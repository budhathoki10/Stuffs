import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ClientPage, ItemsTable } from "@/components/workspace/client-page";
import { PrintButton } from "@/components/workspace/print-button";
import { Eyebrow } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { today } from "@/lib/plans";
import { publicInvoice } from "@/lib/services/invoices";
import { appUrl } from "@/lib/util";
import { lineItemsTotal, type PaymentDetails } from "@/lib/work/types";

export async function generateMetadata({ params }: PageProps<"/i/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = await publicInvoice(id);
  return { title: found ? `Invoice ${found.invoice.number} for ${found.business.name}` : "Invoice not found", robots: { index: false } };
}

function paymentLines(d: PaymentDetails): [string, string][] {
  const bank = [d.bankName, d.bankBranch && `${d.bankBranch} branch`].filter(Boolean).join(", ");
  return [
    ["eSewa", d.esewaId],
    ["Khalti", d.khaltiId],
    ["Bank", bank],
    ["Account name", d.bankAccountName],
    ["Account number", d.bankAccountNumber],
    ["Payoneer", d.payoneerEmail],
  ].filter((l): l is [string, string] => !!l[1]);
}

export default async function InvoicePage({ params }: PageProps<"/i/[id]">) {
  const { id } = await params;
  const found = await publicInvoice(id);
  if (!found) notFound();
  const { invoice, business, freelancer } = found;
  const total = lineItemsTotal(invoice.items);
  const format = (minor: number) => formatMoney(minor, invoice.currency);
  const details = freelancer.paymentDetails;
  const lines = paymentLines(details);
  const overdue = invoice.status === "unpaid" && invoice.dueOn < today();
  // On paper, a QR gets the client back to this page.
  const linkQr = await QRCode.toDataURL(appUrl(`/i/${invoice.id}`), { margin: 0, width: 160 });

  return (
    <ClientPage from={freelancer}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Eyebrow>Invoice</Eyebrow>
          <h1 className="mt-2 font-mono text-3xl font-medium tracking-tight">{invoice.number}</h1>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted">Issued</dt>
          <dd>{formatDay(invoice.issuedOn)}</dd>
          <dt className="text-muted">Due</dt>
          <dd className={overdue ? "font-medium text-pen" : ""}>{formatDay(invoice.dueOn)}</dd>
        </dl>
      </div>

      {invoice.status === "paid" && (
        <p role="status" className="mt-6 inline-block rounded-[3px] border-2 border-money px-3 py-1 font-mono text-sm font-semibold uppercase tracking-widest text-money">
          Paid{invoice.paidAt && ` ${formatDay(invoice.paidAt)}`}
        </p>
      )}
      {invoice.status === "void" && (
        <p role="status" className="mt-6 inline-block rounded-[3px] border-2 border-strong-border px-3 py-1 font-mono text-sm font-semibold uppercase tracking-widest text-muted">
          Void. Nothing to pay.
        </p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <Eyebrow>Bill to</Eyebrow>
          <p className="mt-1.5 font-medium">{business.name}</p>
          {business.address && <p className="text-sm text-muted">{business.address}</p>}
        </div>
        <div>
          <Eyebrow>From</Eyebrow>
          <p className="mt-1.5 font-medium">{freelancer.name}</p>
          <p className="text-sm text-muted">{freelancer.email}</p>
        </div>
      </div>

      <div className="mt-8">
        <ItemsTable items={invoice.items} total={total} format={format} />
      </div>
      {invoice.note && <p className="mt-4 whitespace-pre-line text-sm">{invoice.note}</p>}

      {invoice.status === "unpaid" && (
        <section className="mt-10 break-inside-avoid rounded-md border border-border bg-surface p-5 print:border-strong-border">
          <h2 className="font-medium">How to pay</h2>
          <p className="mt-1 text-sm text-muted">
            Pay {format(total)} to {freelancer.name} directly. Use <span className="font-mono text-foreground">{invoice.number}</span> as the
            reference.
          </p>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
            {lines.length > 0 || details.other ? (
              <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                {lines.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted">{label}</dt>
                    <dd className={`break-all ${/\d{4}/.test(value) ? "font-mono" : ""}`}>{value}</dd>
                  </div>
                ))}
                {details.other && (
                  <div className="contents">
                    <dt className="text-muted">Other</dt>
                    <dd className="whitespace-pre-line">{details.other}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="flex-1 text-sm">
                Ask {freelancer.name} at {freelancer.email} for payment details.
              </p>
            )}
            {details.qrImage && (
              <figure className="shrink-0 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small data URL the freelancer uploaded */}
                <img src={details.qrImage} alt={`Payment QR code${details.qrLabel ? ` for ${details.qrLabel}` : ""}`} className="size-40 object-contain" />
                <figcaption className="mt-1 text-xs text-muted">{details.qrLabel || "Scan to pay"}</figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      <div className="mt-10 flex items-end justify-between gap-6">
        <PrintButton />
        <figure className="hidden text-center print:block">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated on the server */}
          <img src={linkQr} alt="" className="size-20" />
          <figcaption className="mt-1 text-[10px] text-muted">View online</figcaption>
        </figure>
      </div>
    </ClientPage>
  );
}
