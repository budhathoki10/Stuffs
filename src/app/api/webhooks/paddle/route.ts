import { interpretPaddleEvent, verifyPaddleSignature, type PaddleEvent } from "@/lib/billing/paddle";
import { recordPayment, setProUntil } from "@/lib/services/billing";

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  if (!verifyPaddleSignature(raw, request.headers.get("paddle-signature"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(raw) as PaddleEvent;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const action = interpretPaddleEvent(event);
  try {
    if (action.kind === "subscription") {
      await setProUntil(action.userId, action.proUntil, action.subscriptionId);
    } else if (action.kind === "payment") {
      await recordPayment({
        userId: action.userId,
        provider: "paddle",
        ref: action.ref,
        status: "completed",
        amountMinor: action.amountMinor,
        currency: action.currency,
      });
      if (action.proUntil) await setProUntil(action.userId, action.proUntil);
    }
  } catch (err) {
    console.error("Paddle webhook processing failed", err);
    // A 5xx makes Paddle retry the delivery later.
    return new Response("Processing failed", { status: 500 });
  }
  return Response.json({ ok: true });
}
