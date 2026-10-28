import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { addDays } from "@/lib/dates";
import { today } from "@/lib/plans";
import { listClients } from "@/lib/services/clients";
import { createComparison, publicComparison } from "@/lib/services/comparisons";
import { dueFollowUps, sendFollowUpDigests } from "@/lib/services/followups";
import { createInvoice, outstandingByCurrency, publicInvoice, setInvoiceStatus } from "@/lib/services/invoices";
import { createMonitor, monitorForLead, monitorReport, runMonitor } from "@/lib/services/monitors";
import { createQuote, markQuoteSent, publicQuote, respondToQuote, updateQuote } from "@/lib/services/quotes";
import {
  createSite,
  MESSAGES_PER_HOUR_PER_VISITOR,
  messagesForSite,
  receiveSiteMessage,
  setPublished,
  siteBySlug,
} from "@/lib/services/sites";
import type { CheckResult } from "@/lib/work/monitor";
import { DAY, makeUser, resetDb } from "./helpers";

const OUTBOX = path.join(os.tmpdir(), `pitchcraft-integration-outbox-${process.pid}.jsonl`);
const emails = (): { to: string; subject: string; text: string }[] => {
  try {
    return readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

beforeEach(async () => {
  await resetDb();
  rmSync(OUTBOX, { force: true });
  process.env.EMAIL_DEV_OUTBOX = OUTBOX;
});
afterAll(() => rmSync(OUTBOX, { force: true }));

async function addLead(userId: string, extra: Partial<typeof schema.leads.$inferInsert> = {}) {
  const [lead] = await db
    .insert(schema.leads)
    .values({ userId, source: "mock", sourceId: crypto.randomUUID(), name: "Smile Dental", category: "Dentist", deliveredOn: today(), ...extra })
    .returning();
  return lead;
}
const reloadLead = async (id: string) => (await db.select().from(schema.leads).where(eq(schema.leads.id, id)))[0];
const ITEMS = [
  { title: "New website", amountMinor: 35_000_00 },
  { title: "Hosting", detail: "First year", amountMinor: 4_000_00 },
];

describe("quotes", () => {
  it("sending sets a reminder; accepting wins the lead with the quote's total and tells the freelancer", async () => {
    const user = await makeUser();
    const lead = await addLead(user.id);
    const id = await createQuote(user, lead, "NPR", ITEMS);

    await markQuoteSent(user.id, id);
    expect((await reloadLead(lead.id)).followUpOn).toBe(addDays(today(), 3));

    expect(await respondToQuote(id, true, "Dr. Sharma")).toBe("accepted");
    const won = await reloadLead(lead.id);
    expect(won).toMatchObject({ status: "won", wonAmountCents: 39_000_00, currency: "NPR", followUpOn: null });
    expect((await publicQuote(id))?.quote).toMatchObject({ status: "accepted", acceptedBy: "Dr. Sharma" });
    expect(emails().map((e) => [e.to, e.subject])).toEqual([[user.email, "Smile Dental accepted your quote"]]);
  });

  it("counts only the first answer, even when two arrive at once", async () => {
    const user = await makeUser();
    const id = await createQuote(user, await addLead(user.id), "USD", ITEMS);
    const results = await Promise.all([respondToQuote(id, true, "A"), respondToQuote(id, false, "B")]);
    expect(results.filter((r) => r === "accepted" || r === "declined")).toHaveLength(1);
    expect(await respondToQuote(id, true, "C")).toBe("already_answered");
  });

  it("can't be edited once answered, and can't be answered once expired", async () => {
    const user = await makeUser();
    const lead = await addLead(user.id);
    const id = await createQuote(user, lead, "USD", ITEMS);
    const edit = { currency: "USD" as const, items: ITEMS, note: null, validUntil: addDays(today(), -1) };
    expect(await updateQuote(user.id, id, edit)).toBe(true);
    expect(await respondToQuote(id, true, "Late")).toBe("expired");

    expect(await updateQuote(user.id, id, { ...edit, validUntil: addDays(today(), 7) })).toBe(true);
    expect(await respondToQuote(id, false, "")).toBe("declined");
    expect((await reloadLead(lead.id)).status).toBe("new");
    expect(await updateQuote(user.id, id, edit)).toBe(false);
  });

  it("only the owner can edit a quote", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const id = await createQuote(owner, await addLead(owner.id), "USD", ITEMS);
    expect(await updateQuote(other.id, id, { currency: "USD", items: [], note: null, validUntil: today() })).toBe(false);
    expect(await respondToQuote("nosuchquote", true, "X")).toBe("not_found");
  });
});

describe("invoices", () => {
  it("numbers each freelancer's invoices in order, without gaps or repeats under load", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const leadA = await addLead(a.id);
    const data = { currency: "NPR" as const, items: ITEMS, note: null, issuedOn: today(), dueOn: addDays(today(), 7) };
    const ids = await Promise.all(Array.from({ length: 8 }, () => createInvoice(a.id, leadA.id, data)));
    const numbers = (await Promise.all(ids.map(publicInvoice))).map((r) => r!.invoice.number).sort();
    expect(numbers).toEqual(Array.from({ length: 8 }, (_, i) => `INV-000${i + 1}`));

    const first = await publicInvoice(await createInvoice(b.id, (await addLead(b.id)).id, data));
    expect(first?.invoice.number).toBe("INV-0001");
  });

  it("totals what's owed per currency and ignores paid and void invoices", async () => {
    const user = await makeUser({ paymentDetails: { esewaId: "9841000000" } });
    const lead = await addLead(user.id);
    const base = { note: null, issuedOn: today(), dueOn: today() };
    const npr = await createInvoice(user.id, lead.id, { ...base, currency: "NPR", items: ITEMS });
    await createInvoice(user.id, lead.id, { ...base, currency: "USD", items: [{ title: "Fix", amountMinor: 150_00 }] });
    const paid = await createInvoice(user.id, lead.id, { ...base, currency: "USD", items: [{ title: "Old", amountMinor: 999_00 }] });
    const voided = await createInvoice(user.id, lead.id, { ...base, currency: "USD", items: [{ title: "Oops", amountMinor: 1_00 }] });
    await setInvoiceStatus(user.id, paid, "paid");
    await setInvoiceStatus(user.id, voided, "void");

    expect(await outstandingByCurrency(user.id)).toEqual(
      expect.arrayContaining([
        { currency: "NPR", amountMinor: 39_000_00 },
        { currency: "USD", amountMinor: 150_00 },
      ]),
    );
    expect((await publicInvoice(paid))?.invoice.paidAt).toBeInstanceOf(Date);
    expect((await publicInvoice(npr))?.freelancer.paymentDetails).toEqual({ esewaId: "9841000000" });

    const intruder = await makeUser();
    expect(await setInvoiceStatus(intruder.id, npr, "paid")).toBe(false);
  });
});

