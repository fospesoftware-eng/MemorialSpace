import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { burialsTable } from "./burials";
import { organizationsTable } from "./organizations";

export const memorialsTable = pgTable("memorials", {
  id: serial("id").primaryKey(),
  burialId: integer("burial_id").references(() => burialsTable.id).notNull(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  title: text("title").notNull(),
  biography: text("biography"),
  photos: text("photos"),
  isPublic: boolean("is_public").default(true),
  // Privacy mode controls what an anonymous visitor sees on the public
  // memorial page. The QR code in the URL is the read credential, but the
  // family can choose to also gate the *content* behind the same edit PIN.
  // - "open"    → full page visible to anyone with the QR (default)
  // - "basic"   → name + dates + plot visible; bio + photos require PIN
  // - "private" → nothing visible without the PIN (hard gate)
  // Stored as text instead of an enum so we can add modes later without a
  // type-altering migration.
  visibility: text("visibility").default("open").notNull(),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tributesTable = pgTable("tributes", {
  id: serial("id").primaryKey(),
  memorialId: integer("memorial_id").references(() => memorialsTable.id).notNull(),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMemorialSchema = createInsertSchema(memorialsTable).omit({ id: true, createdAt: true });
export type InsertMemorial = z.infer<typeof insertMemorialSchema>;
export type Memorial = typeof memorialsTable.$inferSelect;

export const insertTributeSchema = createInsertSchema(tributesTable).omit({ id: true, createdAt: true });
export type InsertTribute = z.infer<typeof insertTributeSchema>;
export type Tribute = typeof tributesTable.$inferSelect;
