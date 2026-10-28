import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditSummary, CheckList } from "@/components/audit-report";
import { DemoPitch } from "@/components/demo-pitch";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Eyebrow } from "@/components/ui";
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

  const checkedOn = audit.createdAt.toLocaleDateString("en-US", { dateStyle: "long" });
  const problems = audit.checks.filter((c) => !c.passed).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <Eyebrow>Website check · {checkedOn}</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium leading-tight tracking-tight">{name}</h1>
        <a
          href={audit.finalUrl ?? audit.url}
          className="mt-1 inline-block break-all font-mono text-sm text-muted underline-offset-4 hover:underline"
          rel="nofollow noopener noreferrer"
          target="_blank"
        >
          {audit.finalUrl ?? audit.url}
        </a>

        <div className="mt-8 border-y border-border py-6">
          <AuditSummary score={audit.score} metrics={audit.metrics} />
        </div>

        <section className="mt-10">
          <h2 className="font-serif text-2xl font-medium">
            {problems === 0 ? "Nothing to fix" : problems === 1 ? "One thing to fix" : `${problems} things to fix`}
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted">Most serious first. Each one is something a visitor would notice.</p>
          <CheckList checks={audit.checks} />
        </section>

        <section className="mt-14 rounded-md border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-medium">Are you a freelancer?</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Draft the email you&apos;d send this business, built from the problems above. You can edit it before
            sending.
          </p>
          <DemoPitch auditId={audit.id} />
        </section>

        <p className="mt-10 text-sm text-muted">
          This report was made with Pitchcraft, which finds businesses like this one for freelancers every morning.{" "}
          <Link href="/signup" className="text-foreground underline underline-offset-4">
            Try it free
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
