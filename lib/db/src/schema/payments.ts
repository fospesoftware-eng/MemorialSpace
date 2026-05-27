import { pgTable, serial, text, integer, real, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { invoicesTable } from "./invoices";

/**
 * Payment records applied against a specific invoice. Multiple payments
 * are allowed per invoice (deposits, instalments, etc.). The parent
 * invoice's `amountPaid` and `status` are recomputed by the server every
 * time a payment is created or deleted so the running balance stays
 * authoritative.
 */
export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id, { onDelete: "cascade" }).notNull(),
  amount: real("amount").notNull(),
  paymentDate: date("payment_date").notNull(),
  method: text("method", { enum: ["cash", "check", "card", "bank_transfer", "other"] }).notNull().default("other"),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
