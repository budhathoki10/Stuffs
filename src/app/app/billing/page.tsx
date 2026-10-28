import type { Metadata } from "next";
import { KhaltiButton, PaddleCheckout } from "@/components/billing-buttons";
import { FormMessage } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { isPro, PLAN_LIMITS, PRICES } from "@/lib/plans";
import { appUrl } from "@/lib/util";

export const metadata: Metadata = { title: "Billing" };

const MESSAGES: Record<string, { error?: string; success?: string }> = {
  success: { success: "Payment received. You're on Pro." },
  pending: { success: "Waiting for the payment to confirm. Pro switches on as soon as it does, usually within a few minutes." },
  failed: { error: "The payment didn't go through, and you haven't been charged." },
};

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const user = await requireUser();
  const { status } = await searchParams;
  const message = typeof status === "string" ? MESSAGES[status] : undefined;
  const pro = isPro(user);
  const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const paddlePrices = [
    { label: `$${PRICES.monthlyUsd} a month`, priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY },
    { label: `$${PRICES.yearlyUsd} a year`, priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY },
  ].filter((p): p is { label: string; priceId: string } => !!p.priceId);

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Billing</h1>
      <div className="mt-6">
        <FormMessage error={message?.error} success={message?.success} />
      </div>

      <dl className="mt-6 grid grid-cols-2 border-y border-border py-5 sm:grid-cols-3">
        <div>
          <dt className="text-[13px] text-muted">Plan</dt>
          <dd className="mt-1 text-lg font-medium" data-testid="current-plan">
            {pro ? "Pro" : "Free"}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">{pro ? "Paid until" : "Leads"}</dt>
          <dd className="mt-1 text-lg">
            {pro && user.proUntil
              ? user.proUntil.toLocaleDateString("en-US", { dateStyle: "long" })
              : `${PLAN_LIMITS.free.leadsPerWeek} a week`}
          </dd>
        </div>
        {!pro && (
          <div>
            <dt className="text-[13px] text-muted">Drafted emails</dt>
            <dd className="mt-1 text-lg">{PLAN_LIMITS.free.pitchesPerWeek} a week</dd>
          </div>
        )}
      </dl>

      <section className="mt-12">
        <h2 className="font-serif text-2xl font-medium">{pro ? "Add more time" : "Upgrade to Pro"}</h2>
        <p className="mt-1.5 text-sm text-muted">
          {PLAN_LIMITS.pro.leadsPerDay} new leads every day and no limit on drafts. Refunded in full if you ask within 14
          days.
        </p>

        <div className="mt-8 divide-y divide-border border-y border-border">
          <div className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-medium">Card, Apple Pay or Google Pay</p>
              <p className="text-sm text-muted">Billed in USD by Paddle. Renews until you cancel.</p>
            </div>
            {paddleToken && paddlePrices.length > 0 ? (
              <PaddleCheckout
                clientToken={paddleToken}
                environment={process.env.PADDLE_ENV ?? "sandbox"}
                prices={paddlePrices}
                userId={user.id}
                email={user.email}
                successUrl={appUrl("/app/billing?status=pending")}
              />
            ) : (
              <p className="text-sm text-faint">Not set up yet</p>
            )}
          </div>
          <div className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-medium">Khalti</p>
              <p className="text-sm text-muted">For Nepal. NPR {PRICES.monthlyNpr} for 30 days, doesn&apos;t renew on its own.</p>
            </div>
            <KhaltiButton label={`Pay NPR ${PRICES.monthlyNpr}`} />
          </div>
        </div>
      </section>
    </div>
  );
}
