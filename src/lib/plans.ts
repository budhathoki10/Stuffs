import type { User } from "@/db/schema";

export const PLAN_LIMITS = {
  free: { leadsPerDay: 5, leadsPerWeek: 5, pitchesPerWeek: 10, publishedSites: 1, monitors: 1, emailsPerDay: 20 },
  pro: { leadsPerDay: 5, leadsPerWeek: 35, pitchesPerWeek: 500, publishedSites: 50, monitors: 50, emailsPerDay: 150 },
} as const;

export const PRICES = {
  monthlyUsd: 19,
  yearlyUsd: 149,
  monthlyNpr: Number(process.env.KHALTI_PRO_PRICE_NPR ?? 999),
};

export function isPro(user: Pick<User, "proUntil">, now = new Date()): boolean {
  return !!user.proUntil && user.proUntil > now;
}

export function limitsFor(user: Pick<User, "proUntil">) {
  return isPro(user) ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

/** Monday 00:00 UTC of the week containing `now`, as YYYY-MM-DD. */
export function weekStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
