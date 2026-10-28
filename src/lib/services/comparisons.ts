import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Lead } from "@/db/schema";
import { shortId } from "@/lib/util";
import { auditAndSave, getAudit } from "./audits";

/** Check the finished site and store it next to the audit we pitched with. */
export async function createComparison(userId: string, lead: Lead, url: string): Promise<string> {
  const { id: afterAuditId } = await auditAndSave(url, { createdBy: userId, businessName: lead.name });
  const id = shortId();
  await db.insert(schema.comparisons).values({ id, userId, leadId: lead.id, beforeAuditId: lead.auditId, afterAuditId });
  return id;
}

export async function latestComparison(userId: string, leadId: string) {
  const [c] = await db
    .select()
    .from(schema.comparisons)
    .where(and(eq(schema.comparisons.userId, userId), eq(schema.comparisons.leadId, leadId)))
    .orderBy(desc(schema.comparisons.createdAt))
    .limit(1);
  return c ?? null;
}

export async function publicComparison(id: string) {
  const [row] = await db
    .select({ comparison: schema.comparisons, business: schema.leads.name, freelancer: { name: schema.users.name, email: schema.users.email, portfolioUrl: schema.users.portfolioUrl } })
    .from(schema.comparisons)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.comparisons.leadId))
    .innerJoin(schema.users, eq(schema.users.id, schema.comparisons.userId))
    .where(eq(schema.comparisons.id, id))
    .limit(1);
  if (!row) return null;
  const [before, after] = await Promise.all([
    row.comparison.beforeAuditId ? getAudit(row.comparison.beforeAuditId) : null,
    getAudit(row.comparison.afterAuditId),
  ]);
  if (!after) return null;
  return { ...row, before, after };
}
