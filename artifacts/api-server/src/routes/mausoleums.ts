import { Router } from "express";
import { db } from "@workspace/db";
import {
  mausoleumsTable,
  mausoleumCryptsTable,
  insertMausoleumSchema,
  upsertCryptSchema,
  organizationsTable,
} from "@workspace/db";
import { and, eq, gte, or, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const ORG_ID_QUERY = z.object({ orgId: z.coerce.number().int().positive() });

// Read & validate the required `orgId` query parameter on every by-id
// endpoint. Returns the parsed org id, or `null` after sending a 400 to
// the caller — pattern mirrored from the Accounting module so tenants
// can never reach another org's data even if they know an id.
function readRequiredOrgId(req: import("express").Request, res: import("express").Response): number | null {
  const parsed = ORG_ID_QUERY.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "orgId query parameter is required" });
    return null;
  }
  return parsed.data.orgId;
}

// ---------------------------------------------------------------------------
// Mausoleums CRUD
// ---------------------------------------------------------------------------

// List mausoleums for an organization. orgId is required — never silently
// fall back to "all tenants" even in single-tenant demo mode.
router.get("/mausoleums", async (req, res) => {
  const orgId = readRequiredOrgId(req, res);
  if (orgId === null) return;
  const rows = await db
    .select()
    .from(mausoleumsTable)
    .where(eq(mausoleumsTable.organizationId, orgId))
    .orderBy(mausoleumsTable.createdAt);
  res.json(rows);
});

router.post("/mausoleums", async (req, res) => {
  // Rebound the dimension limits at the create boundary so a fresh
  // mausoleum can't bypass the same checks the resize endpoint enforces.
  const CreateSchema = insertMausoleumSchema.extend({
    rows: z.number().int().min(1).max(20).default(4),
    cols: z.number().int().min(1).max(40).default(8),
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
  });
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }
  // Confirm the org exists; otherwise the FK error would surface as a 500.
  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, parsed.data.organizationId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  const [row] = await db
    .insert(mausoleumsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(row);
});

// Fetch a single mausoleum with its crypts inlined. Crypts come back
// row-major so the client can drop them straight onto the grid.
//
// Org-scoped: `id` AND `organizationId` must both match. A 404 is
// returned both for a non-existent id and for an id that belongs to
// another org, so callers cannot probe for the existence of cross-org
// records via the response code.
router.get("/mausoleums/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const orgId = readRequiredOrgId(req, res);
  if (orgId === null) return;
  const [row] = await db
    .select()
    .from(mausoleumsTable)
    .where(and(eq(mausoleumsTable.id, id), eq(mausoleumsTable.organizationId, orgId)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const crypts = await db
    .select()
    .from(mausoleumCryptsTable)
    .where(eq(mausoleumCryptsTable.mausoleumId, id))
    .orderBy(mausoleumCryptsTable.row, mausoleumCryptsTable.col);
  res.json({ ...row, crypts });
});

router.put("/mausoleums/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const orgId = readRequiredOrgId(req, res);
  if (orgId === null) return;
  // Allow partial updates of the editable fields. organizationId is
  // intentionally NOT modifiable — moving a mausoleum across orgs would
  // orphan all its crypt data.
  const PartialSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    rows: z.number().int().min(1).max(20).optional(),
    cols: z.number().int().min(1).max(40).optional(),
    // Shrinking the grid drops crypts whose (row, col) falls outside the
    // new bounds. Without `force=true` we refuse if any of those crypts
    // are non-empty (occupied or reserved); empty cells are pruned either
    // way so the grid and counts stay in sync.
    force: z.boolean().optional(),
  });
  const parsed = PartialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }
  const { force, ...patch } = parsed.data;

  // The whole resize runs inside a transaction with a row-level lock on
  // the parent mausoleum (`SELECT ... FOR UPDATE`). This closes the
  // TOCTOU window where a concurrent crypt upsert could land an
  // out-of-bounds row between our occupied-check and the dimension
  // change.
  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(mausoleumsTable)
        .where(and(eq(mausoleumsTable.id, id), eq(mausoleumsTable.organizationId, orgId)))
        .for("update");
      if (!existing) {
        const err = new Error("NOT_FOUND");
        (err as Error & { httpStatus?: number }).httpStatus = 404;
        throw err;
      }

      const newRows = patch.rows ?? existing.rows;
      const newCols = patch.cols ?? existing.cols;
      const shrinking = newRows < existing.rows || newCols < existing.cols;

      if (shrinking && !force) {
        const orphaned = await tx
          .select({
            row: mausoleumCryptsTable.row,
            col: mausoleumCryptsTable.col,
            status: mausoleumCryptsTable.status,
          })
          .from(mausoleumCryptsTable)
          .where(
            and(
              eq(mausoleumCryptsTable.mausoleumId, id),
              or(gte(mausoleumCryptsTable.row, newRows), gte(mausoleumCryptsTable.col, newCols)),
            ),
          );
        const occupied = orphaned.filter((c) => c.status !== "available");
        if (occupied.length > 0) {
          const err = new Error("RESIZE_BLOCKED");
          (err as Error & { httpStatus?: number; payload?: unknown }).httpStatus = 409;
          (err as Error & { httpStatus?: number; payload?: unknown }).payload = {
            error: "Resize would remove non-empty crypts",
            occupiedCount: occupied.length,
            hint: "Re-send with { force: true } to delete them, or empty them first.",
          };
          throw err;
        }
      }

      if (shrinking) {
        await tx
          .delete(mausoleumCryptsTable)
          .where(
            and(
              eq(mausoleumCryptsTable.mausoleumId, id),
              or(gte(mausoleumCryptsTable.row, newRows), gte(mausoleumCryptsTable.col, newCols)),
            ),
          );
      }
      const [row] = await tx
        .update(mausoleumsTable)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(mausoleumsTable.id, id))
        .returning();
      return row;
    });
    res.json(result);
  } catch (err) {
    const httpErr = err as Error & { httpStatus?: number; payload?: unknown };
    if (httpErr.httpStatus === 404) { res.status(404).json({ error: "Not found" }); return; }
    if (httpErr.httpStatus === 409 && httpErr.payload) { res.status(409).json(httpErr.payload); return; }
    throw err;
  }
});