describe("client websites", () => {
  it("starts once per client with a unique address", async () => {
    const user = await makeUser();
    const lead = await addLead(user.id, { phone: "+977 1-4412345", email: "hi@smile.test" });
    const site = await createSite(user, lead);
    expect(site.slug).toBe("smile-dental");
    expect(site.template).toBe("clinic");
    expect(site.content).toMatchObject({ businessName: "Smile Dental", phone: "+977 1-4412345", email: "hi@smile.test" });
    expect((await createSite(user, lead)).id).toBe(site.id);

    const other = await makeUser();
    expect((await createSite(other, await addLead(other.id))).slug).toBe("smile-dental-2");
  });

  it("free accounts can have one live site", async () => {
    const user = await makeUser();
    const one = await createSite(user, await addLead(user.id));
    const two = await createSite(user, await addLead(user.id, { name: "Second Clinic" }));
    expect(await setPublished(user, one.id, true)).toBe("published");
    expect(await setPublished(user, two.id, true)).toBe("limit_reached");
    expect(await setPublished(user, one.id, false)).toBe("unpublished");
    expect(await setPublished(user, two.id, true)).toBe("published");

    const pro = await makeUser({ proUntil: new Date(Date.now() + 30 * DAY) });
    await setPublished(pro, (await createSite(pro, await addLead(pro.id))).id, true);
    expect(await setPublished(pro, (await createSite(pro, await addLead(pro.id, { name: "B" }))).id, true)).toBe("published");
  });

  it("stores booking requests, emails the business and the freelancer, and limits each visitor", async () => {
    const user = await makeUser();
    const site = await createSite(user, await addLead(user.id, { email: "owner@smile.test" }));
    await setPublished(user, site.id, true);
    const row = (await siteBySlug(site.slug))!;
    const msg = { name: "Ram", contact: "9841111111", message: "Cleaning please", preferredDate: "Friday", honeypot: "" };

    expect(await receiveSiteMessage(row, msg, "ip1")).toBe("sent");
    expect(emails().map((e) => e.to).sort()).toEqual(["owner@smile.test", user.email].sort());
    expect(emails()[0].text).toContain("Preferred: Friday");

    expect(await receiveSiteMessage(row, { ...msg, honeypot: "http://spam" }, "ip1")).toBe("spam");
    expect(await receiveSiteMessage(row, { ...msg, message: "   " }, "ip1")).toBe("invalid");
    for (let i = 1; i < MESSAGES_PER_HOUR_PER_VISITOR; i++) expect(await receiveSiteMessage(row, msg, "ip1")).toBe("sent");
    expect(await receiveSiteMessage(row, msg, "ip1")).toBe("rate_limited");
    expect(await receiveSiteMessage(row, msg, "ip2")).toBe("sent");

    expect(await messagesForSite(user.id, site.id)).toHaveLength(MESSAGES_PER_HOUR_PER_VISITOR + 1);
    expect(await messagesForSite((await makeUser()).id, site.id)).toHaveLength(0);
  });
});

