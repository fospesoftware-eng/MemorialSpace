import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { burialsTable } from "./burials";
import { plotsTable } from "./plots";
import { memorialsTable } from "./memorials";

export const qrCodesTable = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  burialId: integer("burial_id").references(() => burialsTable.id),
  plotId: integer("plot_id").references(() => plotsTable.id),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  memorialId: integer("memorial_id").references(() => memorialsTable.id),
  qrImageUrl: text("qr_image_url"),
  scanCount: integer("scan_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQrCodeSchema = createInsertSchema(qrCodesTable).omit({ id: true, createdAt: true });
export type InsertQrCode = z.infer<typeof insertQrCodeSchema>;
export type QrCode = typeof qrCodesTable.$inferSelect;
