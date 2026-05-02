import { Router } from "express";
import { db } from "@workspace/db";
import { organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/organizations", async (req, res) => {
  const orgs = await db.select().from(organizationsTable).orderBy(organizationsTable.createdAt);
  res.json(orgs);
});

router.post("/organizations", async (req, res) => {
  const [org] = await db.insert(organizationsTable).values(req.body).returning();
  res.status(201).json(org);
});

router.get("/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id));
  if (!org) return res.status(404).json({ error: "Not found" });
  res.json(org);
});

router.put("/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [org] = await db.update(organizationsTable).set(req.body).where(eq(organizationsTable.id, id)).returning();
  if (!org) return res.status(404).json({ error: "Not found" });
  res.json(org);
});

router.delete("/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(organizationsTable).where(eq(organizationsTable.id, id));
  res.status(204).send();
});

export default router;
