import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { startSite } from "@/app/actions/work";
import { PublishToggle } from "@/components/workspace/publish-toggle";
import { ShareLink } from "@/components/workspace/share-link";
import { SiteEditor } from "@/components/workspace/site-editor";
import { Badge, Button, Card, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { ownedLead } from "@/lib/services/leads";
import { messagesForSite, siteForLead, siteUrl } from "@/lib/services/sites";
import type { SiteTemplate } from "@/lib/work/types";

export const metadata: Metadata = { title: "Website" };

export default async function SiteTab({ params }: PageProps<"/app/leads/[id]/site">) {
  const user = await requireUser();
  const { id } = await params;
  const [lead, site] = await Promise.all([ownedLead(user.id, id), siteForLead(user.id, id)]);
  if (!lead) notFound();

  if (!site) {
    return (
      <Card className="max-w-2xl space-y-4 p-6">
        <h2 className="font-serif text-2xl font-medium">Build them a website</h2>
        <p className="text-sm text-muted">
          A one-page site with their services, opening hours, a map link, tap-to-call, WhatsApp and a booking form that emails them. It
          starts filled in with what we already know about {lead.name}. Fast on phones, and it passes every check in our own audit.
        </p>
        <p className="text-sm text-muted">
          Publish it at a Pitchcraft address, or download it as one HTML file and host it on their own domain.
        </p>
        <form action={startSite}>
          <input type="hidden" name="leadId" value={lead.id} />
          <Button type="submit">Start the website</Button>
        </form>
      </Card>
    );
  }

  const messages = await messagesForSite(user.id, site.id);
  const url = siteUrl(site.slug);

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-6 rounded-md border border-border bg-surface p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            {site.published ? <Badge tone="good">Live</Badge> : <Badge>Not published</Badge>}
            <a href={`/app/sites/${site.id}/preview`} target="_blank" rel="noopener" className="text-[13px] underline underline-offset-4">
              Full-page preview
            </a>
            <span className="text-faint">·</span>
            <a href={`/app/sites/${site.id}/download`} className="text-[13px] underline underline-offset-4">
              Download HTML
            </a>
          </div>
          {site.published ? (
            <ShareLink
              url={url}
              to={site.content.email || lead.email}
              subject={`Your new website is live`}
              body={`Hi,\n\nYour new website is live. Have a look and tell me what you'd like changed.`}
            />
          ) : (
            <p className="text-sm text-muted">
              When you publish, it goes live at <span className="font-mono text-foreground">{url}</span>. Show the client the preview first.
            </p>
          )}
        </div>
        <PublishToggle leadId={lead.id} published={site.published} />
      </section>

      <SiteEditor
        key={site.updatedAt.toISOString()}
        leadId={lead.id}
        siteId={site.id}
        initialTemplate={site.template as SiteTemplate}
        initialContent={site.content}
        builtBy={{ name: user.name, url: user.portfolioUrl }}
      />

      <section>
        <h2 className="mb-1 font-serif text-2xl font-medium">Booking requests</h2>
        <p className="mb-4 text-sm text-muted">Sent through the site&apos;s form. Each one is also emailed to the business and to you.</p>
        {messages.length === 0 ? (
          <p className="rounded-md border border-dashed border-strong-border px-5 py-6 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {messages.map(({ message: m }) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {m.name} <span className="font-normal text-muted">· {m.contact}</span>
                  </p>
                  <Eyebrow>{m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</Eyebrow>
                </div>
                {m.preferredDate && <p className="mt-1 text-[13px] text-muted">Preferred: {m.preferredDate}</p>}
                <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
