import { analyzePage, scoreChecks, unreachableChecks } from "./analyze";
import { fetchPageSpeed } from "./pagespeed";
import { FetchBlockedError, normalizeUrl, safeFetch } from "./safe-fetch";
import type { AuditCheck, AuditMetrics, AuditResult } from "./types";

export { FetchBlockedError, normalizeUrl } from "./safe-fetch";
export { topIssues } from "./analyze";
export type * from "./types";

const emptyMetrics = (error: string | null): AuditMetrics => ({
  status: null,
  responseMs: null,
  pageBytes: null,
  https: false,
  redirects: 0,
  mobilePerformance: null,
  lcpSeconds: null,
  title: null,
  emails: [],
  phones: [],
  copyrightYear: null,
  error,
});

function pageSpeedCheck(performance: number, lcpSeconds: number | null): AuditCheck {
  return {
    id: "pagespeed",
    label: "Fast on mobile (Google PageSpeed)",
    passed: performance >= 70,
    severity: performance < 50 ? "critical" : "major",
    detail: `Google rates mobile performance ${performance}/100${lcpSeconds ? `; the main content appears after ${lcpSeconds}s` : ""}.`,
    impact: "Google ranks slow mobile sites lower, and visitors on phones leave before the page finishes loading.",
  };
}

/**
 * Audit a website. Never throws for unreachable sites: those get a 0 score and
 * a "website loads" failure, which is itself a sales opportunity.
 */
export async function runAudit(input: string, opts: { pageSpeed?: boolean } = {}): Promise<AuditResult> {
  const url = normalizeUrl(input).toString();
  let page;
  try {
    page = await safeFetch(url);
  } catch (err) {
    if (err instanceof FetchBlockedError) throw err;
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      url,
      finalUrl: null,
      score: 0,
      checks: unreachableChecks("down", `The website could not be loaded (${message}).`),
      metrics: emptyMetrics(message),
    };
  }

  if (page.status >= 400) {
    return {
      url,
      finalUrl: page.finalUrl,
      score: 0,
      checks: unreachableChecks("down", `The website returned an error (HTTP ${page.status}).`),
      metrics: { ...emptyMetrics(`HTTP ${page.status}`), status: page.status, responseMs: page.responseMs },
    };
  }

  const { checks, metrics } = analyzePage({
    status: page.status,
    finalUrl: page.finalUrl,
    html: page.body,
    bytes: page.bytes,
    responseMs: page.responseMs,
    redirects: page.redirects,
  });

  if (opts.pageSpeed !== false) {
    const ps = await fetchPageSpeed(page.finalUrl);
    if (ps) {
      metrics.mobilePerformance = ps.performance;
      metrics.lcpSeconds = ps.lcpSeconds;
      checks.splice(2, 0, pageSpeedCheck(ps.performance, ps.lcpSeconds));
    }
  }

  return { url, finalUrl: page.finalUrl, score: scoreChecks(checks), checks, metrics };
}

/** Synthetic audit for a business with no website listed. */
export function noWebsiteAudit(): Pick<AuditResult, "score" | "checks"> {
  return { score: 0, checks: unreachableChecks("none", "") };
}
