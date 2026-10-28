import { PROBLEM_SHORT } from "@/lib/audit/problems";
import type { AuditCheck, AuditMetrics, Severity } from "@/lib/audit/types";
import { ScoreMeter } from "./ui";

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Serious",
  major: "Worth fixing",
  minor: "Minor",
};

export function scoreVerdict(score: number) {
  if (score >= 80) return "Mostly in good shape";
  if (score >= 50) return "Needs some work";
  return "Probably costing them customers";
}

export function AuditSummary({ score, metrics }: { score: number; metrics: AuditMetrics }) {
  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
      <ScoreMeter score={score} />
      <div>
        <p className="font-serif text-2xl font-medium leading-tight">{scoreVerdict(score)}</p>
        <p className="mt-1 text-sm text-muted">
          {metrics.responseMs !== null ? `Server answered in ${(metrics.responseMs / 1000).toFixed(1)}s` : "The site didn't load"}
          {metrics.mobilePerformance !== null && ` · Google's phone speed score ${metrics.mobilePerformance}/100`}
        </p>
      </div>
    </div>
  );
}

export function CheckList({ checks }: { checks: AuditCheck[] }) {
  const order: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };
  const failed = checks.filter((c) => !c.passed).sort((a, b) => order[a.severity] - order[b.severity]);
  const passed = checks.filter((c) => c.passed);
  return (
    <div>
      {failed.length > 0 && (
        <ol className="divide-y divide-border border-y border-border">
          {failed.map((c, i) => (
            <li key={c.id} className="grid grid-cols-[2rem_1fr] gap-x-2 py-4">
              <span className="pt-0.5 font-mono text-sm text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-medium">
                    <span className="pen-mark">{PROBLEM_SHORT[c.id] ?? c.label}</span>
                  </p>
                  <span className={`text-xs ${c.severity === "critical" ? "font-medium text-pen" : "text-muted"}`}>
                    {SEVERITY_LABEL[c.severity]}
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{c.detail}</p>
                <p className="mt-1 text-sm text-muted">{c.impact}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {passed.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          <span className="font-medium text-foreground">Checked and fine: </span>
          {passed.map((c) => c.label).join(", ")}.
        </p>
      )}
    </div>
  );
}
