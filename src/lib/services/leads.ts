import "server-only";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { topIssues } from "@/lib/audit/analyze";
import { PROBLEM_SHORT } from "@/lib/audit/problems";
import type { AuditCheck } from "@/lib/audit/types";

function shortProblem(checks: AuditCheck[] | null): string | null {
  const top = checks ? topIssues(checks, 1)[0] : undefined;
  return top ? (PROBLEM_SHORT[top.id] ?? top.label) : null;
}

export type LeadRow = Awaited<ReturnType<typeof listLeads>>[number];

/** All of a user's leads with their site score and the single most serious problem found. */
export async function listLeads(userId: string) {
  const rows = await db
    .select({
      lead: schema.leads,
      auditScore: schema.audits.score,
      checks: schema.audits.checks,
    })
    .from(schema.leads)
    .leftJoin(schema.audits, eq(schema.audits.id, schema.leads.auditId))
    .where(eq(schema.leads.userId, userId))
    .orderBy(desc(schema.leads.deliveredOn), desc(schema.leads.opportunity), schema.leads.name);
  return rows.map(({ lead, auditScore, checks }) => ({
    lead,
    auditScore,
    topProblem: lead.website ? shortProblem(checks) : PROBLEM_SHORT.website,
  }));
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
    })
    .from(schema.leads)
    .where(eq(schema.leads.userId, userId));
  // Projects can be priced in different currencies, so earnings are totalled per currency.
  const earned = await db
    .select({ currency: schema.leads.currency, amountMinor: sql<number>`sum(${schema.leads.wonAmountCents})::bigint` })
    .from(schema.leads)
    .where(and(eq(schema.leads.userId, userId), eq(schema.leads.status, "won"), isNotNull(schema.leads.wonAmountCents)))
    .groupBy(schema.leads.currency)
    .orderBy(schema.leads.currency);
  return { ...row, earned: earned.map((e) => ({ currency: e.currency, amountMinor: Number(e.amountMinor) })) };
}

/** The lead, only if it belongs to this user. Every workspace action goes through this. */
export async function ownedLead(userId: string, leadId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return null;
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.userId, userId)))
    .limit(1);
  return lead ?? null;
}
