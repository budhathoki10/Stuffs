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
    notes: text("notes"),
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
