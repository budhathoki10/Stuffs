"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { topIssues } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { leadProvider, NICHES, type NicheId } from "@/lib/leads";
import { LEAD_STATUSES } from "@/lib/leads/status";
import { generatePitch } from "@/lib/pitch";
import { limitsFor, weekStart } from "@/lib/plans";
import { deliverLeads } from "@/lib/services/delivery";
import { getAudit } from "@/lib/services/audits";
import { isSkill, SKILLS, type SkillId } from "@/lib/skills";
import { appUrl, formatMoney } from "@/lib/util";

export type FormState = { error?: string; success?: string } | undefined;

const SettingsSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  skill: z.enum(Object.keys(SKILLS) as [SkillId, ...SkillId[]]),
  portfolioUrl: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .pipe(z.union([z.literal(""), z.url("Portfolio must be a valid link")])),
  niche: z.enum(Object.keys(NICHES) as [NicheId, ...NicheId[]], "Pick the type of business you want to work with"),
  location: z.string().trim().min(2, "Enter a city, like Austin, TX or Kathmandu").max(120),
  radiusKm: z.coerce.number().int().min(1).max(50),
});

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = SettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, skill, portfolioUrl, niche, location, radiusKm } = parsed.data;

  await db.update(schema.users).set({ name, skill, portfolioUrl: portfolioUrl || null }).where(eq(schema.users.id, user.id));

  const [current] = await db
    .select()
    .from(schema.searches)
    .where(and(eq(schema.searches.userId, user.id), eq(schema.searches.active, true)))
    .limit(1);
  const unchanged = current && current.niche === niche && current.location === location && current.radiusKm === radiusKm;
  if (!unchanged) {
    let point;
    try {
      point = await leadProvider().geocode(location);
    } catch {
      return { error: "We couldn't look up that location right now. Try again in a minute." };
    }
    if (!point) return { error: `We couldn't find "${location}". Try adding the country, like "Pokhara, Nepal".` };
    await db.update(schema.searches).set({ active: false }).where(eq(schema.searches.userId, user.id));
    await db.insert(schema.searches).values({ userId: user.id, niche, location, radiusKm, lat: point.lat, lon: point.lon });
  }
  revalidatePath("/app", "layout");
  if (formData.get("welcome") === "1") redirect("/app?first=1");
  return { success: "Saved." };
}

export async function findLeadsNow(_: FormState): Promise<FormState> {
  const user = await requireUser();
  let result;
  try {
    result = await deliverLeads(user);
  } catch (err) {
    console.error("Lead delivery failed", err);
    return { error: "The map service didn't answer. Try again in a few minutes." };
  }
  revalidatePath("/app");
  switch (result.reason) {
    case "ok":
      return { success: `Found ${result.delivered} new lead${result.delivered === 1 ? "" : "s"}.` };
    case "no_search":
      return { error: "Choose a type of business and a city in Settings first." };
    case "limit_reached":
      return { error: "You've had all the leads your plan allows for now. Free accounts get 5 a week, Pro gets 5 every day." };
    case "no_new_businesses":
      return { error: "Every business we can find nearby is already in your list. Try a wider distance or another type of business in Settings." };
  }
}

async function ownedLead(userId: string, leadId: string) {
  if (!z.uuid().safeParse(leadId).success) return null;
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.userId, userId)))
    .limit(1);
  return lead ?? null;
}

export type PitchState = { error?: string; subject?: string; body?: string } | undefined;

export async function generateLeadPitch(_: PitchState, formData: FormData): Promise<PitchState> {
  const user = await requireUser();
  const lead = await ownedLead(user.id, String(formData.get("leadId")));
  if (!lead) return { error: "Lead not found." };

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.pitches)
    .where(and(eq(schema.pitches.userId, user.id), gte(schema.pitches.createdAt, new Date(weekStart()))));
  if (n >= limitsFor(user).pitchesPerWeek) {
    return { error: "That's your 10 free drafts for this week. Pro has no limit." };
  }

  const audit = lead.auditId ? await getAudit(lead.auditId) : null;
  const [search] = lead.searchId
    ? await db.select().from(schema.searches).where(eq(schema.searches.id, lead.searchId)).limit(1)
    : [];
  const pitch = await generatePitch({
    freelancerName: user.name,
    skill: isSkill(user.skill) ? user.skill : "web_dev",
    portfolioUrl: user.portfolioUrl,
    businessName: lead.name,
    category: lead.category,
    city: search?.location.split(",")[0] ?? null,
    website: lead.website,
    issues: audit ? topIssues(audit.checks) : [],
    reportUrl: audit ? appUrl(`/r/${audit.id}`) : null,
  });
  await db.insert(schema.pitches).values({
    userId: user.id,
    leadId: lead.id,
    auditId: audit?.id ?? null,
    subject: pitch.subject,
    body: pitch.body,
    model: pitch.model,
  });
  revalidatePath(`/app/leads/${lead.id}`);
  return { subject: pitch.subject, body: pitch.body };
}

const LeadUpdateSchema = z.object({
  leadId: z.uuid(),
  status: z.enum(LEAD_STATUSES),
  wonAmount: z
    .string()
    .optional()
    .transform((v) => (v ? Math.round(Number(v.replace(/[^0-9.]/g, "")) * 100) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e10), "Enter a valid amount"),
  notes: z.string().max(2000).optional(),
});

export async function updateLead(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = LeadUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { leadId, status, wonAmount, notes } = parsed.data;
  if (status === "won" && !wonAmount) return { error: "Enter what the project is worth so it counts toward your earnings." };
  const lead = await ownedLead(user.id, leadId);
  if (!lead) return { error: "Lead not found." };
  await db
    .update(schema.leads)
    .set({
      status,
      wonAmountCents: status === "won" ? wonAmount : null,
      notes: notes ?? lead.notes,
      updatedAt: new Date(),
    })
    .where(eq(schema.leads.id, lead.id));
  revalidatePath("/app", "layout");
  return { success: status === "won" && wonAmount ? `Saved. ${formatMoney(wonAmount)} added to your earnings.` : "Saved." };
}

/** Quick status change from the pipeline board (no amount needed except for "won"). */
export async function markSent(formData: FormData) {
  const user = await requireUser();
  const lead = await ownedLead(user.id, String(formData.get("leadId")));
  if (!lead || lead.status !== "new") return;
  await db.update(schema.leads).set({ status: "sent", updatedAt: new Date() }).where(eq(schema.leads.id, lead.id));
  revalidatePath("/app", "layout");
}
