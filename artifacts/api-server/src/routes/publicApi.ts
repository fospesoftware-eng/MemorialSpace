import { Router } from "express";
import { db } from "@workspace/db";
import { burialsTable, plotsTable, organizationsTable, memorialsTable, obituariesTable } from "@workspace/db";
import { ilike, eq, and, inArray, desc } from "drizzle-orm";

const router = Router();

router.get("/public/search", async (req, res) => {
  const { q, organizationId } = req.query;
  if (!q || typeof q !== "string" || q.trim().length < 2) {
    res.json([]);
    return;
  }

  const searchTerm = `%${q.trim()}%`;
  const burials = await db
    .select()
    .from(burialsTable)
    .where(
      organizationId
        ? and(ilike(burialsTable.deceasedName, searchTerm), eq(burialsTable.organizationId, Number(organizationId)))
        : ilike(burialsTable.deceasedName, searchTerm),
    )
    .limit(20);

  if (burials.length === 0) { res.json([]); return; }

  // Batch all related lookups so search is O(1) round-trips instead of O(N).
  const plotIds = Array.from(new Set(burials.map((b) => b.plotId).filter(Boolean) as number[]));
  const orgIds = Array.from(new Set(burials.map((b) => b.organizationId)));
  const burialIds = burials.map((b) => b.id);

  const [plots, orgs, memorials] = await Promise.all([
    plotIds.length
      ? db.select().from(plotsTable).where(inArray(plotsTable.id, plotIds))
      : Promise.resolve([] as Array<typeof plotsTable.$inferSelect>),
    orgIds.length
      ? db.select().from(organizationsTable).where(inArray(organizationsTable.id, orgIds))
      : Promise.resolve([] as Array<typeof organizationsTable.$inferSelect>),
    burialIds.length
      ? db.select().from(memorialsTable).where(inArray(memorialsTable.burialId, burialIds))
      : Promise.resolve([] as Array<typeof memorialsTable.$inferSelect>),
  ]);

  const plotById = new Map(plots.map((p) => [p.id, p]));
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const memorialByBurial = new Map(memorials.map((m) => [m.burialId, m]));

  const results = burials
    .map((burial) => {
      const plot = plotById.get(burial.plotId);
      const org = orgById.get(burial.organizationId);
      const memorial = memorialByBurial.get(burial.id);
      return {
        burial,
        plot,
        organization: org,
        memorial: memorial
          ? { ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] }
          : undefined,
      };
    })
    .filter((r) => r.plot && r.organization);

  res.json(results);
});

router.get("/public/obituaries", async (req, res) => {
  const { organizationId } = req.query;
  const conditions = [eq(obituariesTable.isPublished, true)];
  if (organizationId) conditions.push(eq(obituariesTable.organizationId, Number(organizationId)));
  const obituaries = await db
    .select()
    .from(obituariesTable)
    .where(and(...conditions))
    .orderBy(desc(obituariesTable.id))
    .limit(100);
  res.json(obituaries);
});

export default router;
