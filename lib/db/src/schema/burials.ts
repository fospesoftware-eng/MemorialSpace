import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plotsTable } from "./plots";
import { organizationsTable } from "./organizations";

export const burialsTable = pgTable("burials", {
  id: serial("id").primaryKey(),
  plotId: integer("plot_id").references(() => plotsTable.id).notNull(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  deceasedName: text("deceased_name").notNull(),
  deceasedDob: date("deceased_dob"),
  deceasedDod: date("deceased_dod"),
  burialDate: date("burial_date"),
  religion: text("religion"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBurialSchema = createInsertSchema(burialsTable).omit({ id: true, createdAt: true });
export type InsertBurial = z.infer<typeof insertBurialSchema>;
export type Burial = typeof burialsTable.$inferSelect;
