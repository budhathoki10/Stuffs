import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Invoice } from "@/db/schema";
import { shortId } from "@/lib/util";
import type { Currency, LineItem } from "@/lib/work/types";

/** INV-0001, INV-0002, …: one sequence per freelancer, safe under concurrent requests. */
export async function nextInvoiceNumber(userId: string): Promise<string> {
  const [row] = await db
    .update(schema.users)
    .set({ invoiceSeq: sql`${schema.users.invoiceSeq} + 1` })
    .where(eq(schema.users.id, userId))
    .returning({ seq: schema.users.invoiceSeq });
  return `INV-${String(row.seq).padStart(4, "0")}`;
}

export async function createInvoice(
  userId: string,
  leadId: string,
  data: { currency: Currency; items: LineItem[]; note: string | null; issuedOn: string; dueOn: string },
): Promise<string> {
  const id = shortId();
  await db.insert(schema.invoices).values({ id, userId, leadId, number: await nextInvoiceNumber(userId), ...data });
  return id;
}

export function invoicesForLead(userId: string, leadId: string): Promise<Invoice[]> {
  return db
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.userId, userId), eq(schema.invoices.leadId, leadId)))
    .orderBy(desc(schema.invoices.createdAt));
}

export async function setInvoiceStatus(userId: string, id: string, status: "paid" | "unpaid" | "void"): Promise<boolean> {
  const rows = await db
    .update(schema.invoices)
    .set({ status, paidAt: status === "paid" ? new Date() : null })
    .where(and(eq(schema.invoices.id, id), eq(schema.invoices.userId, userId)))
    .returning({ id: schema.invoices.id });
  return rows.length > 0;
}

export async function publicInvoice(id: string) {
  const [row] = await db
    .select({
      invoice: schema.invoices,
      business: { name: schema.leads.name, address: schema.leads.address },
      freelancer: {
        name: schema.users.name,
        email: schema.users.email,
        portfolioUrl: schema.users.portfolioUrl,
        paymentDetails: schema.users.paymentDetails,
      },
    })
    .from(schema.invoices)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.invoices.leadId))
    .innerJoin(schema.users, eq(schema.users.id, schema.invoices.userId))
    .where(eq(schema.invoices.id, id))
    .limit(1);
  return row ?? null;
}

/** Unpaid totals per currency across all of a freelancer's clients. */
export async function outstandingByCurrency(userId: string) {
  const rows = await db
    .select({ currency: schema.invoices.currency, items: schema.invoices.items })
    .from(schema.invoices)
    .where(and(eq(schema.invoices.userId, userId), eq(schema.invoices.status, "unpaid")));
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.items.reduce((s, i) => s + i.amountMinor, 0));
  return [...totals].map(([currency, amountMinor]) => ({ currency, amountMinor }));
}
