import type { AuditCheck } from "@/lib/audit/types";
import type { Currency, LineItem } from "./types";

/**
 * Starting prices for fixing each problem the audit finds. They're suggestions the
 * freelancer edits before sending; NPR prices reflect Kathmandu rates, not conversions.
 */
type PriceEntry = { title: string; detail: string; usd: number; npr: number };

const NEW_SITE: PriceEntry = {
  title: "New website",
  detail: "Up to 5 pages, works on phones, contact and booking form, set up on Google.",
  usd: 600,
  npr: 35000,
};
const DOMAIN_HOSTING: PriceEntry = {
  title: "Domain and hosting, first year",
  detail: "Registration, HTTPS certificate and hosting.",
  usd: 60,
  npr: 4000,
};

const FIXES: Record<string, PriceEntry> = {
  reachable: { title: "Fix the broken website", detail: "Find out why it's down and get it back online, or rebuild it.", usd: 400, npr: 25000 },
  https: { title: "Set up HTTPS", detail: 'Security certificate, so browsers stop showing "Not secure".', usd: 50, npr: 3000 },
  mobile: { title: "Make it work on phones", detail: "Rework the layout so it fits any screen.", usd: 250, npr: 15000 },
  pagespeed: { title: "Speed up the site", detail: "Compress images, trim scripts, add caching.", usd: 150, npr: 8000 },
  speed: { title: "Speed up the site", detail: "Compress images, trim scripts, add caching.", usd: 150, npr: 8000 },
  seo: {
    title: "Search engine basics",
    detail: "Page titles, Google descriptions, headings and image descriptions.",
    usd: 120,
    npr: 6000,
  },
  contact: { title: "Make it easy to get in touch", detail: "Tap-to-call, email link and a contact form.", usd: 60, npr: 3000 },
  booking: { title: "Online booking", detail: "A booking or order request form that emails you.", usd: 150, npr: 8000 },
  fresh: { title: "Content refresh", detail: "Update dates, hours, prices and photos.", usd: 60, npr: 3000 },
  polish: { title: "Link previews and browser icon", detail: "Preview image for WhatsApp/Facebook shares, and a tab icon.", usd: 30, npr: 1500 },
};

// Several small checks are one job for the client.
const GROUP: Record<string, string> = {
  title: "seo",
  description: "seo",
  h1: "seo",
  alt: "seo",
  weight: "speed",
  social: "polish",
  favicon: "polish",
};

// Rough rates for currencies without their own price list.
const FROM_USD: Record<Exclude<Currency, "NPR" | "USD">, number> = { INR: 85, GBP: 0.8, EUR: 0.92, AUD: 1.5 };

function price(entry: PriceEntry, currency: Currency): number {
  if (currency === "NPR") return entry.npr * 100;
  if (currency === "USD") return entry.usd * 100;
  // Round to a whole 5 so converted prices don't look computed.
  return Math.round((entry.usd * FROM_USD[currency]) / 5) * 5 * 100;
}

function item(entry: PriceEntry, currency: Currency): LineItem {
  return { title: entry.title, detail: entry.detail, amountMinor: price(entry, currency) };
}

/** Line items for a quote, built from what the audit found. `checks` is null when there's no website. */
export function quoteFromChecks(checks: AuditCheck[] | null, currency: Currency): LineItem[] {
  if (!checks || checks.some((c) => c.id === "website" && !c.passed)) {
    return [item(NEW_SITE, currency), item(DOMAIN_HOSTING, currency)];
  }
  const keys: string[] = [];
  for (const c of checks) {
    if (c.passed) continue;
    const key = GROUP[c.id] ?? c.id;
    if (FIXES[key] && !keys.includes(key)) keys.push(key);
  }
  // Two speed checks are the same job.
  const unique = keys.filter((k, i) => !(k === "speed" && keys.includes("pagespeed") && keys.indexOf("pagespeed") < i));
  return unique.map((k) => item(FIXES[k], currency));
}

/**
 * Parse an amount a person typed ("35,000", "1 200.50", "$600") into minor units.
 * Returns null for anything that isn't a sensible positive amount.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!cleaned || cleaned.split(".").length > 2) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000) return null;
  return Math.round(value * 100);
}

/** Major units for an input box: 3500000 -> "35000", 1250 -> "12.5". */
export function amountInputValue(minor: number): string {
  return String(minor / 100);
}

const CURRENCY_HINTS: [RegExp, Currency][] = [
  [/nepal|kathmandu|lalitpur|bhaktapur|pokhara|biratnagar|chitwan|butwal/i, "NPR"],
  [/india|delhi|mumbai|bengaluru|bangalore|kolkata|chennai/i, "INR"],
  [/united kingdom|england|scotland|wales|london|\buk\b/i, "GBP"],
  [/australia|sydney|melbourne|brisbane|perth/i, "AUD"],
  [/germany|france|spain|italy|netherlands|ireland|portugal|austria|belgium/i, "EUR"],
];

/** Best guess at the client's currency from their address, so the first quote is priced locally. */
export function currencyForAddress(address: string | null | undefined): Currency {
  if (address) for (const [re, c] of CURRENCY_HINTS) if (re.test(address)) return c;
  return "USD";
}
