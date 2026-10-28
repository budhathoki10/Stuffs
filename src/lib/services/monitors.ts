import "server-only";
import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Monitor, User } from "@/db/schema";
import { normalizeUrl } from "@/lib/audit/safe-fetch";
import { noticeMessage, sendEmail } from "@/lib/email";
import { limitsFor } from "@/lib/plans";
import { appUrl, shortId } from "@/lib/util";
import { checkSite, daysUntil, DOWN_AFTER_FAILURES, SSL_WARNING_DAYS, summarize, type CheckResult } from "@/lib/work/monitor";

const KEEP_CHECKS_DAYS = 90;

export async function monitorForLead(userId: string, leadId: string): Promise<Monitor | null> {
  const [m] = await db
    .select()
    .from(schema.monitors)
    .where(and(eq(schema.monitors.userId, userId), eq(schema.monitors.leadId, leadId)))
    .limit(1);
  return m ?? null;
}

export type CreateMonitorResult = { ok: true; id: string } | { ok: false; reason: "limit_reached" | "exists" };

/** Start watching a client's site. Throws FetchBlockedError/TypeError for URLs we won't fetch. */
export async function createMonitor(user: User, leadId: string, url: string): Promise<CreateMonitorResult> {
  const normalized = normalizeUrl(url).toString();
  const [{ n }] = await db.select({ n: count() }).from(schema.monitors).where(eq(schema.monitors.userId, user.id));
  if (n >= limitsFor(user).monitors) return { ok: false, reason: "limit_reached" };
  const id = shortId();
  const rows = await db
    .insert(schema.monitors)
    .values({ id, userId: user.id, leadId, url: normalized })
    .onConflictDoNothing()
    .returning({ id: schema.monitors.id });
  return rows.length ? { ok: true, id } : { ok: false, reason: "exists" };
}

export async function setMonitorActive(userId: string, id: string, active: boolean) {
  await db.update(schema.monitors).set({ active }).where(and(eq(schema.monitors.id, id), eq(schema.monitors.userId, userId)));
}

export async function deleteMonitor(userId: string, id: string) {
  await db.delete(schema.monitors).where(and(eq(schema.monitors.id, id), eq(schema.monitors.userId, userId)));
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

export async function runMonitor(m: Monitor, freelancerEmail: string, check: (url: string) => Promise<CheckResult> = checkSite) {
  const result = await check(m.url);
  const now = new Date();
  await db.insert(schema.monitorChecks).values({
    monitorId: m.id,
    checkedAt: now,
    ok: result.ok,
    statusCode: result.statusCode,
    responseMs: result.responseMs,
    error: result.error,
  });
  const { update, alerts } = nextState(m, result, now);
  await db.update(schema.monitors).set(update).where(eq(schema.monitors.id, m.id));
  for (const a of alerts) {
    try {
      await sendEmail(noticeMessage(freelancerEmail, a.subject, a.heading, [a.body], { label: "Open the client", url: appUrl(`/app/leads/${m.leadId}/care`) }));
    } catch (err) {
      console.error("Monitor alert email failed", err);
    }
  }
  return { result, alerts: alerts.length };
}

/** Check every active monitor a few at a time, then drop old history. */
export async function runAllMonitors(concurrency = 5) {
  const rows = await db
    .select({ monitor: schema.monitors, email: schema.users.email })
    .from(schema.monitors)
    .innerJoin(schema.users, eq(schema.users.id, schema.monitors.userId))
    .where(eq(schema.monitors.active, true))
    .orderBy(asc(schema.monitors.lastCheckedAt));
  let next = 0;
  let down = 0;
  let failed = 0;
  const workers = Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (next < rows.length) {
      const { monitor, email } = rows[next++];
      try {
        const { result } = await runMonitor(monitor, email);
        if (!result.ok) down++;
      } catch (err) {
        console.error(`Monitor ${monitor.id} failed`, err);
        failed++;
      }
    }
  });
  await Promise.all(workers);
  await db.delete(schema.monitorChecks).where(lt(schema.monitorChecks.checkedAt, new Date(Date.now() - KEEP_CHECKS_DAYS * 86_400_000)));
  return { checked: rows.length, down, failed };
}

/** Client-facing health report for the last `days` days. */
export async function monitorReport(id: string, days = 30) {
  const [row] = await db
    .select({
      monitor: schema.monitors,
      business: schema.leads.name,
      freelancer: { name: schema.users.name, email: schema.users.email, portfolioUrl: schema.users.portfolioUrl },
    })
    .from(schema.monitors)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.monitors.leadId))
    .innerJoin(schema.users, eq(schema.users.id, schema.monitors.userId))
    .where(eq(schema.monitors.id, id))
    .limit(1);
  if (!row) return null;
  const since = new Date(Date.now() - days * 86_400_000);
  const checks = await db
    .select({ ok: schema.monitorChecks.ok, responseMs: schema.monitorChecks.responseMs, checkedAt: schema.monitorChecks.checkedAt })
    .from(schema.monitorChecks)
    .where(and(eq(schema.monitorChecks.monitorId, id), gte(schema.monitorChecks.checkedAt, since)));
  return { ...row, days, summary: summarize(checks) };
}
