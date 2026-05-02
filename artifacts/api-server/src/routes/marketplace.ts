import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/marketplace/products", async (req, res) => {
  const { category } = req.query;
  const products = category
    ? await db.select().from(productsTable).where(eq(productsTable.category, category as string))
    : await db.select().from(productsTable);
  res.json(products);
});

router.post("/marketplace/products", async (req, res) => {
  const [product] = await db.insert(productsTable).values(req.body).returning();
  res.status(201).json(product);
});

router.get("/marketplace/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) return res.status(404).json({ error: "Not found" });
  res.json(product);
});

router.put("/marketplace/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [product] = await db.update(productsTable).set(req.body).where(eq(productsTable.id, id)).returning();
  if (!product) return res.status(404).json({ error: "Not found" });
  res.json(product);
});

router.delete("/marketplace/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).send();
});

router.get("/marketplace/orders", async (req, res) => {
  const { customerId } = req.query;
  const orders = customerId
    ? await db.select().from(ordersTable).where(eq(ordersTable.customerId, Number(customerId)))
    : await db.select().from(ordersTable);
  const result = orders.map((o) => ({ ...o, items: JSON.parse(o.items) }));
  res.json(result);
});

router.post("/marketplace/orders", async (req, res) => {
  const { items, ...rest } = req.body;
  const [order] = await db.insert(ordersTable).values({ ...rest, items: JSON.stringify(items) }).returning();
  res.status(201).json({ ...order, items: JSON.parse(order.items) });
});

router.get("/marketplace/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json({ ...order, items: JSON.parse(order.items) });
});

export default router;
