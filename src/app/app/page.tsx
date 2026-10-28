import type { Metadata } from "next";
import Link from "next/link";
import { FindLeadsButton } from "@/components/find-leads-button";
import { Badge, ButtonLink, Card, scoreTone } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { NICHES, isNiche } from "@/lib/leads";
import { STATUS_LABELS, type LeadStatus } from "@/lib/leads/status";
import { today } from "@/lib/plans";
import { activeSearch } from "@/lib/services/delivery";
import { getStats, listLeads } from "@/lib/services/leads";
import { formatMoney } from "@/lib/util";

export const metadata: Metadata = { title: "Today" };

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const [{ first }, search, stats, rows] = await Promise.all([
    searchParams,
    activeSearch(user.id),
    getStats(user.id),
    listLeads(user.id),
  ]);
  const todays = rows.filter((r) => r.lead.deliveredOn === today());
  const waiting = rows.filter((r) => r.lead.status === "new" && r.lead.deliveredOn !== today()).slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hi {user.name.split(" ")[0]} 👋</h1>
          <p className="text-muted">
            {search
              ? `Looking for ${NICHES[isNiche(search.niche) ? search.niche : "dentist"].label.toLowerCase()} within ${search.radiusKm} km of ${search.location}.`
              : "Tell us who you want to work with to start getting leads."}{" "}
            <Link href="/app/settings" className="text-accent underline">
              Change
            </Link>
          </p>
        </div>
      </div>

      <section aria-label="Your results" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Leads", stats.total],
          ["Pitched", stats.contacted],
          ["Replies", stats.replied],
          ["Earned with Pitchcraft", formatMoney(stats.earnedCents)],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold" data-testid={`stat-${String(label).split(" ")[0].toLowerCase()}`}>
              {value}
            </p>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Today&apos;s leads</h2>
        </div>
        {!search ? (
          <Card>
            <p className="mb-4">Pick your target business type and city to get your first leads.</p>
            <ButtonLink href="/app/settings">Set up my search</ButtonLink>
          </Card>
        ) : todays.length === 0 ? (
          <Card>
            <p className="mb-4 text-muted">
              {first ? "You're all set! Get your first batch of leads now." : "New leads arrive every morning. Want them now?"}
            </p>
            <FindLeadsButton />
          </Card>
        ) : (
          <LeadList rows={todays} />
        )}
      </section>

      {waiting.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Still waiting for your pitch</h2>
          <LeadList rows={waiting} />
        </section>
      )}
    </div>
  );
}

function LeadList({ rows }: { rows: Awaited<ReturnType<typeof listLeads>> }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {rows.map(({ lead, auditScore }) => (
        <li key={lead.id}>
          <Link href={`/app/leads/${lead.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-background">
            <div className="min-w-0">
              <p className="font-medium">{lead.name}</p>
              <p className="truncate text-sm text-muted">
                {lead.category}
                {lead.address ? ` · ${lead.address}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lead.website ? (
                auditScore !== null && <Badge tone={scoreTone(auditScore)}>Site score {auditScore}</Badge>
              ) : (
                <Badge tone="bad">No website</Badge>
              )}
              <Badge>{STATUS_LABELS[lead.status as LeadStatus] ?? lead.status}</Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
