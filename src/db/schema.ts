import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  doublePrecision,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { AuditCheck, AuditMetrics } from "@/lib/audit/types";
import type { LineItem, PaymentDetails, SiteContent } from "@/lib/work/types";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  skill: text("skill").notNull().default("web_dev"),
  portfolioUrl: text("portfolio_url"),
  plan: text("plan").notNull().default("free"),
  // Pro access is valid until this moment. Null means never paid.
  proUntil: timestamp("pro_until", { withTimezone: true }),
  paddleSubscriptionId: text("paddle_subscription_id"),
  /** Shown on invoices so clients pay the freelancer directly. */
  paymentDetails: jsonb("payment_details").$type<PaymentDetails>().notNull().default({}),
  /** Last invoice number issued; incremented atomically. */
  invoiceSeq: integer("invoice_seq").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  // SHA-256 of the cookie token; the raw token never touches the database.
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** One-time tokens sent by email (password reset, email verification). */
export const authTokens = pgTable(
  "auth_tokens",
  {
    // SHA-256 of the emailed token, like sessions.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_purpose_idx").on(t.userId, t.purpose, t.createdAt)],
);

export const searches = pgTable("searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  niche: text("niche").notNull(),
  location: text("location").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  radiusKm: integer("radius_km").notNull().default(10),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const audits = pgTable(
  "audits",
  {
    // Short public id used in shareable report links (/r/:id).
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    finalUrl: text("final_url"),
    score: integer("score").notNull(),
    checks: jsonb("checks").$type<AuditCheck[]>().notNull(),
    metrics: jsonb("metrics").$type<AuditMetrics>().notNull(),
    businessName: text("business_name"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audits_ip_created_idx").on(t.ipHash, t.createdAt)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    searchId: uuid("search_id").references(() => searches.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    address: text("address"),
    website: text("website"),
    phone: text("phone"),
    email: text("email"),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    auditId: text("audit_id").references(() => audits.id, { onDelete: "set null" }),
    opportunity: integer("opportunity").notNull().default(0),
    status: text("status").notNull().default("new"),
    wonAmountCents: integer("won_amount_cents"),
    // Currency of wonAmountCents (the column name predates multi-currency support).
    currency: text("currency").notNull().default("USD"),
    followUpOn: date("follow_up_on", { mode: "string" }),
    notes: text("notes"),
    // Replies to emails sent from the app go to reply+<token>@REPLY_DOMAIN and land on this lead.
    replyToken: text("reply_token").unique(),
    // The business asked not to be emailed by this freelancer again.
    optedOutAt: timestamp("opted_out_at", { withTimezone: true }),
    deliveredOn: date("delivered_on", { mode: "string" }).notNull(),
    // When name/address/phone/website/location were last fetched from the source.
    // Google only allows caching Places content for 30 days, so Google leads are refreshed before then.
    detailsFetchedAt: timestamp("details_fetched_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leads_user_source_uidx").on(t.userId, t.source, t.sourceId),
    index("leads_user_delivered_idx").on(t.userId, t.deliveredOn),
  ],
);

export const pitches = pgTable(
  "pitches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    auditId: text("audit_id").references(() => audits.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    model: text("model").notNull(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pitches_user_created_idx").on(t.userId, t.createdAt),
    index("pitches_ip_created_idx").on(t.ipHash, t.createdAt),
  ],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  // Paddle transaction id or Khalti pidx; unique so webhooks are idempotent.
  providerRef: text("provider_ref").notNull().unique(),
  status: text("status").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Audit = typeof audits.$inferSelect;
export type Search = typeof searches.$inferSelect;

export const quotes = pgTable(
  "quotes",
  {
    // Short public id: the client opens /q/:id to accept or decline.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    items: jsonb("items").$type<LineItem[]>().notNull(),
    note: text("note"),
    // draft -> sent -> accepted | declined
    status: text("status").notNull().default("draft"),
    validUntil: date("valid_until", { mode: "string" }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    acceptedBy: text("accepted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quotes_lead_idx").on(t.leadId)],
);

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .unique()
    .references(() => leads.id, { onDelete: "cascade" }),
  // Public address: /s/:slug
  slug: text("slug").notNull().unique(),
  template: text("template").notNull(),
  content: jsonb("content").$type<SiteContent>().notNull(),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Booking and contact requests sent through a published site. */
export const siteMessages = pgTable(
  "site_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contact: text("contact").notNull(),
    message: text("message").notNull(),
    preferredDate: text("preferred_date"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("site_messages_site_created_idx").on(t.siteId, t.createdAt)],
);

/** A shareable before-and-after report: the site we pitched vs the site after the work. */
export const comparisons = pgTable("comparisons", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  // Null when the business had no website before.
  beforeAuditId: text("before_audit_id").references(() => audits.id, { onDelete: "set null" }),
  afterAuditId: text("after_audit_id")
    .notNull()
    .references(() => audits.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monitors = pgTable("monitors", {
  // Short public id: the client-facing report is /m/:id
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .unique()
    .references(() => leads.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  active: boolean("active").notNull().default(true),
  // unknown | up | down
  status: text("status").notNull().default("unknown"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastResponseMs: integer("last_response_ms"),
  sslExpiresAt: timestamp("ssl_expires_at", { withTimezone: true }),
  // Which certificate expiry we already warned about, so each warning goes out once.
  sslAlertedFor: timestamp("ssl_alerted_for", { withTimezone: true }),
  downAlertSentAt: timestamp("down_alert_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monitorChecks = pgTable(
  "monitor_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    ok: boolean("ok").notNull(),
    statusCode: integer("status_code"),
    responseMs: integer("response_ms"),
    error: text("error"),
  },
  (t) => [index("monitor_checks_monitor_checked_idx").on(t.monitorId, t.checkedAt)],
);

export const invoices = pgTable(
  "invoices",
  {
    // Short public id: the client opens /i/:id
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    currency: text("currency").notNull(),
    items: jsonb("items").$type<LineItem[]>().notNull(),
    note: text("note"),
    issuedOn: date("issued_on", { mode: "string" }).notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    // unpaid | paid | void
    status: text("status").notNull().default("unpaid"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invoices_user_number_uidx").on(t.userId, t.number), index("invoices_lead_idx").on(t.leadId)],
);

export type Quote = typeof quotes.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Monitor = typeof monitors.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;

/** Every email between a freelancer and a business, sent from the app or received as a reply. */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    // out | in
    direction: text("direction").notNull(),
    // pitch | followup | reply | quote | invoice | report | site (outgoing); reply (incoming)
    kind: text("kind").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // sent | failed | received | bounced
    status: text("status").notNull(),
    // Resend's id, used to match bounce and complaint events, and the Message-ID header for threading.
    providerId: text("provider_id"),
    messageIdHeader: text("message_id_header"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_lead_created_idx").on(t.leadId, t.createdAt),
    index("messages_user_direction_idx").on(t.userId, t.direction, t.createdAt),
    uniqueIndex("messages_provider_uidx").on(t.providerId),
  ],
);

/**
 * Addresses nobody may email from the app: they opted out, bounced or marked us as spam.
 * Shared across all freelancers, because every email goes out from Pitchcraft's domain.
 */
export const suppressions = pgTable("suppressions", {
  email: text("email").primaryKey(),
  // opt_out | bounce | complaint
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Message = typeof messages.$inferSelect;
