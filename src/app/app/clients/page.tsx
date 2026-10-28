import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { today } from "@/lib/plans";
import { listClients } from "@/lib/services/clients";
import { outstandingByCurrency } from "@/lib/services/invoices";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const user = await requireUser();
  const [clients, outstanding] = await Promise.all([listClients(user.id), outstandingByCurrency(user.id)]);
  const day = today();
  const monitored = clients.filter((c) => c.monitor?.active).length;

  return (
    <div className="space-y-10">
      <div>
        <Eyebrow>Won work</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Clients</h1>
        <p className="mt-1.5 text-sm text-muted">
          Everyone who said yes. Build their site, check the result, keep it running and get paid, all from each client&apos;s page.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-md border border-dashed border-strong-border px-6 py-10 text-center">
          <p className="mb-4 text-muted">
            No clients yet. When a business accepts your quote, or you mark a lead as won, it shows up here.
          </p>
          <ButtonLink href="/app/pipeline">Open the pipeline</ButtonLink>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 overflow-hidden rounded-md border border-border bg-surface">
            <div className="px-5 py-4">
              <dt className="text-[13px] text-muted">Clients</dt>
              <dd className="mt-1 font-mono text-2xl tabular-nums">{clients.length}</dd>
            </div>
            <div className="border-l border-border px-5 py-4">
              <dt className="text-[13px] text-muted">On a care plan</dt>
              <dd className="mt-1 font-mono text-2xl tabular-nums">{monitored}</dd>
            </div>
            <div className="border-l border-border px-5 py-4">
              <dt className="text-[13px] text-muted">Waiting to be paid</dt>
              <dd data-testid="outstanding" className="mt-1 font-mono text-2xl tabular-nums">
                {outstanding.length ? outstanding.map((o) => formatMoney(o.amountMinor, o.currency)).join(" + ") : formatMoney(0)}
              </dd>
            </div>
          </dl>

          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Your clients</caption>
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="px-5 py-2.5 font-medium">Business</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Project</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Website</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Care plan</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map(({ lead, site, monitor, unpaid, invoiceCount }) => {
                  const overdue = unpaid.some((u) => u.dueOn < day);
                  return (
                    <tr key={lead.id}>
                      <td className="px-5 py-3">
                        <Link href={`/app/leads/${lead.id}`} className="font-medium underline-offset-4 hover:underline">
                          {lead.name}
                        </Link>
                        <p className="text-[13px] text-muted">{lead.category}</p>
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums">
                        {lead.wonAmountCents ? formatMoney(lead.wonAmountCents, lead.currency) : <span className="text-faint">–</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/app/leads/${lead.id}/site`}>
                          {site?.published ? <Badge tone="good">Live</Badge> : site ? <Badge tone="warn">Draft</Badge> : <Badge>Not started</Badge>}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/app/leads/${lead.id}/care`}>
                          {!monitor ? (
                            <Badge>None</Badge>
                          ) : !monitor.active ? (
                            <Badge>Paused</Badge>
                          ) : monitor.status === "down" ? (
                            <Badge tone="bad">Site down</Badge>
                          ) : (
                            <Badge tone="good">Watching</Badge>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/app/leads/${lead.id}/invoices`} className="font-mono tabular-nums underline-offset-4 hover:underline">
                          {unpaid.length ? (
                            <span className={overdue ? "text-pen" : ""}>
                              {unpaid.map((u) => formatMoney(u.amountMinor, u.currency)).join(" + ")}
                              {overdue && " overdue"}
                            </span>
                          ) : invoiceCount ? (
                            <span className="text-money">Paid up</span>
                          ) : (
                            <span className="text-muted">Not invoiced</span>
                          )}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
