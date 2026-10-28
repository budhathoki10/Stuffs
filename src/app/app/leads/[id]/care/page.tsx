import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compareSite, monitorAction, startMonitor } from "@/app/actions/work";
import { ShareLink } from "@/components/workspace/share-link";
import { UrlActionForm } from "@/components/workspace/url-action-form";
import { Badge, Button, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { getAudit } from "@/lib/services/audits";
import { latestComparison } from "@/lib/services/comparisons";
import { getLeadWithAudit } from "@/lib/services/leads";
import { monitorForLead, monitorReport } from "@/lib/services/monitors";
import { siteForLead, siteUrl } from "@/lib/services/sites";
import { appUrl } from "@/lib/util";
import { currencyForAddress } from "@/lib/work/pricing";
import { daysUntil } from "@/lib/work/monitor";

export const metadata: Metadata = { title: "Results and care" };

const CARE_PRICE = { NPR: "NPR 1,500 to 3,000", USD: "$25 to $50", INR: "₹1,500 to ₹3,000", GBP: "£20 to £40", EUR: "€25 to €45", AUD: "A$40 to A$75" };

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={`mt-0.5 font-mono text-xl tabular-nums ${tone === "good" ? "text-money" : tone === "bad" ? "text-pen" : ""}`}>{value}</dd>
    </div>
  );
}

export default async function CareTab({ params }: PageProps<"/app/leads/[id]/care">) {
  const user = await requireUser();
  const { id } = await params;
  const [row, site, comparison, monitor] = await Promise.all([
    getLeadWithAudit(user.id, id),
    siteForLead(user.id, id),
    latestComparison(user.id, id),
    monitorForLead(user.id, id),
  ]);
  if (!row) notFound();
  const { lead, audit: before } = row;
  const after = comparison ? await getAudit(comparison.afterAuditId) : null;
  const report = monitor ? await monitorReport(monitor.id) : null;
  const siteAddress = site?.published ? siteUrl(site.slug) : (lead.website ?? "");
  const sslDays = monitor?.sslExpiresAt ? daysUntil(monitor.sslExpiresAt) : null;

  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <section className="space-y-5">
        <div>
          <h2 className="font-serif text-2xl font-medium">Before and after</h2>
          <p className="mt-1 text-sm text-muted">
            When the work is done, check the new site. The client gets a page showing the score you found and the score now, problem by
            problem. It&apos;s the best thing to send with your invoice, and to show the next client.
          </p>
        </div>
        <UrlActionForm
          action={compareSite}
          leadId={lead.id}
          defaultUrl={siteAddress}
          label="Address of the finished site"
          button="Check it now"
          pendingLabel="Checking…"
        />
        {comparison && after && (
          <div className="space-y-4 rounded-md border border-border bg-surface p-5">
            <div className="flex items-end gap-6">
              <div>
                <Eyebrow>Before</Eyebrow>
                <p className="mt-1 font-mono text-3xl tabular-nums text-muted">{before ? before.score : "none"}</p>
              </div>
              <span aria-hidden="true" className="pb-1 text-faint">
                →
              </span>
              <div>
                <Eyebrow>After</Eyebrow>
                <p className="mt-1 font-mono text-3xl tabular-nums text-money">{after.score}</p>
              </div>
              <p className="ml-auto pb-1 text-[13px] text-muted">Checked {formatDay(comparison.createdAt)}</p>
            </div>
            <ShareLink
              url={appUrl(`/p/${comparison.id}`)}
              to={lead.email}
              subject={`${lead.name}: before and after`}
              body={`Hi,\n\nHere's how the website scores now compared with before the work.`}
            />
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="font-serif text-2xl font-medium">Care plan</h2>
          <p className="mt-1 text-sm text-muted">
            We check the site every 10 minutes and email you if it goes down or its security certificate is about to run out, usually before
            the client notices. Sell it as a monthly care plan: freelancers typically charge {CARE_PRICE[currencyForAddress(lead.address)]} a
            month, and the client gets a report they can open any time.
          </p>
        </div>

        {!monitor || !report ? (
          <UrlActionForm
            action={startMonitor}
            leadId={lead.id}
            defaultUrl={siteAddress}
            label="Site to watch"
            button="Start monitoring"
            pendingLabel="Checking…"
          />
        ) : (
          <div className="space-y-5 rounded-md border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {!monitor.active ? (
                  <Badge>Paused</Badge>
                ) : monitor.status === "up" ? (
                  <Badge tone="good">Up</Badge>
                ) : monitor.status === "down" ? (
                  <Badge tone="bad">Down</Badge>
                ) : (
                  <Badge tone="warn">Checking</Badge>
                )}
                <span className="truncate font-mono text-[13px]">{monitor.url}</span>
              </div>
              {monitor.lastCheckedAt && (
                <span className="text-[13px] text-muted">
                  Last checked {monitor.lastCheckedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-4">
              <Stat
                label="Uptime, 30 days"
                value={report.summary.uptimePct === null ? "–" : `${report.summary.uptimePct}%`}
                tone={report.summary.uptimePct === null ? undefined : report.summary.uptimePct >= 99 ? "good" : "bad"}
              />
              <Stat label="Avg response" value={report.summary.avgResponseMs === null ? "–" : `${(report.summary.avgResponseMs / 1000).toFixed(1)}s`} />
              <Stat
                label="Certificate"
                value={sslDays === null ? "–" : sslDays < 0 ? "Expired" : `${sslDays} days`}
                tone={sslDays !== null && sslDays <= 14 ? "bad" : undefined}
              />
            </dl>
            {report.summary.incidents.length > 0 && (
              <p className="text-[13px] text-muted">
                {report.summary.incidents.length === 1 ? "1 outage" : `${report.summary.incidents.length} outages`} in the last 30 days.
              </p>
            )}
            <form action={monitorAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <Button type="submit" name="op" value="check" variant="secondary">
                Check now
              </Button>
              <Button type="submit" name="op" value={monitor.active ? "pause" : "resume"} variant="secondary">
                {monitor.active ? "Pause" : "Resume"}
              </Button>
              <Button type="submit" name="op" value="delete" variant="ghost">
                Stop monitoring
              </Button>
            </form>
            <div className="space-y-2 border-t border-border pt-4">
              <Eyebrow>Report for the client</Eyebrow>
              <ShareLink
                url={appUrl(`/m/${monitor.id}`)}
                to={lead.email}
                subject={`${lead.name}: website health report`}
                body={`Hi,\n\nHere's this month's report for your website: uptime, speed and security.`}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
