import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Lead, Message, User } from "@/db/schema";
import { noticeMessage, resendApiBase, sendEmail } from "@/lib/email";
import { addDays } from "@/lib/dates";
import { CHASE_STATUSES } from "@/lib/leads/status";
import {
  addressOf,
  COLD_KINDS,
  isStopRequest,
  MAX_UNANSWERED,
  normalizeEmail,
  replyAddress,
  replyTokenFrom,
  senderName,
  stripQuoted,
  withOptOut,
  type OutgoingKind,
} from "@/lib/outreach/text";
import { limitsFor, today } from "@/lib/plans";
import { appUrl, shortId } from "@/lib/util";

/** The address emails go out from, on a domain verified in Resend. */
function outreachAddress(): string {
  const configured = process.env.OUTREACH_FROM_ADDRESS ?? process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  return addressOf(configured) ?? "onboarding@resend.dev";
}

/** Domain that receives replies (an MX record pointing at Resend). Without it, replies go to the freelancer's own inbox. */
const replyDomain = () => process.env.REPLY_DOMAIN?.trim().toLowerCase() || null;

export async function ensureReplyToken(lead: Lead): Promise<string> {
  if (lead.replyToken) return lead.replyToken;
  const token = shortId(16);
  const [row] = await db
    .update(schema.leads)
    .set({ replyToken: token })
    .where(and(eq(schema.leads.id, lead.id), isNull(schema.leads.replyToken)))
    .returning({ token: schema.leads.replyToken });
  if (row?.token) return row.token;
  const [again] = await db.select({ token: schema.leads.replyToken }).from(schema.leads).where(eq(schema.leads.id, lead.id));
  return again.token!;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const [row] = await db.select({ email: schema.suppressions.email }).from(schema.suppressions).where(eq(schema.suppressions.email, email)).limit(1);
  return !!row;
}

export async function suppress(emails: (string | null | undefined)[], reason: "opt_out" | "bounce" | "complaint") {
  const clean = [...new Set(emails.map((e) => normalizeEmail(e)).filter((e): e is string => !!e))];
  if (clean.length) await db.insert(schema.suppressions).values(clean.map((email) => ({ email, reason }))).onConflictDoNothing();
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: "not_verified" | "invalid_address" | "suppressed" | "opted_out" | "daily_limit" | "too_many_unanswered" | "failed" };

/** Outgoing messages today and cold ones since the business last replied. */
async function sendingCounts(userId: string, leadId: string) {
  const [[sentToday], [lastIn]] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.messages)
      .where(and(eq(schema.messages.userId, userId), eq(schema.messages.direction, "out"), gte(schema.messages.createdAt, new Date(`${today()}T00:00:00Z`)))),
    db
      .select({ at: schema.messages.createdAt })
      .from(schema.messages)
      .where(and(eq(schema.messages.leadId, leadId), eq(schema.messages.direction, "in")))
      .orderBy(desc(schema.messages.createdAt))
      .limit(1),
  ]);
  const [unanswered] = await db
    .select({ n: count() })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.leadId, leadId),
        eq(schema.messages.direction, "out"),
        eq(schema.messages.status, "sent"),
        inArray(schema.messages.kind, [...COLD_KINDS]),
        lastIn ? gte(schema.messages.createdAt, lastIn.at) : undefined,
      ),
    );
  return { sentToday: sentToday.n, unanswered: unanswered.n };
}

/**
 * Send an email from the freelancer to a business, as "Name via Pitchcraft", with replies routed
 * back to this lead. Records the message and moves the lead along the pipeline.
 */
