import { Router, type RequestHandler } from "express";
import { db } from "@workspace/db";
import { memorialsTable, tributesTable, qrCodesTable, organizationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const publicRouter = Router();
const adminRouter = Router();

/* ------------------------------------------------------------------ */
/*  Scoped read helpers — family users see their org's memorials      */
/* ------------------------------------------------------------------ */

function orgScopedQuery(req: Parameters<RequestHandler>[0]) {
  const u = req.session?.user;
  // If a cemetery user is signed in, force their org scope.
  if (u?.kind === "cemetery" && u.organizationId) {
    return { organizationId: u.organizationId };
  }
  // If a family user is signed in, scope to their org.
  if (u?.kind === "family" && u.organizationId) {
    return { organizationId: u.organizationId };
  }
  // Anonymous — no org scope.
  return { organizationId: undefined };
}

function isAuthorizedToRead(memorial: typeof memorialsTable.$inferSelect, req: Parameters<RequestHandler>[0]) {
  const u = req.session?.user;
  // Public memorials are readable by anyone
  if (memorial.isPublic) return true;
  // Signed-in users can read memorials in their own org
  if (u?.organizationId && memorial.organizationId === u.organizationId) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/*  Public reads — visibility-gated                                  */
/* ------------------------------------------------------------------ */

publicRouter.get("/memorials", async (req, res) => {
  const { organizationId } = orgScopedQuery(req);
  if (!organizationId) {
    // Anonymous: only public memorials
    const memorials = await db.select().from(memorialsTable).where(eq(memorialsTable.isPublic, true));
    return res.json(memorials.map((m) => ({
      ...m,
      photos: m.photos ? JSON.parse(m.photos) : [],
    })));
  }
  // Signed-in: scope to their org (both public and private)
  const rows = await db
    .select({
      memorial: memorialsTable,
      qrCode: qrCodesTable.code,
      orgSlug: organizationsTable.slug,
    })
    .from(memorialsTable)
    .leftJoin(qrCodesTable, and(
      eq(qrCodesTable.memorialId, memorialsTable.id),
      eq(qrCodesTable.organizationId, memorialsTable.organizationId),
    ))
    .leftJoin(organizationsTable, eq(organizationsTable.id, memorialsTable.organizationId))
    .where(eq(memorialsTable.organizationId, organizationId));

  // Deduplicate: one memorial row even if multiple QR codes are linked.
  const seen = new Set<number>();
  return res.json(rows
    .filter((r) => {
      if (seen.has(r.memorial.id)) return false;
      seen.add(r.memorial.id);
      return true;
    })
    .map((r) => ({
      ...r.memorial,
      photos: r.memorial.photos ? JSON.parse(r.memorial.photos) : [],
      qrCode: r.qrCode ?? null,
      orgSlug: r.orgSlug ?? null,
    })));
});

// Look up a memorial by QR code string — used by /memorial/:code public URLs
// for orgs that have no slug. The code is always stored uppercased.
publicRouter.get("/memorial/by-code/:code", async (req, res) => {
  const code = String(req.params.code ?? "").toUpperCase();
  if (!/^[A-Z0-9]{8,64}$/.test(code)) {
    res.status(400).json({ error: "Invalid memorial code" });
    return;
  }
  const [qr] = await db
    .select()
    .from(qrCodesTable)
    .where(eq(qrCodesTable.code, code));
  if (!qr || qr.memorialId == null) {
    res.status(404).json({ error: "Memorial not found" });
    return;
  }
  const [memorial] = await db
    .select()
    .from(memorialsTable)
    .where(eq(memorialsTable.id, qr.memorialId));
  if (!memorial) { res.status(404).json({ error: "Memorial not found" }); return; }
  if (!isAuthorizedToRead(memorial, req)) { res.status(403).json({ error: "Access denied" }); return; }
  res.json({ ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] });
});

publicRouter.get("/memorials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [memorial] = await db.select().from(memorialsTable).where(eq(memorialsTable.id, id));
  if (!memorial) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAuthorizedToRead(memorial, req)) { res.status(403).json({ error: "Access denied" }); return; }
  res.json({ ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] });
});

publicRouter.get("/memorials/:id/tributes", async (req, res) => {
  const id = Number(req.params.id);
  const [memorial] = await db.select().from(memorialsTable).where(eq(memorialsTable.id, id));
  if (!memorial) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAuthorizedToRead(memorial, req)) { res.status(403).json({ error: "Access denied" }); return; }
  const tributes = await db.select().from(tributesTable).where(eq(tributesTable.memorialId, id));
  res.json(tributes);
});

publicRouter.post("/memorials/:id/tributes", async (req, res) => {
  const id = Number(req.params.id);
  const [memorial] = await db.select().from(memorialsTable).where(eq(memorialsTable.id, id));
  if (!memorial) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAuthorizedToRead(memorial, req)) { res.status(403).json({ error: "Access denied" }); return; }
  const [tribute] = await db.insert(tributesTable).values({ ...req.body, memorialId: id }).returning();
  res.status(201).json(tribute);
});

/* ------------------------------------------------------------------ */
/*  Admin writes — restricted to cemetery operators (requireOrgUser)    */
/* ------------------------------------------------------------------ */

adminRouter.post("/memorials", async (req, res) => {
  const { photos, ...rest } = req.body;
  const [memorial] = await db.insert(memorialsTable).values({
    ...rest,
    photos: photos ? JSON.stringify(photos) : null,
  }).returning();
  res.status(201).json({ ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] });
});

adminRouter.put("/memorials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const u = req.session?.user;
  const { photos, ...rest } = req.body;
  // Cross-tenant guard: only update rows that belong to the user's org.
  const whereClause = u?.organizationId
    ? and(eq(memorialsTable.id, id), eq(memorialsTable.organizationId, u.organizationId))
    : eq(memorialsTable.id, id);
  const [memorial] = await db.update(memorialsTable).set({
    ...rest,
    photos: photos ? JSON.stringify(photos) : null,
  }).where(whereClause).returning();
  if (!memorial) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...memorial, photos: memorial.photos ? JSON.parse(memorial.photos) : [] });
});

export { publicRouter, adminRouter };
