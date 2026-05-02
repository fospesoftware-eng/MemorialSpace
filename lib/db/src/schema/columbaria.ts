import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

// A "columbarium" here means a single niche-wall structure belonging to a
// cemetery (organization). One organization can have several walls (e.g. an
// indoor chapel wall + an outdoor garden wall). Each wall is a `rows × cols`
// grid of niche slots, each addressable by (row, col).
export const columbariaTable = pgTable("columbaria", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  rows: integer("rows").default(8).notNull(),
  cols: integer("cols").default(12).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const NICHE_STATUSES = ["available", "reserved", "occupied"] as const;
export type NicheStatus = (typeof NICHE_STATUSES)[number];

// Each `niche` is a single slot in a columbarium wall. Coordinates (row, col)
// are zero-indexed; (0,0) is the top-left of the wall as drawn in the editor.
// `(columbariumId, row, col)` is unique so a slot can be looked up by position.
// `photoUrl` is a data: URL or external URL for the deceased's portrait.
export const nichesTable = pgTable(
  "niches",
  {
    id: serial("id").primaryKey(),
    columbariumId: integer("columbarium_id")
      .notNull()
      .references(() => columbariaTable.id, { onDelete: "cascade" }),
    row: integer("row").notNull(),
    col: integer("col").notNull(),
    occupantName: text("occupant_name"),
    dob: text("dob"),
    dod: text("dod"),
    inscription: text("inscription"),
    photoUrl: text("photo_url"),
    status: text("status").default("available").notNull(),
    notes: text("notes"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("niches_position_unique").on(t.columbariumId, t.row, t.col)],
);

export const insertColumbariumSchema = createInsertSchema(columbariaTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertColumbarium = z.infer<typeof insertColumbariumSchema>;
export type Columbarium = typeof columbariaTable.$inferSelect;

// Photo URLs are usually `data:image/jpeg;base64,...` strings (the client
// downscales uploads to 600px JPEG before sending). 2_000_000 chars ≈ 1.5MB
// of base64, comfortably above the typical 50–150KB payload but small enough
// to prevent abuse / DB bloat from oversized uploads.
const MAX_PHOTO_URL_LEN = 2_000_000;

export const upsertNicheSchema = createInsertSchema(nichesTable, {
  status: z.enum(NICHE_STATUSES),
  occupantName: z.string().max(200).nullable().optional(),
  dob: z.string().max(40).nullable().optional(),
  dod: z.string().max(40).nullable().optional(),
  inscription: z.string().max(500).nullable().optional(),
  photoUrl: z.string().max(MAX_PHOTO_URL_LEN).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).omit({ id: true, updatedAt: true });
export type UpsertNiche = z.infer<typeof upsertNicheSchema>;
export type Niche = typeof nichesTable.$inferSelect;
