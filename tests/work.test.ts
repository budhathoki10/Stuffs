import { describe, expect, it } from "vitest";
import { analyzePage } from "@/lib/audit/analyze";
import type { AuditCheck } from "@/lib/audit/types";
import type { Monitor } from "@/db/schema";
import { addDays, formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { nextState, summarize, type CheckResult } from "@/lib/work/monitor";
import { amountInputValue, currencyForAddress, parseAmount, quoteFromChecks } from "@/lib/work/pricing";
import { defaultSiteContent, renderSiteHtml, slugify, templateForCategory } from "@/lib/work/site";
import { hasPaymentDetails, lineItemsTotal } from "@/lib/work/types";

const NOW = new Date("2026-10-28T09:00:00Z");
const check = (id: string, passed: boolean): AuditCheck => ({ id, label: id, passed, severity: "major", detail: "", impact: "" });

describe("quotes from an audit", () => {
  it("prices a new site and hosting when there's no website", () => {
    const items = quoteFromChecks(null, "NPR");
    expect(items.map((i) => i.title)).toEqual(["New website", "Domain and hosting, first year"]);
    expect(lineItemsTotal(items)).toBe(39_000_00);
  });

  it("treats an unreachable 'website' check like no website", () => {
    expect(quoteFromChecks([check("website", false)], "USD")[0].title).toBe("New website");
  });

  it("turns each failed check into one line, grouping checks that are the same job", () => {
    const items = quoteFromChecks(
      [check("https", false), check("title", false), check("description", false), check("h1", false), check("mobile", true), check("favicon", false), check("social", false)],
      "USD",
    );
    expect(items.map((i) => i.title)).toEqual(["Set up HTTPS", "Search engine basics", "Link previews and browser icon"]);
    expect(items.map((i) => i.amountMinor)).toEqual([5000, 12000, 3000]);
  });

  it("doesn't charge twice for slow loading", () => {
    const items = quoteFromChecks([check("pagespeed", false), check("speed", false), check("weight", false)], "USD");
    expect(items.map((i) => i.title)).toEqual(["Speed up the site"]);
  });

  it("returns nothing for a site that passes", () => {
    expect(quoteFromChecks([check("https", true), check("mobile", true)], "USD")).toEqual([]);
  });

  it("converts other currencies to round numbers", () => {
    const [https] = quoteFromChecks([check("https", false)], "EUR");
    expect(https.amountMinor).toBe(4500); // 50 * 0.92 = 46, rounded to 45
    expect(https.amountMinor % 500).toBe(0);
  });
});

describe("amounts people type", () => {
  it.each([
    ["35,000", 3_500_000],
    ["$600", 60_000],
    ["1 200.50", 120_050],
    ["12.5", 1250],
    ["0", 0],
  ])("%s", (input, minor) => expect(parseAmount(input)).toBe(minor));

  it.each(["", "abc", "1.2.3", "999999999999"])("rejects %j", (input) => expect(parseAmount(input)).toBeNull());

  it("round-trips through the input box", () => {
    expect(amountInputValue(3_500_000)).toBe("35000");
    expect(parseAmount(amountInputValue(1250))).toBe(1250);
  });

  it("formats money without needless decimals", () => {
    expect(formatMoney(3_500_000, "NPR")).toBe("NPR\u00a035,000"); // Intl puts a no-break space after the code;
    expect(formatMoney(1250, "USD")).toBe("$12.50");
  });
});

describe("currency from the client's address", () => {
  it.each([
    ["Thamel, Kathmandu 44600, Nepal", "NPR"],
    ["Lakeside, Pokhara", "NPR"],
    ["Connaught Place, New Delhi, India", "INR"],
    ["12 High St, London", "GBP"],
    ["Austin, TX", "USD"],
    [null, "USD"],
  ])("%s -> %s", (address, currency) => expect(currencyForAddress(address)).toBe(currency));
});

describe("dates", () => {
  it("adds days across month ends in UTC", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays(new Date("2026-12-31T23:30:00Z"), 1)).toBe("2027-01-01");
  });
  it("formats strings and Dates the same way", () => {
    expect(formatDay("2026-10-28")).toBe("28 Oct 2026");
    expect(formatDay(NOW)).toBe("28 Oct 2026");
  });
});

