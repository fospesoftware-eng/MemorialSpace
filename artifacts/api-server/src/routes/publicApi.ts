import { Router } from "express";
import { db } from "@workspace/db";
import { burialsTable, plotsTable, organizationsTable, memorialsTable, obituariesTable } from "@workspace/db";
import { ilike, eq, and, or } from "drizzle-orm";

const router = Router();

router.get("/public/search", async (req, res) => {
  const { q, organizationId } = req.query;
  if (!q) return res.json([]);

  const searchTerm = `%${q}%`;
  const burials = await db
    .select()
    .from(burialsTable)
    .where(
      organizationId
        ? and(ilike(burialsTable.deceasedName, searchTerm), eq(burialsTable.organizationId, Number(organizationId)))
        : ilike(burialsTable.deceasedName, searchTerm)
    )
    .limit(20);

  const results = await Promise.all(
    burials.map(async (burial) => {
      const [plot] = await db.select().from(plotsTable).where(eq(plotsTable.id, burial.plotId));
      const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, burial.organizationId));
      const [memorial] = await db.select().from(memorialsTable).where(eq(memorialsTable.burialId, burial.id));
      return { burial, plot, organization: org, memorial: memorial ? { ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] } : undefined };
    })
  );

  res.json(results.filter((r) => r.plot && r.organization));
});

router.get("/public/obituaries", async (req, res) => {
  const { organizationId } = req.query;
  const conditions = [eq(obituariesTable.isPublished, true)];
  if (organizationId) conditions.push(eq(obituariesTable.organizationId, Number(organizationId)));
  const obituaries = await db.select().from(obituariesTable).where(and(...conditions));
  res.json(obituaries);
});

export default router;
