"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { FetchBlockedError, topIssues } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { generatePitch } from "@/lib/pitch";
import {
  ANON_AUDITS_PER_HOUR,
  ANON_PITCHES_PER_HOUR,
  anonymousAuditsLastHour,
  anonymousPitchesLastHour,
  auditAndSave,
  getAudit,
} from "@/lib/services/audits";
import { isSkill } from "@/lib/skills";
import { appUrl, clientIp, hashIp } from "@/lib/util";

export type AuditFormState = { error?: string; url?: string } | undefined;

export async function runFreeAudit(_: AuditFormState, formData: FormData): Promise<AuditFormState> {
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Paste a website address, like example.com" };
  const user = await getCurrentUser();
  const ipHash = hashIp(clientIp(await headers()));
  if (!user && (await anonymousAuditsLastHour(ipHash)) >= ANON_AUDITS_PER_HOUR) {
    return { url, error: "You've used the free checks for this hour. Create a free account to keep going." };
  }

  let id: string;
  try {
    ({ id } = await auditAndSave(url, { createdBy: user?.id ?? null, ipHash }));
  } catch (err) {
    if (err instanceof FetchBlockedError || err instanceof TypeError) {
      return { url, error: "That doesn't look like a public website address." };
    }
    console.error("Audit failed", err);
    return { url, error: "Something went wrong while checking that site. Please try again." };
  }
  redirect(`/r/${id}`);
}

export type DemoPitchState = { error?: string; subject?: string; body?: string } | undefined;

/** Sample pitch on a public report, so visitors can try the product before signing up. */
export async function generateDemoPitch(_: DemoPitchState, formData: FormData): Promise<DemoPitchState> {
  const auditId = String(formData.get("auditId") ?? "");
  const audit = await getAudit(auditId);
  if (!audit) return { error: "Report not found." };

  const user = await getCurrentUser();
  const ipHash = hashIp(clientIp(await headers()));
  if (!user && (await anonymousPitchesLastHour(ipHash)) >= ANON_PITCHES_PER_HOUR) {
    return { error: "You've reached the free sample limit for this hour. Sign up free to get daily pitches." };
  }

  const pitch = await generatePitch({
    freelancerName: user?.name ?? "Your Name",
    skill: user && isSkill(user.skill) ? user.skill : "web_dev",
    portfolioUrl: user?.portfolioUrl,
    businessName: audit.businessName ?? new URL(audit.finalUrl ?? audit.url).hostname.replace(/^www\./, ""),
    category: "business",
    website: audit.finalUrl ?? audit.url,
    issues: topIssues(audit.checks),
    reportUrl: appUrl(`/r/${audit.id}`),
  });
  await db.insert(schema.pitches).values({
    userId: user?.id ?? null,
    auditId: audit.id,
    subject: pitch.subject,
    body: pitch.body,
    model: pitch.model,
    ipHash,
  });
  return { subject: pitch.subject, body: pitch.body };
}
