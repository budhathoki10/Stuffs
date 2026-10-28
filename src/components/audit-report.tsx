import type { AuditCheck, AuditMetrics } from "@/lib/audit/types";
import { Badge, ScoreRing } from "./ui";

const SEVERITY_TONE = { critical: "bad", major: "warn", minor: "neutral" } as const;

export function scoreVerdict(score: number) {
  if (score >= 80) return "In good shape";
  if (score >= 50) return "Needs attention";
  return "Losing customers";
}

export function AuditSummary({ score, metrics }: { score: number; metrics: AuditMetrics }) {
  return (
    <div className="flex items-center gap-5">
      <ScoreRing score={score} />
      <div>
        <p className="text-xl font-semibold">{scoreVerdict(score)}</p>
        <p className="text-sm text-muted">
          {metrics.responseMs !== null ? `Loaded in ${(metrics.responseMs / 1000).toFixed(1)}s` : "Could not load"}
          {metrics.mobilePerformance !== null && ` · Google mobile score ${metrics.mobilePerformance}/100`}
        </p>
      </div>
    </div>
  );
}

export function CheckList({ checks }: { checks: AuditCheck[] }) {
  const failed = checks.filter((c) => !c.passed);
  const passed = checks.filter((c) => c.passed);
  return (
    <div className="space-y-6">
      {failed.length > 0 && (
        <ul className="space-y-3">
          {failed.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">✗ {c.label}</span>
                <Badge tone={SEVERITY_TONE[c.severity]}>{c.severity}</Badge>
              </div>
              <p className="mt-1 text-sm">{c.detail}</p>
              <p className="mt-1 text-sm text-muted">Why it matters: {c.impact}</p>
            </li>
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted">Passed ({passed.length})</h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {passed.map((c) => (
              <li key={c.id} className="text-accent">
                ✓ <span className="text-foreground">{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
