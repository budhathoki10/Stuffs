import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientPage } from "@/components/workspace/client-page";
import { Badge, Eyebrow } from "@/components/ui";
import { monitorReport } from "@/lib/services/monitors";
import { daysUntil, formatResponse } from "@/lib/work/monitor";

export const metadata: Metadata = { title: "Website health report", robots: { index: false } };

const when = (d: Date) => d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function duration(minutes: number) {
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  const h = Math.floor(minutes / 60);
  return `${h} h ${minutes % 60} min`;
}

export default async function MonitorReport({ params }: PageProps<"/m/[id]">) {
  const { id } = await params;
  const report = await monitorReport(id);
  if (!report) notFound();
  const { monitor, business, freelancer, summary, days } = report;
  const sslDays = monitor.sslExpiresAt ? daysUntil(monitor.sslExpiresAt) : null;
  const host = new URL(monitor.url).hostname;

  return (
    <ClientPage from={freelancer}>
      <Eyebrow>Website health · last {days} days</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">{business}</h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
        <span className="font-mono">{host}</span>
        {!monitor.active ? (
          <Badge>Monitoring paused</Badge>
        ) : monitor.status === "up" ? (
          <Badge tone="good">Online now</Badge>
        ) : monitor.status === "down" ? (
          <Badge tone="bad">Down now</Badge>
        ) : null}
      </p>

      <dl className="mt-8 grid grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-5 sm:pr-5">
          <dt className="text-[13px] text-muted">Uptime</dt>
          <dd className="mt-1 font-mono text-3xl tabular-nums">{summary.uptimePct === null ? "Not checked yet" : `${summary.uptimePct}%`}</dd>
          <dd className="mt-1 text-xs text-muted">{summary.checks.toLocaleString("en-US")} checks, every 10 minutes</dd>
        </div>
        <div className="py-5 sm:px-5">
          <dt className="text-[13px] text-muted">Average response</dt>
          <dd className="mt-1 font-mono text-3xl tabular-nums">
            {summary.avgResponseMs === null ? "No data" : formatResponse(summary.avgResponseMs)}
          </dd>
          <dd className="mt-1 text-xs text-muted">Under 1s is good</dd>
        </div>
        <div className="py-5 sm:pl-5">
          <dt className="text-[13px] text-muted">Security certificate</dt>
          <dd className={`mt-1 font-mono text-3xl tabular-nums ${sslDays !== null && sslDays <= 14 ? "text-pen" : ""}`}>
            {sslDays === null ? "None" : sslDays < 0 ? "Expired" : `${sslDays} days`}
          </dd>
          <dd className="mt-1 text-xs text-muted">{sslDays === null ? "The site isn't using HTTPS" : "Until it needs renewing"}</dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-medium">Outages</h2>
        {summary.incidents.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None in the last {days} days.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border border-y border-border text-sm">
            {summary.incidents.map((i) => (
              <li key={i.start.toISOString()} className="flex justify-between gap-4 py-3">
                <span>{when(i.start)} UTC</span>
                <span className="font-mono tabular-nums text-muted">{i.end ? duration(i.minutes) : "ongoing"}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="mt-10 text-sm text-muted">
        {freelancer.name} looks after this site and is told straight away if it goes down or the certificate is about to expire.
      </p>
    </ClientPage>
  );
}
