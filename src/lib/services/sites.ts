import "server-only";
import { and, count, desc, eq, gt, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Lead, Site, User } from "@/db/schema";
import { noticeMessage, sendEmail } from "@/lib/email";
import { limitsFor } from "@/lib/plans";
import { appUrl } from "@/lib/util";
import { defaultSiteContent, slugify, templateForCategory } from "@/lib/work/site";
import type { SiteContent, SiteTemplate } from "@/lib/work/types";

export const MESSAGES_PER_HOUR_PER_VISITOR = 5;

export async function siteForLead(userId: string, leadId: string): Promise<Site | null> {
  const [s] = await db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.userId, userId), eq(schema.sites.leadId, leadId)))
    .limit(1);
  return s ?? null;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const [taken] = await db.select({ id: schema.sites.id }).from(schema.sites).where(eq(schema.sites.slug, slug)).limit(1);
    if (!taken) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Start a site for a client, pre-filled from what we know about the business. */
export async function createSite(user: User, lead: Lead): Promise<Site> {
  const existing = await siteForLead(user.id, lead.id);
  if (existing) return existing;
  const template = templateForCategory(lead.category);
  const content = defaultSiteContent({
    businessName: lead.name,
    category: lead.category,
    template,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
  });
  const [site] = await db
    .insert(schema.sites)
    .values({ userId: user.id, leadId: lead.id, slug: await uniqueSlug(lead.name), template, content })
    .onConflictDoNothing()
    .returning();
  return site ?? (await siteForLead(user.id, lead.id))!;
}

export async function updateSite(userId: string, siteId: string, template: SiteTemplate, content: SiteContent): Promise<boolean> {
  const rows = await db
    .update(schema.sites)
    .set({ template, content, updatedAt: new Date() })
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.userId, userId)))
    .returning({ id: schema.sites.id });
  return rows.length > 0;
}

export type PublishResult = "published" | "unpublished" | "limit_reached" | "not_found";

export async function setPublished(user: User, siteId: string, publish: boolean): Promise<PublishResult> {
  if (publish) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.sites)
      .where(and(eq(schema.sites.userId, user.id), eq(schema.sites.published, true), ne(schema.sites.id, siteId)));
    if (n >= limitsFor(user).publishedSites) return "limit_reached";
  }
  const rows = await db
    .update(schema.sites)
    .set({ published: publish, publishedAt: publish ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.userId, user.id)))
    .returning({ id: schema.sites.id });
  if (!rows.length) return "not_found";
  return publish ? "published" : "unpublished";
}

export async function siteBySlug(slug: string) {
  const [row] = await db
    .select({ site: schema.sites, freelancer: { name: schema.users.name, email: schema.users.email, portfolioUrl: schema.users.portfolioUrl } })
    .from(schema.sites)
    .innerJoin(schema.users, eq(schema.users.id, schema.sites.userId))
    .where(eq(schema.sites.slug, slug))
    .limit(1);
  return row ?? null;
}

export function siteUrl(slug: string) {
  return appUrl(`/s/${slug}`);
}

export type MessageResult = "sent" | "rate_limited" | "spam" | "invalid";

/** A visitor's booking or contact request: stored, then emailed to the business and the freelancer. */
export async function receiveSiteMessage(
  siteRow: NonNullable<Awaited<ReturnType<typeof siteBySlug>>>,
  input: { name: string; contact: string; message: string; preferredDate: string; honeypot: string },
  ipHash: string,
): Promise<MessageResult> {
  if (input.honeypot) return "spam";
  const name = input.name.trim().slice(0, 120);
  const contact = input.contact.trim().slice(0, 160);
  const message = input.message.trim().slice(0, 2000);
  if (!name || !contact || !message) return "invalid";

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.siteMessages)
    .where(
      and(
        eq(schema.siteMessages.siteId, siteRow.site.id),
        eq(schema.siteMessages.ipHash, ipHash),
        gt(schema.siteMessages.createdAt, new Date(Date.now() - 3_600_000)),
      ),
    );
  if (n >= MESSAGES_PER_HOUR_PER_VISITOR) return "rate_limited";

  const preferredDate = input.preferredDate.trim().slice(0, 60) || null;
  await db.insert(schema.siteMessages).values({ siteId: siteRow.site.id, name, contact, message, preferredDate, ipHash });

  const business = siteRow.site.content.businessName;
  const lines = [`From: ${name}`, `Contact: ${contact}`, preferredDate ? `Preferred: ${preferredDate}` : null, "", message]
    .filter((l) => l !== null)
    .join("\n");
  const recipients = [siteRow.site.content.email, siteRow.freelancer.email].filter((e, i, all) => e && all.indexOf(e) === i);
  for (const to of recipients) {
    try {
      await sendEmail(noticeMessage(to, `New request from ${name} via your website`, `New request for ${business}`, [lines, "Reply to them directly using the contact details above."]));
    } catch (err) {
      console.error("Site message email failed", err);
    }
  }
  return "sent";
}

export function messagesForSite(userId: string, siteId: string) {
  return db
    .select({ message: schema.siteMessages })
    .from(schema.siteMessages)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.siteMessages.siteId))
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.userId, userId)))
    .orderBy(desc(schema.siteMessages.createdAt))
    .limit(50);
}

export async function ownedSite(userId: string, siteId: string): Promise<Site | null> {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return null;
  const [s] = await db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.userId, userId)))
    .limit(1);
  return s ?? null;
}
