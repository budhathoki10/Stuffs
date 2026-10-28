import type { Metadata } from "next";
import Link from "next/link";
import { markSent } from "@/app/actions/app";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { LEAD_STATUSES, STATUS_LABELS } from "@/lib/leads/status";
import { listLeads } from "@/lib/services/leads";
import { formatMoney } from "@/lib/util";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const user = await requireUser();
  const rows = await listLeads(user.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <p className="text-muted">Every business you&apos;ve been matched with, from first pitch to paid project.</p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <p className="text-muted">
            No leads yet. <Link href="/app" className="text-accent underline">Get today&apos;s leads</Link>.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {LEAD_STATUSES.map((status) => {
            const items = rows.filter((r) => r.lead.status === status);
            return (
              <section key={status} aria-label={STATUS_LABELS[status]} className="rounded-xl bg-border/40 p-3">
                <h2 className="mb-3 flex justify-between text-sm font-semibold">
                  {STATUS_LABELS[status]} <span className="text-muted">{items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map(({ lead }) => (
                    <li key={lead.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                      <Link href={`/app/leads/${lead.id}`} className="font-medium hover:text-accent">
                        {lead.name}
                      </Link>
                      <p className="text-xs text-muted">{lead.category}</p>
                      {status === "won" && lead.wonAmountCents !== null && (
                        <p className="mt-1 font-semibold text-accent">{formatMoney(lead.wonAmountCents)}</p>
                      )}
                      {status === "new" && (
                        <form action={markSent} className="mt-2">
                          <input type="hidden" name="leadId" value={lead.id} />
                          <button type="submit" className="text-xs text-accent underline">
                            Mark pitch sent
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
      )}
    </div>
  );
}
