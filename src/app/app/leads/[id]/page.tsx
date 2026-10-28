import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AuditSummary, CheckList } from "@/components/audit-report";
import { LeadPitch, LeadStatusForm } from "@/components/lead-actions";
import { Eyebrow } from "@/components/ui";
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
    <div className="space-y-8">
      <div>
        <Link href="/app" className="text-[13px] text-muted hover:text-foreground">
          Today&apos;s leads
        </Link>
        <span className="mx-2 text-faint">/</span>
        <span className="text-[13px] text-muted">{lead.category}</span>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">{lead.name}</h1>
        {lead.address && <p className="mt-1 text-sm text-muted">{lead.address}</p>}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-12">
          <section>
            <h2 className="font-serif text-2xl font-medium">Your email</h2>
            {!lead.email && (
              <p className="mt-2 text-sm text-muted">
                We couldn&apos;t find an email address for them. Call
                {lead.phone ? ` ${lead.phone}` : ""} or use the contact form on their
                {lead.website ? " website" : " Google listing"}, and use this as your script.
              </p>
            )}
            <div className="mt-4">
              <LeadPitch leadId={lead.id} email={lead.email} existing={pitch ? { subject: pitch.subject, body: pitch.body } : null} />
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl font-medium">Their website</h2>
              {audit && (
                <Link href={`/r/${audit.id}`} target="_blank" className="text-sm underline underline-offset-4">
                  Open the report you can send them
                </Link>
              )}
            </div>
            {audit ? (
              <div className="mt-5 space-y-6">
                <AuditSummary score={audit.score} metrics={audit.metrics} />
                <CheckList checks={audit.checks} />
              </div>
            ) : (
              <p className="mt-2 max-w-xl text-muted">
                They don&apos;t have one listed. People searching for a {lead.category.toLowerCase()} nearby can&apos;t
                see their hours, prices or a way to book, so they go to whoever shows up first. A simple one-page site
                is an easy first project to offer.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
          <section>
            <Eyebrow>Contact</Eyebrow>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-[13px] text-muted">Email</dt>
                <dd className="break-all">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="underline underline-offset-4">
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-faint">Not found</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Phone</dt>
                <dd>
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="font-mono underline underline-offset-4">
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-faint">Not found</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Website</dt>
                <dd className="break-all">
                  {lead.website ? (
                    <a href={lead.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-faint">None</span>
                  )}
                </dd>
              </div>
              {lead.lat !== null && lead.lon !== null && (
                <div>
                  <dt className="text-[13px] text-muted">Location</dt>
                  <dd>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${lead.lat}&mlon=${lead.lon}#map=18/${lead.lat}/${lead.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      Show on map
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
          <section className="border-t border-border pt-8">
            <Eyebrow>Where it stands</Eyebrow>
            <div className="mt-3">
              <LeadStatusForm leadId={lead.id} status={lead.status as LeadStatus} wonAmount={lead.wonAmountCents} notes={lead.notes} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
