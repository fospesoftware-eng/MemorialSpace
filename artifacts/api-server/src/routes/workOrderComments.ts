import { Router, type IRouter } from "express";
import { db, workOrderCommentsTable, workOrdersTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";

const router: IRouter = Router();

function readOrgId(req: { query: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

router.get("/work-orders/:id/comments", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [wo] = await db
    .select({ id: workOrdersTable.id })
    .from(workOrdersTable)
    .where(and(eq(workOrdersTable.id, id), eq(workOrdersTable.organizationId, orgId)));
  if (!wo) {
    res.status(404).json({ error: "Work order not found" });
    return;
  }
  const rows = await db
    .select()
    .from(workOrderCommentsTable)
    .where(eq(workOrderCommentsTable.workOrderId, id))
    .orderBy(asc(workOrderCommentsTable.createdAt));
  res.json(rows);
});

router.post("/work-orders/:id/comments", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const body = (req.body?.body ?? "").toString().trim();
  if (!body) {
    res.status(400).json({ error: "body is required" });
    return;
  }
  // Verify parent work order belongs to caller org (enforceOrgScope injects organizationId into body).
  const orgId = Number(req.body?.organizationId);
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [wo] = await db
    .select({ id: workOrdersTable.id })
    .from(workOrdersTable)
    .where(and(eq(workOrdersTable.id, id), eq(workOrdersTable.organizationId, orgId)));
  if (!wo) {
    res.status(404).json({ error: "Work order not found" });
    return;
  }
  const [row] = await db
    .insert(workOrderCommentsTable)
    .values({
      workOrderId: id,
      body,
      authorName: req.body?.authorName ?? null,
      userId: req.body?.userId ?? null,
    })
    .returning();
  res.status(201).json(row);
});

export default router;
