import dns from "node:dns";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { analyzePage, extractEmails, scoreChecks, topIssues } from "@/lib/audit/analyze";
import { runAudit } from "@/lib/audit";
import { FetchBlockedError, isPrivateAddress, normalizeUrl, safeFetch } from "@/lib/audit/safe-fetch";

const fixture = (name: string) => readFileSync(`e2e/fixture-sites/${name}`, "utf8");
const NOW = new Date("2026-10-28T00:00:00Z");

function page(html: string, overrides: Partial<Parameters<typeof analyzePage>[0]> = {}) {
  return { status: 200, finalUrl: "https://example.com/", html, bytes: html.length, responseMs: 400, redirects: 0, ...overrides };
}

describe("analyzePage", () => {
  it("passes a well-built site", () => {
    const { checks, metrics } = analyzePage(page(fixture("good.html")), NOW);
    const failed = checks.filter((c) => !c.passed).map((c) => c.id);
    expect(failed).toEqual([]);
    expect(scoreChecks(checks)).toBe(100);
    expect(metrics.emails).toEqual(["hello@summit.test"]);
    expect(metrics.phones).toEqual(["+15550103"]);
    expect(metrics.copyrightYear).toBe(2026);
  });

  it("finds the problems on an old site", () => {
    const { checks, metrics } = analyzePage(page(fixture("old.html"), { finalUrl: "http://maple.test/" }), NOW);
    const failed = new Set(checks.filter((c) => !c.passed).map((c) => c.id));
    for (const id of ["https", "mobile", "title", "description", "h1", "alt", "contact", "fresh", "booking"]) {
      expect(failed, id).toContain(id);
    }
    expect(metrics.copyrightYear).toBe(2017);
    expect(metrics.emails).toEqual(["owner.maple@mail.test"]);
    const score = scoreChecks(checks);
    expect(score).toBeLessThan(30);
    expect(topIssues(checks)[0].severity).toBe("critical");
  });

  it("flags slow responses", () => {
    const { checks } = analyzePage(page(fixture("good.html"), { responseMs: 4200 }), NOW);
    expect(checks.find((c) => c.id === "speed")).toMatchObject({ passed: false, detail: expect.stringContaining("4.2s") });
  });
});

describe("extractEmails", () => {
  it("ignores image names and placeholder domains", () => {
    const html = 'logo@2x.png info@example.com real@biz.np <a href="mailto:Boss@Biz.np?subject=hi">x</a>';
    expect(extractEmails(html, ["mailto:Boss@Biz.np?subject=hi"])).toEqual(["boss@biz.np", "real@biz.np"]);
  });
});

describe("SSRF protection", () => {
  it.each([
    ["127.0.0.1", true],
    ["10.1.2.3", true],
    ["172.20.0.1", true],
    ["192.168.1.1", true],
    ["169.254.169.254", true],
    ["100.64.0.1", true],
    ["::1", true],
    ["fd00::1", true],
    ["::ffff:127.0.0.1", true],
    ["8.8.8.8", false],
    ["2606:4700::1111", false],
  ])("isPrivateAddress(%s) = %s", (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });

  it("normalizes bare domains to https", () => {
    expect(normalizeUrl("example.com/path#x").toString()).toBe("https://example.com/path");
  });

  it.each(["http://localhost:3000", "http://10.0.0.5/", "ftp://example.com", "https://user:pw@example.com", "http://example.com:8080", "http://[::1]/"])(
    "blocks %s",
    (url) => {
      expect(() => normalizeUrl(url)).toThrow(FetchBlockedError);
    },
  );

  it("blocks public-looking hostnames that resolve to private addresses at connect time", async () => {
    // Simulates DNS rebinding: the name passes URL checks but resolves to an internal IP.
    const spy = vi.spyOn(dns, "lookup").mockImplementation(((_host: string, _opts: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [{ address: "10.0.0.5", family: 4 }])) as unknown as typeof dns.lookup);
    try {
      await expect(safeFetch("http://rebind.example/")).rejects.toBeInstanceOf(FetchBlockedError);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("safeFetch and runAudit against a local server", () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    process.env.AUDIT_ALLOW_PRIVATE_HOSTS = "1";
    process.env.PAGESPEED_DISABLED = "1";
    server = http.createServer((req, res) => {
      if (req.url === "/hop") {
        res.writeHead(302, { location: "/page" });
        return res.end();
      }
      if (req.url === "/page") {
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(fixture("good.html"));
      }
      res.writeHead(500);
      res.end("boom");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    delete process.env.AUDIT_ALLOW_PRIVATE_HOSTS;
    server.close();
  });

  it("follows redirects", async () => {
    const res = await safeFetch(`${base}/hop`);
    expect(res.status).toBe(200);
    expect(res.redirects).toBe(1);
    expect(res.finalUrl).toBe(`${base}/page`);
  });

  it("scores an erroring site 0 instead of throwing", async () => {
    const result = await runAudit(`${base}/error`);
    expect(result.score).toBe(0);
    expect(result.checks[0].id).toBe("reachable");
  });

  it("audits a working site", async () => {
    const result = await runAudit(`${base}/page`);
    // Served over plain http, so only the HTTPS check fails.
    expect(result.checks.filter((c) => !c.passed).map((c) => c.id)).toEqual(["https"]);
    expect(result.score).toBe(75);
  });

  it("refuses private hosts when the override is off", async () => {
    process.env.AUDIT_ALLOW_PRIVATE_HOSTS = "0";
    try {
      await expect(runAudit(`${base}/page`)).rejects.toBeInstanceOf(FetchBlockedError);
    } finally {
      process.env.AUDIT_ALLOW_PRIVATE_HOSTS = "1";
    }
  });
});
