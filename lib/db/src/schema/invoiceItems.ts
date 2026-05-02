import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { invoicesTable } from "./invoices";
import { taxRatesTable } from "./taxRates";

/**
 * Line items on an invoice. Each item has its own tax rate (or none),
 * which lets a single invoice mix taxable and tax-exempt items (e.g. a
 * plot purchase that's tax-exempt and a headstone install that isn't).
 *
 * `lineSubtotal`, `lineTax`, and `lineTotal` are computed and persisted
 * by the server when the invoice is saved so reports don't have to
 * re-derive them from quantity × unitPrice every time.
 */
export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  taxRateId: integer("tax_rate_id").references(() => taxRatesTable.id),
  lineSubtotal: real("line_subtotal").notNull().default(0),
  lineTax: real("line_tax").notNull().default(0),
  lineTotal: real("line_total").notNull().default(0),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({ id: true, createdAt: true });
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
