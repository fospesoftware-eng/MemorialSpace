import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/users", async (req, res) => {
  const { organizationId } = req.query;
  let query = db.select().from(usersTable);
  if (organizationId) {
    const users = await db.select().from(usersTable).where(eq(usersTable.organizationId, Number(organizationId)));
    return res.json(users);
  }
  const users = await query;
  res.json(users);
});

router.post("/users", async (req, res) => {
  const [user] = await db.insert(usersTable).values(req.body).returning();
  res.status(201).json(user);
});

router.get("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

router.put("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await db.update(usersTable).set(req.body).where(eq(usersTable.id, id)).returning();
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

router.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;
