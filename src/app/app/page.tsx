import type { Metadata } from "next";
import Link from "next/link";
import { FindLeadsButton } from "@/components/find-leads-button";
import { LeadTable } from "@/components/lead-table";
import { Button, ButtonLink, Eyebrow, FormMessage } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { NICHES, isNiche } from "@/lib/leads";
import { today } from "@/lib/plans";
import { activeSearch } from "@/lib/services/delivery";
import { followUpAction } from "@/app/actions/work";
import { formatDay } from "@/lib/dates";
import { STATUS_LABELS, type LeadStatus } from "@/lib/leads/status";
import { dueFollowUps } from "@/lib/services/followups";
import { getStats, listLeads } from "@/lib/services/leads";
import { formatMoney } from "@/lib/util";

export const metadata: Metadata = { title: "Today" };

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const [{ first, verified, reset }, search, stats, rows, followUps] = await Promise.all([
    searchParams,
    activeSearch(user.id),
    getStats(user.id),
    listLeads(user.id),
    dueFollowUps(user.id),
  ]);
  const todays = rows.filter((r) => r.lead.deliveredOn === today());
  const waiting = rows.filter((r) => r.lead.status === "new" && r.lead.deliveredOn !== today()).slice(0, 10);
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const STATS = [
    { id: "leads", label: "Leads", value: stats.total },
    { id: "pitched", label: "Emailed", value: stats.contacted },
    { id: "replies", label: "Replied", value: stats.replied },
    {
      id: "earned",
      label: "Earned from these",
      value: stats.earned.length ? stats.earned.map((e) => formatMoney(e.amountMinor, e.currency)).join(" + ") : formatMoney(0),
      money: stats.earned.length > 0,
    },
  ];

  return (
    <div className="space-y-10">
      <FormMessage
        success={verified === "1" ? "Email confirmed." : reset === "1" ? "Password changed. You're logged in." : null}
        error={verified === "0" ? "That confirmation link has expired or was already used. Use “Send it again” above for a fresh one." : null}
      />

      <div>
        <Eyebrow>{dateLabel}</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Today&apos;s leads</h1>
        <p className="mt-1.5 text-sm text-muted">
          {search
            ? `${NICHES[isNiche(search.niche) ? search.niche : "dentist"].label} within ${search.radiusKm} km of ${search.location}.`
            : "You haven't said who you want to work with yet."}{" "}
          <Link href="/app/settings" className="text-foreground underline underline-offset-4">
            {search ? "Change" : "Set it up"}
          </Link>
        </p>
      </div>

      <dl aria-label="Your results" className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-surface md:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={s.id}
            className={`px-5 py-4 ${i % 2 ? "border-l border-border" : ""} ${i > 1 ? "border-t border-border md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
          >
            <dt className="text-[13px] text-muted">{s.label}</dt>
            <dd data-testid={`stat-${s.id}`} className={`mt-1 font-mono text-2xl tabular-nums ${s.money ? "text-money" : ""}`}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {followUps.length > 0 && (
        <section aria-labelledby="follow-ups">
          <h2 id="follow-ups" className="mb-3 font-serif text-2xl font-medium">
            Follow up today
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {followUps.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/app/leads/${lead.id}`} className="font-medium underline-offset-4 hover:underline">
                    {lead.name}
                  </Link>
                  <p className="text-[13px] text-muted">
                    {STATUS_LABELS[lead.status as LeadStatus]}
                    {lead.followUpOn && lead.followUpOn < today() && ` · due ${formatDay(lead.followUpOn)}`}
                    {lead.email && ` · ${lead.email}`}
                  </p>
                </div>
                <form action={followUpAction} className="flex gap-1">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <Button type="submit" name="op" value="done" variant="secondary" className="py-1">
                    Done
                  </Button>
                  <Button type="submit" name="op" value="snooze" variant="ghost" className="py-1">
                    In 3 days
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {!search ? (
          <div className="rounded-md border border-dashed border-strong-border px-6 py-10 text-center">
            <p className="mb-4 text-muted">Pick a type of business and a city, and we&apos;ll find your first five.</p>
            <ButtonLink href="/app/settings">Choose who to work with</ButtonLink>
          </div>
        ) : todays.length === 0 ? (
          <div className="rounded-md border border-dashed border-strong-border px-6 py-10 text-center">
            <p className="mb-4 text-muted">
              {first ? "You're set up. Your first batch takes about twenty seconds to find and check." : "New leads arrive every morning. You can also ask for them now."}
            </p>
            <div className="flex justify-center">
              <FindLeadsButton />
            </div>
          </div>
        ) : (
          <LeadTable rows={todays} label="Today's leads" />
        )}
      </section>

      {waiting.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-2xl font-medium">Not emailed yet</h2>
          <LeadTable rows={waiting} label="Earlier leads not emailed yet" />
        </section>
      )}
    </div>
  );
}
