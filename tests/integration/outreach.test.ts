import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { addDays } from "@/lib/dates";
import { today } from "@/lib/plans";
import {
  conversation,
  fetchReceivedEmail,
  handleDeliveryProblem,
  inbox,
  isSuppressed,
  leadByReplyToken,
  markRead,
  optOutLead,
  receiveReply,
  sendToLead,
  unreadCount,
} from "@/lib/services/outreach";
import { makeUser, resetDb } from "./helpers";

const OUTBOX = path.join(os.tmpdir(), `pitchcraft-outreach-outbox-${process.pid}.jsonl`);
type Sent = { to: string; from: string; subject: string; text: string; replyTo?: string; headers?: Record<string, string> };
const sent = (): Sent[] => {
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
  process.env.REPLY_DOMAIN = "reply.pitchcraft.test";
  process.env.OUTREACH_FROM_ADDRESS = "outreach@pitchcraft.test";
});
afterAll(() => rmSync(OUTBOX, { force: true }));

const verifiedUser = (extra: Partial<typeof schema.users.$inferInsert> = {}) => makeUser({ name: "Kushal Budhathoki", emailVerifiedAt: new Date(), ...extra });
async function addLead(userId: string, extra: Partial<typeof schema.leads.$inferInsert> = {}) {
  const [lead] = await db
    .insert(schema.leads)
    .values({ userId, source: "mock", sourceId: crypto.randomUUID(), name: "Smile Dental", category: "Dentist", deliveredOn: today(), email: "owner@smile.test", ...extra })
    .returning();
  return lead;
}
const reload = async (id: string) => (await db.select().from(schema.leads).where(eq(schema.leads.id, id)))[0];
const pitch = { kind: "pitch" as const, to: "owner@smile.test", subject: "Your website on phones", body: "Hi,\n\nYour site doesn't fit on a phone.\n\nKushal" };

async function replyFrom(lead: { id: string }, text: string, id = crypto.randomUUID()) {
  const { replyToken } = await reload(lead.id);
  return receiveReply({
    providerId: id,
    from: "Dr. Sita <owner@smile.test>",
    to: [`reply+${replyToken}@reply.pitchcraft.test`],
    subject: "Re: Your website on phones",
    text,
    messageIdHeader: `<${id}@mail.smile.test>`,
  });
}

