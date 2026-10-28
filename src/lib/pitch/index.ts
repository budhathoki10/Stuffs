import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AuditCheck } from "@/lib/audit/types";
import { SKILLS, type SkillId } from "@/lib/skills";

export type PitchInput = {
  freelancerName: string;
  skill: SkillId;
  portfolioUrl?: string | null;
  businessName: string;
  category: string;
  city?: string | null;
  website?: string | null;
  /** Failed audit checks, most serious first. */
  issues: AuditCheck[];
  reportUrl?: string | null;
};

export type Pitch = { subject: string; body: string; model: string };

const PitchSchema = z.object({
  subject: z.string().describe("Email subject, under 70 characters, no clickbait"),
  body: z.string().describe("Plain-text email body, 90-160 words, ending with the sign-off"),
});

// Models that accept the server-side refusal fallback parameter.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

const SYSTEM_PROMPT = `You write short, honest cold emails that freelancers send to local businesses.
Rules:
- Open with one specific, verifiable observation about the business's website (or the lack of one) taken from the audit facts. Never invent facts that are not in the audit.
- Explain in one sentence what that problem likely costs the business (lost calls, bookings, or search visibility), without exaggerating or quoting made-up statistics.
- Offer one concrete fix the freelancer can do, and a low-pressure next step (a 10-minute call or a free mock-up).
- If a report link is provided, mention it once as "the free report".
- Friendly, plain language. No buzzwords, no emojis, no ALL CAPS, no fake urgency, no flattery.
- Sign off with the freelancer's name, plus the portfolio link if one is given.`;

export function buildPitchPrompt(input: PitchInput): string {
  const skill = SKILLS[input.skill];
  const issues = input.issues.length
    ? input.issues.map((i) => `- ${i.label}: ${i.detail} (Why it matters: ${i.impact})`).join("\n")
    : "- No major problems found; offer an improvement related to the freelancer's skill.";
  return [
    `Freelancer: ${input.freelancerName}, who offers ${skill.offer}.`,
    input.portfolioUrl ? `Portfolio: ${input.portfolioUrl}` : null,
    `Business: ${input.businessName} (${input.category}${input.city ? `, ${input.city}` : ""}).`,
    `Website: ${input.website ?? "none listed"}.`,
    `Audit findings, most serious first:\n${issues}`,
    input.reportUrl ? `Free report link: ${input.reportUrl}` : null,
    "Write the email.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Deterministic pitch used when no API key is configured or the model call fails. */
export function templatePitch(input: PitchInput): Pitch {
  const skill = SKILLS[input.skill];
  const top = input.issues[0];
  const noSite = !input.website || top?.id === "website";
  const greeting = `Hi ${input.businessName} team,`;
  const observation = noSite
    ? `I was looking for ${input.category.toLowerCase()} options${input.city ? ` in ${input.city}` : ""} and noticed ${input.businessName} doesn't have a website yet.`
    : `I took a quick look at ${input.website} and noticed one thing worth fixing: ${top ? top.detail.charAt(0).toLowerCase() + top.detail.slice(1) : "a few small details that could be improved."}`;
  const impact = noSite
    ? "Customers who search online can't see your hours, prices, or a way to book, so many of them pick whoever shows up first."
    : top?.impact ?? "Small fixes like these usually make it easier for customers to contact you.";
  const offer = noSite
    ? `I build simple, fast websites for local businesses, and I'd be happy to sketch a free one-page mock-up for ${input.businessName} so you can see what it could look like.`
    : `I help businesses with ${skill.offer}, and this is usually a quick fix.`;
  const report = input.reportUrl ? `\n\nI put the details in a free report: ${input.reportUrl}` : "";
  const signoff = `Best,\n${input.freelancerName}${input.portfolioUrl ? `\n${input.portfolioUrl}` : ""}`;
  const body = `${greeting}\n\n${observation} ${impact}\n\n${offer} Would you be open to a 10-minute call this week?${report}\n\n${signoff}`;
  const subject = noSite ? `A website for ${input.businessName}?` : `Quick fix for the ${input.businessName} website`;
  return { subject: subject.slice(0, 90), body, model: "template" };
}

let client: Anthropic | null = null;

/** Write a pitch with Claude, falling back to the template on any failure. */
export async function generatePitch(input: PitchInput): Promise<Pitch> {
  if (!process.env.ANTHROPIC_API_KEY) return templatePitch(input);
  const model = process.env.PITCH_MODEL || "claude-opus-5-5";
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  try {
    const useFallback = FALLBACK_MODELS.has(model);
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPitchPrompt(input) }],
      output_config: { effort: "low", format: betaZodOutputFormat(PitchSchema) },
      ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return templatePitch(input);
    const { subject, body } = response.parsed_output;
    return { subject: subject.trim(), body: body.trim(), model: response.model };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Pitch generation failed (${error.status}): ${error.message}`);
    } else {
      console.error("Pitch generation failed:", error);
    }
    return templatePitch(input);
  }
}
