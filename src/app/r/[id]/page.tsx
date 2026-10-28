import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditSummary, CheckList } from "@/components/audit-report";
import { DemoPitch } from "@/components/demo-pitch";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ButtonLink, Card } from "@/components/ui";
import { getAudit } from "@/lib/services/audits";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function generateMetadata({ params }: PageProps<"/r/[id]">): Promise<Metadata> {
  const { id } = await params;
  const audit = await getAudit(id);
  if (!audit) return { title: "Report not found" };
  const name = audit.businessName ?? hostOf(audit.url);
  return {
    title: `Website report for ${name}`,
    description: `${name} scored ${audit.score}/100 on a free website health check.`,
    robots: { index: false },
  };
}

export default async function ReportPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const audit = await getAudit(id);
  if (!audit) notFound();
  const name = audit.businessName ?? hostOf(audit.url);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <p className="text-sm text-muted">Free website health check · {audit.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Website report for {name}</h1>
        <a href={audit.finalUrl ?? audit.url} className="text-sm text-accent underline" rel="nofollow noopener" target="_blank">
          {audit.finalUrl ?? audit.url}
        </a>

        <Card className="mt-6">
          <AuditSummary score={audit.score} metrics={audit.metrics} />
        </Card>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">What we found</h2>
          <CheckList checks={audit.checks} />
        </section>

        <Card className="mt-10">
          <h2 className="mb-2 text-xl font-semibold">Freelancer? Turn this into a client.</h2>
          <DemoPitch auditId={audit.id} />
        </Card>

        <div className="mt-10 rounded-xl bg-accent-soft p-6 text-center">
          <p className="font-semibold">Made with Pitchcraft</p>
          <p className="mt-1 text-sm text-muted">Get 5 businesses like this, with ready-to-send pitches, every day.</p>
          <ButtonLink href="/signup" className="mt-4">
            Start free
          </ButtonLink>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
