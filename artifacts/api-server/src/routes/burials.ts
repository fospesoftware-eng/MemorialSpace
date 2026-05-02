import { Router } from "express";
import { db } from "@workspace/db";
import { burialsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";

const router = Router();

router.get("/burials", async (req, res) => {
  const { organizationId, plotId } = req.query;
  const conditions = [];
  if (organizationId) conditions.push(eq(burialsTable.organizationId, Number(organizationId)));
  if (plotId) conditions.push(eq(burialsTable.plotId, Number(plotId)));
  const burials = conditions.length
    ? await db.select().from(burialsTable).where(and(...conditions))
    : await db.select().from(burialsTable);
  res.json(burials);
});

router.post("/burials", async (req, res) => {
  const [burial] = await db.insert(burialsTable).values(req.body).returning();
  res.status(201).json(burial);
});

router.get("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [burial] = await db.select().from(burialsTable).where(eq(burialsTable.id, id));
  if (!burial) return res.status(404).json({ error: "Not found" });
  res.json(burial);
});

router.put("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [burial] = await db.update(burialsTable).set(req.body).where(eq(burialsTable.id, id)).returning();
  if (!burial) return res.status(404).json({ error: "Not found" });
  res.json(burial);
});

router.delete("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(burialsTable).where(eq(burialsTable.id, id));
  res.status(204).send();
});

export default router;
