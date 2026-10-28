import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzePage, scoreChecks, unreachableChecks } from "@/lib/audit/analyze";
import { resetPasswordMessage, sendEmail, verifyEmailMessage } from "@/lib/email";
import { isPro, limitsFor, PLAN_LIMITS, today, weekStart } from "@/lib/plans";
import { buildPitchPrompt, templatePitch } from "@/lib/pitch";
import { SKILLS, isSkill, type SkillId } from "@/lib/skills";
import { appUrl, clientIp, formatMoney, hashIp, shortId } from "@/lib/util";

describe("plans", () => {
  const DAY = 86_400_000;
  it("Pro is active only before its end date", () => {
    expect(isPro({ proUntil: null })).toBe(false);
    expect(isPro({ proUntil: new Date(Date.now() + DAY) })).toBe(true);
    expect(isPro({ proUntil: new Date(Date.now() - DAY) })).toBe(false);
  });

  it("free users get weekly limits, Pro users get daily leads", () => {
    expect(limitsFor({ proUntil: null })).toBe(PLAN_LIMITS.free);
    expect(limitsFor({ proUntil: new Date(Date.now() + DAY) })).toBe(PLAN_LIMITS.pro);
    expect(PLAN_LIMITS.pro.leadsPerWeek).toBeGreaterThan(PLAN_LIMITS.free.leadsPerWeek);
    expect(PLAN_LIMITS.pro.pitchesPerWeek).toBeGreaterThan(PLAN_LIMITS.free.pitchesPerWeek);
  });

  it("dates use UTC", () => {
    expect(today(new Date("2026-10-28T23:59:59Z"))).toBe("2026-10-28");
    expect(weekStart(new Date("2026-01-01T12:00:00Z"))).toBe("2025-12-29"); // across a year boundary
  });
});

describe("util", () => {
  it("shortId is URL-safe, unambiguous and unique", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => shortId()));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(/^[a-km-z2-9]{10}$/); // no l, o, 0, 1
  });

  it("hashIp never stores the raw IP", () => {
    const h = hashIp("203.0.113.7");
    expect(h).toHaveLength(32);
    expect(h).not.toContain("203");
    expect(hashIp("203.0.113.7")).toBe(h);
    expect(hashIp("203.0.113.8")).not.toBe(h);
  });

  it("clientIp takes the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("formats money and app links", () => {
    expect(formatMoney(75_000)).toBe("$750");
    expect(formatMoney(0)).toBe("$0");
    const saved = process.env.APP_URL;
    process.env.APP_URL = "https://pitchcraft.app/";
    expect(appUrl("/r/abc")).toBe("https://pitchcraft.app/r/abc");
    process.env.APP_URL = saved;
  });
});

describe("audit edge cases", () => {
  const page = (html: string) => ({ status: 200, finalUrl: "https://x.test/", html, bytes: html.length, responseMs: 300, redirects: 0 });

  it("handles an empty page without crashing", () => {
    const { checks, metrics } = analyzePage(page(""));
    expect(checks.length).toBeGreaterThan(10);
    expect(metrics.title).toBeNull();
    expect(scoreChecks(checks)).toBeLessThan(60);
  });

  it("counts a booking link and a copyright range", () => {
    const html = '<body><a href="https://calendly.com/x">Hi</a><footer>© 2019–2026 Biz</footer></body>';
    const { checks, metrics } = analyzePage(page(html), new Date("2026-10-28"));
    expect(checks.find((c) => c.id === "booking")?.passed).toBe(true);
    expect(metrics.copyrightYear).toBe(2026);
    expect(checks.find((c) => c.id === "fresh")?.passed).toBe(true);
  });

  it("rejects a title that is too long for Google", () => {
    const { checks } = analyzePage(page(`<title>${"Dentist ".repeat(12)}</title>`));
    expect(checks.find((c) => c.id === "title")?.passed).toBe(false);
  });

  it("scores missing and broken websites 0 with one clear reason", () => {
    expect(unreachableChecks("none", "")).toMatchObject([{ id: "website", severity: "critical" }]);
    expect(unreachableChecks("down", "HTTP 500")).toMatchObject([{ id: "reachable", detail: "HTTP 500" }]);
  });
});

describe("pitches for every skill", () => {
  const skills = Object.keys(SKILLS) as SkillId[];

  it.each(skills)("%s: prompt and template mention the freelancer's offer", (skill) => {
    const input = {
      freelancerName: "Asha",
      skill,
      businessName: "Lakeside Clinic",
      category: "Clinic",
      website: "https://lakeside.example",
      issues: unreachableChecks("down", "HTTP 500"),
    };
    expect(buildPitchPrompt(input)).toContain(SKILLS[skill].offer);
    const pitch = templatePitch(input);
    expect(pitch.body).toContain("Asha");
    expect(pitch.subject.length).toBeLessThanOrEqual(90);
    expect(pitch.body).not.toMatch(/undefined|null/);
  });

  it("validates skill ids", () => {
    expect(isSkill("seo")).toBe(true);
    expect(isSkill("hacking")).toBe(false);
    expect(isSkill(undefined)).toBe(false);
  });
});

describe("emails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
  });

  it("verification and reset emails contain the link in text and HTML", () => {
    const v = verifyEmailMessage("a@b.test", "Asha", "https://app.test/verify-email/tok");
    expect(v.subject).toBe("Confirm your Pitchcraft email");
    expect(v.text).toContain("https://app.test/verify-email/tok");
    expect(v.html).toContain('href="https://app.test/verify-email/tok"');
    expect(v.text).toContain("Welcome, Asha!");

    const r = resetPasswordMessage("a@b.test", "https://app.test/reset-password/tok");
    expect(r.text).toContain("expires in 1 hour");
    expect(r.html).toContain("https://app.test/reset-password/tok");
  });

  it("sends through Resend when a key is set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail({ to: "a@b.test", subject: "Hi", text: "t", html: "h" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toMatchObject({ to: "a@b.test", subject: "Hi", from: expect.stringContaining("Pitchcraft") });
  });

  it("reports Resend errors", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("domain not verified", { status: 403 })));
    await expect(sendEmail({ to: "a@b.test", subject: "Hi", text: "t", html: "h" })).rejects.toThrow("domain not verified");
  });
});
