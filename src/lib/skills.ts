export const SKILLS = {
  web_dev: {
    label: "Web design & development",
    offer: "building and redesigning fast, mobile-friendly websites",
    intro: "I build and redesign websites for local businesses",
    // Businesses without a site are the best leads for web developers.
    prefersNoWebsite: true,
  },
  seo: {
    label: "SEO & Google visibility",
    offer: "getting local businesses found on Google (SEO, page titles, Google Business Profile)",
    intro: "I help local businesses show up on Google",
    prefersNoWebsite: false,
  },
  speed: {
    label: "Website speed & maintenance",
    offer: "speeding up slow websites and keeping them secure and up to date",
    intro: "I speed up slow websites and keep them secure",
    prefersNoWebsite: false,
  },
  booking: {
    label: "Online booking & automation",
    offer: "setting up online booking, contact forms, and simple automations",
    intro: "I set up online booking and contact forms for local businesses",
    prefersNoWebsite: false,
  },
} as const;

export type SkillId = keyof typeof SKILLS;

export function isSkill(value: unknown): value is SkillId {
  return typeof value === "string" && value in SKILLS;
}
