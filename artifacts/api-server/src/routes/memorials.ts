import { Router } from "express";
import { db } from "@workspace/db";
import { memorialsTable, tributesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/memorials", async (req, res) => {
  const { organizationId } = req.query;
  const memorials = organizationId
    ? await db.select().from(memorialsTable).where(eq(memorialsTable.organizationId, Number(organizationId)))
    : await db.select().from(memorialsTable);
  const result = memorials.map((m) => ({
    ...m,
    photos: m.photos ? JSON.parse(m.photos) : [],
  }));
  res.json(result);
});

router.post("/memorials", async (req, res) => {
  const { photos, ...rest } = req.body;
  const [memorial] = await db.insert(memorialsTable).values({
    ...rest,
    photos: photos ? JSON.stringify(photos) : null,
  }).returning();
  res.status(201).json({ ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] });
});

router.get("/memorials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [memorial] = await db.select().from(memorialsTable).where(eq(memorialsTable.id, id));
  if (!memorial) return res.status(404).json({ error: "Not found" });
  res.json({ ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] });
});

router.put("/memorials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { photos, ...rest } = req.body;
  const [memorial] = await db.update(memorialsTable).set({
    ...rest,
    photos: photos ? JSON.stringify(photos) : null,
  }).where(eq(memorialsTable.id, id)).returning();
  if (!memorial) return res.status(404).json({ error: "Not found" });
  res.json({ ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] });
});

router.get("/memorials/:id/tributes", async (req, res) => {
  const memorialId = Number(req.params.id);
  const tributes = await db.select().from(tributesTable).where(eq(tributesTable.memorialId, memorialId));
  res.json(tributes);
});

router.post("/memorials/:id/tributes", async (req, res) => {
  const memorialId = Number(req.params.id);
  const [tribute] = await db.insert(tributesTable).values({ ...req.body, memorialId }).returning();
  res.status(201).json(tribute);
});

export default router;