describe("before and after", () => {
  it("compares the finished site with the audit we pitched with", async () => {
    const user = await makeUser();
    const before = await db
      .insert(schema.audits)
      .values({ id: "beforeaudit", url: "http://old.test/", score: 31, checks: [], metrics: {} as never })
      .returning();
    const lead = await addLead(user.id, { auditId: before[0].id, website: "http://old.test/" });
    const id = await createComparison(user.id, lead, `${process.env.MOCK_SITE_BASE}/good.html`);
    const found = await publicComparison(id);
    expect(found?.business).toBe("Smile Dental");
    expect(found?.before?.score).toBe(31);
    // The fixture is served over plain http, so it loses the HTTPS points but passes the rest.
    expect(found?.after.score).toBeGreaterThan(70);
    expect(found?.after.checks.filter((c) => !c.passed).map((c) => c.id)).toEqual(["https"]);
    expect(await publicComparison("nope")).toBeNull();
  });

  it("works for a business that had no website", async () => {
    const user = await makeUser();
    const id = await createComparison(user.id, await addLead(user.id), `${process.env.MOCK_SITE_BASE}/good.html`);
    expect((await publicComparison(id))?.before).toBeNull();
  });
});

describe("monitoring", () => {
  const up: CheckResult = { ok: true, statusCode: 200, responseMs: 120, error: null, sslExpiresAt: null };
  const down: CheckResult = { ok: false, statusCode: null, responseMs: null, error: "timed out", sslExpiresAt: null };

  it("checks a real site and builds the client report", async () => {
    const user = await makeUser();
    const lead = await addLead(user.id);
    const created = await createMonitor(user, lead.id, `${process.env.MOCK_SITE_BASE}/good.html`);
    expect(created.ok).toBe(true);
    expect(await createMonitor(user, lead.id, `${process.env.MOCK_SITE_BASE}/good.html`)).toEqual({ ok: false, reason: "exists" });

    const monitor = (await monitorForLead(user.id, lead.id))!;
    const { result } = await runMonitor(monitor, user.email);
    expect(result).toMatchObject({ ok: true, statusCode: 200 });

    const report = await monitorReport(monitor.id);
    expect(report?.monitor.status).toBe("up");
    expect(report?.summary).toMatchObject({ checks: 1, uptimePct: 100 });
  });

  it("emails the freelancer once when the site goes down, and again when it's back", async () => {
    const user = await makeUser();
    const lead = await addLead(user.id);
    await createMonitor(user, lead.id, "https://smile.test/");
    const fresh = async () => (await monitorForLead(user.id, lead.id))!;

    await runMonitor(await fresh(), user.email, async () => up);
    await runMonitor(await fresh(), user.email, async () => down);
    await runMonitor(await fresh(), user.email, async () => down);
    await runMonitor(await fresh(), user.email, async () => down);
    expect((await fresh()).status).toBe("down");
    await runMonitor(await fresh(), user.email, async () => up);

    expect(emails().map((e) => e.subject)).toEqual(["smile.test is down", "smile.test is back up"]);
    const report = (await monitorReport((await fresh()).id))!;
    expect(report.summary.uptimePct).toBe(40);
    expect(report.summary.incidents).toHaveLength(1);
  });

  it("free accounts can monitor one site", async () => {
    const user = await makeUser();
    expect((await createMonitor(user, (await addLead(user.id)).id, "https://a.test/")).ok).toBe(true);
    expect(await createMonitor(user, (await addLead(user.id)).id, "https://b.test/")).toEqual({ ok: false, reason: "limit_reached" });
  });

  it("refuses addresses it shouldn't fetch", async () => {
    const user = await makeUser();
    await expect(createMonitor(user, (await addLead(user.id)).id, "ftp://files.test/")).rejects.toThrow();
  });
});

