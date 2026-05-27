import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const PAYMENT_PROVIDERS = ["stripe"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_MODES = ["test", "live"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_VERIFY_STATUSES = [
  "ok",
  "invalid_key",
  "mismatched_mode",
  "network_error",
  "untested",
] as const;
export type PaymentVerifyStatus = (typeof PAYMENT_VERIFY_STATUSES)[number];

/**
 * Platform-level payment gateway used by the SaaS company to charge cemetery
 * operators their subscription fees. There is exactly one row (id = 1).
 *
 * Secrets are stored in plaintext today; if/when we move beyond MVP they
 * should be wrapped with envelope encryption (KMS/age) at rest. Reads from
 * the API always mask them — see `maskSecret()` in the route handler.
 */
export const platformPaymentSettingsTable = pgTable(
  "platform_payment_settings",
  {
    id: integer("id").primaryKey(),
    provider: text("provider").default("stripe").notNull(),
    mode: text("mode").default("test").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    publishableKey: text("publishable_key"),
    secretKey: text("secret_key"),
    webhookSecret: text("webhook_secret"),
    defaultCurrency: text("default_currency").default("USD").notNull(),
    statementDescriptor: text("statement_descriptor"),
    // Populated by the `/test` endpoint after we successfully call Stripe.
    lastVerifiedAt: timestamp("last_verified_at"),
    lastVerifiedStatus: text("last_verified_status"),
    accountId: text("account_id"),
    accountName: text("account_name"),
    accountEmail: text("account_email"),
    livemode: boolean("livemode"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

/**
 * Per-organization payment gateway. Each cemetery operator brings their own
 * Stripe account so funds settle directly to their bank — the platform never
 * touches customer money.
 */
export const orgPaymentSettingsTable = pgTable(
  "org_payment_settings",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizationsTable.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").default("stripe").notNull(),
    mode: text("mode").default("test").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    publishableKey: text("publishable_key"),
    secretKey: text("secret_key"),
    webhookSecret: text("webhook_secret"),
    defaultCurrency: text("default_currency").default("USD").notNull(),
    statementDescriptor: text("statement_descriptor"),
    lastVerifiedAt: timestamp("last_verified_at"),
    lastVerifiedStatus: text("last_verified_status"),
    accountId: text("account_id"),
    accountName: text("account_name"),
    accountEmail: text("account_email"),
    livemode: boolean("livemode"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgUnique: uniqueIndex("org_payment_settings_org_id_uq").on(
      t.organizationId,
    ),
  }),
);

export type PlatformPaymentSettings =
  typeof platformPaymentSettingsTable.$inferSelect;
export type OrgPaymentSettings = typeof orgPaymentSettingsTable.$inferSelect;
