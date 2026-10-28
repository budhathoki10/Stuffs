import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initiateKhaltiPayment, lookupKhaltiPayment } from "@/lib/billing/khalti";
import { cancelPaddleSubscription, interpretPaddleEvent, verifyPaddleSignature } from "@/lib/billing/paddle";

const SECRET = "pdl_ntfset_test_secret";
const body = JSON.stringify({ event_type: "transaction.completed", data: { id: "txn_1" } });
const sign = (ts: number, raw = body, secret = SECRET) =>
  `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")}`;

describe("verifyPaddleSignature", () => {
  const now = 1_800_000_000;

  it("accepts a valid signature", () => {
    expect(verifyPaddleSignature(body, sign(now), SECRET, now)).toBe(true);
  });

  it("accepts any matching h1 during secret rotation", () => {
    const header = `${sign(now, body, "old-secret")};h1=${sign(now).split("h1=")[1]}`;
    expect(verifyPaddleSignature(body, header, SECRET, now)).toBe(true);
  });

  it("rejects a tampered body, wrong secret, stale timestamp or missing header", () => {
    expect(verifyPaddleSignature(body.replace("txn_1", "txn_2"), sign(now), SECRET, now)).toBe(false);
    expect(verifyPaddleSignature(body, sign(now, body, "other"), SECRET, now)).toBe(false);
    expect(verifyPaddleSignature(body, sign(now - 3600), SECRET, now)).toBe(false);
    expect(verifyPaddleSignature(body, null, SECRET, now)).toBe(false);
    expect(verifyPaddleSignature(body, "garbage", SECRET, now)).toBe(false);
    expect(verifyPaddleSignature(body, sign(now), "", now)).toBe(false);
  });
});

describe("interpretPaddleEvent", () => {
  it("maps an active subscription to a Pro end date", () => {
    const result = interpretPaddleEvent({
      event_id: "evt_1",
      event_type: "subscription.updated",
      data: {
        id: "sub_1",
        status: "active",
        custom_data: { userId: "u1" },
        current_billing_period: { ends_at: "2026-11-28T00:00:00Z" },
      },
    });
    expect(result).toEqual({ kind: "subscription", userId: "u1", subscriptionId: "sub_1", proUntil: new Date("2026-11-28T00:00:00Z") });
  });

  it("does not shorten access when a subscription is canceled", () => {
    const result = interpretPaddleEvent({
      event_id: "evt_2",
      event_type: "subscription.canceled",
      data: { id: "sub_1", status: "canceled", custom_data: { userId: "u1" }, current_billing_period: null },
    });
    expect(result).toMatchObject({ kind: "subscription", proUntil: null });
  });

  it("records completed transactions", () => {
    const result = interpretPaddleEvent({
      event_id: "evt_3",
      event_type: "transaction.completed",
      data: {
        id: "txn_1",
        currency_code: "USD",
        custom_data: { userId: "u1" },
        details: { totals: { grand_total: "1900" } },
        billing_period: { ends_at: "2026-11-28T00:00:00Z" },
      },
    });
    expect(result).toMatchObject({ kind: "payment", ref: "txn_1", amountMinor: 1900, currency: "USD" });
  });

  it("ignores events without our user id", () => {
    expect(interpretPaddleEvent({ event_id: "e", event_type: "transaction.completed", data: { id: "t" } })).toEqual({ kind: "ignore" });
  });
});

describe("Khalti client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KHALTI_SECRET_KEY;
  });

  it("initiates a payment with the secret key against the sandbox", async () => {
    process.env.KHALTI_SECRET_KEY = "test_secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ pidx: "px1", payment_url: "https://test-pay.khalti.com/?pidx=px1", expires_at: "x" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await initiateKhaltiPayment({
      amountPaisa: 99900,
      orderId: "pc-1",
      orderName: "Pro",
      returnUrl: "http://localhost:3000/cb",
      websiteUrl: "http://localhost:3000",
      customer: { name: "Kushal", email: "k@example.com" },
    });
    expect(res.pidx).toBe("px1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://dev.khalti.com/api/v2/epayment/initiate/");
    expect(init.headers.Authorization).toBe("Key test_secret");
    expect(JSON.parse(init.body)).toMatchObject({ amount: 99900, purchase_order_id: "pc-1", return_url: "http://localhost:3000/cb" });
  });

  it("surfaces API errors", async () => {
    process.env.KHALTI_SECRET_KEY = "test_secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid token." }), { status: 401 })));
    await expect(lookupKhaltiPayment("px1")).rejects.toThrow("Invalid token.");
  });

  it("requires a secret key", async () => {
    await expect(lookupKhaltiPayment("px1")).rejects.toThrow("KHALTI_SECRET_KEY");
  });
});

describe("cancelPaddleSubscription", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PADDLE_API_KEY;
  });

  it("cancels immediately through the sandbox API", async () => {
    process.env.PADDLE_API_KEY = "pdl_sdbx_key";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await cancelPaddleSubscription("sub_123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sandbox-api.paddle.com/subscriptions/sub_123/cancel");
    expect(init.headers.Authorization).toBe("Bearer pdl_sdbx_key");
    expect(JSON.parse(init.body)).toEqual({ effective_from: "immediately" });
  });

  it("treats an already-canceled subscription as done", async () => {
    process.env.PADDLE_API_KEY = "pdl_sdbx_key";
    const body = JSON.stringify({ error: { code: "subscription_update_when_canceled", detail: "already canceled" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 400 })));
    await expect(cancelPaddleSubscription("sub_123")).resolves.toBeUndefined();
  });

  it("fails loudly on other errors or a missing key", async () => {
    await expect(cancelPaddleSubscription("sub_123")).rejects.toThrow("PADDLE_API_KEY");
    process.env.PADDLE_API_KEY = "pdl_sdbx_key";
    const body = JSON.stringify({ error: { code: "forbidden", detail: "Invalid API key" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 403 })));
    await expect(cancelPaddleSubscription("sub_123")).rejects.toThrow("Invalid API key");
  });
});
