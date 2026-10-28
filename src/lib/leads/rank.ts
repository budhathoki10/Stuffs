import type { AuditCheck } from "@/lib/audit/types";
import { SKILLS, type SkillId } from "@/lib/skills";

// Checks that signal the strongest need for each kind of freelancer.
const SKILL_SIGNALS: Record<SkillId, string[]> = {
  web_dev: ["mobile", "https", "fresh", "reachable"],
  seo: ["title", "description", "h1", "alt"],
  speed: ["speed", "pagespeed", "weight", "reachable"],
  booking: ["booking", "contact"],
};

/**
 * 0-100: how promising this business is for this freelancer.
 * `checks` is null when the business has no website at all.
 */
export function opportunityScore(skill: SkillId, auditScore: number | null, checks: AuditCheck[] | null): number {
  if (!checks || auditScore === null) {
    if (SKILLS[skill].prefersNoWebsite) return 100;
    return skill === "booking" ? 75 : skill === "seo" ? 55 : 15;
  }
  const failed = new Set(checks.filter((c) => !c.passed).map((c) => c.id));
  const signalHits = SKILL_SIGNALS[skill].filter((id) => failed.has(id)).length;
  // For web developers nothing beats "no website at all", so existing sites cap just below it.
  const cap = SKILLS[skill].prefersNoWebsite ? 95 : 100;
  return Math.min(cap, Math.round((100 - auditScore) * 0.7 + signalHits * 15));
}
