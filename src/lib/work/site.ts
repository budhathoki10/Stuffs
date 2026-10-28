import { SITE_ACCENTS, type SiteContent, type SiteTemplate } from "./types";

/**
 * Client websites are rendered as one self-contained HTML document: no framework,
 * no external assets. The same output is served at /s/:slug and offered as a
 * download, and it's built to pass every check in Pitchcraft's own audit.
 */

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return base || "site";
}

export function templateForCategory(category: string): SiteTemplate {
  const c = category.toLowerCase();
  if (/dent|clinic|doctor|vet|physio|medical/.test(c)) return "clinic";
  if (/restaurant|caf|bakery|bar|food/.test(c)) return "restaurant";
  if (/hotel|guest|lodg|hostel|stay/.test(c)) return "stay";
  return "shop";
}

const TEMPLATE_COPY: Record<
  SiteTemplate,
  { cta: string; servicesHeading: string; dateLabel: string | null; tagline: (n: string, c: string) => string; about: (n: string, c: string) => string; services: { name: string; description: string }[] }
> = {
  clinic: {
    cta: "Book an appointment",
    servicesHeading: "Treatments",
    dateLabel: "Preferred date",
    tagline: (_n, c) => `Friendly, careful ${c.toLowerCase()} care for the whole family`,
    about: (n) =>
      `${n} looks after patients of all ages. We take time to explain every treatment, keep waiting times short and use modern, sterilised equipment. New patients are always welcome.`,
    services: [
      { name: "Check-ups", description: "A thorough examination and advice on what, if anything, needs doing." },
      { name: "Treatment", description: "Clear explanations and options before we start anything." },
      { name: "Follow-up care", description: "We stay in touch until you're fully recovered." },
    ],
  },
  restaurant: {
    cta: "Reserve a table",
    servicesHeading: "On the menu",
    dateLabel: "Date and time",
    tagline: (_n, c) => `Good food and a warm welcome at our ${c.toLowerCase()}`,
    about: (n) =>
      `${n} serves fresh food made in our own kitchen, every day. Come in for a quick bite or stay for a long meal with friends. Groups and celebrations are welcome; just let us know in advance.`,
    services: [
      { name: "House specials", description: "The dishes our regulars come back for." },
      { name: "Drinks", description: "Fresh juices, coffee and tea." },
      { name: "Takeaway", description: "Call ahead and we'll have it ready." },
    ],
  },
  stay: {
    cta: "Book a room",
    servicesHeading: "Rooms",
    dateLabel: "Check-in date",
    tagline: () => "A clean, quiet place to stay, close to everything",
    about: (n) =>
      `${n} offers comfortable rooms, hot showers, reliable wifi and a friendly team who know the area well. Book with us directly for the best rate and a quick reply.`,
    services: [
      { name: "Standard room", description: "Comfortable double or twin room with private bathroom." },
      { name: "Family room", description: "Space for up to four, ideal for families and small groups." },
      { name: "Airport pickup", description: "Arrange it when you book and we'll meet you on arrival." },
    ],
  },
  shop: {
    cta: "Book now",
    servicesHeading: "What we do",
    dateLabel: null,
    tagline: (_n, c) => `Reliable, friendly ${c.toLowerCase()} service you can count on`,
    about: (n) =>
      `${n} has served local customers with honest prices and careful work. Tell us what you need and we'll get back to you quickly with a clear answer.`,
    services: [
      { name: "Consultation", description: "Tell us what you need and we'll recommend the right option." },
      { name: "Service", description: "Done properly, on time, at the price we agreed." },
      { name: "Aftercare", description: "Questions afterwards? Just call." },
    ],
  },
};

export function servicesHeading(template: SiteTemplate) {
  return TEMPLATE_COPY[template].servicesHeading;
}

