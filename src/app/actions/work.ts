"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { FetchBlockedError } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { addDays } from "@/lib/dates";
import { today } from "@/lib/plans";
import { createComparison } from "@/lib/services/comparisons";
import { setFollowUp } from "@/lib/services/followups";
import { createInvoice, setInvoiceStatus } from "@/lib/services/invoices";
import { getLeadWithAudit, ownedLead } from "@/lib/services/leads";
import { createMonitor, deleteMonitor, monitorForLead, runMonitor, setMonitorActive } from "@/lib/services/monitors";
import { createQuote, markQuoteSent, quoteForLead, respondToQuote, updateQuote } from "@/lib/services/quotes";
import { createSite, setPublished, siteForLead, updateSite } from "@/lib/services/sites";
import { quoteFromChecks } from "@/lib/work/pricing";
import { CURRENCIES, SITE_ACCENTS, SITE_TEMPLATES, type Currency, type SiteAccent, type SiteTemplate } from "@/lib/work/types";

export type WorkState = { error?: string; success?: string } | undefined;

const currency = z.enum(CURRENCIES as unknown as [Currency, ...Currency[]]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const LineItems = z
  .array(
    z.object({
      title: z.string().trim().min(1, "Every line needs a description").max(160),
      detail: z.string().trim().max(400).optional(),
      amountMinor: z.number().int().min(0).max(10_000_000_000),
    }),
  )
  .min(1, "Add at least one line")
  .max(30);

function parseItems(raw: FormDataEntryValue | null) {
  try {
    return LineItems.safeParse(JSON.parse(String(raw ?? "[]")));
  } catch {
    return LineItems.safeParse(null);
  }
}

async function requireLead(leadId: FormDataEntryValue | null) {
  const user = await requireUser();
  const lead = await ownedLead(user.id, String(leadId ?? ""));
  if (!lead) redirect("/app");
  return { user, lead };
}

const leadPath = (leadId: string, tab = "") => `/app/leads/${leadId}${tab ? `/${tab}` : ""}`;

// ---------------------------------------------------------------- quotes

export async function startQuote(formData: FormData) {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const parsed = currency.safeParse(formData.get("currency"));
  if (!(await quoteForLead(user.id, lead.id))) {
    const row = await getLeadWithAudit(user.id, lead.id);
    await createQuote(user, lead, parsed.success ? parsed.data : "USD", quoteFromChecks(row?.audit?.checks ?? null, parsed.success ? parsed.data : "USD"));
  }
  revalidatePath(leadPath(lead.id, "quote"));
}

export async function saveQuote(_: WorkState, formData: FormData): Promise<WorkState> {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const items = parseItems(formData.get("items"));
  if (!items.success) return { error: items.error.issues[0].message };
  const cur = currency.safeParse(formData.get("currency"));
  const validUntil = day.safeParse(formData.get("validUntil"));
  if (!cur.success || !validUntil.success) return { error: "Check the currency and the valid-until date." };
  const ok = await updateQuote(user.id, String(formData.get("quoteId")), {
    items: items.data,
    currency: cur.data,
    note: String(formData.get("note") ?? "").trim().slice(0, 2000) || null,
    validUntil: validUntil.data,
  });
  if (!ok) return { error: "This quote has already been answered, so it can't be changed." };
  revalidatePath(leadPath(lead.id, "quote"));
  return { success: "Quote saved." };
}

export async function sendQuote(formData: FormData) {
  const { user, lead } = await requireLead(formData.get("leadId"));
  await markQuoteSent(user.id, String(formData.get("quoteId")));
  revalidatePath(leadPath(lead.id, "quote"));
}

/** Public: the client accepting or declining on /q/:id. */
export async function answerQuote(_: WorkState, formData: FormData): Promise<WorkState> {
  const id = String(formData.get("quoteId") ?? "");
  const accept = formData.get("answer") === "accept";
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (accept && !name) return { error: "Type your name to accept." };
  const result = await respondToQuote(id, accept, name);
  if (result === "not_found") return { error: "This quote no longer exists." };
  if (result === "expired") return { error: "This quote has expired. Ask for an updated one." };
  revalidatePath(`/q/${id}`);
  return undefined;
}

// ---------------------------------------------------------------- website

export async function startSite(formData: FormData) {
  const { user, lead } = await requireLead(formData.get("leadId"));
  await createSite(user, lead);
  revalidatePath(leadPath(lead.id, "site"));
}

const SiteForm = z.object({
  template: z.enum(Object.keys(SITE_TEMPLATES) as [SiteTemplate, ...SiteTemplate[]]),
  accent: z.enum(Object.keys(SITE_ACCENTS) as [SiteAccent, ...SiteAccent[]]),
  businessName: z.string().trim().min(1, "The business needs a name").max(120),
  tagline: z.string().trim().max(160),
  about: z.string().trim().max(2000),
  phone: z.string().trim().max(40),
  whatsapp: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email address doesn't look right")]),
  address: z.string().trim().max(240),
  hours: z.string().trim().max(400),
  cta: z.string().trim().min(1, "The main button needs a label").max(40),
  services: z
    .array(z.object({ name: z.string().trim().max(80), description: z.string().trim().max(300), price: z.string().trim().max(40).optional() }))
    .max(12),
});

export async function saveSite(_: WorkState, formData: FormData): Promise<WorkState> {
  const { user, lead } = await requireLead(formData.get("leadId"));
  let services: unknown = [];
  try {
    services = JSON.parse(String(formData.get("services") ?? "[]"));
  } catch {
    return { error: "Couldn't read the services list." };
  }
  const parsed = SiteForm.safeParse({ ...Object.fromEntries(formData), services });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { template, ...content } = parsed.data;
  const ok = await updateSite(user.id, String(formData.get("siteId")), template, {
    ...content,
    services: content.services.filter((s) => s.name),
  });
  if (!ok) return { error: "Site not found." };
  revalidatePath(leadPath(lead.id, "site"));
  return { success: "Saved." };
}

export async function publishSite(_: WorkState, formData: FormData): Promise<WorkState> {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const site = await siteForLead(user.id, lead.id);
  if (!site) return { error: "Build the site first." };
  const result = await setPublished(user, site.id, formData.get("publish") === "1");
  revalidatePath(leadPath(lead.id, "site"));
  if (result === "limit_reached") return { error: "Free accounts can have one live site. Upgrade to Pro to publish more." };
  return { success: result === "published" ? "The site is live." : "The site is offline." };
}

// ---------------------------------------------------------------- results and monitoring

function urlError(err: unknown) {
  if (err instanceof FetchBlockedError || err instanceof TypeError) return "That doesn't look like a public website address.";
  console.error(err);
  return "Something went wrong. Try again in a moment.";
}

export async function compareSite(_: WorkState, formData: FormData): Promise<WorkState> {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Enter the address of the finished site." };
  try {
    await createComparison(user.id, lead, url);
  } catch (err) {
    return { error: urlError(err) };
  }
  revalidatePath(leadPath(lead.id, "care"));
  return { success: "Checked. The before-and-after report is ready to share." };
}

export async function startMonitor(_: WorkState, formData: FormData): Promise<WorkState> {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Enter the site's address." };
  let result;
  try {
    result = await createMonitor(user, lead.id, url);
  } catch (err) {
    return { error: urlError(err) };
  }
  if (!result.ok) {
    return { error: result.reason === "limit_reached" ? "Free accounts can monitor one site. Upgrade to Pro for more." : "This client is already monitored." };
  }
  const monitor = await monitorForLead(user.id, lead.id);
  if (monitor) await runMonitor(monitor, user.email);
  revalidatePath(leadPath(lead.id, "care"));
  return { success: "Monitoring started. We'll check it every 10 minutes." };
}

export async function monitorAction(formData: FormData) {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const monitor = await monitorForLead(user.id, lead.id);
  if (monitor) {
    const op = formData.get("op");
    if (op === "check") await runMonitor(monitor, user.email);
    if (op === "pause") await setMonitorActive(user.id, monitor.id, false);
    if (op === "resume") await setMonitorActive(user.id, monitor.id, true);
    if (op === "delete") await deleteMonitor(user.id, monitor.id);
  }
  revalidatePath(leadPath(lead.id, "care"));
}

// ---------------------------------------------------------------- invoices

export async function newInvoice(_: WorkState, formData: FormData): Promise<WorkState> {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const items = parseItems(formData.get("items"));
  if (!items.success) return { error: items.error.issues[0].message };
  const cur = currency.safeParse(formData.get("currency"));
  const due = day.safeParse(formData.get("dueOn"));
  if (!cur.success || !due.success) return { error: "Check the currency and the due date." };
  await createInvoice(user.id, lead.id, {
    currency: cur.data,
    items: items.data,
    note: String(formData.get("note") ?? "").trim().slice(0, 2000) || null,
    issuedOn: today(),
    dueOn: due.data,
  });
  revalidatePath(leadPath(lead.id, "invoices"));
  return { success: "Invoice created. Open it to send the link or print it." };
}

export async function invoiceStatus(formData: FormData) {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const status = z.enum(["paid", "unpaid", "void"]).safeParse(formData.get("status"));
  if (status.success) await setInvoiceStatus(user.id, String(formData.get("invoiceId")), status.data);
  revalidatePath(leadPath(lead.id, "invoices"));
  revalidatePath("/app/clients");
}

// ---------------------------------------------------------------- follow-ups

export async function followUpAction(formData: FormData) {
  const { user, lead } = await requireLead(formData.get("leadId"));
  const op = formData.get("op");
  await setFollowUp(user.id, lead.id, op === "snooze" ? addDays(today(), 3) : null);
  revalidatePath("/app");
}

// ---------------------------------------------------------------- payment details

const MAX_QR_BYTES = 300 * 1024;

export async function savePaymentDetails(_: WorkState, formData: FormData): Promise<WorkState> {
  const user = await requireUser();
  const text = (k: string, max = 120) => String(formData.get(k) ?? "").trim().slice(0, max) || undefined;
  const details = {
    esewaId: text("esewaId", 40),
    khaltiId: text("khaltiId", 40),
    bankName: text("bankName"),
    bankAccountName: text("bankAccountName"),
    bankAccountNumber: text("bankAccountNumber", 40),
    bankBranch: text("bankBranch"),
    payoneerEmail: text("payoneerEmail"),
    other: text("other", 500),
    qrLabel: text("qrLabel", 60),
    qrImage: user.paymentDetails.qrImage,
  };

  const file = formData.get("qr");
  if (file instanceof File && file.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return { error: "The QR code must be a PNG, JPEG or WebP image." };
    if (file.size > MAX_QR_BYTES) return { error: "The QR image is too large. Keep it under 300 KB (a screenshot of the QR is plenty)." };
    details.qrImage = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  if (formData.get("removeQr") === "1") details.qrImage = undefined;

  await db.update(schema.users).set({ paymentDetails: details }).where(eq(schema.users.id, user.id));
  revalidatePath("/app/settings");
  return { success: "Payment details saved. They'll appear on every invoice." };
}
