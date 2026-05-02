import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const plotsTable = pgTable("plots", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  plotNumber: text("plot_number").notNull(),
  section: text("section"),
  row: text("row"),
  status: text("status", { enum: ["available", "reserved", "occupied", "maintenance"] }).notNull().default("available"),
  type: text("type", { enum: ["standard", "double", "family", "mausoleum", "cremation"] }).default("standard"),
  price: real("price"),
  ownerName: text("owner_name"),
  ownerContact: text("owner_contact"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  geoJson: text("geo_json"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlotSchema = createInsertSchema(plotsTable).omit({ id: true, createdAt: true });
export type InsertPlot = z.infer<typeof insertPlotSchema>;
export type Plot = typeof plotsTable.$inferSelect;
