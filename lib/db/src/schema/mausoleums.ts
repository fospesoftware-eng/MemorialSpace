import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

// A "mausoleum" is an above-ground burial building containing crypts
// (entombment vaults for caskets). A cemetery (organization) can have
// multiple mausoleums (e.g. "Garden Chapel", "Veterans Mausoleum").
// Each mausoleum is modeled as a single `rows × cols` grid of crypts:
//   rows = vertical tiers (level 1 = bottom, level N = top)
//   cols = horizontal positions across the wall
// This matches the Columbarium model so the rendering / addressing logic
// is consistent, but crypts are physically larger and carry richer
// occupant + ownership data (see `mausoleumCryptsTable` below).
export const mausoleumsTable = pgTable("mausoleums", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // Optional building-level metadata for the list card and detail header.
  location: text("location"),
  rows: integer("rows").default(4).notNull(),
  cols: integer("cols").default(8).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const CRYPT_STATUSES = ["available", "reserved", "occupied"] as const;
export type CryptStatus = (typeof CRYPT_STATUSES)[number];

// Single = one casket, Companion = two caskets (typical husband+wife),
// Family = larger vault for 3+. The frontend renders the cell taller for
// Companion / Family so operators can tell them apart at a glance.
export const CRYPT_TYPES = ["single", "companion", "family"] as const;
export type CryptType = (typeof CRYPT_TYPES)[number];

// Each crypt is a single entombment slot in a mausoleum. Coordinates
// (row, col) are zero-indexed; (0,0) is the bottom-left so that "tier 1"
// (the most accessible row) appears at the bottom of the wall — this
// matches how mausoleums are read in real life.
//
// `(mausoleumId, row, col)` is unique so a slot can be looked up by
// position via the upsert endpoint without a stale-read race.
export const mausoleumCryptsTable = pgTable(
  "mausoleum_crypts",
  {
    id: serial("id").primaryKey(),
    mausoleumId: integer("mausoleum_id")
      .notNull()
      .references(() => mausoleumsTable.id, { onDelete: "cascade" }),
    row: integer("row").notNull(),
    col: integer("col").notNull(),
    // Optional human-readable label like "N-1-A" or "C-12". If null the
    // UI falls back to the auto-computed Tier/Pos label.
    cryptNumber: text("crypt_number"),
    cryptType: text("crypt_type").default("single").notNull(),
    status: text("status").default("available").notNull(),

    // Primary occupant (always rendered on the plaque).
    occupantName: text("occupant_name"),
    dob: text("dob"),
    dod: text("dod"),

    // Companion crypts can hold a second occupant. For "family" crypts
    // additional occupants beyond the second are recorded in `notes`
    // since the schema is intentionally flat for fast reads.
    secondOccupantName: text("second_occupant_name"),
    secondDob: text("second_dob"),
    secondDod: text("second_dod"),

    inscription: text("inscription"),
    photoUrl: text("photo_url"),

    // Owner = whoever holds the right of entombment (often pre-purchased
    // years before any burial). Used by the operator to follow up on
    // reservations.
    ownerName: text("owner_name"),
    ownerContact: text("owner_contact"),

    notes: text("notes"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("mausoleum_crypts_position_unique").on(t.mausoleumId, t.row, t.col)],
);

export const insertMausoleumSchema = createInsertSchema(mausoleumsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMausoleum = z.infer<typeof insertMausoleumSchema>;
export type Mausoleum = typeof mausoleumsTable.$inferSelect;

// Photos are stored as `data:image/jpeg;base64,...` (frontend downscales
// to 600px before sending). 2_000_000 chars ≈ 1.5MB of base64, generous
// headroom for a typical 50–150KB upload but small enough to prevent
// abuse / accidental DB bloat from full-size phone photos.
const MAX_PHOTO_URL_LEN = 2_000_000;

export const upsertCryptSchema = createInsertSchema(mausoleumCryptsTable, {
  status: z.enum(CRYPT_STATUSES),
  cryptType: z.enum(CRYPT_TYPES),
  cryptNumber: z.string().max(40).nullable().optional(),
  occupantName: z.string().max(200).nullable().optional(),
  dob: z.string().max(40).nullable().optional(),
  dod: z.string().max(40).nullable().optional(),
  secondOccupantName: z.string().max(200).nullable().optional(),
  secondDob: z.string().max(40).nullable().optional(),
  secondDod: z.string().max(40).nullable().optional(),
  inscription: z.string().max(500).nullable().optional(),
  photoUrl: z.string().max(MAX_PHOTO_URL_LEN).nullable().optional(),
  ownerName: z.string().max(200).nullable().optional(),
  ownerContact: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).omit({ id: true, updatedAt: true });
export type UpsertCrypt = z.infer<typeof upsertCryptSchema>;
export type MausoleumCrypt = typeof mausoleumCryptsTable.$inferSelect;