describe("follow-ups", () => {
  it("lists leads still in play that are due, and emails one digest per freelancer", async () => {
    const user = await makeUser();
    await addLead(user.id, { name: "Due", status: "sent", followUpOn: today() });
    await addLead(user.id, { name: "Overdue", status: "replied", followUpOn: addDays(today(), -2) });
    await addLead(user.id, { name: "Later", status: "sent", followUpOn: addDays(today(), 2) });
    await addLead(user.id, { name: "Won", status: "won", followUpOn: today() });
    await addLead(user.id, { name: "Never", status: "sent" });
    const other = await makeUser();
    await addLead(other.id, { name: "Theirs", status: "call", followUpOn: today() });

    expect((await dueFollowUps(user.id)).map((l) => l.name)).toEqual(["Overdue", "Due"]);
    expect(await sendFollowUpDigests()).toEqual({ sent: 2 });
    const mine = emails().find((e) => e.to === user.email)!;
    expect(mine.subject).toBe("2 businesses to follow up with today");
    expect(mine.text).toContain("Overdue");
    expect(mine.text).not.toContain("Later");
  });
});

describe("clients", () => {
  it("shows each won client's site, care plan and what they owe", async () => {
    const user = await makeUser();
    await addLead(user.id, { name: "Still a lead" });
    const lead = await addLead(user.id, { status: "won", wonAmountCents: 39_000_00, currency: "NPR" });
    const site = await createSite(user, lead);
    await setPublished(user, site.id, true);
    await createMonitor(user, lead.id, "https://smile.test/");
    await createInvoice(user.id, lead.id, { currency: "NPR", items: ITEMS, note: null, issuedOn: today(), dueOn: addDays(today(), -1) });

    const [client, ...rest] = await listClients(user.id);
    expect(rest).toHaveLength(0);
    expect(client.lead.name).toBe("Smile Dental");
    expect(client.site).toMatchObject({ published: true });
    expect(client.monitor).toMatchObject({ active: true });
    expect(client.unpaid).toEqual([{ currency: "NPR", amountMinor: 39_000_00, dueOn: addDays(today(), -1) }]);
  });
});