export async function sendToLead(
  user: User,
  lead: Lead,
  input: { kind: OutgoingKind; to: string; subject: string; body: string },
): Promise<SendResult> {
  if (!user.emailVerifiedAt) return { ok: false, reason: "not_verified" };
  const to = normalizeEmail(input.to);
  if (!to) return { ok: false, reason: "invalid_address" };
  if (lead.optedOutAt) return { ok: false, reason: "opted_out" };
  if (await isSuppressed(to)) return { ok: false, reason: "suppressed" };

  const cold = (COLD_KINDS as readonly string[]).includes(input.kind);
  const { sentToday, unanswered } = await sendingCounts(user.id, lead.id);
  if (sentToday >= limitsFor(user).emailsPerDay) return { ok: false, reason: "daily_limit" };
  if (cold && unanswered >= MAX_UNANSWERED) return { ok: false, reason: "too_many_unanswered" };

  const token = await ensureReplyToken(lead);
  const domain = replyDomain();
  const from = `${senderName(user.name)} <${outreachAddress()}>`;
  const body = cold ? withOptOut(input.body, appUrl(`/x/${token}`)) : input.body.trimEnd();
  const lastIn = await lastIncoming(lead.id);

  let providerId: string | null = null;
  let status: "sent" | "failed" = "sent";
  try {
    ({ id: providerId } = await sendEmail({
      from,
      to,
      subject: input.subject,
      text: body,
      replyTo: domain ? replyAddress(token, domain) : user.email,
      headers: lastIn?.messageIdHeader ? { "In-Reply-To": lastIn.messageIdHeader, References: lastIn.messageIdHeader } : undefined,
    }));
  } catch (err) {
    console.error(`Sending to lead ${lead.id} failed`, err);
    status = "failed";
  }

  const [message] = await db
    .insert(schema.messages)
    .values({
      userId: user.id,
      leadId: lead.id,
      direction: "out",
      kind: input.kind,
      fromAddress: from,
      toAddress: to,
      subject: input.subject,
      body,
      status,
      providerId,
    })
    .returning({ id: schema.messages.id });
  if (status === "failed") return { ok: false, reason: "failed" };

  // A first email moves a new lead to "Emailed"; anything still in play gets a reminder in three days.
  const nextStatus = lead.status === "new" ? "sent" : lead.status;
  const chase = input.kind !== "reply" && (CHASE_STATUSES as readonly string[]).includes(nextStatus);
  await db
    .update(schema.leads)
    .set({
      status: nextStatus,
      email: lead.email ?? to,
      followUpOn: chase ? addDays(today(), 3) : nextStatus === lead.status ? lead.followUpOn : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.leads.id, lead.id));
  return { ok: true, messageId: message.id };
}

async function lastIncoming(leadId: string) {
  const [m] = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.leadId, leadId), eq(schema.messages.direction, "in")))
    .orderBy(desc(schema.messages.createdAt))
    .limit(1);
  return m ?? null;
}

export type Incoming = {
  providerId: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  messageIdHeader: string | null;
};

export type ReceiveResult = "stored" | "duplicate" | "unmatched" | "opted_out";

/** A reply from a business. Lands on the lead, updates its status and tells the freelancer. */
export async function receiveReply(email: Incoming): Promise<ReceiveResult> {
  const domain = replyDomain();
  const token = domain ? replyTokenFrom(email.to, domain) : null;
  if (!token) return "unmatched";
  const [row] = await db
    .select({ lead: schema.leads, user: schema.users })
    .from(schema.leads)
    .innerJoin(schema.users, eq(schema.users.id, schema.leads.userId))
    .where(eq(schema.leads.replyToken, token))
    .limit(1);
  if (!row) return "unmatched";
  const { lead, user } = row;

  const [stored] = await db
    .insert(schema.messages)
    .values({
      userId: user.id,
      leadId: lead.id,
      direction: "in",
      kind: "reply",
      fromAddress: email.from.slice(0, 320),
      toAddress: email.to.join(", ").slice(0, 1000),
      subject: email.subject.slice(0, 500) || "(no subject)",
      body: email.text.slice(0, 50_000),
      status: "received",
      providerId: email.providerId,
      messageIdHeader: email.messageIdHeader,
    })
    .onConflictDoNothing()
    .returning({ id: schema.messages.id });
  // Resend retries webhooks; the provider id makes a retry a no-op.
  if (!stored) return "duplicate";

  if (isStopRequest(email.text)) {
    await optOutLead(lead);
    return "opted_out";
  }

  await db
    .update(schema.leads)
    .set({
      status: lead.status === "new" || lead.status === "sent" ? "replied" : lead.status,
      followUpOn: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.leads.id, lead.id));

  try {
    await sendEmail(
      noticeMessage(user.email, `${lead.name} replied`, `${lead.name} replied`, [stripQuoted(email.text).slice(0, 2000)], {
        label: "Reply in Pitchcraft",
        url: appUrl(`/app/leads/${lead.id}#conversation`),
      }),
    );
  } catch (err) {
    console.error("Reply notification failed", err);
  }
  return "stored";
}

