import { pgTable, serial, text, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cemetery types asked at signup. "columbarium" means the operator runs a
// stand-alone columbarium facility (no in-ground burials). "church" cemeteries
// can ALSO run a columbarium on-premises by checking `featuresColumbarium`.
export const CEMETERY_TYPES = ["church", "private", "pet", "municipality", "columbarium"] as const;
export type CemeteryType = (typeof CEMETERY_TYPES)[number];

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Cemetery type chosen at signup. Stored as text for portability; the
  // server enforces the enum via insertOrganizationSchema (Zod).
  cemeteryType: text("cemetery_type").default("private").notNull(),
  // For "church" cemeteries, set true if they additionally run a columbarium
  // facility on-premises. For type "columbarium", treated as implicitly true.
  featuresColumbarium: boolean("features_columbarium").default(false).notNull(),
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
  // Platform-level lifecycle status set by Super Admin. `active` is the
  // default; `suspended` blocks the operator from signing in (UI gate);
  // `trial` mirrors a trialing subscription; `cancelled` means the operator
  // has churned but their data is preserved for restoration.
  status: text("status").default("active").notNull(), // active|trial|suspended|cancelled
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  // Internal notes only Super Admins see — never exposed publicly.
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable, {
  cemeteryType: z.enum(CEMETERY_TYPES),
}).omit({ id: true, createdAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
