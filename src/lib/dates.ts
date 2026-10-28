/** Calendar-date helpers. Dates are YYYY-MM-DD strings in UTC, matching Postgres `date` columns. */

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string | Date, n: number): string {
  const d = typeof day === "string" ? new Date(`${day}T00:00:00Z`) : new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** "28 Oct 2026" */
export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
