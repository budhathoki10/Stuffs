import { createHmac, timingSafeEqual } from "node:crypto";

/** Emails written to a business. Everything else (quotes, invoices, replies) is part of a conversation. */
export const COLD_KINDS = ["pitch", "followup"] as const;
export const OUTGOING_KINDS = ["pitch", "followup", "reply", "quote", "invoice", "report", "site"] as const;
export type OutgoingKind = (typeof OUTGOING_KINDS)[number];

export function isOutgoingKind(v: unknown): v is OutgoingKind {
  return typeof v === "string" && (OUTGOING_KINDS as readonly string[]).includes(v);
}

/** Stop emailing a business after this many unanswered cold emails. */
export const MAX_UNANSWERED = 3;

const EMAIL_RE = /^[^\s@<>"(),;:]+@[^\s@<>"(),;:]+\.[a-z]{2,}$/i;

export function normalizeEmail(input: string | null | undefined): string | null {
  const v = (input ?? "").trim().toLowerCase();
  return EMAIL_RE.test(v) ? v : null;
}

/** "Ram Shrestha <ram@x.com>" -> "ram@x.com" */
export function addressOf(input: string): string | null {
  const m = input.match(/<([^>]+)>/);
  return normalizeEmail(m ? m[1] : input);
}

/** Display name for the From header: no quotes, brackets or line breaks that could alter the header. */
export function senderName(name: string): string {
  const clean = name.replace(/[\r\n"<>\\,;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${clean || "A freelancer"} via Pitchcraft`;
}

export function replyAddress(token: string, domain: string): string {
  return `reply+${token}@${domain}`;
}

/** Find our reply token in the addresses an incoming email was sent to. */
export function replyTokenFrom(addresses: string[], domain: string): string | null {
  const d = domain.toLowerCase();
  for (const a of addresses) {
    const m = (addressOf(a) ?? "").match(/^reply\+([a-z0-9]{6,40})@(.+)$/);
    if (m && m[2] === d) return m[1];
  }
  return null;
}

/** "Re: Quick note" stays as is; "Quick note" becomes "Re: Quick note". */
export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

/**
 * The new part of a reply, without the quoted thread underneath. Mail apps quote in different
 * ways, so this cuts at the first line that looks like the start of a quote.
 */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (l, i) =>
      /^On .{4,200}wrote:\s*$/.test(l.trim()) ||
      // Gmail sometimes wraps "On ... wrote:" over two lines.
      (/^On .{4,200}$/.test(l.trim()) && /wrote:\s*$/.test((lines[i + 1] ?? "").trim())) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(l.trim()) ||
      (/^From: .+/.test(l.trim()) && /^(Sent|Date): /.test((lines[i + 1] ?? "").trim())) ||
      /^>/.test(l),
  );
  const kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
  return kept || text.trim();
}

/** A reply that only says stop, unsubscribe, remove me and so on. */
export function isStopRequest(text: string): boolean {
  const first = stripQuoted(text).toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (first.length > 60) return false;
  return /^(please )?(stop|unsubscribe|remove( me)?|do not (email|contact)( me)?|don t (email|contact)( me)?|no more emails|not interested stop)( please)?( thanks| thank you)?$/.test(
    first,
  );
}

export function withOptOut(body: string, link: string): string {
  return `${body.trimEnd()}\n\n--\nIf you'd rather not hear from me again, reply "stop" or open ${link}`;
}

/** What the first email was about, by audit check id, phrased to follow "my note about". */
const TOPIC: Record<string, string> = {
  website: "getting you a website",
  reachable: "your website not loading",
  https: "the \"Not secure\" warning on your website",
  mobile: "how your website looks on phones",
  pagespeed: "how slowly your website loads on phones",
  speed: "how slowly your website loads",
  weight: "how slowly your website loads",
  title: "how your website shows up on Google",
  description: "how your website shows up on Google",
  h1: "how your website shows up on Google",
  alt: "how your website shows up on Google",
  contact: "making it easier for customers to reach you",
  booking: "letting customers book online",
  fresh: "your website looking out of date",
  social: "how your website looks when people share it",
  favicon: "how your website looks when people share it",
};

/** A short, polite nudge, written for the freelancer to edit. `problemId` is the audit check the pitch led with. */
export function followUpDraft(input: { businessName: string; freelancerName: string; problemId: string | null; previousSubject: string | null }) {
  const topic = input.problemId ? TOPIC[input.problemId] : null;
  const about = topic ? ` about ${topic}` : "";
  return {
    subject: input.previousSubject ? replySubject(input.previousSubject) : `Following up, ${input.businessName}`,
    body: [
      "Hi again,",
      `Just making sure my note${about} reached you. I know things get busy.`,
      "If it's useful, I can put together a quick mockup so you can see what it would look like before deciding anything. If the timing isn't right, no problem at all.",
      `Thanks,\n${input.freelancerName}`,
    ].join("\n\n"),
  };
}

/**
 * Verify a Resend webhook. Resend signs with Svix: HMAC-SHA256 over "id.timestamp.body" with the
 * base64 secret after "whsec_", sent as one or more "v1,<base64>" values. Five minutes of clock skew allowed.
 */
export function verifyWebhook(
  secret: string | undefined,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  now = Date.now(),
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${body}`).digest();
  return headers.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export function signWebhook(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}
