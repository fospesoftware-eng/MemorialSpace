import { Router, type RequestHandler } from "express";
import { db } from "@workspace/db";
import { workOrdersTable, type WorkOrder } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { readPage } from "../lib/pagination";

const router = Router();

const list: RequestHandler = async (req, res) => {
  const { organizationId, status, assignedTo } = req.query;
  const { limit, offset } = readPage(req, { defaultLimit: 200, maxLimit: 1000 });
  const conditions = [];
  if (organizationId) conditions.push(eq(workOrdersTable.organizationId, Number(organizationId)));
  // status is a string-enum column; compare via raw sql to avoid the enum-vs-string mismatch.
  if (status) conditions.push(sql`${workOrdersTable.status} = ${String(status)}`);
  if (assignedTo) conditions.push(eq(workOrdersTable.assignedTo, Number(assignedTo)));
  const q = db.select().from(workOrdersTable).orderBy(desc(workOrdersTable.id)).limit(limit).offset(offset);
  const orders: WorkOrder[] = conditions.length ? await q.where(and(...conditions)) : await q;
  res.json(orders);
};
router.get("/work-orders", list);

router.post("/work-orders", async (req, res) => {
  const [order] = await db.insert(workOrdersTable).values(req.body).returning();
  res.status(201).json(order);
});

router.get("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [order] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(order);
});

router.put("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [order] = await db.update(workOrdersTable).set(req.body).where(eq(workOrdersTable.id, id)).returning();
  if (!order) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(order);
});

router.delete("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(workOrdersTable).where(eq(workOrdersTable.id, id));
  res.status(204).send();
});

export default router;
