import { timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { deliverLeads } from "@/lib/services/delivery";

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
  if (userIds.length === 0) return Response.json({ users: 0, delivered: 0 });

  const users = await db.select().from(schema.users).where(and(inArray(schema.users.id, userIds)));
  let delivered = 0;
  const failures: string[] = [];
  // Sequential on purpose: OpenStreetMap's public servers ask for gentle usage.
  for (const user of users) {
    try {
      delivered += (await deliverLeads(user)).delivered;
    } catch (err) {
      console.error(`Daily leads failed for ${user.id}`, err);
      failures.push(user.id);
    }
  }
  return Response.json({ users: users.length, delivered, failed: failures.length });
}
