type PageSpeedResult = { performance: number; lcpSeconds: number | null };

/** Mobile Lighthouse score from Google PageSpeed Insights. Returns null on any failure. */
export async function fetchPageSpeed(url: string, timeoutMs = 25_000): Promise<PageSpeedResult | null> {
  if (process.env.PAGESPEED_DISABLED === "1") return null;
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", "mobile");
  api.searchParams.set("category", "performance");
  if (process.env.PAGESPEED_API_KEY) api.searchParams.set("key", process.env.PAGESPEED_API_KEY);
  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number | null } };
        audits?: Record<string, { numericValue?: number }>;
      };
    };
    const score = data.lighthouseResult?.categories?.performance?.score;
    if (typeof score !== "number") return null;
    const lcpMs = data.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
    return { performance: Math.round(score * 100), lcpSeconds: lcpMs ? Math.round(lcpMs / 100) / 10 : null };
  } catch {
    return null;
  }
}
