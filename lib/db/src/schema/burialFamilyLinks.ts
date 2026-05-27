/**
 * Family-link edges between burial records within the same cemetery
 * (organization). Powers:
 *   - the "Family" section on the burial-detail card (admin)
 *   - the family-tree visualization
 *
 * Design notes:
 *  - The table stores ONE directed row per relationship. The route layer
 *    is responsible for normalizing the inverse semantics during reads
 *    (e.g. "B is parent of A" implies "A is child of B"). This keeps writes
 *    cheap and avoids the upkeep of mirror rows on delete.
 *  - `organizationId` is denormalized onto the link so we can filter and
 *    cascade-scope without joining through both burials. The route layer
 *    enforces that both linked burials live in the SAME org.
 *  - Self-links and duplicate (fromBurialId, toBurialId, relationship)
 *    rows are blocked with a CHECK + a unique index.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { burialsTable } from "./burials";
import { organizationsTable } from "./organizations";

export const FAMILY_RELATIONSHIPS = [
  "parent",
  "child",
  "spouse",
  "sibling",
  "other",
] as const;
export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number];

export const burialFamilyLinksTable = pgTable(
  "burial_family_links",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizationsTable.id, { onDelete: "cascade" })
      .notNull(),
    fromBurialId: integer("from_burial_id")
      .references(() => burialsTable.id, { onDelete: "cascade" })
      .notNull(),
    toBurialId: integer("to_burial_id")
      .references(() => burialsTable.id, { onDelete: "cascade" })
      .notNull(),
    /** Role of `to` relative to `from`. e.g. "parent" → to is from's parent. */
    relationship: text("relationship").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqEdge: uniqueIndex("burial_family_links_edge_idx").on(
      t.fromBurialId,
      t.toBurialId,
      t.relationship,
    ),
    byFrom: index("burial_family_links_from_idx").on(t.fromBurialId),
    byTo: index("burial_family_links_to_idx").on(t.toBurialId),
    byOrg: index("burial_family_links_org_idx").on(t.organizationId),
    noSelfLink: check("burial_family_links_no_self", sql`${t.fromBurialId} <> ${t.toBurialId}`),
  }),
);

export type BurialFamilyLink = typeof burialFamilyLinksTable.$inferSelect;
export type InsertBurialFamilyLink = typeof burialFamilyLinksTable.$inferInsert;

export const familyRelationshipSchema = z.enum(FAMILY_RELATIONSHIPS);