describe("sending from the app", () => {
  it("sends as the freelancer via Pitchcraft, with a reply address for this lead and an opt-out line", async () => {
    const user = await verifiedUser();
    const lead = await addLead(user.id);
    const result = await sendToLead(user, lead, pitch);
    expect(result.ok).toBe(true);

    const [email] = sent();
    const { replyToken } = await reload(lead.id);
    expect(email.from).toBe("Kushal Budhathoki via Pitchcraft <outreach@pitchcraft.test>");
    expect(email.to).toBe("owner@smile.test");
    expect(email.replyTo).toBe(`reply+${replyToken}@reply.pitchcraft.test`);
    expect(email.text).toContain(`reply "stop" or open http://localhost:3000/x/${replyToken}`);

    const updated = await reload(lead.id);
    expect(updated.status).toBe("sent");
    expect(updated.followUpOn).toBe(addDays(today(), 3));
    expect((await conversation(user.id, lead.id)).map((m) => [m.direction, m.kind, m.status])).toEqual([["out", "pitch", "sent"]]);
  });

  it("without a reply domain, replies go to the freelancer's own inbox", async () => {
    delete process.env.REPLY_DOMAIN;
    const user = await verifiedUser();
    await sendToLead(user, await addLead(user.id), pitch);
    expect(sent()[0].replyTo).toBe(user.email);
  });

  it("saves an address the freelancer typed in for a lead that had none", async () => {
    const user = await verifiedUser();
    const lead = await addLead(user.id, { email: null });
    await sendToLead(user, lead, { ...pitch, to: "Found@Facebook.test" });
    expect((await reload(lead.id)).email).toBe("found@facebook.test");
  });

  it("only sends for confirmed accounts, to valid addresses", async () => {
    const unverified = await makeUser();
    expect(await sendToLead(unverified, await addLead(unverified.id), pitch)).toEqual({ ok: false, reason: "not_verified" });
    const user = await verifiedUser();
    expect(await sendToLead(user, await addLead(user.id), { ...pitch, to: "nope" })).toEqual({ ok: false, reason: "invalid_address" });
    expect(sent()).toHaveLength(0);
  });

  it("stops after three unanswered cold emails, and a reply resets the count", async () => {
    const user = await verifiedUser();
    const lead = await addLead(user.id);
    for (let i = 0; i < 3; i++) expect((await sendToLead(user, await reload(lead.id), { ...pitch, kind: i ? "followup" : "pitch" })).ok).toBe(true);
    expect(await sendToLead(user, await reload(lead.id), { ...pitch, kind: "followup" })).toEqual({ ok: false, reason: "too_many_unanswered" });
    // Quotes and invoices aren't cold email, so they still go.
    expect((await sendToLead(user, await reload(lead.id), { ...pitch, kind: "quote" })).ok).toBe(true);

    await replyFrom(lead, "Tell me more");
    expect((await sendToLead(user, await reload(lead.id), { ...pitch, kind: "followup" })).ok).toBe(true);
  });

  it("caps emails per day by plan", async () => {
    const user = await verifiedUser();
    const lead = await addLead(user.id);
    await db.insert(schema.messages).values(
      Array.from({ length: 20 }, () => ({
        userId: user.id,
        leadId: lead.id,
        direction: "out",
        kind: "reply",
        fromAddress: "x",
        toAddress: "y@z.test",
        subject: "s",
        body: "b",
        status: "sent",
      })),
    );
    expect(await sendToLead(user, lead, { ...pitch, kind: "reply" })).toEqual({ ok: false, reason: "daily_limit" });
  });

  it("records a failed send without moving the lead", async () => {
    process.env.RESEND_API_KEY = "key";
    process.env.RESEND_API_BASE = "http://127.0.0.1:1"; // nothing listens here
    try {
      const user = await verifiedUser();
      const lead = await addLead(user.id);
      expect(await sendToLead(user, lead, pitch)).toEqual({ ok: false, reason: "failed" });
      expect((await reload(lead.id)).status).toBe("new");
      expect((await conversation(user.id, lead.id))[0].status).toBe("failed");
    } finally {
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_BASE;
    }
  });
});

