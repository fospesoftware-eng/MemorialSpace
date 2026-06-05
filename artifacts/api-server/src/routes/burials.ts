import { Router } from "express";
import { db } from "@workspace/db";
import { burialsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { readPage } from "../lib/pagination";

const router = Router();

router.get("/burials", async (req, res) => {
  const { organizationId, plotId } = req.query;
  const { limit, offset } = readPage(req, { defaultLimit: 200, maxLimit: 1000 });
  const conditions = [];
  if (organizationId) conditions.push(eq(burialsTable.organizationId, Number(organizationId)));
  if (plotId) conditions.push(eq(burialsTable.plotId, Number(plotId)));
  const q = db.select().from(burialsTable).orderBy(desc(burialsTable.id)).limit(limit).offset(offset);
  const burials = conditions.length ? await q.where(and(...conditions)) : await q;
  const result = burials.map((b) => ({
    ...b,
    headstoneImages: (() => {
      try {
        return b.headstoneImages ? JSON.parse(b.headstoneImages) : [];
      } catch {
        return b.photoUrl ? [b.photoUrl] : [];
      }
    })(),
  }));
  res.json(result);
});

router.post("/burials", async (req, res) => {
  const [burial] = await db.insert(burialsTable).values(req.body).returning();
  res.status(201).json(burial);
});

router.get("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [burial] = await db.select().from(burialsTable).where(eq(burialsTable.id, id));
  if (!burial) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    ...burial,
    headstoneImages: (() => {
      try {
        return burial.headstoneImages ? JSON.parse(burial.headstoneImages) : [];
      } catch {
        return burial.photoUrl ? [burial.photoUrl] : [];
      }
    })(),
  });
});

router.put("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [burial] = await db.update(burialsTable).set(req.body).where(eq(burialsTable.id, id)).returning();
  if (!burial) { res.status(404).json({ error: "Not found" }); return; }
  res.json(burial);
});

router.delete("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(burialsTable).where(eq(burialsTable.id, id));
  res.status(204).send();
});

export default router;
