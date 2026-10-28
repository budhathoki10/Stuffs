import { parse } from "node-html-parser";
import type { AuditCheck, AuditMetrics, Severity } from "./types";

export type PageFacts = {
  status: number;
  finalUrl: string;
  html: string;
  bytes: number;
  responseMs: number;
  redirects: number;
};

const WEIGHTS: Record<Severity, number> = { critical: 25, major: 12, minor: 5 };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const IGNORED_EMAIL_DOMAINS = ["example.com", "sentry.io", "wixpress.com", "domain.com"];

export function extractEmails(html: string, mailtos: string[]): string[] {
  const found = new Set<string>();
  for (const href of mailtos) {
    const addr = decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0]).trim().toLowerCase();
    if (addr.includes("@")) found.add(addr);
  }
  for (const match of html.match(EMAIL_RE) ?? []) {
    const addr = match.toLowerCase();
    // Skip asset names like logo@2x.png that look like addresses.
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(addr)) continue;
    found.add(addr);
  }
  return [...found].filter((e) => !IGNORED_EMAIL_DOMAINS.some((d) => e.endsWith(`@${d}`))).slice(0, 5);
}

function check(
  id: string,
  label: string,
  passed: boolean,
  severity: Severity,
  detail: string,
  impact: string,
): AuditCheck {
  return { id, label, passed, severity, detail, impact };
}

