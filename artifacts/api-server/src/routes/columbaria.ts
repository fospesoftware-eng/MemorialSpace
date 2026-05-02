import { Router } from "express";
import { db } from "@workspace/db";
import {
  columbariaTable,
  nichesTable,
  insertColumbariumSchema,
  upsertNicheSchema,
  organizationsTable,
} from "@workspace/db";
import { and, eq, gte, or, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const ORG_ID_QUERY = z.object({ orgId: z.coerce.number().int().positive() });

// ---------------------------------------------------------------------------
// Columbaria CRUD
// ---------------------------------------------------------------------------

// List columbaria for an organization. We require orgId so an operator never
// accidentally sees another tenant's walls.
router.get("/columbaria", async (req, res) => {
  const parsed = ORG_ID_QUERY.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "orgId query parameter is required" });
    return;
  }
  const orgId = parsed.data.orgId;
  const rows = await db
    .select()
    .from(columbariaTable)
    .where(eq(columbariaTable.organizationId, orgId))
    .orderBy(columbariaTable.createdAt);
  res.json(rows);
});

router.post("/columbaria", async (req, res) => {
  // Enforce the same 1..50 bounds on rows/cols as the update route, so a
  // freshly-created wall can't bypass the dimension limits via defaults.
  const CreateSchema = insertColumbariumSchema.extend({
    rows: z.number().int().min(1).max(50).default(8),
    cols: z.number().int().min(1).max(50).default(12),
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().optional(),
  });
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }
  // Confirm the org actually exists; otherwise the FK error would be a 500.
  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, parsed.data.organizationId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  const [row] = await db
    .insert(columbariaTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(row);
});

// Fetch a single columbarium with all its niches inlined. Niches sorted
// row-major so the client can drop them straight onto the grid.
router.get("/columbaria/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(columbariaTable).where(eq(columbariaTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const niches = await db
    .select()
    .from(nichesTable)
    .where(eq(nichesTable.columbariumId, id))
    .orderBy(nichesTable.row, nichesTable.col);
  res.json({ ...row, niches });
});

router.put("/columbaria/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Allow partial updates of name / description / dimensions. organizationId
  // is intentionally NOT modifiable here — moving a wall between orgs would
  // orphan all its niche data.
  const PartialSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    rows: z.number().int().min(1).max(50).optional(),
    cols: z.number().int().min(1).max(50).optional(),
    // When shrinking a wall, callers must opt in to losing data. Without
    // `force=true` we refuse the resize if any out-of-range niche is non-empty
    // (occupied or reserved); empty cells are silently pruned either way so
    // the niche grid and the stats stay consistent.
    force: z.boolean().optional(),
  });
  const parsed = PartialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }
  const { force, ...patch } = parsed.data;

  // If dimensions are changing, reconcile niches that fall outside the new grid.
  const [existing] = await db
    .select()
    .from(columbariaTable)
    .where(eq(columbariaTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const newRows = patch.rows ?? existing.rows;
  const newCols = patch.cols ?? existing.cols;
  const shrinking = newRows < existing.rows || newCols < existing.cols;

  if (shrinking && !force) {
    const orphaned = await db
      .select({ row: nichesTable.row, col: nichesTable.col, status: nichesTable.status })
      .from(nichesTable)
      .where(
        and(
          eq(nichesTable.columbariumId, id),
          or(gte(nichesTable.row, newRows), gte(nichesTable.col, newCols)),
        ),
      );
    const occupied = orphaned.filter((n) => n.status !== "available");
    if (occupied.length > 0) {
      res.status(409).json({
        error: "Resize would remove non-empty niches",
        occupiedCount: occupied.length,
        hint: "Re-send with { force: true } to delete them, or empty them first.",
      });
      return;
    }
  }

  const result = await db.transaction(async (tx) => {
    if (shrinking) {
      await tx
        .delete(nichesTable)
        .where(
          and(
            eq(nichesTable.columbariumId, id),
            or(gte(nichesTable.row, newRows), gte(nichesTable.col, newCols)),
          ),
        );
    }
    const [row] = await tx
      .update(columbariaTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(columbariaTable.id, id))
      .returning();
    return row;
  });
  res.json(result);
});

