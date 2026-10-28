import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export async function listLeads(userId: string) {
  return db
    .select({
      lead: schema.leads,
      auditScore: schema.audits.score,
    })
    .from(schema.leads)
    .leftJoin(schema.audits, eq(schema.audits.id, schema.leads.auditId))
    .where(eq(schema.leads.userId, userId))
    .orderBy(desc(schema.leads.deliveredOn), desc(schema.leads.opportunity), schema.leads.name);
}

export async function getLeadWithAudit(userId: string, leadId: string) {
  const [row] = await db
    .select({ lead: schema.leads, audit: schema.audits })
    .from(schema.leads)
    .leftJoin(schema.audits, eq(schema.audits.id, schema.leads.auditId))
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function latestPitch(userId: string, leadId: string) {
  const [pitch] = await db
    .select()
    .from(schema.pitches)
    .where(and(eq(schema.pitches.userId, userId), eq(schema.pitches.leadId, leadId)))
    .orderBy(desc(schema.pitches.createdAt))
    .limit(1);
  return pitch ?? null;
}

export async function getStats(userId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      contacted: sql<number>`count(*) filter (where ${schema.leads.status} <> 'new')::int`,
      replied: sql<number>`count(*) filter (where ${schema.leads.status} in ('replied','call','won'))::int`,
      won: sql<number>`count(*) filter (where ${schema.leads.status} = 'won')::int`,
      earnedCents: sql<number>`coalesce(sum(${schema.leads.wonAmountCents}) filter (where ${schema.leads.status} = 'won'), 0)::bigint`,
    })
    .from(schema.leads)
    .where(eq(schema.leads.userId, userId));
  return { ...row, earnedCents: Number(row.earnedCents) };
}
