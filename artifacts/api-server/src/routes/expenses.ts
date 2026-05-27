import { Router, type IRouter } from "express";
import { db, expensesTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function readOrgId(req: { query: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

router.get("/expenses", async (req, res): Promise<void> => {
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const conditions = [eq(expensesTable.organizationId, orgId)];
  if (req.query.status) conditions.push(sql`${expensesTable.status} = ${String(req.query.status)}`);
  if (req.query.categoryId) conditions.push(eq(expensesTable.categoryId, Number(req.query.categoryId)));
  const rows = await db
    .select()
    .from(expensesTable)
    .where(and(...conditions))
    .orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id));
  res.json(rows);
});

router.post("/expenses", async (req, res): Promise<void> => {
  if (!req.body?.organizationId || !req.body?.description || req.body?.amount == null || !req.body?.expenseDate) {
    res.status(400).json({ error: "organizationId, description, amount, and expenseDate are required" });
    return;
  }
  const [row] = await db.insert(expensesTable).values(req.body).returning();
  res.status(201).json(row);
});

router.get("/expenses/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.organizationId, orgId)));
  if (!row) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(row);
});

router.put("/expenses/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!req.body?.organizationId) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .update(expensesTable)
    .set(req.body)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.organizationId, req.body.organizationId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(row);
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  await db
    .delete(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.organizationId, orgId)));
  res.sendStatus(204);
});

router.post("/expenses/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = Number(req.body?.organizationId);
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .update(expensesTable)
    .set({
      status: "approved",
      approvedBy: req.body?.approvedBy ?? null,
      approvedAt: new Date(),
    })
    .where(and(eq(expensesTable.id, id), eq(expensesTable.organizationId, orgId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(row);
});

router.post("/expenses/:id/reject", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = Number(req.body?.organizationId);
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .update(expensesTable)
    .set({
      status: "rejected",
      approvedBy: req.body?.approvedBy ?? null,
      approvedAt: new Date(),
      notes: req.body?.notes ?? null,
    })
    .where(and(eq(expensesTable.id, id), eq(expensesTable.organizationId, orgId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(row);
});

router.post("/expenses/:id/mark-paid", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = Number(req.body?.organizationId);
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .update(expensesTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(expensesTable.id, id), eq(expensesTable.organizationId, orgId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(row);
});

export default router;