describe("replies", () => {
  it("land on the lead, mark it replied, clear the reminder and notify the freelancer", async () => {
    const user = await verifiedUser();
    const lead = await addLead(user.id);
    await sendToLead(user, lead, pitch);
    expect(await replyFrom(lead, "Yes! Call me.\n\nOn Tue, Kushal wrote:\n> Hi", "evt_1")).toBe("stored");
    expect(await replyFrom(lead, "Yes! Call me.", "evt_1")).toBe("duplicate");

    const updated = await reload(lead.id);
    expect(updated.status).toBe("replied");
    expect(updated.followUpOn).toBeNull();
    expect(await unreadCount(user.id)).toBe(1);
    const notice = sent().find((e) => e.to === user.email)!;
    expect(notice.subject).toBe("Smile Dental replied");
    expect(notice.text).toContain("Yes! Call me.");
    expect(notice.text).not.toContain("> Hi");

    const [thread] = await inbox(user.id);
    expect(thread).toMatchObject({ lead: { name: "Smile Dental" }, unread: 1, message: { direction: "in" } });
    await markRead(user.id, lead.id);
    expect(await unreadCount(user.id)).toBe(0);
  });

  it("threads the freelancer's answer onto the reply", async () => {
    const user = await verifiedUser();
    const lead = await addLead(user.id);
    await sendToLead(user, lead, pitch);
    await replyFrom(lead, "How much?", "evt_2");
    await sendToLead(user, await reload(lead.id), { kind: "reply", to: "owner@smile.test", subject: "Re: Your website on phones", body: "About NPR 35,000." });
    const answer = sent().at(-1)!;
    expect(answer.headers).toEqual({ "In-Reply-To": "<evt_2@mail.smile.test>", References: "<evt_2@mail.smile.test>" });
    expect(answer.text).toBe("About NPR 35,000."); // no opt-out line in a conversation
  });

  it("ignores mail to unknown or foreign addresses", async () => {
    const base = { providerId: "x", from: "a@b.test", subject: "hi", text: "hi", messageIdHeader: null };
    expect(await receiveReply({ ...base, to: ["reply+unknowntoken99@reply.pitchcraft.test"] })).toBe("unmatched");
    expect(await receiveReply({ ...base, to: ["someone@reply.pitchcraft.test"] })).toBe("unmatched");
  });

  it("fetches the body from Resend's receiving API", async () => {
    process.env.RESEND_API_KEY = "key";
    process.env.RESEND_API_BASE = `${process.env.MOCK_SITE_BASE}/resend`;
    try {
      await fetch(`${process.env.MOCK_SITE_BASE}/resend/_inbound`, {
        method: "POST",
        body: JSON.stringify({ id: "rcv_1", from: "a@b.test", to: ["reply+t@x.test"], subject: "Hi", text: "Body here" }),
      });
      expect(await fetchReceivedEmail("rcv_1")).toMatchObject({ subject: "Hi", text: "Body here" });
      await expect(fetchReceivedEmail("missing")).rejects.toThrow("404");
    } finally {
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_BASE;
    }
  });
});

describe("opting out", () => {
  it("a reply saying stop opts out the lead and the address, for every freelancer", async () => {
    const user = await verifiedUser();
    const lead = await addLead(user.id);
    await sendToLead(user, lead, pitch);
    expect(await replyFrom(lead, "STOP")).toBe("opted_out");
    const updated = await reload(lead.id);
    expect(updated.optedOutAt).toBeInstanceOf(Date);
    expect(updated.status).toBe("lost");
    expect(await sendToLead(user, updated, { ...pitch, kind: "reply" })).toEqual({ ok: false, reason: "opted_out" });

    const other = await verifiedUser();
    expect(await sendToLead(other, await addLead(other.id), pitch)).toEqual({ ok: false, reason: "suppressed" });
  });

  it("the opt-out link works by token and is idempotent", async () => {
    const user = await verifiedUser();
    const lead = await addLead(user.id);
    await sendToLead(user, lead, { ...pitch, to: "second@smile.test" });
    const found = await leadByReplyToken((await reload(lead.id)).replyToken!);
    expect(found?.freelancer).toBe("Kushal Budhathoki");
    await optOutLead(found!.lead);
    await optOutLead(await reload(lead.id));
    expect(await isSuppressed("owner@smile.test")).toBe(true);
    expect(await isSuppressed("second@smile.test")).toBe(true);
    expect(await leadByReplyToken("../etc")).toBeNull();
  });

  it("bounces and spam complaints suppress the address and flag the message", async () => {
    process.env.RESEND_API_KEY = "key";
    process.env.RESEND_API_BASE = `${process.env.MOCK_SITE_BASE}/resend`;
    try {
      const user = await verifiedUser();
      const lead = await addLead(user.id);
      await sendToLead(user, lead, pitch);
      const [message] = await conversation(user.id, lead.id);
      expect(message.providerId).toMatch(/^re_fake_/);
      await handleDeliveryProblem(message.providerId, ["Owner@Smile.test"], "bounce");
      expect((await conversation(user.id, lead.id))[0].status).toBe("bounced");
      expect(await isSuppressed("owner@smile.test")).toBe(true);
    } finally {
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_BASE;
    }
  });
});
