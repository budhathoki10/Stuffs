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

/** First number in a check's detail, e.g. "4.2" from "The server took 4.2s to deliver the page." */
const firstNumber = (text: string) => text.match(/\d+(?:\.\d+)?/)?.[0];

/**
 * What the owner would notice, then what it costs them, written for each check so the
 * template reads like a person wrote it rather than two stitched-together report lines.
 */
function observationFor(issue: AuditCheck, website: string): [string, string] {
  const host = website.replace(/^https?:\/\//, "").replace(/\/$/, "");
  switch (issue.id) {
    case "https":
      return [
        `I opened ${host} and Chrome showed a "Not secure" warning next to the address.`,
        "That warning is enough to make a lot of people close the tab before they call or book.",
      ];
    case "mobile":
      return [
        `I opened ${host} on my phone and had to pinch and zoom to read it.`,
        "Most people looking for a local business are on their phone, and they rarely bother zooming.",
      ];
    case "speed":
      return [
        `Your site took ${firstNumber(issue.detail) ?? "several"} seconds to start loading when I checked it.`,
        "People searching on their phone tend to give up and tap the next result.",
      ];
    case "pagespeed":
      return [
        `Google's own speed test rates ${host} as slow on phones.`,
        "Google ranks slow sites lower, and visitors leave before the page finishes.",
      ];
    case "title":
      return [
        "The title Google shows for your site doesn't say what you do or where you are.",
        "It's the first line people read in the search results.",
      ];
    case "description":
      return [
        "Your site doesn't give Google a description to show under your name in search results.",
        "Google fills the gap with whatever text it finds, which rarely sells you well.",
      ];
    case "contact":
      return [
        "I couldn't find a tap-to-call button, an email link or a contact form on your homepage.",
        "When getting in touch takes effort, people go to the next business on the list.",
      ];
    case "booking":
      return ["There's no way to book or order on your website.", "Online booking picks up the customers who look you up after hours."];
    case "fresh":
      return [
        `The footer on your site still says © ${firstNumber(issue.detail) ?? "an old year"}.`,
        "It makes people wonder whether you're still open.",
      ];
    case "reachable":
      return ["The website link on your map listing doesn't load for me.", "Anyone who clicks it will assume you've closed."];
    default:
      return [issue.detail, issue.impact];
  }
}

/** Deterministic pitch used when no API key is configured or the model call fails. */
export function templatePitch(input: PitchInput): Pitch {
  const skill = SKILLS[input.skill];
  const top = input.issues[0];
  const noSite = !input.website || top?.id === "website";
  const greeting = `Hi ${input.businessName} team,`;

  let opening: string;
  let offer: string;
  if (noSite) {
    opening = `I was looking for a ${input.category.toLowerCase()}${input.city ? ` in ${input.city}` : ""} and noticed ${input.businessName} doesn't have a website. People who search online can't see your hours, prices or a way to book, so they tend to pick whoever does show up.`;
    offer = `I build simple, fast websites for local businesses. I'd be glad to put together a free one-page mock-up for ${input.businessName} so you can see what it could look like.`;
  } else if (top) {
    const [noticed, cost] = observationFor(top, input.website!);
    opening = `${noticed} ${cost}`;
    offer = `${skill.intro}, and this one is usually a quick fix.`;
  } else {
    opening = `I had a look at ${input.website} and it's in decent shape, but there are a couple of small things I'd tighten up.`;
    offer = `${skill.intro}.`;
  }

  const report = input.reportUrl ? `\n\nI wrote up what I found here, in case it's useful: ${input.reportUrl}` : "";
  const signoff = `Best,\n${input.freelancerName}${input.portfolioUrl ? `\n${input.portfolioUrl}` : ""}`;
  const body = `${greeting}\n\n${opening}\n\n${offer} Would a ten-minute call this week work for you?${report}\n\n${signoff}`;
  const subject = noSite ? `A website for ${input.businessName}?` : `Something I noticed on the ${input.businessName} website`;
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
