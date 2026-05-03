import { pgTable, serial, text, integer, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { assetsTable } from "./assets";
import { usersTable } from "./users";

export const maintenanceSchedulesTable = pgTable("maintenance_schedules", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  assetId: integer("asset_id").references(() => assetsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  frequency: text("frequency", { enum: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"] }).notNull(),
  intervalDays: integer("interval_days").notNull().default(30),
  lastPerformedAt: date("last_performed_at"),
  nextDueAt: date("next_due_at"),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const insertMaintenanceScheduleSchema = createInsertSchema(maintenanceSchedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMaintenanceSchedule = z.infer<typeof insertMaintenanceScheduleSchema>;
export type MaintenanceSchedule = typeof maintenanceSchedulesTable.$inferSelect;
