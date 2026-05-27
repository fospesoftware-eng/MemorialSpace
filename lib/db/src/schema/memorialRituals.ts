/**
 * Memorial rituals — the gamified B2C memory experience.
 *
 * Visitors of a public memorial page can perform three kinds of digital
 * rituals:
 *   - candle  — a virtual candle that "burns" for 24h, then dims out of
 *               the active wall but is preserved for history.
 *   - flower  — a flower / bouquet offering. Stays "fresh" for 7 days.
 *   - prayer  — a written prayer, optionally accompanied by a short voice
 *               recording (stored as a base64 data URL, capped well under
 *               1 MB so we don't need object storage for the demo path).
 *
 * Rituals are scoped to a `burialId` (every QR is bound to a burial; not
 * every QR has a memorial row), with `organizationId` denormalized in for
 * cheap tenant-scoped scans. Cascade-deleted alongside the burial / org so
 * we never leave dangling rituals when a record is removed.
 */
import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { burialsTable } from "./burials";
import { organizationsTable } from "./organizations";

export const RITUAL_TYPES = ["candle", "flower", "prayer"] as const;
export type RitualType = (typeof RITUAL_TYPES)[number];
export const ritualTypeSchema = z.enum(RITUAL_TYPES);

// Candle/flower variants exposed to the picker. Free-form for "other"
// custom ritual types, but the canonical ones are pinned for analytics.
export const CANDLE_VARIANTS = ["white", "gold", "amber", "rose"] as const;
export const FLOWER_VARIANTS = ["white-roses", "lilies", "sunflowers", "chrysanthemums", "mixed-bouquet"] as const;

// How long each ritual stays in the "active" wall. Past this point the
// ritual is still preserved (visible in history / "all time" totals) but
// no longer rendered as a flickering candle / fresh bouquet on the wall.
export const RITUAL_ACTIVE_MS: Record<RitualType, number> = {
  candle: 24 * 60 * 60 * 1000, //  1 day
  flower: 7 * 24 * 60 * 60 * 1000, //  7 days
  prayer: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const memorialRitualsTable = pgTable(
  "memorial_rituals",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    burialId: integer("burial_id")
      .notNull()
      .references(() => burialsTable.id, { onDelete: "cascade" }),
    /** "candle" | "flower" | "prayer". Stored as text (vs enum) so future
     *  ritual types don't need a type-altering migration. */
    type: text("type").notNull(),
    /** Optional sub-variant — candle colour, flower bouquet kind, etc. */
    variant: text("variant"),
    /** Display name. Defaults to "Anonymous" client-side but we keep the
     *  raw value so families can later edit/curate. */
    visitorName: text("visitor_name"),
    /** Free-text message; for prayers this is the written prayer, for
     *  candles/flowers it's an optional dedication. Capped at 1000 chars
     *  in the API layer. */
    message: text("message"),
    /** Voice prayer audio as a base64 data URL (e.g. "data:audio/webm;base64,..."). */
    audioDataUrl: text("audio_data_url"),
    audioDurationMs: integer("audio_duration_ms"),
    /** When this ritual stops counting as "active" on the live wall. The
     *  row itself is kept for history. */
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Hot path: list active rituals for a burial newest-first.
    byBurialCreatedIdx: index("memorial_rituals_burial_created_idx").on(
      t.burialId,
      sql`${t.createdAt} DESC`,
    ),
    // For org-wide analytics + cascade scans.
    byOrgIdx: index("memorial_rituals_org_idx").on(t.organizationId),
    byTypeIdx: index("memorial_rituals_type_idx").on(t.type),
  }),
);

export type MemorialRitual = typeof memorialRitualsTable.$inferSelect;
