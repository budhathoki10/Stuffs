"use client";

import Script from "next/script";
import { useActionState, useState } from "react";
import { startKhaltiPayment } from "@/app/actions/billing";
import { Button, FormMessage } from "./ui";

type PaddleGlobal = {
  Environment: { set(env: string): void };
  Initialize(opts: { token: string }): void;
  Checkout: {
    open(opts: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
      settings?: { successUrl?: string };
    }): void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

export function PaddleCheckout({
  clientToken,
  environment,
  prices,
  userId,
  email,
  successUrl,
}: {
  clientToken: string;
  environment: string;
  prices: { label: string; priceId: string }[];
  userId: string;
  email: string;
  successUrl: string;
}) {
  const [ready, setReady] = useState(false);
  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        onLoad={() => {
          if (!window.Paddle) return;
          if (environment !== "production") window.Paddle.Environment.set("sandbox");
          window.Paddle.Initialize({ token: clientToken });
          setReady(true);
        }}
      />
      <div className="flex flex-wrap gap-2">
        {prices.map((p) => (
          <Button
            key={p.priceId}
            type="button"
            disabled={!ready}
            onClick={() =>
              window.Paddle?.Checkout.open({
                items: [{ priceId: p.priceId, quantity: 1 }],
                customer: { email },
                // Read back by the webhook to know which account paid.
                customData: { userId },
                settings: { successUrl },
              })
            }
          >
            {p.label}
          </Button>
        ))}
      </div>
    </>
  );
}

export function KhaltiButton({ label }: { label: string }) {
  const [state, action, pending] = useActionState(startKhaltiPayment, undefined);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Opening Khalti…" : label}
      </Button>
      <FormMessage error={state?.error} />
    </form>
  );
}
