import { pgTable, serial, text, integer, date, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { expenseCategoriesTable } from "./expenseCategories";
import { workOrdersTable } from "./workOrders";
import { usersTable } from "./users";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  categoryId: integer("category_id").references(() => expenseCategoriesTable.id),
  workOrderId: integer("work_order_id").references(() => workOrdersTable.id),
  vendorName: text("vendor_name"),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: date("expense_date").notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "card", "check", "transfer", "other"] }).notNull().default("card"),
  receiptUrl: text("receipt_url"),
  status: text("status", { enum: ["pending", "approved", "rejected", "paid"] }).notNull().default("pending"),
  submittedBy: integer("submitted_by").references(() => usersTable.id),
  approvedBy: integer("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true, paidAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
