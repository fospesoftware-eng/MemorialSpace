import { Router, type IRouter } from "express";
import { db, assetsTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function readOrgId(req: { query: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

router.get("/assets", async (req, res): Promise<void> => {
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const conditions = [eq(assetsTable.organizationId, orgId)];
  if (req.query.status) conditions.push(sql`${assetsTable.status} = ${String(req.query.status)}`);
  if (req.query.type) conditions.push(sql`${assetsTable.type} = ${String(req.query.type)}`);
  const rows = await db
    .select()
    .from(assetsTable)
    .where(and(...conditions))
    .orderBy(desc(assetsTable.createdAt));
  res.json(rows);
});

router.post("/assets", async (req, res): Promise<void> => {
  if (!req.body?.organizationId || !req.body?.name || !req.body?.type) {
    res.status(400).json({ error: "organizationId, name, and type are required" });
    return;
  }
  const [row] = await db.insert(assetsTable).values(req.body).returning();
  res.status(201).json(row);
});

router.get("/assets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.id, id), eq(assetsTable.organizationId, orgId)));
  if (!row) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.json(row);
});

router.put("/assets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!req.body?.organizationId) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .update(assetsTable)
    .set(req.body)
    .where(and(eq(assetsTable.id, id), eq(assetsTable.organizationId, req.body.organizationId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.json(row);
});

router.delete("/assets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  await db
    .delete(assetsTable)
    .where(and(eq(assetsTable.id, id), eq(assetsTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
