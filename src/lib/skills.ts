export const SKILLS = {
  web_dev: {
    label: "Web design & development",
    offer: "building and redesigning fast, mobile-friendly websites",
    // Businesses without a site are the best leads for web developers.
    prefersNoWebsite: true,
  },
  seo: {
    label: "SEO & Google visibility",
    offer: "getting local businesses found on Google (SEO, page titles, Google Business Profile)",
    prefersNoWebsite: false,
  },
  speed: {
    label: "Website speed & maintenance",
    offer: "speeding up slow websites and keeping them secure and up to date",
    prefersNoWebsite: false,
  },
  booking: {
    label: "Online booking & automation",
    offer: "setting up online booking, contact forms, and simple automations",
    prefersNoWebsite: false,
  },
} as const;

export type SkillId = keyof typeof SKILLS;

export function isSkill(value: unknown): value is SkillId {
  return typeof value === "string" && value in SKILLS;
}
