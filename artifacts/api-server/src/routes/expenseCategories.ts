import { Router, type IRouter } from "express";
import { db, expenseCategoriesTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";

const router: IRouter = Router();

function readOrgId(req: { query: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

router.get("/expense-categories", async (req, res): Promise<void> => {
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const rows = await db
    .select()
    .from(expenseCategoriesTable)
    .where(eq(expenseCategoriesTable.organizationId, orgId))
    .orderBy(asc(expenseCategoriesTable.name));
  res.json(rows);
});

router.post("/expense-categories", async (req, res): Promise<void> => {
  if (!req.body?.organizationId || !req.body?.name) {
    res.status(400).json({ error: "organizationId and name are required" });
    return;
  }
  const [row] = await db.insert(expenseCategoriesTable).values(req.body).returning();
  res.status(201).json(row);
});

router.put("/expense-categories/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!req.body?.organizationId) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .update(expenseCategoriesTable)
    .set(req.body)
    .where(and(eq(expenseCategoriesTable.id, id), eq(expenseCategoriesTable.organizationId, req.body.organizationId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(row);
});

router.delete("/expense-categories/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  await db
    .delete(expenseCategoriesTable)
    .where(and(eq(expenseCategoriesTable.id, id), eq(expenseCategoriesTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
