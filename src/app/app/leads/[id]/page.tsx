import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AuditSummary, CheckList } from "@/components/audit-report";
import { LeadPitch, LeadStatusForm } from "@/components/lead-actions";
import { Conversation } from "@/components/workspace/conversation";
import { topIssues } from "@/lib/audit";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import type { LeadStatus } from "@/lib/leads/status";
import { needsRefresh, refreshGoogleLead } from "@/lib/services/google-refresh";
import { getLeadWithAudit, latestPitch } from "@/lib/services/leads";
import { conversation, markRead } from "@/lib/services/outreach";
import { quoteForLead } from "@/lib/services/quotes";
import { siteForLead } from "@/lib/services/sites";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/app/leads/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let row = await getLeadWithAudit(user.id, id);
  if (!row) notFound();
  if (needsRefresh(row.lead) && process.env.GOOGLE_MAPS_API_KEY) {
    try {
      await refreshGoogleLead(row.lead);
      row = (await getLeadWithAudit(user.id, id)) ?? row;
    } catch (err) {
      // Showing slightly old details beats failing the page; the daily job retries.
      console.error(`Refreshing Google lead ${id} failed`, err);
    }
  }
  const { lead, audit } = row;
  const [pitch, quote, site, messages] = await Promise.all([
    latestPitch(user.id, lead.id),
    quoteForLead(user.id, lead.id),
    siteForLead(user.id, lead.id),
    conversation(user.id, lead.id),
  ]);
  if (messages.some((m) => m.direction === "in" && !m.readAt)) await markRead(user.id, lead.id);
  const emailed = messages.some((m) => m.direction === "out" && m.status === "sent");
  const lastIn = messages.findLast((m) => m.direction === "in");
  const base = `/app/leads/${lead.id}`;
  // One suggestion at a time, following the order the work usually happens in.
  const next =
    lead.status === "lost"
      ? null
      : lastIn && messages.at(-1) === lastIn
        ? { text: `${lead.name} replied. Answer them below.`, href: "#conversation", label: "Read the reply" }
        : !emailed && lead.status === "new"
        ? { text: "Draft the first email below and send it.", href: null }
        : !quote
          ? { text: "Interested? Turn the problems we found into a priced quote.", href: `${base}/quote`, label: "Build the quote" }
          : quote.status !== "accepted" && lead.status !== "won"
            ? { text: "Waiting on their answer to your quote.", href: `${base}/quote`, label: "See the quote" }
            : !site?.published
              ? { text: "They said yes. Build and publish their new website.", href: `${base}/site`, label: "Open the site builder" }
              : { text: "Site's live. Send the before-and-after report and your invoice.", href: `${base}/care`, label: "Results and care" };

  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-12">
          {messages.length > 0 ? (
            <section id="conversation" className="scroll-mt-6">
              <h2 className="mb-4 font-serif text-2xl font-medium">Conversation</h2>
              <Conversation
                leadId={lead.id}
                businessName={lead.name}
                freelancerName={user.name}
                messages={messages}
                problemId={lead.website ? (audit ? (topIssues(audit.checks)[0]?.id ?? null) : null) : "website"}
                optedOut={!!lead.optedOutAt}
              />
            </section>
          ) : (
            <section id="conversation" className="scroll-mt-6">
              <h2 className="font-serif text-2xl font-medium">Your email</h2>
              {lead.optedOutAt ? (
                <p className="mt-2 text-sm text-muted">{lead.name} asked not to be emailed.</p>
              ) : !lead.email ? (
                <p className="mt-2 text-sm text-muted">
                  We couldn&apos;t find an email address for them. If you find one (on Facebook, or by calling
                  {lead.phone ? ` ${lead.phone}` : ""}), type it in the To line. Otherwise, use the draft as your phone script.
                </p>
              ) : null}
              {!lead.optedOutAt && (
                <div className="mt-4">
                  <LeadPitch leadId={lead.id} email={lead.email} existing={pitch ? { subject: pitch.subject, body: pitch.body } : null} />
                </div>
              )}
            </section>
          )}

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
          {next && (
            <section className="border-l-2 border-ink pl-3">
              <Eyebrow>Next step</Eyebrow>
              <p className="mt-1.5 text-sm">{next.text}</p>
              {next.href && (
                <Link href={next.href} className="mt-1 inline-block text-sm font-medium underline underline-offset-4">
                  {next.label}
                </Link>
              )}
            </section>
          )}
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
            {lead.source === "google" && <p className="mt-3 text-xs text-faint">Business details from Google Maps</p>}
          </section>
          <section className="border-t border-border pt-8">
            <Eyebrow>Where it stands</Eyebrow>
            <div className="mt-3">
              <LeadStatusForm
                leadId={lead.id}
                status={lead.status as LeadStatus}
                wonAmount={lead.wonAmountCents}
                currency={lead.currency}
                followUpOn={lead.followUpOn}
                notes={lead.notes}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
