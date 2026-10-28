import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { runAudit } from "@/lib/audit";
import { isPro } from "@/lib/plans";
import { anonymousAuditsLastHour, getAudit, saveAudit } from "@/lib/services/audits";
import { completePendingPayment, extendPro, getPayment, recordPayment, setProUntil } from "@/lib/services/billing";
import { getLeadWithAudit, getStats, latestPitch, listLeads } from "@/lib/services/leads";
import { DAY, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

const reload = async (id: string) => (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];
const daysFromNow = (d: Date | null) => (d ? Math.round((d.getTime() - Date.now()) / DAY) : null);

describe("Pro access", () => {
  it("a Khalti payment gives 30 days, and a second one stacks", async () => {
    const user = await makeUser();
    await extendPro(user.id, 30);
    let after = await reload(user.id);
    expect(isPro(after)).toBe(true);
    expect(daysFromNow(after.proUntil)).toBe(30);

    await extendPro(user.id, 30);
    after = await reload(user.id);
    expect(daysFromNow(after.proUntil)).toBe(60);
  });

  it("extending an expired plan starts from today, not the old end date", async () => {
    const user = await makeUser({ proUntil: new Date(Date.now() - 10 * DAY) });
    await extendPro(user.id, 30);
    expect(daysFromNow((await reload(user.id)).proUntil)).toBe(30);
  });

  it("Paddle sets the end date and subscription id; a null end date keeps current access", async () => {
    const user = await makeUser();
    const end = new Date(Date.now() + 31 * DAY);
    await setProUntil(user.id, end, "sub_1");
    let after = await reload(user.id);
    expect(after.proUntil?.getTime()).toBe(end.getTime());
    expect(after.paddleSubscriptionId).toBe("sub_1");

    await setProUntil(user.id, null, "sub_1");
    after = await reload(user.id);
    expect(after.proUntil?.getTime()).toBe(end.getTime());
  });
});

describe("payments", () => {
  it("records each provider reference once, so webhook retries are harmless", async () => {
    const user = await makeUser();
    const p = { userId: user.id, provider: "paddle" as const, ref: "txn_1", status: "completed", amountMinor: 1900, currency: "USD" };
    expect(await recordPayment(p)).toBe(true);
    expect(await recordPayment(p)).toBe(false);
    expect(await db.select().from(schema.payments)).toHaveLength(1);
  });

  it("a pending Khalti payment can be completed only once, even with simultaneous callbacks", async () => {
    const user = await makeUser();
    await recordPayment({ userId: user.id, provider: "khalti", ref: "pidx_1", status: "pending", amountMinor: 99900, currency: "NPR" });
    const results = await Promise.all([completePendingPayment("khalti", "pidx_1"), completePendingPayment("khalti", "pidx_1")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await getPayment("khalti", "pidx_1"))?.status).toBe("completed");
    expect(await completePendingPayment("khalti", "unknown")).toBeNull();
  });
});

describe("audits", () => {
  it("saves a report under a short public id and counts anonymous checks per IP", async () => {
    const result = await runAudit(`${process.env.MOCK_SITE_BASE}/good.html`);
    const id = await saveAudit(result, { ipHash: "iphash1", businessName: "Summit" });
    expect(id).toMatch(/^[a-z2-9]{10}$/);
    const saved = await getAudit(id);
    expect(saved).toMatchObject({ score: result.score, businessName: "Summit", url: result.url });
    expect(saved?.checks).toHaveLength(result.checks.length);

    await saveAudit(result, { ipHash: "iphash1" });
    await saveAudit(result, { ipHash: "iphash2" });
    expect(await anonymousAuditsLastHour("iphash1")).toBe(2);
    expect(await getAudit("doesnotexist")).toBeNull();
  });
});

describe("lead data", () => {
  async function addLead(userId: string, name: string, extra: Partial<typeof schema.leads.$inferInsert> = {}) {
    const [lead] = await db
      .insert(schema.leads)
      .values({ userId, source: "mock", sourceId: name, name, category: "Dentist", deliveredOn: "2026-10-28", ...extra })
      .returning();
    return lead;
  }

  it("totals the funnel and earnings, counting only won projects", async () => {
    const user = await makeUser();
    await addLead(user.id, "A");
    await addLead(user.id, "B", { status: "sent" });
    await addLead(user.id, "C", { status: "replied" });
    await addLead(user.id, "D", { status: "won", wonAmountCents: 75_000 });
    await addLead(user.id, "E", { status: "won", wonAmountCents: 30_000 });
    await addLead(user.id, "F", { status: "lost", wonAmountCents: 99_999 });
    expect(await getStats(user.id)).toEqual({ total: 6, contacted: 5, replied: 3, won: 2, earnedCents: 105_000 });
  });

  it("lists newest days first, then best opportunities", async () => {
    const user = await makeUser();
    await addLead(user.id, "Old", { deliveredOn: "2026-10-27", opportunity: 100 });
    await addLead(user.id, "Weak", { opportunity: 10 });
    await addLead(user.id, "Strong", { opportunity: 90 });
    expect((await listLeads(user.id)).map((r) => r.lead.name)).toEqual(["Strong", "Weak", "Old"]);
  });

  it("never returns another user's lead or pitch", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const lead = await addLead(owner.id, "Private");
    await db.insert(schema.pitches).values({ userId: owner.id, leadId: lead.id, subject: "s", body: "b", model: "template" });

    expect(await getLeadWithAudit(owner.id, lead.id)).not.toBeNull();
    expect(await getLeadWithAudit(intruder.id, lead.id)).toBeNull();
    expect(await latestPitch(intruder.id, lead.id)).toBeNull();
    expect(await listLeads(intruder.id)).toHaveLength(0);
  });
});