/** The business asked to stop: no more email from this freelancer, or from anyone on Pitchcraft. */
export async function optOutLead(lead: Lead) {
  if (lead.optedOutAt) return;
  const sentTo = await db
    .selectDistinct({ to: schema.messages.toAddress })
    .from(schema.messages)
    .where(and(eq(schema.messages.leadId, lead.id), eq(schema.messages.direction, "out")));
  await suppress([lead.email, ...sentTo.map((m) => m.to)], "opt_out");
  await db
    .update(schema.leads)
    .set({ optedOutAt: new Date(), status: "lost", followUpOn: null, updatedAt: new Date() })
    .where(eq(schema.leads.id, lead.id));
}

export async function leadByReplyToken(token: string) {
  if (!/^[a-z0-9]{6,40}$/.test(token)) return null;
  const [row] = await db
    .select({ lead: schema.leads, freelancer: schema.users.name })
    .from(schema.leads)
    .innerJoin(schema.users, eq(schema.users.id, schema.leads.userId))
    .where(eq(schema.leads.replyToken, token))
    .limit(1);
  return row ?? null;
}

/** A bounce or spam complaint: never email that address again, from anyone. */
export async function handleDeliveryProblem(providerId: string | null, to: string[], kind: "bounce" | "complaint") {
  if (providerId) {
    await db.update(schema.messages).set({ status: "bounced" }).where(eq(schema.messages.providerId, providerId));
  }
  await suppress(to, kind);
}

/** Fetch a received email's body from Resend; the webhook only carries metadata. */
export async function fetchReceivedEmail(emailId: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch(`${resendApiBase()}/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend receiving lookup failed (${res.status})`);
  return (await res.json()) as {
    from?: string;
    to?: string[] | string;
    subject?: string;
    text?: string | null;
    html?: string | null;
    headers?: Record<string, string>;
    message_id?: string;
  };
}

export function conversation(userId: string, leadId: string): Promise<Message[]> {
  return db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.userId, userId), eq(schema.messages.leadId, leadId)))
    .orderBy(schema.messages.createdAt);
}

export async function markRead(userId: string, leadId: string) {
  await db
    .update(schema.messages)
    .set({ readAt: new Date() })
    .where(and(eq(schema.messages.userId, userId), eq(schema.messages.leadId, leadId), eq(schema.messages.direction, "in"), isNull(schema.messages.readAt)));
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.messages)
    .where(and(eq(schema.messages.userId, userId), eq(schema.messages.direction, "in"), isNull(schema.messages.readAt)));
  return row.n;
}

/** Latest message per business, newest conversation first. */
export async function inbox(userId: string) {
  const rows = await db
    .selectDistinctOn([schema.messages.leadId], {
      message: schema.messages,
      lead: { id: schema.leads.id, name: schema.leads.name, status: schema.leads.status },
      unread: sql<number>`(select count(*)::int from messages m where m.lead_id = ${schema.messages.leadId} and m.direction = 'in' and m.read_at is null)`,
    })
    .from(schema.messages)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.messages.leadId))
    .where(eq(schema.messages.userId, userId))
    .orderBy(schema.messages.leadId, desc(schema.messages.createdAt));
  return rows.sort((a, b) => b.message.createdAt.getTime() - a.message.createdAt.getTime());
}
