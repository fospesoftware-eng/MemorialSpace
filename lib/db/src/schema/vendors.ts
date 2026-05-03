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
    // Loose price band for the public listing — not a checkout price.
    priceFrom: real("price_from"),
    priceTo: real("price_to"),
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
