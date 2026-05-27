import { Router } from "express";
import { db } from "@workspace/db";
import { organizationsTable, insertOrganizationSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Two cemetery types implicitly run a columbarium: the standalone "columbarium"
// type and "church" cemeteries that opted in. Anything else must be false so
// the UI can hide the module reliably.
function reconcileColumbariumFlag<T extends { cemeteryType?: string; featuresColumbarium?: boolean }>(
  patch: T,
): T {
  if (patch.cemeteryType === "columbarium") {
    return { ...patch, featuresColumbarium: true };
  }
  if (patch.cemeteryType && patch.cemeteryType !== "church") {
    return { ...patch, featuresColumbarium: false };
  }
  return patch;
}

router.get("/organizations", async (req, res) => {
  const orgs = await db.select().from(organizationsTable).orderBy(organizationsTable.createdAt);
  res.json(orgs);
});

router.post("/organizations", async (req, res) => {
  const parsed = insertOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }
  const values = reconcileColumbariumFlag(parsed.data);
  const [org] = await db.insert(organizationsTable).values(values).returning();
  res.status(201).json(org);
});

router.get("/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id));
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  res.json(org);
});

router.put("/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Updates are partial — accept the same keys as create, all optional.
  const PartialSchema = insertOrganizationSchema.partial();
  const parsed = PartialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }
  const values = reconcileColumbariumFlag(parsed.data);
  const [org] = await db
    .update(organizationsTable)
    .set(values)
    .where(eq(organizationsTable.id, id))
    .returning();
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  res.json(org);
});

router.delete("/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(organizationsTable).where(eq(organizationsTable.id, id));
  res.status(204).send();
});

export default router;
