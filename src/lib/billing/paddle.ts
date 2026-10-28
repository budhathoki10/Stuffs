import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300;

/**
 * Verify a Paddle Billing webhook. Header format: "ts=1671552777;h1=<hex>";
 * the signed payload is `${ts}:${rawBody}` (HMAC-SHA256 with the endpoint secret).
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(";").map((p) => p.split("=") as [string, string]);
  const ts = parts.find(([k]) => k === "ts")?.[1];
  const signatures = parts.filter(([k]) => k === "h1").map(([, v]) => v);
  if (!ts || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(ts)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type PaddleEvent = {
  event_id: string;
  event_type: string;
  data: {
    id: string;
    status?: string;
    currency_code?: string;
    custom_data?: { userId?: string } | null;
    current_billing_period?: { ends_at: string } | null;
    billing_period?: { ends_at: string } | null;
    subscription_id?: string | null;
    details?: { totals?: { grand_total?: string } };
  };
};

/** What a Paddle event means for our database, independent of storage. */
export function interpretPaddleEvent(event: PaddleEvent):
  | { kind: "subscription"; userId: string; subscriptionId: string; proUntil: Date | null }
  | { kind: "payment"; userId: string; ref: string; amountMinor: number; currency: string; proUntil: Date | null }
  | { kind: "ignore" } {
  const userId = event.data.custom_data?.userId;
  if (!userId) return { kind: "ignore" };
  if (event.event_type.startsWith("subscription.")) {
    const active = event.data.status === "active" || event.data.status === "trialing";
    const ends = event.data.current_billing_period?.ends_at;
    return {
      kind: "subscription",
      userId,
      subscriptionId: event.data.id,
      // Canceled/paused subscriptions keep access until the period they paid for ends.
      proUntil: active && ends ? new Date(ends) : null,
    };
  }
  if (event.event_type === "transaction.completed") {
    const ends = event.data.billing_period?.ends_at;
    return {
      kind: "payment",
      userId,
      ref: event.data.id,
      amountMinor: Number(event.data.details?.totals?.grand_total ?? 0),
      currency: event.data.currency_code ?? "USD",
      proUntil: ends ? new Date(ends) : null,
    };
  }
  return { kind: "ignore" };
}
