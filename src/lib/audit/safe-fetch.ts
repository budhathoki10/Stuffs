import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import type { LookupFunction } from "node:net";

export class FetchBlockedError extends Error {}

export type SafeResponse = {
  status: number;
  finalUrl: string;
  redirects: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  bytes: number;
  responseMs: number;
};

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/** True for loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

function allowPrivate() {
  return process.env.AUDIT_ALLOW_PRIVATE_HOSTS === "1";
}

/**
 * DNS lookup that refuses private addresses. It runs at connect time, so a
 * hostname that re-resolves to an internal IP (DNS rebinding) is still blocked.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    if (!allowPrivate() && list.some((a) => isPrivateAddress(a.address))) {
      return callback(new FetchBlockedError(`Blocked private address for ${hostname}`), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
    throw new FetchBlockedError("Only http and https URLs can be audited");
  }
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchBlockedError("Only http and https URLs can be audited");
  }
  if (url.username || url.password) throw new FetchBlockedError("URLs with credentials are not allowed");
  if (!allowPrivate()) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
      throw new FetchBlockedError("Local addresses cannot be audited");
    }
    if (net.isIP(host) && isPrivateAddress(host)) throw new FetchBlockedError("Private addresses cannot be audited");
  }
  if (url.port && !["80", "443", ""].includes(url.port) && !allowPrivate()) {
    throw new FetchBlockedError("Only standard web ports can be audited");
  }
  url.hash = "";
  return url;
}

function requestOnce(url: URL, timeoutMs: number): Promise<Omit<SafeResponse, "finalUrl" | "redirects" | "responseMs">> {
  const mod = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: {
          "user-agent": "PitchcraftAudit/1.0 (+website health check)",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "accept-encoding": "identity",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes <= MAX_BYTES) chunks.push(chunk);
          else res.destroy();
        });
        res.on("close", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
            bytes,
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** GET a public web page, following redirects and re-validating every hop. */
export async function safeFetch(input: string, timeoutMs = 10_000): Promise<SafeResponse> {
  let url = normalizeUrl(input);
  const started = Date.now();
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const res = await requestOnce(url, timeoutMs);
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && location) {
      url = normalizeUrl(new URL(location, url).toString());
      continue;
    }
    return { ...res, finalUrl: url.toString(), redirects, responseMs: Date.now() - started };
  }
  throw new Error("Too many redirects");
}
