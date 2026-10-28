import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Extend Pro access by `days`, starting from now or the current end date, whichever is later. */
export async function extendPro(userId: string, days: number) {
  await db
    .update(schema.users)
    .set({
      plan: "pro",
      proUntil: sql`greatest(coalesce(${schema.users.proUntil}, now()), now()) + make_interval(days => ${days})`,
    })
    .where(eq(schema.users.id, userId));
}

export async function setProUntil(userId: string, proUntil: Date | null, subscriptionId?: string) {
  await db
    .update(schema.users)
    .set({
      ...(proUntil ? { plan: "pro", proUntil } : {}),
      ...(subscriptionId ? { paddleSubscriptionId: subscriptionId } : {}),
    })
    .where(eq(schema.users.id, userId));
}

/** Record a payment once; returns false if this provider reference was already processed. */
export async function recordPayment(p: {
  userId: string;
  provider: "paddle" | "khalti";
  ref: string;
  status: string;
  amountMinor: number;
  currency: string;
}): Promise<boolean> {
  const inserted = await db
    .insert(schema.payments)
    .values({
      userId: p.userId,
      provider: p.provider,
      providerRef: p.ref,
      status: p.status,
      amountMinor: p.amountMinor,
      currency: p.currency,
    })
    .onConflictDoNothing()
    .returning({ id: schema.payments.id });
  return inserted.length > 0;
}

/** Atomically move a pending payment to completed. Returns the row if this call won the race. */
export async function completePendingPayment(provider: "khalti", ref: string) {
  const [row] = await db
    .update(schema.payments)
    .set({ status: "completed" })
    .where(
      and(
        eq(schema.payments.provider, provider),
        eq(schema.payments.providerRef, ref),
        eq(schema.payments.status, "pending"),
      ),
    )
    .returning();
  return row ?? null;
}

export async function getPayment(provider: "khalti" | "paddle", ref: string) {
  const [row] = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.provider, provider), eq(schema.payments.providerRef, ref)))
    .limit(1);
  return row ?? null;
}
