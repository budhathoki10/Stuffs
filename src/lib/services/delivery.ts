import "server-only";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { runAudit } from "@/lib/audit";
import type { AuditResult } from "@/lib/audit/types";
import { leadProvider, type Business } from "@/lib/leads";
import { opportunityScore } from "@/lib/leads/rank";
import { limitsFor, today, weekStart } from "@/lib/plans";
import { isSkill } from "@/lib/skills";
import { saveAudit } from "./audits";

export type DeliveryResult =
  | { delivered: number; reason: "ok" }
  | { delivered: 0; reason: "no_search" | "limit_reached" | "no_new_businesses" };

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function deliveredSince(userId: string, since: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.leads)
    .where(and(eq(schema.leads.userId, userId), gte(schema.leads.deliveredOn, since)));
  return row.n;
}

export async function activeSearch(userId: string) {
  const [search] = await db
    .select()
    .from(schema.searches)
    .where(and(eq(schema.searches.userId, userId), eq(schema.searches.active, true)))
    .orderBy(desc(schema.searches.createdAt))
    .limit(1);
  return search ?? null;
}

/** Find, audit, rank and store today's leads for one user, within plan limits. */
export async function deliverLeads(user: User, now = new Date()): Promise<DeliveryResult> {
  const search = await activeSearch(user.id);
  if (!search) return { delivered: 0, reason: "no_search" };

  const limits = limitsFor(user);
  const day = today(now);
  const remaining = Math.min(
    limits.leadsPerDay - (await deliveredSince(user.id, day)),
    limits.leadsPerWeek - (await deliveredSince(user.id, weekStart(now))),
  );
  if (remaining <= 0) return { delivered: 0, reason: "limit_reached" };

  const businesses = await leadProvider().findBusinesses({
    niche: search.niche,
    lat: search.lat,
    lon: search.lon,
    radiusKm: search.radiusKm,
  });
  const existing = await db
    .select({ source: schema.leads.source, sourceId: schema.leads.sourceId })
    .from(schema.leads)
    .where(eq(schema.leads.userId, user.id));
  const seen = new Set(existing.map((l) => `${l.source}:${l.sourceId}`));
  const fresh = businesses.filter((b) => !seen.has(`${b.source}:${b.sourceId}`));
  if (fresh.length === 0) return { delivered: 0, reason: "no_new_businesses" };

  // Audit a pool a bit larger than needed, then keep the best opportunities.
  const pool = fresh.slice(0, Math.min(fresh.length, remaining * 3, 15));
  const skill = isSkill(user.skill) ? user.skill : "web_dev";
  const audited = await mapLimit(pool, 4, async (business: Business) => {
    let audit: AuditResult | null = null;
    if (business.website) {
      try {
        audit = await runAudit(business.website, { pageSpeed: false });
      } catch {
        audit = null; // Blocked URL (e.g. private address): treat as no usable site.
      }
    }
    const opportunity = opportunityScore(skill, audit?.score ?? null, audit?.checks ?? null);
    return { business, audit, opportunity };
  });

  const chosen = audited.sort((a, b) => b.opportunity - a.opportunity).slice(0, remaining);
  for (const { business, audit, opportunity } of chosen) {
    const auditId = audit ? await saveAudit(audit, { createdBy: user.id, businessName: business.name }) : null;
    await db
      .insert(schema.leads)
      .values({
        userId: user.id,
        searchId: search.id,
        source: business.source,
        sourceId: business.sourceId,
        name: business.name,
        category: business.category,
        address: business.address,
        website: business.website,
        phone: business.phone ?? audit?.metrics.phones[0] ?? null,
        email: business.email ?? audit?.metrics.emails[0] ?? null,
        lat: business.lat,
        lon: business.lon,
        auditId,
        opportunity,
        deliveredOn: day,
      })
      .onConflictDoNothing();
  }
  return { delivered: chosen.length, reason: "ok" };
}
