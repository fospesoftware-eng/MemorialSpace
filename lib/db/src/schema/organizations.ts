import { pgTable, serial, text, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cemetery types asked at signup. Operators can select multiple — e.g. a
// church that runs a columbarium AND a small private plot. The legacy
// `cemeteryType` text column captures the *primary* type; `cemeteryTypes`
// captures the full multi-select.
export const CEMETERY_TYPES = [
  "church",
  "private",
  "pet",
  "municipality",
  "columbarium",
  "mausoleum",
] as const;
export type CemeteryType = (typeof CEMETERY_TYPES)[number];

// Per-org feature flags. Super Admin toggles these in the admin org detail
// sheet, and the cemetery signup wizard pre-populates them based on the
// selected cemetery types. Anything not present is treated as disabled.
export const PLATFORM_FEATURES = [
  "plotMap",
  "burials",
  "bookings",
  "workOrders",
  "maintenance",
  "expenses",
  "accounting",
  "memorials",
  "obituaries",
  "qrCodes",
  "marketplace",
  "publicSite",
  "columbarium",
  "mausoleum",
  "petCemetery",
  "multiSite",
  "sso",
] as const;
export type PlatformFeature = (typeof PLATFORM_FEATURES)[number];

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Primary cemetery type (kept for backward compat & display chips).
  cemeteryType: text("cemetery_type").default("private").notNull(),
  // Full multi-select set of cemetery types this organization operates.
  cemeteryTypes: jsonb("cemetery_types").$type<CemeteryType[]>().default([]).notNull(),
  // Legacy single-flag kept in sync with `enabledFeatures.columbarium`.
  featuresColumbarium: boolean("features_columbarium").default(false).notNull(),
  // Per-org feature flags managed by Super Admin.
  enabledFeatures: jsonb("enabled_features")
    .$type<Partial<Record<PlatformFeature, boolean>>>()
    .default({})
    .notNull(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  logoUrl: text("logo_url"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  totalPlots: integer("total_plots").default(0),
  status: text("status").default("active").notNull(),
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable, {
  cemeteryType: z.enum(CEMETERY_TYPES),
  cemeteryTypes: z.array(z.enum(CEMETERY_TYPES)).optional(),
  enabledFeatures: z.record(z.enum(PLATFORM_FEATURES), z.boolean()).optional(),
}).omit({ id: true, createdAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

// Default feature set for each cemetery type. Used by the signup wizard to
// pre-fill enabledFeatures based on the operator's selections.
export const DEFAULT_FEATURES_FOR_TYPE: Record<CemeteryType, PlatformFeature[]> = {
  church: ["plotMap", "burials", "bookings", "workOrders", "maintenance", "memorials", "obituaries", "qrCodes", "publicSite"],
  private: ["plotMap", "burials", "bookings", "workOrders", "maintenance", "expenses", "accounting", "memorials", "obituaries", "qrCodes", "marketplace", "publicSite"],
  pet: ["plotMap", "burials", "bookings", "memorials", "qrCodes", "publicSite", "petCemetery"],
  municipality: ["plotMap", "burials", "bookings", "workOrders", "maintenance", "expenses", "accounting", "memorials", "obituaries", "qrCodes", "publicSite", "multiSite"],
  columbarium: ["bookings", "memorials", "qrCodes", "publicSite", "columbarium"],
  mausoleum: ["bookings", "memorials", "qrCodes", "publicSite", "mausoleum"],
};