router.delete("/columbaria/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(columbariaTable).where(eq(columbariaTable.id, id));
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Niche upsert / clear by (row, col) position
// ---------------------------------------------------------------------------

const POSITION = z.object({
  id: z.coerce.number().int().positive(),
  row: z.coerce.number().int().min(0),
  col: z.coerce.number().int().min(0),
});

// Upsert a niche at a specific position. The body is the niche payload
// minus columbariumId / row / col (which come from the URL). If a niche
// already exists at (id, row, col), we update it; otherwise we insert.
router.put("/columbaria/:id/niches/:row/:col", async (req, res) => {
  const params = POSITION.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid position" });
    return;
  }
  const { id, row, col } = params.data;

  // Confirm the wall exists and the position is in bounds.
  const [wall] = await db.select().from(columbariaTable).where(eq(columbariaTable.id, id));
  if (!wall) { res.status(404).json({ error: "Columbarium not found" }); return; }
  if (row >= wall.rows || col >= wall.cols) {
    res.status(400).json({ error: "Position out of bounds for this wall" });
    return;
  }

  const NicheBodySchema = upsertNicheSchema
    .omit({ columbariumId: true, row: true, col: true })
    .partial();
  const parsed = NicheBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  // INSERT values fill defaults for a brand-new niche. UPDATE values only
  // touch the columns the caller actually sent, so partial PATCH-style calls
  // never wipe existing portrait/inscription/notes data.
  const insertValues = {
    columbariumId: id,
    row,
    col,
    occupantName: parsed.data.occupantName ?? null,
    dob: parsed.data.dob ?? null,
    dod: parsed.data.dod ?? null,
    inscription: parsed.data.inscription ?? null,
    photoUrl: parsed.data.photoUrl ?? null,
    status: parsed.data.status ?? "available",
    notes: parsed.data.notes ?? null,
  };

  const updatable = ["occupantName", "dob", "dod", "inscription", "photoUrl", "status", "notes"] as const;
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of updatable) {
    if (key in parsed.data) updateSet[key] = parsed.data[key];
  }

  // Atomic upsert via the (columbariumId, row, col) unique index — no race
  // window between an UPDATE-then-INSERT pair, and concurrent writers can't
  // both miss and then collide on the unique constraint. Postgres exposes
  // `xmax = 0` only for newly-inserted rows so we can return 201 vs 200.
  const result = await db
    .insert(nichesTable)
    .values(insertValues)
    .onConflictDoUpdate({
      target: [nichesTable.columbariumId, nichesTable.row, nichesTable.col],
      set: updateSet,
    })
    .returning({
      id: nichesTable.id,
      columbariumId: nichesTable.columbariumId,
      row: nichesTable.row,
      col: nichesTable.col,
      occupantName: nichesTable.occupantName,
      dob: nichesTable.dob,
      dod: nichesTable.dod,
      inscription: nichesTable.inscription,
      photoUrl: nichesTable.photoUrl,
      status: nichesTable.status,
      notes: nichesTable.notes,
      updatedAt: nichesTable.updatedAt,
      wasInsert: sql<boolean>`xmax = 0`.as("was_insert"),
    });
  const [niche] = result;
  const { wasInsert, ...row_ } = niche;
  res.status(wasInsert ? 201 : 200).json(row_);
});

router.delete("/columbaria/:id/niches/:row/:col", async (req, res) => {
  const params = POSITION.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid position" });
    return;
  }
  const { id, row, col } = params.data;
  await db
    .delete(nichesTable)
    .where(
      and(
        eq(nichesTable.columbariumId, id),
        eq(nichesTable.row, row),
        eq(nichesTable.col, col),
      ),
    );
  res.status(204).send();
});

export default router;
