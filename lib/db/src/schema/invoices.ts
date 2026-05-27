import { pgTable, serial, text, integer, real, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { customersTable } from "./customers";
import { bookingsTable } from "./bookings";

/**
 * Status flow:
 *   draft           — editable, no invoice number assigned yet
 *   issued          — finalized, sent to customer, awaiting payment
 *   partially_paid  — at least one payment recorded but balance > 0
 *   paid            — fully paid
 *   voided          — cancelled (terminal); preserved for audit
 *
 * `bookingId` is optional — invoices can be free-standing or linked to a
 * specific plot booking so the cemetery's plot-sales workflow can attach
 * invoices to the bookings table that already exists.
 */
export const invoicesTable = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
    // Cascade so deleting a customer also removes their invoices (UI documents this).
    customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "cascade" }).notNull(),
    bookingId: integer("booking_id").references(() => bookingsTable.id),
    invoiceNumber: text("invoice_number"),
    status: text("status", { enum: ["draft", "issued", "partially_paid", "paid", "voided"] }).notNull().default("draft"),
    issueDate: date("issue_date"),
    dueDate: date("due_date"),
    paidDate: date("paid_date"),
    subtotal: real("subtotal").notNull().default(0),
    taxTotal: real("tax_total").notNull().default(0),
    total: real("total").notNull().default(0),
    amountPaid: real("amount_paid").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    // Guarantee invoice numbers are unique per organization. NULLs (drafts) are
    // treated as distinct by Postgres, so multiple drafts coexist fine. Combined
    // with an issue-time retry loop this prevents the count(*)+1 race.
    invoiceNumberPerOrgIdx: uniqueIndex("invoices_org_invoice_number_unique").on(
      table.organizationId,
      table.invoiceNumber,
    ),
  }),
);

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
