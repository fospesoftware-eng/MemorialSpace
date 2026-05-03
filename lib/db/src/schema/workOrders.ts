import { pgTable, serial, text, integer, date, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { plotsTable } from "./plots";
import { usersTable } from "./users";
import { assetsTable } from "./assets";

export const workOrdersTable = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  plotId: integer("plot_id").references(() => plotsTable.id),
  assetId: integer("asset_id").references(() => assetsTable.id),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["maintenance", "burial", "cleaning", "inspection", "other"] }).notNull(),
  status: text("status", { enum: ["open", "in_progress", "completed", "cancelled"] }).notNull().default("open"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  laborHours: numeric("labor_hours", { precision: 8, scale: 2 }),
  laborCost: numeric("labor_cost", { precision: 12, scale: 2 }),
  materialsCost: numeric("materials_cost", { precision: 12, scale: 2 }),
  completionNotes: text("completion_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const insertWorkOrderSchema = createInsertSchema(workOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = typeof workOrdersTable.$inferSelect;
