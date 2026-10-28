import "server-only";
import { and, asc, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Lead } from "@/db/schema";
import { placeDetails, toBusiness } from "@/lib/leads/google";

/** Refresh a day early so nothing is ever older than Google's 30-day limit. */
export const GOOGLE_MAX_AGE_MS = 29 * 86_400_000;

export function needsRefresh(lead: Pick<Lead, "source" | "detailsFetchedAt">, now = new Date()): boolean {
  return lead.source === "google" && now.getTime() - lead.detailsFetchedAt.getTime() > GOOGLE_MAX_AGE_MS;
}

/**
 * Re-fetch a Google lead's details. If Google no longer knows the place, the cached
 * content is cleared and only the name and the user's own notes are kept.
 */
export async function refreshGoogleLead(lead: Lead): Promise<void> {
  const place = await placeDetails(lead.sourceId);
  const fresh = place ? toBusiness(place, lead.category) : null;
  await db
    .update(schema.leads)
    .set({
      name: fresh?.name ?? lead.name,
      address: fresh?.address ?? null,
      website: fresh?.website ?? null,
      phone: fresh?.phone ?? null,
      lat: fresh?.lat ?? null,
      lon: fresh?.lon ?? null,
      detailsFetchedAt: new Date(),
    })
    .where(eq(schema.leads.id, lead.id));
}

/** Refresh the oldest stale Google leads. Run daily; `limit` caps the Place Details spend. */
export async function refreshStaleGoogleLeads(limit = 200, now = new Date()): Promise<{ refreshed: number; failed: number }> {
  const stale = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.source, "google"), lt(schema.leads.detailsFetchedAt, new Date(now.getTime() - GOOGLE_MAX_AGE_MS))))
    .orderBy(asc(schema.leads.detailsFetchedAt))
    .limit(limit);
  let refreshed = 0;
  let failed = 0;
  for (const lead of stale) {
    try {
      await refreshGoogleLead(lead);
      refreshed++;
    } catch (err) {
      console.error(`Refreshing Google lead ${lead.id} failed`, err);
      failed++;
    }
  }
  return { refreshed, failed };
}