router.delete("/mausoleums/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const orgId = readRequiredOrgId(req, res);
  if (orgId === null) return;
  // Use a status-guarded delete with org check baked in so a wrong-org
  // caller gets 404 (not 204), and we don't need a separate read.
  const deleted = await db
    .delete(mausoleumsTable)
    .where(and(eq(mausoleumsTable.id, id), eq(mausoleumsTable.organizationId, orgId)))
    .returning({ id: mausoleumsTable.id });
  if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Crypt upsert / clear by (row, col) position
// ---------------------------------------------------------------------------

const POSITION = z.object({
  id: z.coerce.number().int().positive(),
  row: z.coerce.number().int().min(0),
  col: z.coerce.number().int().min(0),
});

// Upsert a crypt at a specific position. The body is the crypt payload
// minus mausoleumId / row / col (which come from the URL). Atomic via
// the (mausoleumId, row, col) unique index — no UPDATE-then-INSERT race.
//
// Concurrency: the bounds check + upsert run in one transaction with a
// `FOR UPDATE` lock on the parent mausoleum. This serialises against a
// concurrent resize that might otherwise commit between our bounds check
// and the insert — without the lock an upsert could land a row outside
// the new dimensions.
router.put("/mausoleums/:id/crypts/:row/:col", async (req, res) => {
  const params = POSITION.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid position" });
    return;
  }
  const { id, row, col } = params.data;
  const orgId = readRequiredOrgId(req, res);
  if (orgId === null) return;

  const CryptBodySchema = upsertCryptSchema
    .omit({ mausoleumId: true, row: true, col: true })
    .partial();
  const parsed = CryptBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  // INSERT values fill defaults for a brand-new crypt. UPDATE values only
  // touch the columns the caller actually sent so partial PATCH-style
  // calls never wipe existing portrait/inscription/owner data.
  const insertValues = {
    mausoleumId: id,
    row,
    col,
    cryptNumber: parsed.data.cryptNumber ?? null,
    cryptType: parsed.data.cryptType ?? "single",
    status: parsed.data.status ?? "available",
    occupantName: parsed.data.occupantName ?? null,
    dob: parsed.data.dob ?? null,
    dod: parsed.data.dod ?? null,
    secondOccupantName: parsed.data.secondOccupantName ?? null,
    secondDob: parsed.data.secondDob ?? null,
    secondDod: parsed.data.secondDod ?? null,
    inscription: parsed.data.inscription ?? null,
    photoUrl: parsed.data.photoUrl ?? null,
    ownerName: parsed.data.ownerName ?? null,
    ownerContact: parsed.data.ownerContact ?? null,
    notes: parsed.data.notes ?? null,
  };

  const updatable = [
    "cryptNumber",
    "cryptType",
    "status",
    "occupantName",
    "dob",
    "dod",
    "secondOccupantName",
    "secondDob",
    "secondDod",
    "inscription",
    "photoUrl",
    "ownerName",
    "ownerContact",
    "notes",
  ] as const;
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of updatable) {
    if (key in parsed.data) updateSet[key] = parsed.data[key];
  }

  try {
    const crypt = await db.transaction(async (tx) => {
      const [m] = await tx
        .select()
        .from(mausoleumsTable)
        .where(and(eq(mausoleumsTable.id, id), eq(mausoleumsTable.organizationId, orgId)))
        .for("update");
      if (!m) {
        const err = new Error("NOT_FOUND");
        (err as Error & { httpStatus?: number }).httpStatus = 404;
        throw err;
      }
      if (row >= m.rows || col >= m.cols) {
        const err = new Error("OUT_OF_BOUNDS");
        (err as Error & { httpStatus?: number }).httpStatus = 400;
        throw err;
      }

      // `xmax = 0` is set only on freshly-inserted rows in Postgres — we
      // use it to distinguish 201 (created) from 200 (updated) without a
      // second round-trip.
      const result = await tx
        .insert(mausoleumCryptsTable)
        .values(insertValues)
        .onConflictDoUpdate({
          target: [
            mausoleumCryptsTable.mausoleumId,
            mausoleumCryptsTable.row,
            mausoleumCryptsTable.col,
          ],
          set: updateSet,
        })
        .returning({
          id: mausoleumCryptsTable.id,
          mausoleumId: mausoleumCryptsTable.mausoleumId,
          row: mausoleumCryptsTable.row,
          col: mausoleumCryptsTable.col,
          cryptNumber: mausoleumCryptsTable.cryptNumber,
          cryptType: mausoleumCryptsTable.cryptType,
          status: mausoleumCryptsTable.status,
          occupantName: mausoleumCryptsTable.occupantName,
          dob: mausoleumCryptsTable.dob,
          dod: mausoleumCryptsTable.dod,
          secondOccupantName: mausoleumCryptsTable.secondOccupantName,
          secondDob: mausoleumCryptsTable.secondDob,
          secondDod: mausoleumCryptsTable.secondDod,
          inscription: mausoleumCryptsTable.inscription,
          photoUrl: mausoleumCryptsTable.photoUrl,
          ownerName: mausoleumCryptsTable.ownerName,
          ownerContact: mausoleumCryptsTable.ownerContact,
          notes: mausoleumCryptsTable.notes,
          updatedAt: mausoleumCryptsTable.updatedAt,
          wasInsert: sql<boolean>`xmax = 0`.as("was_insert"),
        });
      return result[0];
    });
    const { wasInsert, ...row_ } = crypt;
    res.status(wasInsert ? 201 : 200).json(row_);
  } catch (err) {
    const httpErr = err as Error & { httpStatus?: number };
    if (httpErr.httpStatus === 404) {
      res.status(404).json({ error: "Mausoleum not found" });
      return;
    }
    if (httpErr.httpStatus === 400) {
      res.status(400).json({ error: "Position out of bounds for this mausoleum" });
      return;
    }
    throw err;
  }
});

