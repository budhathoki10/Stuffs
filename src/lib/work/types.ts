/** Shapes stored as JSON for the work a freelancer does after winning a client. */

export const CURRENCIES = ["NPR", "USD", "INR", "GBP", "EUR", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export type LineItem = {
  title: string;
  detail?: string;
  /** Price in the smallest unit (paisa, cents). */
  amountMinor: number;
};

/** How clients pay the freelancer directly. Pitchcraft never touches the money. */
export type PaymentDetails = {
  esewaId?: string;
  khaltiId?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  payoneerEmail?: string;
  /** Anything else: Wise link, PayPal for clients abroad, "cash on handover", etc. */
  other?: string;
  /** The freelancer's own eSewa/Khalti/bank QR, uploaded as an image (data URL, kept small). */
  qrImage?: string;
  qrLabel?: string;
};

export type SiteService = { name: string; description: string; price?: string };

export type SiteContent = {
  businessName: string;
  tagline: string;
  about: string;
  services: SiteService[];
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  hours: string;
  /** Label on the main button, e.g. "Book an appointment". */
  cta: string;
  accent: SiteAccent;
};

export const SITE_ACCENTS = {
  forest: "#2d6a4f",
  ocean: "#1d4e89",
  clay: "#b5532a",
  plum: "#6b2d5c",
  charcoal: "#2b2b2b",
} as const;
export type SiteAccent = keyof typeof SITE_ACCENTS;

export const SITE_TEMPLATES = {
  clinic: "Clinic or practice",
  restaurant: "Restaurant or café",
  stay: "Hotel or guesthouse",
  shop: "Shop or service business",
} as const;
export type SiteTemplate = keyof typeof SITE_TEMPLATES;

export function lineItemsTotal(items: Pick<LineItem, "amountMinor">[]): number {
  return items.reduce((sum, i) => sum + i.amountMinor, 0);
}

/** True when the freelancer has told us at least one way to get paid. */
export function hasPaymentDetails(d: PaymentDetails): boolean {
  return Object.entries(d).some(([k, v]) => k !== "qrLabel" && typeof v === "string" && v.trim() !== "");
}
