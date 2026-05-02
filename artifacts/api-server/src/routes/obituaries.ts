import { Router } from "express";
import { db } from "@workspace/db";
import { obituariesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/obituaries", async (req, res) => {
  const { organizationId, published } = req.query;
  const conditions = [];
  if (organizationId) conditions.push(eq(obituariesTable.organizationId, Number(organizationId)));
  if (published !== undefined) conditions.push(eq(obituariesTable.isPublished, published === "true"));
  const obituaries = conditions.length
    ? await db.select().from(obituariesTable).where(and(...conditions))
    : await db.select().from(obituariesTable);
  res.json(obituaries);
});

router.post("/obituaries", async (req, res) => {
  const { isPublished, ...rest } = req.body;
  const publishedAt = isPublished ? new Date() : null;
  const [obituary] = await db.insert(obituariesTable).values({ ...rest, isPublished, publishedAt }).returning();
  res.status(201).json(obituary);
});

router.get("/obituaries/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [obituary] = await db.select().from(obituariesTable).where(eq(obituariesTable.id, id));
  if (!obituary) return res.status(404).json({ error: "Not found" });
  res.json(obituary);
});

router.put("/obituaries/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { isPublished, ...rest } = req.body;
  const existing = await db.select().from(obituariesTable).where(eq(obituariesTable.id, id));
  const publishedAt = isPublished && !existing[0]?.publishedAt ? new Date() : existing[0]?.publishedAt;
  const [obituary] = await db.update(obituariesTable).set({ ...rest, isPublished, publishedAt }).where(eq(obituariesTable.id, id)).returning();
  if (!obituary) return res.status(404).json({ error: "Not found" });
  res.json(obituary);
});

router.delete("/obituaries/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(obituariesTable).where(eq(obituariesTable.id, id));
  res.status(204).send();
});

export default router;
