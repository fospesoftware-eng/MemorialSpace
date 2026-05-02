import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const BILLING_PERIODS = ["monthly", "yearly"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "suspended",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLATFORM_INVOICE_STATUSES = [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
] as const;
export type PlatformInvoiceStatus = (typeof PLATFORM_INVOICE_STATUSES)[number];

export const PLATFORM_PAYMENT_METHODS = [
  "card",
  "bank_transfer",
  "check",
  "manual",
  "stripe",
  "other",
] as const;
export type PlatformPaymentMethod = (typeof PLATFORM_PAYMENT_METHODS)[number];

// SaaS plans the platform sells to cemetery owners. Money in cents.
export const subscriptionPlansTable = pgTable(
  "subscription_plans",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    billingPeriod: text("billing_period").default("monthly").notNull(), // monthly|yearly
    trialDays: integer("trial_days").default(14).notNull(),
    // Soft entitlement caps — null means "unlimited".
    maxUsers: integer("max_users"),
    maxPlots: integer("max_plots"),
    maxStorageMb: integer("max_storage_mb"),
    // Feature flags exposed in the operator UI; opaque keys → boolean/value.
    features: jsonb("features").$type<Record<string, unknown>>().default({}),
    isActive: boolean("is_active").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("subscription_plans_slug_unique").on(t.slug)],
);

// Per-organization subscription. Only one ACTIVE-ish row per org at a time
// (enforced via partial unique index below).
export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    planId: integer("plan_id")
      .notNull()
      .references(() => subscriptionPlansTable.id, { onDelete: "restrict" }),
    status: text("status").default("trialing").notNull(), // trialing|active|past_due|cancelled|suspended
    billingPeriod: text("billing_period").default("monthly").notNull(),
    seats: integer("seats").default(1).notNull(),
    // Trial / period bookkeeping.
    trialStartsAt: timestamp("trial_starts_at"),
    trialEndsAt: timestamp("trial_ends_at"),
    currentPeriodStart: timestamp("current_period_start").defaultNow().notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    cancelledAt: timestamp("cancelled_at"),
    // Snapshot the price at subscription creation/change time so plan price
    // edits don't retroactively rewrite open subscriptions.
    pricePerPeriodCents: integer("price_per_period_cents").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("subscriptions_org_idx").on(t.organizationId),
    index("subscriptions_status_idx").on(t.status),
  ],
);

// Platform invoice — billed FROM the platform TO a cemetery owner. Distinct
// from the B2B invoices table which is owner→family billing.
export const platformInvoicesTable = pgTable(
  "platform_invoices",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    subscriptionId: integer("subscription_id").references(
      () => subscriptionsTable.id,
      { onDelete: "set null" },
    ),
    invoiceNumber: text("invoice_number"), // PINV-YYYY-NNNN, allocated on issue
    status: text("status").default("draft").notNull(), // draft|open|paid|void|uncollectible
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    issuedAt: timestamp("issued_at"),
    dueDate: timestamp("due_date"),
    paidAt: timestamp("paid_at"),
    voidedAt: timestamp("voided_at"),
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    totalCents: integer("total_cents").notNull(),
    amountPaidCents: integer("amount_paid_cents").default(0).notNull(),
    currency: text("currency").default("USD").notNull(),
    description: text("description"),
    // Snapshot of line items at issue time. Plan name/price + addons.
    lineItems: jsonb("line_items")
      .$type<Array<{ description: string; quantity: number; unitPriceCents: number; lineTotalCents: number }>>()
      .default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("platform_invoices_number_unique").on(t.invoiceNumber),
    index("platform_invoices_org_idx").on(t.organizationId),
    index("platform_invoices_status_idx").on(t.status),
  ],
);

export const platformPaymentsTable = pgTable(
  "platform_payments",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => platformInvoicesTable.id, { onDelete: "cascade" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    method: text("method").default("manual").notNull(),
    reference: text("reference"),
    paidAt: timestamp("paid_at").defaultNow().notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("platform_payments_invoice_idx").on(t.invoiceId),
    index("platform_payments_org_idx").on(t.organizationId),
  ],
);

// Audit log — every meaningful platform-admin action lands here. Action is a
// stable dotted key like "org.suspended", "subscription.cancelled" etc.
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorEmail: text("actor_email"), // null = system/seed
    action: text("action").notNull(),
    targetType: text("target_type"), // organization|subscription|invoice|plan|user
    targetId: integer("target_id"),
    organizationId: integer("organization_id").references(
      () => organizationsTable.id,
      { onDelete: "set null" },
    ),
    summary: text("summary"),
    details: jsonb("details").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_org_idx").on(t.organizationId),
    index("audit_log_action_idx").on(t.action),
  ],
);

// ----- Zod -----
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlansTable, {
  billingPeriod: z.enum(BILLING_PERIODS),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable, {
  status: z.enum(SUBSCRIPTION_STATUSES),
  billingPeriod: z.enum(BILLING_PERIODS),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

export const insertPlatformInvoiceSchema = createInsertSchema(platformInvoicesTable, {
  status: z.enum(PLATFORM_INVOICE_STATUSES),
}).omit({ id: true, createdAt: true });
export type InsertPlatformInvoice = z.infer<typeof insertPlatformInvoiceSchema>;
export type PlatformInvoice = typeof platformInvoicesTable.$inferSelect;

export const insertPlatformPaymentSchema = createInsertSchema(platformPaymentsTable, {
  method: z.enum(PLATFORM_PAYMENT_METHODS),
}).omit({ id: true, createdAt: true });
export type InsertPlatformPayment = z.infer<typeof insertPlatformPaymentSchema>;
export type PlatformPayment = typeof platformPaymentsTable.$inferSelect;

export const insertAuditLogSchema = createInsertSchema(auditLogTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLogEntry = typeof auditLogTable.$inferSelect;
