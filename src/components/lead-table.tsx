import Link from "next/link";
import { STATUS_LABELS, type LeadStatus } from "@/lib/leads/status";
import type { LeadRow } from "@/lib/services/leads";

export function LeadTable({ rows, label }: { rows: LeadRow[]; label: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <table className="w-full text-left text-sm" aria-label={label}>
        <thead className="border-b border-border bg-background text-[11px] uppercase tracking-[0.08em] text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Business</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Biggest problem</th>
            <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Score</th>
            <th className="px-4 py-2.5 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ lead, auditScore, topProblem }) => (
            <tr key={lead.id} className="group relative hover:bg-background">
              <td className="px-4 py-3">
                {/* The stretched link makes the whole row clickable while keeping one link per row. */}
                <Link href={`/app/leads/${lead.id}`} className="font-medium after:absolute after:inset-0">
                  {lead.name}
                </Link>
                <p className="text-[13px] text-muted">
                  {lead.category}
                  {lead.address ? ` · ${lead.address}` : ""}
                </p>
                {topProblem && <p className="mt-0.5 text-[13px] text-pen md:hidden">{topProblem}</p>}
              </td>
              <td className="hidden px-4 py-3 text-pen md:table-cell">{topProblem ?? <span className="text-faint">None found</span>}</td>
              <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-muted sm:table-cell">
                {auditScore ?? <span className="text-faint">n/a</span>}
              </td>
              <td className="px-4 py-3 text-right text-[13px] whitespace-nowrap">
                <span className={lead.status === "won" ? "font-medium text-money" : lead.status === "new" ? "text-muted" : ""}>
                  {STATUS_LABELS[lead.status as LeadStatus] ?? lead.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
