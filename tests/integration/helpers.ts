import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { shortId } from "@/lib/util";

export async function resetDb() {
  await db.execute(sql`truncate users, sessions, auth_tokens, searches, audits, leads, pitches, payments, quotes, sites, site_messages, comparisons, monitors, monitor_checks, invoices, messages, suppressions cascade`);
}

export async function makeUser(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
  const [user] = await db
    .insert(schema.users)
    .values({ email: `${shortId()}@example.com`, name: "Test User", passwordHash: "scrypt$00$00", ...overrides })
    .returning();
  return user;
}

export async function makeSearch(userId: string, niche = "dentist") {
  const [search] = await db
    .insert(schema.searches)
    .values({ userId, niche, location: "Kathmandu, Nepal", lat: 27.7172, lon: 85.324, radiusKm: 10 })
    .returning();
  return search;
}

export const DAY = 86_400_000;
// A Wednesday, so day+1 and day+2 stay in the same Monday-based week.
export const WEDNESDAY = new Date("2026-10-28T09:00:00Z");