export function defaultSiteContent(input: {
  businessName: string;
  category: string;
  template: SiteTemplate;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): SiteContent {
  const copy = TEMPLATE_COPY[input.template];
  return {
    businessName: input.businessName,
    tagline: copy.tagline(input.businessName, input.category),
    about: copy.about(input.businessName, input.category),
    services: copy.services.map((s) => ({ ...s })),
    phone: input.phone ?? "",
    email: input.email ?? "",
    whatsapp: "",
    address: input.address ?? "",
    hours: "",
    cta: copy.cta,
    accent: input.template === "clinic" ? "ocean" : input.template === "restaurant" ? "clay" : input.template === "stay" ? "forest" : "charcoal",
  };
}

const digits = (s: string) => s.replace(/[^\d+]/g, "");
/** Only plain web links make it into a client's site. */
const webUrl = (u?: string | null) => (u && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null);

function favicon(letter: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="43" font-family="Georgia,serif" font-size="34" text-anchor="middle" fill="#fff">${escapeHtml(letter)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function clamp(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export type RenderOptions = {
  template: SiteTemplate;
  /** Public URL of this site, used for canonical and preview tags. */
  canonicalUrl?: string;
  /** Absolute URL of the share image. */
  ogImageUrl?: string;
  /** Where the booking form posts. Null renders call/WhatsApp/email buttons instead (for downloaded copies). */
  formAction: string | null;
  /** Show the "request sent" confirmation. */
  sent?: boolean;
  /** Optional footer credit for the freelancer who built the site. */
  builtBy?: { name: string; url?: string | null };
  year?: number;
};

export function renderSiteHtml(c: SiteContent, opts: RenderOptions): string {
  const accent = SITE_ACCENTS[c.accent] ?? SITE_ACCENTS.charcoal;
  const copy = TEMPLATE_COPY[opts.template];
  const year = opts.year ?? new Date().getFullYear();
  const e = escapeHtml;
  const name = c.businessName.trim() || "Our business";
  const title = clamp(`${name} | ${c.tagline}`, 68);
  const description = clamp(`${c.tagline}. ${c.about}`.replace(/\s+/g, " "), 160);
  const tel = c.phone ? digits(c.phone) : "";
  const wa = c.whatsapp ? digits(c.whatsapp).replace(/^\+/, "") : "";
  const mapUrl = c.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${c.address}`)}` : "";

  const contactLinks = [
    tel && `<a class="btn" href="tel:${e(tel)}">Call ${e(c.phone)}</a>`,
    wa && `<a class="btn ghost" href="https://wa.me/${e(wa)}">WhatsApp</a>`,
    c.email && `<a class="btn ghost" href="mailto:${e(c.email)}">Email us</a>`,
  ]
    .filter(Boolean)
    .join("\n          ");

  const services = c.services
    .filter((s) => s.name.trim())
    .map(
      (s) => `<article class="card">
          <h3>${e(s.name)}</h3>
          <p>${e(s.description)}</p>${s.price ? `\n          <p class="price">${e(s.price)}</p>` : ""}
        </article>`,
    )
    .join("\n        ");

  const form = opts.formAction
    ? `<form method="post" action="${e(opts.formAction)}" class="form">
          ${opts.sent ? `<p class="sent" role="status">Thank you. We've received your request and will get back to you soon.</p>` : ""}
          <label>Your name<input name="name" required maxlength="120" autocomplete="name"></label>
          <label>Phone or email<input name="contact" required maxlength="160" autocomplete="tel"></label>
          ${copy.dateLabel ? `<label>${e(copy.dateLabel)}<input name="preferredDate" maxlength="60" placeholder="e.g. Friday morning"></label>` : ""}
          <label>Message<textarea name="message" rows="4" maxlength="2000" required></textarea></label>
          <label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
          <button class="btn" type="submit">${e(c.cta)}</button>
        </form>`
    : `<div class="actions">
          ${contactLinks || `<p>Visit us at the address above.</p>`}
        </div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(title)}</title>
  <meta name="description" content="${e(description)}">
  ${opts.canonicalUrl ? `<link rel="canonical" href="${e(opts.canonicalUrl)}">` : ""}
  <meta property="og:title" content="${e(name)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:type" content="website">
  ${opts.ogImageUrl ? `<meta property="og:image" content="${e(opts.ogImageUrl)}">` : ""}
  <link rel="icon" href="${favicon(name.charAt(0).toUpperCase(), accent)}">
  <style>
    :root { --accent: ${accent}; --ink: #1f1f1f; --muted: #5d5d5d; --line: #e6e2da; --bg: #faf8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--bg); }
    a { color: var(--accent); }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
    header { background: #fff; border-bottom: 1px solid var(--line); }
    header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; }
    .brand { font: 600 20px/1.2 Georgia, "Times New Roman", serif; color: var(--ink); text-decoration: none; }
    nav a { margin-left: 18px; color: var(--muted); text-decoration: none; font-size: 15px; }
    .hero { padding: 72px 0 56px; }
    h1 { font: 500 clamp(34px, 6vw, 54px)/1.08 Georgia, "Times New Roman", serif; margin: 0 0 16px; letter-spacing: -0.01em; }
    .lead { font-size: 20px; color: var(--muted); max-width: 640px; margin: 0 0 28px; }
    .btn { display: inline-block; background: var(--accent); color: #fff; border: 0; border-radius: 6px; padding: 12px 20px; font: 600 16px/1.2 inherit; text-decoration: none; cursor: pointer; margin: 0 8px 8px 0; }
    .btn.ghost { background: transparent; color: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent); }
    section { padding: 56px 0; border-top: 1px solid var(--line); }
    h2 { font: 500 30px/1.2 Georgia, "Times New Roman", serif; margin: 0 0 20px; }
    h3 { margin: 0 0 6px; font-size: 18px; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .card { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 20px; }
    .card p { margin: 0; color: var(--muted); }
    .card .price { margin-top: 10px; color: var(--ink); font-weight: 600; }
    .info { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .info p { margin: 0 0 6px; white-space: pre-line; }
    .label { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .form { display: grid; gap: 14px; max-width: 560px; }
    .form label { display: grid; gap: 6px; font-size: 15px; font-weight: 600; }
    .form input, .form textarea { font: 16px/1.4 inherit; padding: 11px 12px; border: 1px solid #cfc9bd; border-radius: 6px; background: #fff; }
    .form .btn { justify-self: start; }
    .hp { position: absolute; left: -9999px; }
    .sent { background: #e9f4ec; border-left: 3px solid #2d6a3e; padding: 10px 12px; margin: 0; }
    footer { padding: 28px 0 40px; color: var(--muted); font-size: 14px; border-top: 1px solid var(--line); }
    footer .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
    @media (max-width: 640px) { nav { display: none; } .hero { padding: 48px 0 40px; } }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <a class="brand" href="#top">${e(name)}</a>
      <nav aria-label="Sections"><a href="#services">${e(copy.servicesHeading)}</a><a href="#visit">Visit</a><a href="#contact">${e(c.cta)}</a></nav>
    </div>
  </header>
  <main id="top">
    <div class="hero">
      <div class="wrap">
        <h1>${e(name)}</h1>
        <p class="lead">${e(c.tagline)}</p>
        <a class="btn" href="#contact">${e(c.cta)}</a>
        ${tel ? `<a class="btn ghost" href="tel:${e(tel)}">Call ${e(c.phone)}</a>` : ""}
      </div>
    </div>
    <section>
      <div class="wrap">
        <h2>About us</h2>
        <p style="max-width:720px;margin:0">${e(c.about)}</p>
      </div>
    </section>
    <section id="services">
      <div class="wrap">
        <h2>${e(copy.servicesHeading)}</h2>
        <div class="grid">
        ${services}
        </div>
      </div>
    </section>
    <section id="visit">
      <div class="wrap info">
        <div>
          <p class="label">Address</p>
          <p>${c.address ? e(c.address) : "Ask us for directions."}</p>
          ${mapUrl ? `<p><a href="${e(mapUrl)}" rel="noopener">Open in Google Maps</a></p>` : ""}
        </div>
        <div>
          <p class="label">Opening hours</p>
          <p>${c.hours ? e(c.hours) : "Call us for today's hours."}</p>
        </div>
        <div>
          <p class="label">Contact</p>
          ${c.phone ? `<p><a href="tel:${e(tel)}">${e(c.phone)}</a></p>` : ""}
          ${c.email ? `<p><a href="mailto:${e(c.email)}">${e(c.email)}</a></p>` : ""}
          ${wa ? `<p><a href="https://wa.me/${e(wa)}">WhatsApp</a></p>` : ""}
        </div>
      </div>
    </section>
    <section id="contact">
      <div class="wrap">
        <h2>${e(c.cta)}</h2>
        ${form}
      </div>
    </section>
  </main>
  <footer>
    <div class="wrap">
      <span>© ${year} ${e(name)}</span>
      ${opts.builtBy ? `<span>Website by ${webUrl(opts.builtBy.url) ? `<a href="${e(webUrl(opts.builtBy.url)!)}" rel="noopener">${e(opts.builtBy.name)}</a>` : e(opts.builtBy.name)}</span>` : ""}
    </div>
  </footer>
</body>
</html>
`;
}
