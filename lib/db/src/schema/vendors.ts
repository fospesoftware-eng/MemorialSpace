/**
 * Marketplace vendors — third-party service providers (florists, stonemasons,
 * caterers, transport) who serve grieving families across multiple cemeteries.
 *
 * Vendors are intentionally a separate concept from `organizations` (which
 * model individual cemeteries). They have their own login (no `organizationId`
 * link), their own service catalog, and a request inbox where families can
 * solicit quotes / accepted services.
 *
 * Three tables:
 *   - `marketplace_vendors`     — account + business profile + service areas
 *   - `vendor_services`         — published service listings (1:N to vendor)
 *   - `vendor_requests`         — incoming service requests (1:N to vendor;
 *                                 optional FK to a specific vendor service)
 */
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const VENDOR_STATUSES = ["active", "suspended"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "completed",
  "cancelled",
] as const;
export type VendorRequestStatus = (typeof VENDOR_REQUEST_STATUSES)[number];

/**
 * Five-category funeral lifecycle taxonomy. Used both for vendor profile
 * categories and per-service category. Stored as plain text (not a pg enum)
 * so we can extend without a destructive migration; the FE/BE just validate
 * against this list.
 */
export const FUNERAL_CATEGORIES = [
  "funeral-services",
  "religious",
  "maintenance",
  "headstone",
  "remembrance",
] as const;
export type FuneralCategory = (typeof FUNERAL_CATEGORIES)[number];

export const FUNERAL_CATEGORY_LABELS: Record<FuneralCategory, string> = {
  "funeral-services": "Funeral services",
  religious: "Priest & religious services",
  maintenance: "Grave maintenance",
  headstone: "Headstones & monuments",
  remembrance: "Annual remembrance",
};

/** Pricing model determines which price columns are meaningful. */
export const PRICING_MODELS = ["fixed", "range", "subscription", "quote"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

/** Cadence for subscription services (or "one-time" for everything else). */
export const BILLING_CADENCES = ["one-time", "monthly", "quarterly", "yearly"] as const;
export type BillingCadence = (typeof BILLING_CADENCES)[number];

/** Payment lifecycle for an accepted request / order.
 *  Renamed from `PAYMENT_STATUSES` to avoid collision with the
 *  cemetery-sites payment status enum. */
export const VENDOR_PAYMENT_STATUSES = ["unpaid", "invoiced", "paid", "refunded"] as const;
export type VendorPaymentStatus = (typeof VENDOR_PAYMENT_STATUSES)[number];

export const marketplaceVendorsTable = pgTable(
  "marketplace_vendors",
  {
    id: serial("id").primaryKey(),
    // Lower-cased on insert for case-insensitive lookup.
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    // URL-safe public identifier; used in the directory route /vendors/:slug.
    slug: text("slug").notNull(),
    businessName: text("business_name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    websiteUrl: text("website_url"),
    // jsonb string arrays — categories like 'florist','monument','catering';
    // serviceAreas as plain city/region names (free text for v1).
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    serviceAreas: jsonb("service_areas").$type<string[]>().notNull().default([]),
    isPublished: boolean("is_published").notNull().default(false),
    status: text("status").notNull().default("active"),
    lastActiveAt: timestamp("last_active_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("marketplace_vendors_email_idx").on(t.email),
    slugIdx: uniqueIndex("marketplace_vendors_slug_idx").on(t.slug),
    publishedIdx: index("marketplace_vendors_published_idx").on(t.isPublished),
  }),
);

export const vendorServicesTable = pgTable(
  "vendor_services",
  {
    id: serial("id").primaryKey(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => marketplaceVendorsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Pricing model decides which price columns matter:
    //   "fixed"        → priceAmount
    //   "range"        → priceFrom + priceTo (legacy default)
    //   "subscription" → priceAmount + billingCadence (recurring)
    //   "quote"        → none of the above; vendor quotes per-request
    pricingModel: text("pricing_model").notNull().default("range"),
    priceFrom: real("price_from"),
    priceTo: real("price_to"),
    priceAmount: real("price_amount"),
    billingCadence: text("billing_cadence").notNull().default("one-time"),
    category: text("category"),
    photos: jsonb("photos").$type<string[]>().notNull().default([]),
    isPublished: boolean("is_published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    vendorIdx: index("vendor_services_vendor_idx").on(t.vendorId),
  }),
);

export const vendorRequestsTable = pgTable(
  "vendor_requests",
  {
    id: serial("id").primaryKey(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => marketplaceVendorsTable.id, { onDelete: "cascade" }),
    // Nullable — the family may request "any service" rather than picking
    // one from the catalog.
    serviceId: integer("service_id").references(() => vendorServicesTable.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    deceasedName: text("deceased_name"),
    serviceLocation: text("service_location"),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"),
    vendorNotes: text("vendor_notes"),
    // Order/payment lifecycle once the vendor accepts. Lets us drive the
    // dashboard's revenue / orders / customer rollups without a second table.
    quotedAmount: real("quoted_amount"),
    paidAmount: real("paid_amount"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    scheduledFor: timestamp("scheduled_for"),
    isRecurring: boolean("is_recurring").notNull().default(false),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    vendorIdx: index("vendor_requests_vendor_idx").on(t.vendorId),
    statusIdx: index("vendor_requests_status_idx").on(t.status),
    createdIdx: index("vendor_requests_created_idx").on(t.createdAt),
  }),
);

export type MarketplaceVendor = typeof marketplaceVendorsTable.$inferSelect;
export type NewMarketplaceVendor = typeof marketplaceVendorsTable.$inferInsert;
export type VendorService = typeof vendorServicesTable.$inferSelect;
export type NewVendorService = typeof vendorServicesTable.$inferInsert;
export type VendorRequest = typeof vendorRequestsTable.$inferSelect;
export type NewVendorRequest = typeof vendorRequestsTable.$inferInsert;
