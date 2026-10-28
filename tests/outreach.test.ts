import { describe, expect, it } from "vitest";
import {
  addressOf,
  followUpDraft,
  isStopRequest,
  normalizeEmail,
  replyAddress,
  replySubject,
  replyTokenFrom,
  senderName,
  signWebhook,
  stripQuoted,
  verifyWebhook,
  withOptOut,
} from "@/lib/outreach/text";

describe("addresses", () => {
  it("normalizes and validates", () => {
    expect(normalizeEmail("  Owner@Smile.TEST ")).toBe("owner@smile.test");
    expect(normalizeEmail("not an email")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("a@b.com, c@d.com")).toBeNull();
    expect(addressOf('"Dr. Sita" <Sita@Smile.test>')).toBe("sita@smile.test");
    expect(addressOf("plain@smile.test")).toBe("plain@smile.test");
  });

  it("keeps header-breaking characters out of the sender name", () => {
    expect(senderName("Kushal Budhathoki")).toBe("Kushal Budhathoki via Pitchcraft");
    expect(senderName('Evil "Name" <x@y.z>\r\nBcc: victim@x.com')).toBe("Evil Name x@y.z Bcc: victim@x.com via Pitchcraft");
    expect(senderName("  ")).toBe("A freelancer via Pitchcraft");
  });

  it("routes replies by token, only on our domain", () => {
    const addr = replyAddress("abc123def456ghjk", "reply.pitchcraft.app");
    expect(addr).toBe("reply+abc123def456ghjk@reply.pitchcraft.app");
    expect(replyTokenFrom(["someone@else.com", `Kushal <${addr}>`], "reply.pitchcraft.app")).toBe("abc123def456ghjk");
    expect(replyTokenFrom(["reply+abc123def456ghjk@evil.com"], "reply.pitchcraft.app")).toBeNull();
    expect(replyTokenFrom(["reply+bad!token@reply.pitchcraft.app"], "reply.pitchcraft.app")).toBeNull();
  });
});

describe("replies", () => {
  it("adds Re: once", () => {
    expect(replySubject("Your website")).toBe("Re: Your website");
    expect(replySubject("RE: Your website")).toBe("RE: Your website");
  });

  it("keeps only the new part of a reply", () => {
    const gmail = "Yes, please call me tomorrow.\n\nOn Tue, 27 Oct 2026 at 10:01, Kushal via Pitchcraft <outreach@x.com> wrote:\n> Hi team,\n> Your site...";
    expect(stripQuoted(gmail)).toBe("Yes, please call me tomorrow.");
    const wrapped = "Sounds good.\n\nOn Tue, 27 Oct 2026 at 10:01, Kushal via Pitchcraft <outreach@x.com>\nwrote:\n> Hi";
    expect(stripQuoted(wrapped)).toBe("Sounds good.");
    const outlook = "How much?\r\n\r\nFrom: Kushal via Pitchcraft\r\nSent: Tuesday\r\nSubject: hi";
    expect(stripQuoted(outlook)).toBe("How much?");
    expect(stripQuoted("> only quoted")).toBe("> only quoted");
  });

  it("recognises a request to stop, and nothing longer", () => {
    for (const t of ["STOP", "stop.", "Unsubscribe", "Please remove me", "Do not contact me, thanks", "stop\n\nOn Tue, X wrote:\n> Hi"]) {
      expect(isStopRequest(t), t).toBe(true);
    }
    for (const t of ["Don't stop, tell me more", "Can you stop by on Friday?", "How much would it cost?"]) {
      expect(isStopRequest(t), t).toBe(false);
    }
  });
});

describe("drafts", () => {
  it("adds an opt-out line to cold emails", () => {
    expect(withOptOut("Hi,\n\nThanks\n", "https://p.app/x/tok")).toBe(
      'Hi,\n\nThanks\n\n--\nIf you\'d rather not hear from me again, reply "stop" or open https://p.app/x/tok',
    );
  });

  it("writes a follow-up about the problem the pitch led with", () => {
    const d = followUpDraft({ businessName: "Smile Dental", freelancerName: "Kushal", problemId: "mobile", previousSubject: "Your website on phones" });
    expect(d.subject).toBe("Re: Your website on phones");
    expect(d.body).toContain("my note about how your website looks on phones reached you");
    expect(d.body.endsWith("Thanks,\nKushal")).toBe(true);
    expect(followUpDraft({ businessName: "Smile", freelancerName: "K", problemId: null, previousSubject: null }).body).toContain("my note reached you");
  });
});

describe("webhook signatures", () => {
  const secret = `whsec_${Buffer.from("test-secret-key-0123456789").toString("base64")}`;
  const body = JSON.stringify({ type: "email.received", data: { email_id: "e1" } });
  const now = 1_793_000_000_000;
  const ts = String(now / 1000);

  it("accepts a valid Svix signature, including among several", () => {
    const sig = signWebhook(secret, "msg_1", now / 1000, body);
    expect(verifyWebhook(secret, { id: "msg_1", timestamp: ts, signature: sig }, body, now)).toBe(true);
    expect(verifyWebhook(secret, { id: "msg_1", timestamp: ts, signature: `v1,AAAA ${sig}` }, body, now)).toBe(true);
  });

  it("rejects tampering, replays and missing secrets", () => {
    const sig = signWebhook(secret, "msg_1", now / 1000, body);
    expect(verifyWebhook(secret, { id: "msg_1", timestamp: ts, signature: sig }, body.replace("e1", "e2"), now)).toBe(false);
    expect(verifyWebhook(secret, { id: "msg_2", timestamp: ts, signature: sig }, body, now)).toBe(false);
    expect(verifyWebhook(secret, { id: "msg_1", timestamp: ts, signature: sig }, body, now + 6 * 60_000)).toBe(false);
    expect(verifyWebhook(undefined, { id: "msg_1", timestamp: ts, signature: sig }, body, now)).toBe(false);
    expect(verifyWebhook(secret, { id: "msg_1", timestamp: ts, signature: null }, body, now)).toBe(false);
  });
});
