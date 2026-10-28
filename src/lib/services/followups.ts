import "server-only";
import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { noticeMessage, sendEmail } from "@/lib/email";
import { CHASE_STATUSES } from "@/lib/leads/status";
import { today } from "@/lib/plans";
import { appUrl } from "@/lib/util";

export { CHASE_STATUSES };

export function dueFollowUps(userId: string, day = today()) {
  return db
    .select()
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.userId, userId),
        isNotNull(schema.leads.followUpOn),
        lte(schema.leads.followUpOn, day),
        inArray(schema.leads.status, [...CHASE_STATUSES]),
      ),
    )
    .orderBy(asc(schema.leads.followUpOn));
}

export async function setFollowUp(userId: string, leadId: string, day: string | null) {
  await db
    .update(schema.leads)
    .set({ followUpOn: day, updatedAt: new Date() })
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.userId, userId)));
}

/** One email per freelancer listing everyone to chase today. Run from the daily job. */
export async function sendFollowUpDigests(day = today()) {
  const rows = await db
    .select({ lead: schema.leads, email: schema.users.email })
    .from(schema.leads)
    .innerJoin(schema.users, eq(schema.users.id, schema.leads.userId))
    .where(and(isNotNull(schema.leads.followUpOn), lte(schema.leads.followUpOn, day), inArray(schema.leads.status, [...CHASE_STATUSES])));
  const byUser = new Map<string, string[]>();
  for (const r of rows) byUser.set(r.email, [...(byUser.get(r.email) ?? []), r.lead.name]);
  let sent = 0;
  for (const [email, names] of byUser) {
    try {
      await sendEmail(
        noticeMessage(
          email,
          names.length === 1 ? `Follow up with ${names[0]} today` : `${names.length} businesses to follow up with today`,
          "Today's follow-ups",
          [names.map((n) => `• ${n}`).join("\n"), "A short, friendly nudge a few days after the first email wins a surprising number of replies."],
          { label: "Open Pitchcraft", url: appUrl("/app") },
        ),
      );
      sent++;
    } catch (err) {
      console.error("Follow-up digest failed", err);
    }
  }
  return { sent };
}
