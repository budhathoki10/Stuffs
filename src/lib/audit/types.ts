export type Severity = "critical" | "major" | "minor";

export type AuditCheck = {
  id: string;
  label: string;
  passed: boolean;
  severity: Severity;
  /** Plain-language explanation shown to the business owner. */
  detail: string;
  /** Why it costs the business money; the pitch builds on this line. */
  impact: string;
};

export type AuditMetrics = {
  status: number | null;
  responseMs: number | null;
  pageBytes: number | null;
  https: boolean;
  redirects: number;
  /** Mobile performance score 0-100 from PageSpeed Insights, when available. */
  mobilePerformance: number | null;
  /** Largest Contentful Paint in seconds from PageSpeed, when available. */
  lcpSeconds: number | null;
  title: string | null;
  emails: string[];
  phones: string[];
  copyrightYear: number | null;
  error: string | null;
};

export type AuditResult = {
  url: string;
  finalUrl: string | null;
  score: number;
  checks: AuditCheck[];
  metrics: AuditMetrics;
};
