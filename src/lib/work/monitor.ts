import tls from "node:tls";
import type { Monitor } from "@/db/schema";
import { FetchBlockedError, guardedLookup, normalizeUrl, safeFetch } from "@/lib/audit/safe-fetch";

export type CheckResult = {
  ok: boolean;
  statusCode: number | null;
  responseMs: number | null;
  error: string | null;
  sslExpiresAt: Date | null;
};

/** Expiry date of the site's HTTPS certificate, or null for http sites and failures. */
export function certificateExpiry(url: string, timeoutMs = 8_000): Promise<Date | null> {
  const parsed = normalizeUrl(url);
  if (parsed.protocol !== "https:") return Promise.resolve(null);
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: parsed.hostname,
      port: Number(parsed.port || 443),
      servername: parsed.hostname,
      lookup: guardedLookup,
      // We want the certificate's dates even when it's already invalid.
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });
    const done = (value: Date | null) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("secureConnect", () => {
      const validTo = socket.getPeerCertificate()?.valid_to;
      done(validTo ? new Date(validTo) : null);
    });
    socket.once("timeout", () => done(null));
    socket.once("error", () => done(null));
  });
}

/** One uptime check: is the site answering, and how fast. */
export async function checkSite(url: string): Promise<CheckResult> {
  const [page, sslExpiresAt] = await Promise.all([
    safeFetch(url, 15_000).then(
      (res) => ({ statusCode: res.status, responseMs: res.responseMs, error: null as string | null }),
      (err: unknown) => ({
        statusCode: null,
        responseMs: null,
        error: err instanceof FetchBlockedError ? "Address not allowed" : err instanceof Error ? err.message : "Unknown error",
      }),
    ),
    certificateExpiry(url).catch(() => null),
  ]);
  const ok = page.statusCode !== null && page.statusCode < 400;
  return {
    ok,
    statusCode: page.statusCode,
    responseMs: page.responseMs,
    error: page.error ?? (ok ? null : `HTTP ${page.statusCode}`),
    sslExpiresAt,
  };
}

/** How many failed checks in a row count as "down". One blip isn't worth waking anyone. */
export const DOWN_AFTER_FAILURES = 2;
/** Warn this many days before the HTTPS certificate expires. */
export const SSL_WARNING_DAYS = 14;

export type Incident = { start: Date; end: Date | null; minutes: number };

export type Summary = {
  checks: number;
  uptimePct: number | null;
  avgResponseMs: number | null;
  incidents: Incident[];
};

/**
 * Uptime summary over a window. An incident is DOWN_AFTER_FAILURES or more failed
 * checks in a row; isolated failures still count against uptime.
 */
export function summarize(checks: { ok: boolean; responseMs: number | null; checkedAt: Date }[], now = new Date()): Summary {
  const sorted = [...checks].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  if (sorted.length === 0) return { checks: 0, uptimePct: null, avgResponseMs: null, incidents: [] };

  const up = sorted.filter((c) => c.ok);
  const times = up.map((c) => c.responseMs).filter((v): v is number => v !== null);
  const incidents: Incident[] = [];
  let run: typeof sorted = [];
  const close = (end: Date | null) => {
    if (run.length >= DOWN_AFTER_FAILURES) {
      const start = run[0].checkedAt;
      incidents.push({ start, end, minutes: Math.round(((end ?? now).getTime() - start.getTime()) / 60_000) });
    }
    run = [];
  };
  for (const c of sorted) {
    if (!c.ok) run.push(c);
    else if (run.length) close(c.checkedAt);
  }
  if (run.length) close(null);

  return {
    checks: sorted.length,
    uptimePct: Math.round((up.length / sorted.length) * 10_000) / 100,
    avgResponseMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    incidents,
  };
}

export function daysUntil(date: Date, now = new Date()): number {
  return Math.floor((date.getTime() - now.getTime()) / 86_400_000);
}

type Alert = { subject: string; heading: string; body: string };

/**
 * Record one check and work out which alerts it triggers. Pure apart from the
 * timestamps, so the state machine can be tested without the network.
 */
export function nextState(m: Monitor, r: CheckResult, now = new Date()) {
  const host = new URL(m.url).hostname;
  const alerts: Alert[] = [];
  const failures = r.ok ? 0 : m.consecutiveFailures + 1;
  const status = r.ok ? "up" : failures >= DOWN_AFTER_FAILURES ? "down" : m.status === "unknown" ? "unknown" : m.status;
  let downAlertSentAt = m.downAlertSentAt;

  if (status === "down" && !downAlertSentAt) {
    alerts.push({ subject: `${host} is down`, heading: `${host} isn't loading`, body: `The last ${failures} checks failed (${r.error ?? "no response"}). Your client may not know yet.` });
    downAlertSentAt = now;
  }
  if (r.ok && downAlertSentAt) {
    alerts.push({ subject: `${host} is back up`, heading: `${host} is back`, body: `The site is answering again${r.responseMs ? ` (${(r.responseMs / 1000).toFixed(1)}s)` : ""}.` });
    downAlertSentAt = null;
  }

  const sslExpiresAt = r.sslExpiresAt ?? m.sslExpiresAt;
  let sslAlertedFor = m.sslAlertedFor;
  if (sslExpiresAt && daysUntil(sslExpiresAt, now) <= SSL_WARNING_DAYS && sslAlertedFor?.getTime() !== sslExpiresAt.getTime()) {
    const days = daysUntil(sslExpiresAt, now);
    alerts.push({
      subject: `HTTPS certificate for ${host} ${days < 0 ? "has expired" : `expires in ${days} days`}`,
      heading: `${host}'s security certificate ${days < 0 ? "has expired" : "is about to expire"}`,
      body: `When it expires, browsers show visitors a full-page security warning. Renew it ${days < 0 ? "now" : `before ${sslExpiresAt.toDateString()}`}.`,
    });
    sslAlertedFor = sslExpiresAt;
  }

  return {
    update: { status, consecutiveFailures: failures, lastCheckedAt: now, lastResponseMs: r.responseMs, sslExpiresAt, sslAlertedFor, downAlertSentAt },
    alerts,
  };
}

/** "180 ms", "2.4s" */
export function formatResponse(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`;
}
