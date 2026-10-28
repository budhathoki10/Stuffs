import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Lead, Quote, User } from "@/db/schema";
import { addDays } from "@/lib/dates";
import { noticeMessage, sendEmail } from "@/lib/email";
import { today } from "@/lib/plans";
import { appUrl, formatMoney, shortId } from "@/lib/util";
import { lineItemsTotal, type Currency, type LineItem } from "@/lib/work/types";

export const QUOTE_VALID_DAYS = 14;

export async function quoteForLead(userId: string, leadId: string): Promise<Quote | null> {
  const [q] = await db
    .select()
    .from(schema.quotes)
    .where(and(eq(schema.quotes.userId, userId), eq(schema.quotes.leadId, leadId)))
    .orderBy(desc(schema.quotes.createdAt))
    .limit(1);
  return q ?? null;
}

export async function createQuote(user: User, lead: Lead, currency: Currency, items: LineItem[]): Promise<string> {
  const id = shortId();
  await db.insert(schema.quotes).values({
    id,
    userId: user.id,
    leadId: lead.id,
    currency,
    items,
    validUntil: addDays(today(), QUOTE_VALID_DAYS),
  });
  return id;
}

/** Edit a quote the client hasn't answered yet. Returns false if it's already been answered. */
export async function updateQuote(
  userId: string,
  quoteId: string,
  data: { currency: Currency; items: LineItem[]; note: string | null; validUntil: string },
): Promise<boolean> {
  const rows = await db
    .update(schema.quotes)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.userId, userId), inArray(schema.quotes.status, ["draft", "sent"])))
    .returning({ id: schema.quotes.id });
  return rows.length > 0;
}

/** Mark as sent and remind the freelancer to chase it in three days. */
export async function markQuoteSent(userId: string, quoteId: string): Promise<void> {
  const [q] = await db
    .update(schema.quotes)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.userId, userId), eq(schema.quotes.status, "draft")))
    .returning({ leadId: schema.quotes.leadId });
  if (q) await db.update(schema.leads).set({ followUpOn: addDays(today(), 3), updatedAt: new Date() }).where(eq(schema.leads.id, q.leadId));
}

export async function publicQuote(id: string) {
  const [row] = await db
    .select({
      quote: schema.quotes,
      business: schema.leads.name,
      freelancer: { name: schema.users.name, email: schema.users.email, portfolioUrl: schema.users.portfolioUrl },
    })
    .from(schema.quotes)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.quotes.leadId))
    .innerJoin(schema.users, eq(schema.users.id, schema.quotes.userId))
    .where(eq(schema.quotes.id, id))
    .limit(1);
  return row ?? null;
}

export function isExpired(quote: Pick<Quote, "validUntil">, day = today()): boolean {
  return quote.validUntil < day;
}

export type QuoteResponse = "accepted" | "declined" | "already_answered" | "expired" | "not_found";

/**
 * The client's answer. Accepting marks the lead as won with the quote's total.
 * Only the first answer counts, so a double-click can't record two.
 */
export async function respondToQuote(id: string, accept: boolean, clientName: string): Promise<QuoteResponse> {
  const found = await publicQuote(id);
  if (!found) return "not_found";
  const { quote } = found;
  if (quote.status === "accepted" || quote.status === "declined") return "already_answered";
  if (isExpired(quote)) return "expired";

  const [answered] = await db
    .update(schema.quotes)
    .set({
      status: accept ? "accepted" : "declined",
      respondedAt: new Date(),
      acceptedBy: accept ? clientName : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.quotes.id, id), inArray(schema.quotes.status, ["draft", "sent"])))
    .returning();
  if (!answered) return "already_answered";

  const total = lineItemsTotal(answered.items);
  await db
    .update(schema.leads)
    .set(
      accept
        ? { status: "won", wonAmountCents: total, currency: answered.currency, followUpOn: null, updatedAt: new Date() }
        : { followUpOn: null, updatedAt: new Date() },
    )
    .where(eq(schema.leads.id, answered.leadId));

  const amount = formatMoney(total, answered.currency);
  try {
    await sendEmail(
      noticeMessage(
        found.freelancer.email,
        accept ? `${found.business} accepted your quote` : `${found.business} declined your quote`,
        accept ? `${found.business} said yes` : `${found.business} passed on this one`,
        accept
          ? [`${clientName} accepted your quote for ${amount}.`, "Next: build their site, then send the invoice when it's done."]
          : ["They declined the quote. It's worth a short, friendly reply asking what would have worked for them."],
        { label: "Open the client", url: appUrl(`/app/leads/${answered.leadId}`) },
      ),
    );
  } catch (err) {
    console.error("Quote response email failed", err);
  }
  return accept ? "accepted" : "declined";
}
