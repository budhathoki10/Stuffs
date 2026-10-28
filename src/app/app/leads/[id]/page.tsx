import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AuditSummary, CheckList } from "@/components/audit-report";
import { LeadPitch, LeadStatusForm } from "@/components/lead-actions";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import type { LeadStatus } from "@/lib/leads/status";
import { getLeadWithAudit, latestPitch } from "@/lib/services/leads";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/app/leads/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const row = await getLeadWithAudit(user.id, id);
  if (!row) notFound();
  const { lead, audit } = row;
  const pitch = await latestPitch(user.id, lead.id);

  return (
    <div className="space-y-6">
      <Link href="/app" className="text-sm text-muted hover:text-foreground">
        ← Back to today
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="text-muted">
            {lead.category}
            {lead.address ? ` · ${lead.address}` : ""}
          </p>
        </div>
        {!lead.website && <Badge tone="bad">No website: great web design lead</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">Your pitch</h2>
            {!lead.email && (
              <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                No email found for this business. Call them{lead.phone ? ` at ${lead.phone}` : ""}, or use the contact
                form on their website{lead.website ? "" : " / Google listing"}, and use this pitch as your script.
              </p>
            )}
            <LeadPitch leadId={lead.id} email={lead.email} existing={pitch ? { subject: pitch.subject, body: pitch.body } : null} />
          </Card>

          {audit ? (
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Website check</h2>
                <Link href={`/r/${audit.id}`} target="_blank" className="text-sm text-accent underline">
                  Shareable report ↗
                </Link>
              </div>
              <AuditSummary score={audit.score} metrics={audit.metrics} />
              <div className="mt-6">
                <CheckList checks={audit.checks} />
              </div>
            </Card>
          ) : (
            <Card>
              <h2 className="mb-2 font-semibold">No website</h2>
              <p className="text-sm text-muted">
                This business isn&apos;t listed with a website. Customers searching online can&apos;t find their hours,
                prices or a way to book, which makes this your easiest pitch: offer a simple one-page site.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">Contact</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Email</dt>
                <dd>{lead.email ? <a href={`mailto:${lead.email}`} className="text-accent underline">{lead.email}</a> : "Not found"}</dd>
              </div>
              <div>
                <dt className="text-muted">Phone</dt>
                <dd>{lead.phone ? <a href={`tel:${lead.phone}`} className="text-accent underline">{lead.phone}</a> : "Not found"}</dd>
              </div>
              <div>
                <dt className="text-muted">Website</dt>
                <dd className="break-all">
                  {lead.website ? (
                    <a href={lead.website} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline">
                      {lead.website}
                    </a>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              {lead.lat !== null && lead.lon !== null && (
                <div>
                  <dt className="text-muted">Map</dt>
                  <dd>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${lead.lat}&mlon=${lead.lon}#map=18/${lead.lat}/${lead.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline"
                    >
                      Open map ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Track it</h2>
            <LeadStatusForm leadId={lead.id} status={lead.status as LeadStatus} wonAmount={lead.wonAmountCents} notes={lead.notes} />
          </Card>
        </div>
      </div>
    </div>
  );
}
