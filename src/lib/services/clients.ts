import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { lineItemsTotal } from "@/lib/work/types";

/** Every won client with where their work stands: site, care plan and money owed. */
export async function listClients(userId: string) {
  const leads = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.userId, userId), eq(schema.leads.status, "won")))
    .orderBy(desc(schema.leads.updatedAt));
  if (!leads.length) return [];
  const ids = leads.map((l) => l.id);
  const [sites, monitors, invoices] = await Promise.all([
    db
      .select({ leadId: schema.sites.leadId, published: schema.sites.published, slug: schema.sites.slug })
      .from(schema.sites)
      .where(inArray(schema.sites.leadId, ids)),
    db
      .select({ leadId: schema.monitors.leadId, status: schema.monitors.status, active: schema.monitors.active })
      .from(schema.monitors)
      .where(inArray(schema.monitors.leadId, ids)),
    db
      .select({ leadId: schema.invoices.leadId, status: schema.invoices.status, currency: schema.invoices.currency, items: schema.invoices.items, dueOn: schema.invoices.dueOn })
      .from(schema.invoices)
      .where(inArray(schema.invoices.leadId, ids)),
  ]);
  return leads.map((lead) => {
    const unpaid = invoices.filter((i) => i.leadId === lead.id && i.status === "unpaid");
    return {
      lead,
      site: sites.find((s) => s.leadId === lead.id) ?? null,
      monitor: monitors.find((m) => m.leadId === lead.id) ?? null,
      invoiceCount: invoices.filter((i) => i.leadId === lead.id && i.status !== "void").length,
      unpaid: unpaid.map((i) => ({ currency: i.currency, amountMinor: lineItemsTotal(i.items), dueOn: i.dueOn })),
    };
  });
}
