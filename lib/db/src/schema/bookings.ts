import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plotsTable } from "./plots";
import { organizationsTable } from "./organizations";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  plotId: integer("plot_id").references(() => plotsTable.id).notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  type: text("type", { enum: ["reservation", "sale"] }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "cancelled", "completed"] }).notNull().default("pending"),
  totalAmount: real("total_amount"),
  paidAmount: real("paid_amount"),
  invoiceNumber: text("invoice_number"),
  notes: text("notes"),
  bookingDate: timestamp("booking_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
