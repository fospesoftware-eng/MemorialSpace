import { Router, type RequestHandler } from "express";
import { db } from "@workspace/db";
import { workOrdersTable, type WorkOrder } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { readPage } from "../lib/pagination";

const router = Router();

function readOrgId(req: { query: Record<string, unknown>; body?: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId ?? req.body?.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function normalizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  // Auto-set completedAt when transitioning to completed without an explicit value.
  if (out.status === "completed" && out.completedAt == null) {
    out.completedAt = new Date();
  }
  // Coerce ISO date strings into Date for timestamp columns.
  if (typeof out.completedAt === "string") out.completedAt = new Date(out.completedAt);
  return out;
}

const list: RequestHandler = async (req, res) => {
  const { organizationId, status, assignedTo } = req.query;
  const { limit, offset } = readPage(req, { defaultLimit: 200, maxLimit: 1000 });
  const conditions = [];
  if (organizationId) conditions.push(eq(workOrdersTable.organizationId, Number(organizationId)));
  if (status) conditions.push(sql`${workOrdersTable.status} = ${String(status)}`);
  if (assignedTo) conditions.push(eq(workOrdersTable.assignedTo, Number(assignedTo)));
  const q = db.select().from(workOrdersTable).orderBy(desc(workOrdersTable.id)).limit(limit).offset(offset);
  const orders: WorkOrder[] = conditions.length ? await q.where(and(...conditions)) : await q;
  res.json(orders);
};
router.get("/work-orders", list);

router.post("/work-orders", async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [order] = await db.insert(workOrdersTable).values(normalizeBody(req.body) as any).returning();
  res.status(201).json(order);
});

router.get("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [order] = await db
    .select()
    .from(workOrdersTable)
    .where(and(eq(workOrdersTable.id, id), eq(workOrdersTable.organizationId, orgId)));
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(order);
});

router.put("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [order] = await db
    .update(workOrdersTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(normalizeBody(req.body) as any)
    .where(and(eq(workOrdersTable.id, id), eq(workOrdersTable.organizationId, orgId)))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(order);
});

router.delete("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  await db
    .delete(workOrdersTable)
    .where(and(eq(workOrdersTable.id, id), eq(workOrdersTable.organizationId, orgId)));
  res.status(204).send();
});

export default router;
