import { afterEach, describe, expect, it } from "vitest";
import { cronAuthorized, cronJobAuthorized, secretMatches } from "@/lib/cron";

const req = (url: string, auth?: string) => new Request(url, { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.CRON_JOB_SECRET;
});

describe("secretMatches", () => {
  it("compares exactly, whatever the lengths", () => {
    expect(secretMatches("abc", "abc")).toBe(true);
    expect(secretMatches("abcd", "abc")).toBe(false);
    expect(secretMatches("", "abc")).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    expect(secretMatches("", undefined)).toBe(false);
    expect(secretMatches("anything", "")).toBe(false);
  });
});

describe("cron-job.org authentication", () => {
  it("accepts the secret as a Bearer header or a ?key= parameter", () => {
    process.env.CRON_JOB_SECRET = "s3cret-for-cron-job-org";
    expect(cronJobAuthorized(req("https://x.test/api/cron-job/daily", "Bearer s3cret-for-cron-job-org"))).toBe(true);
    expect(cronJobAuthorized(req("https://x.test/api/cron-job/daily?key=s3cret-for-cron-job-org"))).toBe(true);
    expect(cronJobAuthorized(req("https://x.test/api/cron-job/daily?key=wrong"))).toBe(false);
    expect(cronJobAuthorized(req("https://x.test/api/cron-job/daily", "s3cret-for-cron-job-org"))).toBe(false);
    expect(cronJobAuthorized(req("https://x.test/api/cron-job/daily"))).toBe(false);
  });

  it("keeps the Vercel secret and the cron-job.org secret separate", () => {
    process.env.CRON_SECRET = "vercel-secret";
    process.env.CRON_JOB_SECRET = "cronjob-secret";
    expect(cronJobAuthorized(req("https://x.test/api/cron-job/daily", "Bearer vercel-secret"))).toBe(false);
    expect(cronAuthorized(req("https://x.test/api/cron/daily-leads", "Bearer cronjob-secret"))).toBe(false);
    expect(cronAuthorized(req("https://x.test/api/cron/daily-leads", "Bearer vercel-secret"))).toBe(true);
  });

});
