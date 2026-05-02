import { Router } from "express";
import { db } from "@workspace/db";
import { plotsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/plots", async (req, res) => {
  const { organizationId, status, section } = req.query;
  const conditions = [];
  if (organizationId) conditions.push(eq(plotsTable.organizationId, Number(organizationId)));
  if (status) conditions.push(eq(plotsTable.status, status as string));
  if (section) conditions.push(eq(plotsTable.section, section as string));
  const plots = conditions.length
    ? await db.select().from(plotsTable).where(and(...conditions))
    : await db.select().from(plotsTable);
  res.json(plots);
});

router.post("/plots", async (req, res) => {
  const [plot] = await db.insert(plotsTable).values(req.body).returning();
  res.status(201).json(plot);
});

router.get("/plots/map/:organizationId", async (req, res) => {
  const organizationId = Number(req.params.organizationId);
  const plots = await db.select().from(plotsTable).where(eq(plotsTable.organizationId, organizationId));
  res.json({ organizationId, plots });
});

router.get("/plots/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [plot] = await db.select().from(plotsTable).where(eq(plotsTable.id, id));
  if (!plot) return res.status(404).json({ error: "Not found" });
  res.json(plot);
});

router.put("/plots/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [plot] = await db.update(plotsTable).set(req.body).where(eq(plotsTable.id, id)).returning();
  if (!plot) return res.status(404).json({ error: "Not found" });
  res.json(plot);
});

router.delete("/plots/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(plotsTable).where(eq(plotsTable.id, id));
  res.status(204).send();
});

export default router;
