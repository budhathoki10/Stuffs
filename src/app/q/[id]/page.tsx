import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientPage, ItemsTable } from "@/components/workspace/client-page";
import { QuoteAnswer } from "@/components/workspace/quote-answer";
import { Eyebrow } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isExpired, publicQuote } from "@/lib/services/quotes";
import { lineItemsTotal } from "@/lib/work/types";

export async function generateMetadata({ params }: PageProps<"/q/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = await publicQuote(id);
  return { title: found ? `Quote for ${found.business}` : "Quote not found", robots: { index: false } };
}

export default async function QuotePage({ params }: PageProps<"/q/[id]">) {
  const { id } = await params;
  const found = await publicQuote(id);
  if (!found) notFound();
  const { quote, business, freelancer } = found;
  const format = (minor: number) => formatMoney(minor, quote.currency);
  const total = lineItemsTotal(quote.items);
  const expired = quote.status !== "accepted" && quote.status !== "declined" && isExpired(quote);

  return (
    <ClientPage from={freelancer}>
      <Eyebrow>Quote · {formatDay(quote.createdAt)}</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">{business}</h1>
      <p className="mt-1 text-sm text-muted">
        From {freelancer.name}
        {quote.status !== "accepted" && quote.status !== "declined" && <> · valid until {formatDay(quote.validUntil)}</>}
      </p>

      <div className="mt-8">
        <ItemsTable items={quote.items} total={total} format={format} />
      </div>

      {quote.note && <p className="mt-6 whitespace-pre-line border-l-2 border-border pl-4 text-sm leading-relaxed">{quote.note}</p>}

      <div className="mt-10 rounded-md border border-border bg-surface p-5">
        {quote.status === "accepted" ? (
          <p role="status" className="text-sm">
            <span className="font-medium text-money">Accepted</span> by {quote.acceptedBy} on {formatDay(quote.respondedAt!)}. {freelancer.name} has
            been told and will be in touch about next steps.
          </p>
        ) : quote.status === "declined" ? (
          <p role="status" className="text-sm">
            Declined on {formatDay(quote.respondedAt!)}. If you change your mind, reply to {freelancer.name} at{" "}
            <a href={`mailto:${freelancer.email}`} className="underline underline-offset-4">
              {freelancer.email}
            </a>
            .
          </p>
        ) : expired ? (
          <p className="text-sm">
            This quote expired on {formatDay(quote.validUntil)}. Ask {freelancer.name} at{" "}
            <a href={`mailto:${freelancer.email}`} className="underline underline-offset-4">
              {freelancer.email}
            </a>{" "}
            for an updated one.
          </p>
        ) : (
          <>
            <h2 className="mb-1 font-medium">Happy to go ahead?</h2>
            <p className="mb-4 text-sm text-muted">
              Accepting tells {freelancer.name} to start. Payment is arranged with them directly; nothing is charged here.
            </p>
            <QuoteAnswer quoteId={quote.id} total={format(total)} />
          </>
        )}
      </div>
    </ClientPage>
  );
}
