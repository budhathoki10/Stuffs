import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { scoreVerdict } from "@/components/audit-report";
import { ClientPage } from "@/components/workspace/client-page";
import { Badge, Eyebrow, ScoreMeter } from "@/components/ui";
import { PROBLEM_SHORT } from "@/lib/audit/problems";
import { formatDay } from "@/lib/dates";
import { publicComparison } from "@/lib/services/comparisons";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = await publicComparison(id);
  if (!found) return { title: "Report not found" };
  return {
    title: `${found.business}: before and after`,
    description: found.before
      ? `Website score went from ${found.before.score} to ${found.after.score} out of 100.`
      : `New website scores ${found.after.score} out of 100.`,
    robots: { index: false },
  };
}

export default async function ComparisonPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const found = await publicComparison(id);
  if (!found) notFound();
  const { business, freelancer, before, after, comparison } = found;

  const beforeById = new Map(before?.checks.map((c) => [c.id, c]) ?? []);
  const rows = after.checks
    .filter((c) => c.id !== "website")
    .map((c) => {
      const was = beforeById.get(c.id);
      const state = !c.passed ? "todo" : before && (!was || was.passed) ? "kept" : "fixed";
      return { check: c, state };
    })
    .sort((a, b) => ["fixed", "todo", "kept"].indexOf(a.state) - ["fixed", "todo", "kept"].indexOf(b.state));
  const fixed = rows.filter((r) => r.state === "fixed").length;

  return (
    <ClientPage from={freelancer}>
      <Eyebrow>Before and after · {formatDay(comparison.createdAt)}</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">{business}</h1>
      <p className="mt-1 text-sm text-muted">
        {before
          ? `${fixed === 1 ? "One problem" : `${fixed} problems`} fixed by ${freelancer.name}.`
          : `${business} had no website. This is the one ${freelancer.name} built.`}
      </p>

      <div className="mt-8 grid gap-6 border-y border-border py-6 sm:grid-cols-2">
        <div>
          <Eyebrow className="mb-3">Before{before && ` · ${formatDay(before.createdAt)}`}</Eyebrow>
          {before ? (
            <>
              <ScoreMeter score={before.score} />
              <p className="mt-2 text-sm text-muted">{scoreVerdict(before.score)}</p>
            </>
          ) : (
            <p className="font-serif text-2xl">No website</p>
          )}
        </div>
        <div>
          <Eyebrow className="mb-3">Now · {formatDay(after.createdAt)}</Eyebrow>
          <ScoreMeter score={after.score} />
          <p className="mt-2 text-sm text-muted">{scoreVerdict(after.score)}</p>
        </div>
      </div>

      <ol className="mt-8 divide-y divide-border border-y border-border">
        {rows.map(({ check, state }) => (
          <li key={check.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{state === "todo" ? (PROBLEM_SHORT[check.id] ?? check.label) : check.label}</p>
              <p className="mt-0.5 text-sm text-muted">{check.detail}</p>
            </div>
            {state === "fixed" ? <Badge tone="good">Fixed</Badge> : state === "todo" ? <Badge tone="warn">Still to do</Badge> : <Badge>Passing</Badge>}
          </li>
        ))}
      </ol>
      <p className="mt-6 break-all font-mono text-[13px] text-muted">{after.finalUrl ?? after.url}</p>
    </ClientPage>
  );
}
