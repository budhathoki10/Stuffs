import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { deliverLeads } from "@/lib/services/delivery";
import { DAY, makeSearch, makeUser, resetDb, WEDNESDAY } from "./helpers";

const leadsOf = (userId: string) =>
  db.select().from(schema.leads).where(eq(schema.leads.userId, userId)).orderBy(schema.leads.name);

beforeEach(resetDb);

describe("deliverLeads", () => {
  it("does nothing until the user has picked a search", async () => {
    const user = await makeUser();
    expect(await deliverLeads(user, WEDNESDAY)).toEqual({ delivered: 0, reason: "no_search" });
  });

  it("gives a free web developer 5 leads, businesses without a website first", async () => {
    const user = await makeUser({ skill: "web_dev" });
    await makeSearch(user.id);
    expect(await deliverLeads(user, WEDNESDAY)).toEqual({ delivered: 5, reason: "ok" });

    const leads = await leadsOf(user.id);
    expect(leads).toHaveLength(5);
    const noSite = leads.filter((l) => !l.website).map((l) => l.name);
    expect(noSite.sort()).toEqual(["Cedar Dentist", "Oak & Pine Dentist", "Sunrise Dentist"]);
    expect(leads.every((l) => l.deliveredOn === "2026-10-28")).toBe(true);
    // The two remaining slots go to the worst websites (score 0), not the good one.
    expect(leads.map((l) => l.name)).not.toContain("Summit Dentist");
  });

  it("audits every lead that has a website and links the saved report", async () => {
    const user = await makeUser({ skill: "web_dev" });
    await makeSearch(user.id);
    await deliverLeads(user, WEDNESDAY);
    const withSite = (await leadsOf(user.id)).filter((l) => l.website);
    expect(withSite.length).toBeGreaterThan(0);
    for (const lead of withSite) {
      expect(lead.auditId).not.toBeNull();
      const [audit] = await db.select().from(schema.audits).where(eq(schema.audits.id, lead.auditId!));
      expect(audit.businessName).toBe(lead.name);
      expect(audit.createdBy).toBe(user.id);
    }
  });

  it("stops at the free plan's weekly limit, even on a new day", async () => {
    const user = await makeUser();
    await makeSearch(user.id);
    await deliverLeads(user, WEDNESDAY);
    expect(await deliverLeads(user, WEDNESDAY)).toEqual({ delivered: 0, reason: "limit_reached" });
    expect(await deliverLeads(user, new Date(WEDNESDAY.getTime() + DAY))).toEqual({ delivered: 0, reason: "limit_reached" });
  });

  it("starts a new free batch the next week", async () => {
    const user = await makeUser();
    await makeSearch(user.id);
    await deliverLeads(user, WEDNESDAY);
    // Only 3 businesses are left in the mock area after the first 5.
    expect(await deliverLeads(user, new Date(WEDNESDAY.getTime() + 7 * DAY))).toEqual({ delivered: 3, reason: "ok" });
  });

  it("gives Pro users a fresh batch every day and never repeats a business", async () => {
    const user = await makeUser({ plan: "pro", proUntil: new Date(Date.now() + 30 * DAY) });
    await makeSearch(user.id);
    expect((await deliverLeads(user, WEDNESDAY)).delivered).toBe(5);
    expect(await deliverLeads(user, WEDNESDAY)).toEqual({ delivered: 0, reason: "limit_reached" });
    expect((await deliverLeads(user, new Date(WEDNESDAY.getTime() + DAY))).delivered).toBe(3);
    expect(await deliverLeads(user, new Date(WEDNESDAY.getTime() + 2 * DAY))).toEqual({ delivered: 0, reason: "no_new_businesses" });

    const leads = await leadsOf(user.id);
    expect(new Set(leads.map((l) => l.sourceId)).size).toBe(8);
  });

  it("treats an expired Pro plan as free", async () => {
    const user = await makeUser({ plan: "pro", proUntil: new Date(Date.now() - DAY) });
    await makeSearch(user.id);
    await deliverLeads(user, WEDNESDAY);
    expect(await deliverLeads(user, new Date(WEDNESDAY.getTime() + DAY))).toEqual({ delivered: 0, reason: "limit_reached" });
  });

  it("ranks by the freelancer's skill: SEO people get businesses that have a site to optimize", async () => {
    const user = await makeUser({ skill: "seo" });
    await makeSearch(user.id);
    await deliverLeads(user, WEDNESDAY);
    const top = await db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.userId, user.id))
      .orderBy(schema.leads.opportunity);
    const best = top.at(-1)!;
    expect(best.website).not.toBeNull();
  });

  it("keeps each user's leads separate", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeSearch(a.id);
    await makeSearch(b.id);
    await deliverLeads(a, WEDNESDAY);
    // Same businesses can go to different freelancers.
    expect((await deliverLeads(b, WEDNESDAY)).delivered).toBe(5);
    expect(await leadsOf(a.id)).toHaveLength(5);
    expect(await leadsOf(b.id)).toHaveLength(5);
  });
});
