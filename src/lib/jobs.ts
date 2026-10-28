import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { deliverLeads } from "@/lib/services/delivery";
import { sendFollowUpDigests } from "@/lib/services/followups";
import { refreshStaleGoogleLeads } from "@/lib/services/google-refresh";
import { runAllMonitors } from "@/lib/services/monitors";

/** Once a day: fresh leads for every user with a search, Google refreshes, then follow-up reminders. */
export async function runDailyJob() {
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

  const followUps = await sendFollowUpDigests();

  return {
    users: users.length,
    delivered,
    failed,
    googleRefreshed: google.refreshed,
    googleRefreshFailed: google.failed,
    followUpEmails: followUps.sent,
  };
}

/** Scheduled jobs by the name used in /api/cron-job/:job. */
export const JOBS = {
  daily: runDailyJob,
  monitors: () => runAllMonitors(),
} as const;

export type JobName = keyof typeof JOBS;

export function isJobName(name: string): name is JobName {
  return Object.hasOwn(JOBS, name);
}
