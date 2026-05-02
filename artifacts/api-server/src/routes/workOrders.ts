import { Router } from "express";
import { db } from "@workspace/db";
import { workOrdersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/work-orders", async (req, res) => {
  const { organizationId, status, assignedTo } = req.query;
  const conditions = [];
  if (organizationId) conditions.push(eq(workOrdersTable.organizationId, Number(organizationId)));
  if (status) conditions.push(eq(workOrdersTable.status, status as string));
  if (assignedTo) conditions.push(eq(workOrdersTable.assignedTo, Number(assignedTo)));
  const orders = conditions.length
    ? await db.select().from(workOrdersTable).where(and(...conditions))
    : await db.select().from(workOrdersTable);
  res.json(orders);
});

router.post("/work-orders", async (req, res) => {
  const [order] = await db.insert(workOrdersTable).values(req.body).returning();
  res.status(201).json(order);
});

router.get("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [order] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});

router.put("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [order] = await db.update(workOrdersTable).set(req.body).where(eq(workOrdersTable.id, id)).returning();
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});

router.delete("/work-orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(workOrdersTable).where(eq(workOrdersTable.id, id));
  res.status(204).send();
});

export default router;