describe("client websites", () => {
  const content = defaultSiteContent({
    businessName: "Smile Dental Clinic",
    category: "Dentist",
    template: "clinic",
    phone: "+977 1-4412345",
    email: "hello@smile.test",
    address: "Baneshwor, Kathmandu",
  });
  const render = (c = content, formAction: string | null = "/s/smile/contact") =>
    renderSiteHtml(c, {
      template: "clinic",
      formAction,
      canonicalUrl: "https://pitchcraft.app/s/smile",
      ogImageUrl: "https://pitchcraft.app/s/smile/og",
      builtBy: { name: "Kushal", url: "https://kushal.dev" },
      year: 2026,
    });

  it("picks a template from the category", () => {
    expect(templateForCategory("Dentist")).toBe("clinic");
    expect(templateForCategory("Café")).toBe("restaurant");
    expect(templateForCategory("Guest house")).toBe("stay");
    expect(templateForCategory("Hardware store")).toBe("shop");
  });

  it("passes every check in our own audit", () => {
    const html = render();
    const { checks } = analyzePage({ status: 200, finalUrl: "https://pitchcraft.app/s/smile", html, bytes: html.length, responseMs: 200, redirects: 0 }, NOW);
    expect(checks.filter((c) => !c.passed).map((c) => c.id)).toEqual([]);
  });

  it("escapes everything the freelancer types", () => {
    const html = render({
      ...content,
      businessName: `<script>alert(1)</script>`,
      tagline: `"><img src=x onerror=alert(1)>`,
      services: [{ name: "<b>Cleaning</b>", description: "it's & more", price: "<i>" }],
    });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;Cleaning&lt;/b&gt;");
    expect(html).not.toMatch(/<script/i);
  });

  it("drops a portfolio link that isn't a plain web address", () => {
    const html = renderSiteHtml(content, { template: "clinic", formAction: null, builtBy: { name: "K", url: "javascript:alert(1)" } });
    expect(html).not.toContain("javascript:");
  });

  it("has a booking form when hosted, and contact buttons when downloaded", () => {
    expect(render()).toContain('action="/s/smile/contact"');
    const downloaded = render(content, null);
    expect(downloaded).not.toContain("<form");
    expect(downloaded).toContain('href="tel:+97714412345"');
  });

  it("makes short, readable slugs", () => {
    expect(slugify("Café Mitra & Bar")).toBe("cafe-mitra-and-bar");
    expect(slugify("   !!! ")).toBe("site");
    expect(slugify("a".repeat(80)).length).toBeLessThanOrEqual(48);
  });
});

describe("payment details", () => {
  it("needs at least one real way to pay", () => {
    expect(hasPaymentDetails({})).toBe(false);
    expect(hasPaymentDetails({ qrLabel: "Fonepay", esewaId: "  " })).toBe(false);
    expect(hasPaymentDetails({ esewaId: "9841000000" })).toBe(true);
  });
});

describe("uptime summary", () => {
  const at = (min: number) => new Date(NOW.getTime() + min * 60_000);

  it("is empty before the first check", () => {
    expect(summarize([], NOW)).toEqual({ checks: 0, uptimePct: null, avgResponseMs: null, incidents: [] });
  });

  it("counts an outage only after two failures in a row", () => {
    const checks = [
      { ok: true, responseMs: 300, checkedAt: at(0) },
      { ok: false, responseMs: null, checkedAt: at(10) }, // one blip: not an outage
      { ok: true, responseMs: 500, checkedAt: at(20) },
      { ok: false, responseMs: null, checkedAt: at(30) },
      { ok: false, responseMs: null, checkedAt: at(40) },
      { ok: true, responseMs: 400, checkedAt: at(50) },
    ];
    const s = summarize(checks, at(60));
    expect(s.uptimePct).toBe(50);
    expect(s.avgResponseMs).toBe(400);
    expect(s.incidents).toEqual([{ start: at(30), end: at(50), minutes: 20 }]);
  });

  it("reports an outage that's still going", () => {
    const s = summarize(
      [
        { ok: false, responseMs: null, checkedAt: at(0) },
        { ok: false, responseMs: null, checkedAt: at(10) },
      ],
      at(25),
    );
    expect(s.incidents).toEqual([{ start: at(0), end: null, minutes: 25 }]);
  });
});

describe("monitor alerts", () => {
  const base: Monitor = {
    id: "m1",
    userId: "u",
    leadId: "l",
    url: "https://smile.test/",
    active: true,
    status: "up",
    consecutiveFailures: 0,
    lastCheckedAt: null,
    lastResponseMs: null,
    sslExpiresAt: null,
    sslAlertedFor: null,
    downAlertSentAt: null,
    createdAt: NOW,
  };
  const ok: CheckResult = { ok: true, statusCode: 200, responseMs: 300, error: null, sslExpiresAt: null };
  const fail: CheckResult = { ok: false, statusCode: null, responseMs: null, error: "timed out", sslExpiresAt: null };
  const apply = (m: Monitor, r: CheckResult) => {
    const { update, alerts } = nextState(m, r, NOW);
    return { m: { ...m, ...update }, alerts };
  };

  it("waits for a second failure, alerts once, then says when it's back", () => {
    let step = apply(base, fail);
    expect(step.m.status).toBe("up");
    expect(step.alerts).toEqual([]);

    step = apply(step.m, fail);
    expect(step.m.status).toBe("down");
    expect(step.alerts.map((a) => a.subject)).toEqual(["smile.test is down"]);

    step = apply(step.m, fail);
    expect(step.alerts).toEqual([]);

    step = apply(step.m, ok);
    expect(step.m.status).toBe("up");
    expect(step.m.consecutiveFailures).toBe(0);
    expect(step.alerts.map((a) => a.subject)).toEqual(["smile.test is back up"]);
  });

  it("warns once about a certificate that's about to expire", () => {
    const expiring = { ...ok, sslExpiresAt: new Date(NOW.getTime() + 10 * 86_400_000) };
    let step = apply(base, expiring);
    expect(step.alerts.map((a) => a.subject)).toEqual(["HTTPS certificate for smile.test expires in 10 days"]);
    step = apply(step.m, expiring);
    expect(step.alerts).toEqual([]);

    // Renewed, then the new one nears expiry: that's a new warning.
    const renewedSoon = { ...ok, sslExpiresAt: new Date(NOW.getTime() + 5 * 86_400_000) };
    expect(apply(step.m, renewedSoon).alerts).toHaveLength(1);
  });

  it("stays quiet about a certificate with months left", () => {
    expect(apply(base, { ...ok, sslExpiresAt: new Date(NOW.getTime() + 80 * 86_400_000) }).alerts).toEqual([]);
  });
});
