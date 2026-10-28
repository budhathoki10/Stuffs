import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Frame for pages the freelancer's client sees (quote, invoice, reports). The freelancer
 * is the sender, so their name leads; Pitchcraft is a quiet line in the footer.
 */
export function ClientPage({
  from,
  children,
  wide,
}: {
  from: { name: string; email?: string; portfolioUrl?: string | null };
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border print:border-0">
        <div className={`mx-auto flex w-full ${wide ? "max-w-4xl" : "max-w-3xl"} flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-5`}>
          <p className="font-serif text-xl font-medium">{from.name}</p>
          <p className="text-[13px] text-muted">
            {from.email && (
              <a href={`mailto:${from.email}`} className="hover:text-foreground">
                {from.email}
              </a>
            )}
            {from.portfolioUrl && (
              <>
                {from.email && <span className="mx-2 text-faint">·</span>}
                <a href={from.portfolioUrl} rel="noopener noreferrer" target="_blank" className="hover:text-foreground">
                  {from.portfolioUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              </>
            )}
          </p>
        </div>
      </header>
      <main className={`mx-auto w-full ${wide ? "max-w-4xl" : "max-w-3xl"} flex-1 px-5 py-10`}>{children}</main>
      <footer className="px-5 py-6 text-center text-xs text-faint print:hidden">
        Sent with{" "}
        <Link href="/" className="underline underline-offset-4 hover:text-muted">
          Pitchcraft
        </Link>
      </footer>
    </div>
  );
}

/** Read-only priced lines with a total row, for quotes and invoices. */
export function ItemsTable({
  items,
  total,
  format,
}: {
  items: { title: string; detail?: string; amountMinor: number }[];
  total: number;
  format: (minor: number) => string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-strong-border text-left text-[11px] uppercase tracking-[0.08em] text-muted">
          <th scope="col" className="py-2 font-medium">
            Work
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Price
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map((item, i) => (
          <tr key={i}>
            <td className="py-3 pr-4 align-top">
              <p className="font-medium">{item.title}</p>
              {item.detail && <p className="mt-0.5 text-muted">{item.detail}</p>}
            </td>
            <td className="whitespace-nowrap py-3 text-right align-top font-mono tabular-nums">{format(item.amountMinor)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-strong-border">
          <th scope="row" className="py-3 text-left font-medium">
            Total
          </th>
          <td data-testid="document-total" className="whitespace-nowrap py-3 text-right font-mono text-lg font-medium tabular-nums">
            {format(total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
