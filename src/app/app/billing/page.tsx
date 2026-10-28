import type { Metadata } from "next";
import { KhaltiButton, PaddleCheckout } from "@/components/billing-buttons";
import { Card, FormMessage } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { isPro, PLAN_LIMITS, PRICES } from "@/lib/plans";
import { appUrl } from "@/lib/util";

export const metadata: Metadata = { title: "Billing" };

const MESSAGES: Record<string, { error?: string; success?: string }> = {
  success: { success: "Payment received. Pro is active. Thank you!" },
  pending: { success: "Payment is being confirmed. Pro will activate within a few minutes." },
  failed: { error: "The payment didn't go through. You haven't been charged." },
};

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const user = await requireUser();
  const { status } = await searchParams;
  const message = typeof status === "string" ? MESSAGES[status] : undefined;
  const pro = isPro(user);
  const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const paddlePrices = [
    { label: `Pay $${PRICES.monthlyUsd}/month`, priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY },
    { label: `Pay $${PRICES.yearlyUsd}/year (save 35%)`, priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY },
  ].filter((p): p is { label: string; priceId: string } => !!p.priceId);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      <FormMessage error={message?.error} success={message?.success} />
      <Card>
        <p className="text-sm text-muted">Current plan</p>
        <p className="text-xl font-semibold" data-testid="current-plan">
          {pro ? "Pro" : "Free"}
        </p>
        {pro && user.proUntil && (
          <p className="text-sm text-muted">
            Active until {user.proUntil.toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        )}
        {!pro && (
          <p className="mt-2 text-sm text-muted">
            Free: {PLAN_LIMITS.free.leadsPerWeek} leads and {PLAN_LIMITS.free.pitchesPerWeek} pitches per week. Pro:{" "}
            {PLAN_LIMITS.pro.leadsPerDay} leads every day and unlimited pitches.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">{pro ? "Extend Pro" : "Upgrade to Pro"}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">One new client pays for years of Pro.</p>
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-medium">Card, Apple Pay, Google Pay (worldwide, USD)</h3>
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
              <p className="text-sm text-muted">Card payments are not configured yet.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Khalti (Nepal, NPR)</h3>
            <KhaltiButton label={`Pay NPR ${PRICES.monthlyNpr} for 30 days`} />
          </div>
        </div>
      </Card>
    </div>
  );
}