/** Turn a fetched page into human-readable checks plus extracted facts. */
export function analyzePage(page: PageFacts, now = new Date()): { checks: AuditCheck[]; metrics: AuditMetrics } {
  const root = parse(page.html, { comment: false });
  const https = page.finalUrl.startsWith("https://");
  const title = root.querySelector("title")?.textContent.trim() || null;
  const description = root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  const viewport = root.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
  const h1Count = root.querySelectorAll("h1").length;
  const images = root.querySelectorAll("img");
  const missingAlt = images.filter((img) => !img.getAttribute("alt")?.trim()).length;
  const ogImage = !!root.querySelector('meta[property="og:image"]');
  const favicon = !!root.querySelector('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  const links = root.querySelectorAll("a[href]").map((a) => a.getAttribute("href") ?? "");
  const mailtos = links.filter((h) => /^mailto:/i.test(h));
  const tels = links.filter((h) => /^tel:/i.test(h)).map((h) => decodeURIComponent(h.slice(4)).trim());
  const hasForm = root.querySelectorAll("form").length > 0;
  const text = root.querySelector("body")?.textContent ?? root.textContent;
  const bookingWords = /\b(book (now|online|an appointment)|schedule (a|an|your)|reserve|appointment|order online)\b/i;
  const hasBooking = bookingWords.test(text) || links.some((h) => /calendly|booking|reserv|opentable|squareup|fresha/i.test(h));

  const years = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const copyrightYear = years.length ? Math.max(...years) : null;
  const staleYears = copyrightYear ? now.getFullYear() - copyrightYear : 0;
  const responseSec = page.responseMs / 1000;
  const sizeMb = page.bytes / 1024 / 1024;

  const checks: AuditCheck[] = [
    check(
      "https",
      "Secure connection (HTTPS)",
      https,
      "critical",
      https ? "The site loads over HTTPS." : "The site loads without HTTPS, so browsers label it \"Not secure\".",
      "Visitors see a \"Not secure\" warning and leave before calling or booking.",
    ),
    check(
      "mobile",
      "Works on phones",
      /width\s*=\s*device-width/i.test(viewport),
      "critical",
      viewport ? "The page declares a mobile viewport." : "The page has no mobile viewport, so phones show a shrunken desktop page.",
      "Most local searches happen on phones; a page that needs pinch-zooming loses those customers.",
    ),
    check(
      "speed",
      "Responds quickly",
      responseSec < 2.5,
      "major",
      `The server took ${responseSec.toFixed(1)}s to deliver the page.`,
      "Every extra second of loading time noticeably increases the number of visitors who give up.",
    ),
    check(
      "weight",
      "Lightweight page",
      sizeMb < 1.5,
      "minor",
      `The HTML alone is ${sizeMb.toFixed(2)} MB.`,
      "Heavy pages load slowly on mobile data.",
    ),
    check(
      "title",
      "Search-friendly page title",
      !!title && title.length >= 10 && title.length <= 70,
      "major",
      title ? `Title: "${title.slice(0, 80)}" (${title.length} characters).` : "The page has no title.",
      "The title is the headline Google shows; a weak one means fewer clicks from search.",
    ),
    check(
      "description",
      "Search result description",
      description.length >= 50 && description.length <= 170,
      "major",
      description ? `Description is ${description.length} characters long.` : "There is no meta description.",
      "Without a description Google picks random text, which makes the listing less convincing.",
    ),
    check(
      "h1",
      "Clear main heading",
      h1Count === 1,
      "minor",
      `Found ${h1Count} main (H1) heading${h1Count === 1 ? "" : "s"}.`,
      "A single clear heading helps both visitors and search engines understand the business.",
    ),
    check(
      "alt",
      "Image descriptions",
      images.length === 0 || missingAlt / images.length <= 0.2,
      "minor",
      `${missingAlt} of ${images.length} images have no description (alt text).`,
      "Missing image descriptions hurt accessibility and image search traffic.",
    ),
    check(
      "contact",
      "Easy to contact",
      tels.length > 0 || mailtos.length > 0 || hasForm,
      "major",
      tels.length || mailtos.length || hasForm
        ? "Visitors can tap to call, email, or use a form."
        : "There is no tap-to-call link, email link, or contact form.",
      "If contacting the business takes effort, interested customers go to a competitor.",
    ),
    check(
      "booking",
      "Online booking or ordering",
      hasBooking,
      "minor",
      hasBooking ? "Customers can book or order online." : "There is no way to book or order online.",
      "Online booking captures customers outside business hours.",
    ),
    check(
      "fresh",
      "Looks up to date",
      !copyrightYear || staleYears <= 1,
      "minor",
      copyrightYear ? `The footer says © ${copyrightYear}.` : "No copyright year found.",
      "An old year in the footer makes visitors wonder whether the business is still open.",
    ),
    check(
      "social",
      "Nice link previews",
      ogImage,
      "minor",
      ogImage ? "Shared links show a preview image." : "Shared links on WhatsApp/Facebook show no preview image.",
      "Links shared by happy customers look plain and get fewer clicks.",
    ),
    check(
      "favicon",
      "Browser tab icon",
      favicon,
      "minor",
      favicon ? "The site has a tab icon." : "The site has no tab icon (favicon).",
      "Small detail, but it makes the business look less professional.",
    ),
  ];

  const metrics: AuditMetrics = {
    status: page.status,
    responseMs: page.responseMs,
    pageBytes: page.bytes,
    https,
    redirects: page.redirects,
    mobilePerformance: null,
    lcpSeconds: null,
    title,
    emails: extractEmails(page.html, mailtos),
    phones: [...new Set(tels)].slice(0, 3),
    copyrightYear,
    error: null,
  };
  return { checks, metrics };
}

/** Checks for a business that has no website at all, or whose site is unreachable. */
export function unreachableChecks(reason: "none" | "down", detail: string): AuditCheck[] {
  if (reason === "none") {
    return [
      check(
        "website",
        "Has a website",
        false,
        "critical",
        "This business has no website listed.",
        "Customers who search online can't find opening hours, prices, or a way to book, so they pick a competitor.",
      ),
    ];
  }
  return [
    check(
      "reachable",
      "Website loads",
      false,
      "critical",
      detail,
      "Customers who click the website link get an error and assume the business has closed.",
    ),
  ];
}

export function scoreChecks(checks: AuditCheck[]): number {
  const lost = checks.filter((c) => !c.passed).reduce((sum, c) => sum + WEIGHTS[c.severity], 0);
  return Math.max(0, Math.min(100, 100 - lost));
}

/** Failed checks, most serious first. */
export function topIssues(checks: AuditCheck[], limit = 3): AuditCheck[] {
  const order: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };
  return checks.filter((c) => !c.passed).sort((a, b) => order[a.severity] - order[b.severity]).slice(0, limit);
}
