import { timingSafeEqual } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { deliverLeads } from "@/lib/services/delivery";
import { refreshStaleGoogleLeads } from "@/lib/services/google-refresh";

export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Called once a day (see vercel.json) to deliver fresh leads to every user with a search. */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const searches = await db
    .select({ userId: schema.searches.userId })
    .from(schema.searches)
    .where(eq(schema.searches.active, true));
  const userIds = [...new Set(searches.map((s) => s.userId))];
  const users = userIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, userIds)) : [];

  let delivered = 0;
  let failed = 0;
  // One user at a time: OpenStreetMap asks for gentle usage, and it keeps Google spend predictable.
  for (const user of users) {
    try {
      delivered += (await deliverLeads(user)).delivered;
    } catch (err) {
      console.error(`Daily leads failed for ${user.id}`, err);
      failed++;
    }
  }

  // Google Places content may only be cached for 30 days.
  const google = process.env.GOOGLE_MAPS_API_KEY ? await refreshStaleGoogleLeads() : { refreshed: 0, failed: 0 };

  return Response.json({ users: users.length, delivered, failed, googleRefreshed: google.refreshed, googleRefreshFailed: google.failed });
}
