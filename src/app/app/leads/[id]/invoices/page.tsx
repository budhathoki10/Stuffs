import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { invoiceStatus } from "@/app/actions/work";
import { InvoiceForm } from "@/components/workspace/invoice-form";
import { Badge, Button } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { today } from "@/lib/plans";
import { invoicesForLead } from "@/lib/services/invoices";
import { ownedLead } from "@/lib/services/leads";
import { quoteForLead } from "@/lib/services/quotes";
import { currencyForAddress } from "@/lib/work/pricing";
import { hasPaymentDetails, lineItemsTotal } from "@/lib/work/types";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesTab({ params }: PageProps<"/app/leads/[id]/invoices">) {
  const user = await requireUser();
  const { id } = await params;
  const [lead, quote, invoices] = await Promise.all([ownedLead(user.id, id), quoteForLead(user.id, id), invoicesForLead(user.id, id)]);
  if (!lead) notFound();
  const day = today();
  const accepted = quote?.status === "accepted" ? quote : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <section>
        <h2 className="mb-4 font-serif text-2xl font-medium">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="rounded-md border border-dashed border-strong-border px-5 py-6 text-sm text-muted">
            None yet. {accepted ? "The form starts with the lines from the quote they accepted." : "Create one when the work is done, or for a deposit."}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {invoices.map((inv) => {
              const overdue = inv.status === "unpaid" && inv.dueOn < day;
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <a href={`/i/${inv.id}`} target="_blank" rel="noopener" className="font-mono text-sm font-medium underline-offset-4 hover:underline">
                    {inv.number}
                  </a>
                  <span className="font-mono text-sm tabular-nums">{formatMoney(lineItemsTotal(inv.items), inv.currency)}</span>
                  {inv.status === "paid" ? (
                    <Badge tone="good">Paid {inv.paidAt && formatDay(inv.paidAt)}</Badge>
                  ) : inv.status === "void" ? (
                    <Badge>Void</Badge>
                  ) : overdue ? (
                    <Badge tone="bad">Overdue</Badge>
                  ) : (
                    <Badge tone="warn">Due {formatDay(inv.dueOn)}</Badge>
                  )}
                  <form action={invoiceStatus} className="ml-auto flex gap-1">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    {inv.status !== "paid" && (
                      <Button type="submit" name="status" value="paid" variant="secondary" className="py-1">
                        Mark paid
                      </Button>
                    )}
                    {inv.status !== "unpaid" && (
                      <Button type="submit" name="status" value="unpaid" variant="ghost" className="py-1">
                        Mark unpaid
                      </Button>
                    )}
                    {inv.status === "unpaid" && (
                      <Button type="submit" name="status" value="void" variant="ghost" className="py-1">
                        Void
                      </Button>
                    )}
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[13px] text-muted">
          Open an invoice to copy its link, send it on WhatsApp or print it as a PDF. Clients pay you directly; Pitchcraft never handles the
          money. Mark it paid when it arrives.
        </p>
      </section>

      <aside className="space-y-4">
        <h2 className="font-serif text-xl font-medium">New invoice</h2>
        {!hasPaymentDetails(user.paymentDetails) && (
          <p className="border-l-2 border-pen bg-pen-soft px-3 py-2 text-sm text-pen">
            Add how you get paid (eSewa, Khalti, bank, Payoneer) in{" "}
            <Link href="/app/settings#payment" className="underline underline-offset-4">
              Settings
            </Link>{" "}
            so it prints on the invoice.
          </p>
        )}
        <InvoiceForm
          leadId={lead.id}
          items={accepted?.items ?? quote?.items ?? []}
          currency={quote?.currency ?? currencyForAddress(lead.address)}
          dueOn={addDays(day, 7)}
        />
      </aside>
    </div>
  );
}
