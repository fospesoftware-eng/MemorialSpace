import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * Tax rates configurable per organization. Stored as a percent (e.g. 8.25
 * for 8.25%) to keep the math human-readable. Each invoice line item can
 * reference one tax rate (or none for tax-exempt items).
 */
export const taxRatesTable = pgTable("tax_rates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  name: text("name").notNull(),
  ratePercent: real("rate_percent").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaxRateSchema = createInsertSchema(taxRatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTaxRate = z.infer<typeof insertTaxRateSchema>;
export type TaxRate = typeof taxRatesTable.$inferSelect;
