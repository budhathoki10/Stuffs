import type { Metadata } from "next";
import Link from "next/link";
import { markSent } from "@/app/actions/app";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { LEAD_STATUSES, STATUS_LABELS } from "@/lib/leads/status";
import { listLeads } from "@/lib/services/leads";
import { formatMoney } from "@/lib/util";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const user = await requireUser();
  const rows = await listLeads(user.id);
  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>{rows.length} businesses</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Pipeline</h1>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">
          Nothing here yet.{" "}
          <Link href="/app" className="text-foreground underline underline-offset-4">
            Get today&apos;s leads
          </Link>{" "}
          and they&apos;ll show up here as you work through them.
        </p>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5 pb-2">
          <div className="grid min-w-[960px] grid-cols-6 gap-3">
            {LEAD_STATUSES.map((status) => {
              const items = rows.filter((r) => r.lead.status === status);
              return (
                <section key={status} aria-label={STATUS_LABELS[status]}>
                  <h2 className="flex items-baseline justify-between border-b-2 border-ink pb-2 text-[13px] font-medium">
                    {STATUS_LABELS[status]}
                    <span className="font-mono text-faint tabular-nums">{items.length}</span>
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {items.map(({ lead }) => (
                      <li key={lead.id} className="rounded-[5px] border border-border bg-surface px-3 py-2.5 text-sm">
                        <Link href={`/app/leads/${lead.id}`} className="font-medium leading-snug hover:underline">
                          {lead.name}
                        </Link>
                        {status === "won" && lead.wonAmountCents !== null ? (
                          <p className="mt-0.5 font-mono text-money tabular-nums">{formatMoney(lead.wonAmountCents)}</p>
                        ) : (
                          <p className="text-xs text-muted">{lead.category}</p>
                        )}
                        {status === "new" && (
                          <form action={markSent} className="mt-1.5">
                            <input type="hidden" name="leadId" value={lead.id} />
                            <button type="submit" className="text-xs text-muted underline underline-offset-2 hover:text-foreground">
                              Mark as emailed
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
