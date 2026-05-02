import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { burialsTable } from "./burials";

export const obituariesTable = pgTable("obituaries", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id).notNull(),
  burialId: integer("burial_id").references(() => burialsTable.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  photoUrl: text("photo_url"),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  shareCount: integer("share_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertObituarySchema = createInsertSchema(obituariesTable).omit({ id: true, createdAt: true });
export type InsertObituary = z.infer<typeof insertObituarySchema>;
export type Obituary = typeof obituariesTable.$inferSelect;
