import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { startQuote, sendQuote } from "@/app/actions/work";
import { QuoteEditor } from "@/components/workspace/quote-editor";
import { ShareLink } from "@/components/workspace/share-link";
import { Badge, Button, Card, Eyebrow, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getLeadWithAudit } from "@/lib/services/leads";
import { isExpired, quoteForLead } from "@/lib/services/quotes";
import { appUrl } from "@/lib/util";
import { currencyForAddress } from "@/lib/work/pricing";
import { CURRENCIES, lineItemsTotal } from "@/lib/work/types";

export const metadata: Metadata = { title: "Quote" };

export default async function QuoteTab({ params }: PageProps<"/app/leads/[id]/quote">) {
  const user = await requireUser();
  const { id } = await params;
  const [row, quote] = await Promise.all([getLeadWithAudit(user.id, id), quoteForLead(user.id, id)]);
  if (!row) notFound();
  const { lead, audit } = row;

  if (!quote) {
    const problems = audit?.checks.filter((c) => !c.passed).length ?? 0;
    return (
      <Card className="max-w-2xl space-y-4 p-6">
        <h2 className="font-serif text-2xl font-medium">Put a price on it</h2>
        <p className="text-sm text-muted">
          {!lead.website
            ? "They don't have a website, so the quote starts with a new site plus a domain and hosting."
            : problems
              ? `The quote starts with one line for each of the ${problems} problems the check found, priced at typical local rates.`
              : "Their site passed every check, so you'll be adding the lines yourself."}{" "}
          Change anything before you send it. They accept with one click and it lands in your earnings.
        </p>
        <form action={startQuote} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="leadId" value={lead.id} />
          <div className="space-y-1.5">
            <label htmlFor="quote-currency" className="block text-[13px] font-medium">
              Currency
            </label>
            <select id="quote-currency" name="currency" defaultValue={currencyForAddress(lead.address)} className={`${inputClass} w-32`}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <Button type="submit">Build the quote</Button>
        </form>
      </Card>
    );
  }

  const url = appUrl(`/q/${quote.id}`);
  const total = formatMoney(lineItemsTotal(quote.items), quote.currency);
  const answered = quote.status === "accepted" || quote.status === "declined";
  const expired = !answered && isExpired(quote);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <section>
        <h2 className="mb-4 font-serif text-2xl font-medium">Quote</h2>
        <QuoteEditor
          key={quote.id}
          leadId={lead.id}
          quote={{ id: quote.id, currency: quote.currency, items: quote.items, note: quote.note, validUntil: quote.validUntil }}
          locked={answered}
        />
      </section>
      <aside className="space-y-6">
        <div>
          <Eyebrow>Status</Eyebrow>
          <div className="mt-2 flex items-center gap-2">
            {quote.status === "accepted" ? (
              <Badge tone="good">Accepted</Badge>
            ) : quote.status === "declined" ? (
              <Badge tone="bad">Declined</Badge>
            ) : expired ? (
              <Badge tone="warn">Expired</Badge>
            ) : quote.status === "sent" ? (
              <Badge tone="warn">Waiting for an answer</Badge>
            ) : (
              <Badge>Draft</Badge>
            )}
            <span className="font-mono text-sm tabular-nums">{total}</span>
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {quote.status === "accepted"
              ? `${quote.acceptedBy} accepted on ${formatDay(quote.respondedAt!)}. Next, build the site.`
              : quote.status === "declined"
                ? `Declined on ${formatDay(quote.respondedAt!)}.`
                : expired
                  ? "Move the valid-until date forward and save to reopen it."
                  : quote.status === "sent"
                    ? `Sent ${formatDay(quote.sentAt!)}. We'll remind you to follow up if they go quiet.`
                    : "Only you can see this until you send the link."}
          </p>
        </div>
        <div className="space-y-2">
          <Eyebrow>Link for the client</Eyebrow>
          <ShareLink
            url={url}
            to={lead.email}
            subject={`Quote for ${lead.name}`}
            body={`Hi,\n\nHere's the quote we talked about (${total}). You can accept it from the page.`}
          />
        </div>
        {quote.status === "draft" && (
          <form action={sendQuote} className="space-y-1.5">
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="quoteId" value={quote.id} />
            <Button type="submit" className="w-full">
              I&apos;ve sent it
            </Button>
            <p className="text-xs text-muted">Marks the lead as emailed and sets a follow-up reminder for three days from now.</p>
          </form>
        )}
      </aside>
    </div>
  );
}
