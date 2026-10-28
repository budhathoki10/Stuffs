"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { initiateKhaltiPayment } from "@/lib/billing/khalti";
import { PRICES } from "@/lib/plans";
import { recordPayment } from "@/lib/services/billing";
import { appUrl, shortId } from "@/lib/util";

export type BillingState = { error?: string } | undefined;

export async function startKhaltiPayment(_: BillingState): Promise<BillingState> {
  const user = await requireUser();
  if (!process.env.KHALTI_SECRET_KEY) return { error: "Khalti payments are not configured yet." };
  const amountPaisa = PRICES.monthlyNpr * 100;
  let paymentUrl: string;
  try {
    const res = await initiateKhaltiPayment({
      amountPaisa,
      orderId: `pc-${shortId(12)}`,
      orderName: "Pitchcraft Pro (30 days)",
      returnUrl: appUrl("/api/billing/khalti/callback"),
      websiteUrl: appUrl(),
      customer: { name: user.name, email: user.email },
    });
    await recordPayment({
      userId: user.id,
      provider: "khalti",
      ref: res.pidx,
      status: "pending",
      amountMinor: amountPaisa,
      currency: "NPR",
    });
    paymentUrl = res.payment_url;
  } catch (err) {
    console.error("Khalti initiate failed", err);
    return { error: "Couldn't start the Khalti payment. Try again." };
  }
  redirect(paymentUrl);
}
