import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { runAudit } from "@/lib/audit";
import type { AuditResult } from "@/lib/audit/types";
import { shortId } from "@/lib/util";

export const ANON_AUDITS_PER_HOUR = 5;
export const ANON_PITCHES_PER_HOUR = 3;

export async function anonymousAuditsLastHour(ipHash: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.audits)
    .where(and(eq(schema.audits.ipHash, ipHash), gt(schema.audits.createdAt, new Date(Date.now() - 3_600_000))));
  return row.n;
}

export async function anonymousPitchesLastHour(ipHash: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.pitches)
    .where(and(eq(schema.pitches.ipHash, ipHash), gt(schema.pitches.createdAt, new Date(Date.now() - 3_600_000))));
  return row.n;
}

export async function saveAudit(
  result: AuditResult,
  meta: { createdBy?: string | null; ipHash?: string | null; businessName?: string | null },
): Promise<string> {
  const id = shortId();
  await db.insert(schema.audits).values({
    id,
    url: result.url,
    finalUrl: result.finalUrl,
    score: result.score,
    checks: result.checks,
    metrics: result.metrics,
    businessName: meta.businessName ?? null,
    createdBy: meta.createdBy ?? null,
    ipHash: meta.ipHash ?? null,
  });
  return id;
}

export async function auditAndSave(
  url: string,
  meta: { createdBy?: string | null; ipHash?: string | null; businessName?: string | null; pageSpeed?: boolean },
): Promise<{ id: string; result: AuditResult }> {
  const result = await runAudit(url, { pageSpeed: meta.pageSpeed });
  const id = await saveAudit(result, meta);
  return { id, result };
}

export async function getAudit(id: string) {
  const [audit] = await db.select().from(schema.audits).where(eq(schema.audits.id, id)).limit(1);
  return audit ?? null;
}
