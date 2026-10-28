"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { isOutgoingKind } from "@/lib/outreach/text";
import { limitsFor } from "@/lib/plans";
import { ownedLead } from "@/lib/services/leads";
import { leadByReplyToken, markRead, optOutLead, sendToLead } from "@/lib/services/outreach";
import { markQuoteSent } from "@/lib/services/quotes";

export type SendState = { error?: string; success?: string; sentAt?: number } | undefined;

const SendForm = z.object({
  to: z.string().trim().min(1, "Who should it go to? Add their email address."),
  subject: z.string().trim().min(1, "Add a subject line.").max(200, "Keep the subject under 200 characters."),
  body: z.string().trim().min(1, "The email is empty.").max(10_000, "That's too long for an email. Trim it a little."),
});

export async function sendMessage(_: SendState, formData: FormData): Promise<SendState> {
  const user = await requireUser();
  const lead = await ownedLead(user.id, String(formData.get("leadId") ?? ""));
  if (!lead) return { error: "Lead not found." };
  const kind = formData.get("kind");
  if (!isOutgoingKind(kind)) return { error: "Unknown kind of email." };
  const parsed = SendForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await sendToLead(user, lead, { kind, ...parsed.data });
  if (!result.ok) {
    const errors: Record<typeof result.reason, string> = {
      not_verified: "Confirm your email address first: use the link we sent you, or “Send it again” at the top of the page. It keeps everyone's emails out of spam.",
      invalid_address: "That email address doesn't look right.",
      suppressed: "This address has asked not to be emailed, or bounced before. Try calling them instead.",
      opted_out: "They asked not to be emailed again.",
      daily_limit: `That's ${limitsFor(user).emailsPerDay} emails today, the daily limit on your plan. It resets at midnight UTC.`,
      too_many_unanswered: "You've emailed them 3 times without a reply. Try calling, or spend the time on a fresh lead.",
      failed: "The email didn't go out. Try again in a minute.",
    };
    return { error: errors[result.reason] };
  }

  const quoteId = formData.get("quoteId");
  if (kind === "quote" && typeof quoteId === "string") await markQuoteSent(user.id, quoteId);
  revalidatePath(`/app/leads/${lead.id}`, "layout");
  revalidatePath("/app/inbox");
  return { success: `Sent to ${parsed.data.to}.`, sentAt: Date.now() };
}

export async function markConversationRead(leadId: string) {
  const user = await requireUser();
  if (typeof leadId !== "string" || !(await ownedLead(user.id, leadId))) return;
  await markRead(user.id, leadId);
  revalidatePath("/app", "layout");
}

/** Public: the business clicked the opt-out link at the bottom of an email. */
export async function confirmOptOut(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const row = await leadByReplyToken(token);
  if (row) await optOutLead(row.lead);
  redirect(`/x/${encodeURIComponent(token)}?done=1`);
}