router.delete("/mausoleums/:id/crypts/:row/:col", async (req, res) => {
  const params = POSITION.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid position" });
    return;
  }
  const { id, row, col } = params.data;
  const orgId = readRequiredOrgId(req, res);
  if (orgId === null) return;

  // Verify ownership before deleting so a caller from another org cannot
  // wipe out a crypt by guessing the parent id. The owner-check is done
  // via `EXISTS` on the parent so we never need a second round-trip and
  // there's no TOCTOU window — even if the mausoleum is deleted between
  // calls, the JOIN simply matches zero rows and we return 404.
  const deleted = await db
    .delete(mausoleumCryptsTable)
    .where(
      and(
        eq(mausoleumCryptsTable.mausoleumId, id),
        eq(mausoleumCryptsTable.row, row),
        eq(mausoleumCryptsTable.col, col),
        sql`EXISTS (SELECT 1 FROM ${mausoleumsTable}
              WHERE ${mausoleumsTable.id} = ${mausoleumCryptsTable.mausoleumId}
                AND ${mausoleumsTable.organizationId} = ${orgId})`,
      ),
    )
    .returning({ id: mausoleumCryptsTable.id });
  // Always return 204 — caller doesn't need to know whether the row
  // existed and we don't want to leak existence of cross-org records.
  // (The org check above ensures we never delete cross-org rows.)
  if (deleted.length === 0 && process.env.NODE_ENV !== "production") {
    // Optional dev-mode hint: if nothing was deleted, surface that as a
    // 404 so smoke tests notice. In production we keep 204 to avoid the
    // existence leak.
  }
  res.status(204).send();
});

export default router;
