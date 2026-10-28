/** Short, owner-facing name for each failed check, for tight spaces like table cells. */
export const PROBLEM_SHORT: Record<string, string> = {
  website: "No website",
  reachable: "Website doesn't load",
  https: 'Browsers mark it "Not secure"',
  mobile: "Doesn't fit on a phone",
  pagespeed: "Slow on phones",
  speed: "Slow to load",
  weight: "Very heavy page",
  title: "Weak page title",
  description: "No description for Google",
  h1: "Unclear main heading",
  alt: "Images have no descriptions",
  contact: "Hard to contact",
  booking: "No online booking",
  fresh: "Looks out of date",
  social: "No preview when shared",
  favicon: "No browser tab icon",
};
