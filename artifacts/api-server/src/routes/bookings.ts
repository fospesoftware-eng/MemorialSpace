import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

let invoiceCounter = 1000;

router.get("/bookings", async (req, res) => {
  const { organizationId, status } = req.query;
  const conditions = [];
  if (organizationId) conditions.push(eq(bookingsTable.organizationId, Number(organizationId)));
  if (status) conditions.push(eq(bookingsTable.status, status as string));
  const bookings = conditions.length
    ? await db.select().from(bookingsTable).where(and(...conditions))
    : await db.select().from(bookingsTable);
  res.json(bookings);
});

router.post("/bookings", async (req, res) => {
  invoiceCounter++;
  const invoiceNumber = `INV-${invoiceCounter}`;
  const [booking] = await db.insert(bookingsTable).values({ ...req.body, invoiceNumber }).returning();
  res.status(201).json(booking);
});

router.get("/bookings/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!booking) return res.status(404).json({ error: "Not found" });
  res.json(booking);
});

router.put("/bookings/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [booking] = await db.update(bookingsTable).set(req.body).where(eq(bookingsTable.id, id)).returning();
  if (!booking) return res.status(404).json({ error: "Not found" });
  res.json(booking);
});

router.delete("/bookings/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(bookingsTable).where(eq(bookingsTable.id, id));
  res.status(204).send();
});

export default router;
