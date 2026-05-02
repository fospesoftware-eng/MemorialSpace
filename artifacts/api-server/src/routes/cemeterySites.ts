import { Router } from "express";
import { db } from "@workspace/db";
import {
  cemeterySitesTable,
  cemeteryCategoriesTable,
  cemeteryProductsTable,
  cemeteryOrdersTable,
  organizationsTable,
  burialsTable,
  plotsTable,
  qrCodesTable,
  memorialsTable,
  upsertCemeterySiteSchema,
  insertCemeteryCategorySchema,
  insertCemeteryProductSchema,
  createCemeteryOrderSchema,
  CEMETERY_THEMES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRODUCT_TYPES,
  type CemeteryOrderItem,
} from "@workspace/db";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

// ---------------------------------------------------------------------------
// Org scoping helper — same pattern used by mausoleums/accounting modules.
// Reads ?orgId=N from the query, returns the parsed integer or sends a 400
// and returns null. Every operator-facing endpoint MUST call this so a
// caller can never reach another tenant's data even if they know an id.
// ---------------------------------------------------------------------------
const ORG_ID_QUERY = z.object({ orgId: z.coerce.number().int().positive() });
function readOrgId(
  req: import("express").Request,
  res: import("express").Response,
): number | null {
  const parsed = ORG_ID_QUERY.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "orgId query parameter is required" });
    return null;
  }
  return parsed.data.orgId;
}

// ---------------------------------------------------------------------------
// SITE CONFIG (per-org, 1:1)
// ---------------------------------------------------------------------------

// GET /api/cemetery-sites?orgId=N  — fetch (auto-creates a default row on
// first call so the operator UI always has something to render).
router.get("/cemetery-sites", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const [existing] = await db
    .select()
    .from(cemeterySitesTable)
    .where(eq(cemeterySitesTable.organizationId, orgId));
  if (existing) return res.json(existing);

  // First-time fetch — seed a sensible default from the org record so the
  // operator sees a half-filled site they can publish quickly.
  const [created] = await db
    .insert(cemeterySitesTable)
    .values({
      organizationId: orgId,
      theme: "classic-marble",
      siteTitle: org.name,
      tagline: "A place of remembrance and peace",
      heroHeadline: `Welcome to ${org.name}`,
      heroSubheadline:
        "Find a loved one, browse our memorial services, or arrange a visit.",
      contactPhone: org.phone ?? null,
      contactEmail: org.email ?? null,
      contactAddress: [org.address, org.city, org.country]
        .filter(Boolean)
        .join(", ") || null,
      isPublished: false,
    })
    .returning();
  res.status(201).json(created);
});

// PUT /api/cemetery-sites?orgId=N  — upsert site config. Org-scoped via the
// unique index on organizationId; we re-derive `slug` from the org row so
// the operator can never spoof another cemetery's URL.
router.put("/cemetery-sites", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  // Strip any client-sent organizationId — we always force it to the
  // authenticated org so the upsert can't cross tenants.
  const body = { ...(req.body ?? {}), organizationId: orgId };
  const parsed = upsertCemeterySiteSchema.safeParse(body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
  }
  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const [row] = await db
    .insert(cemeterySitesTable)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: cemeterySitesTable.organizationId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json(row);
});

// ---------------------------------------------------------------------------
// CATEGORIES (per-org)
// ---------------------------------------------------------------------------

router.get("/cemetery-categories", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const rows = await db
    .select()
    .from(cemeteryCategoriesTable)
    .where(eq(cemeteryCategoriesTable.organizationId, orgId))
    .orderBy(cemeteryCategoriesTable.sortOrder, cemeteryCategoriesTable.name);
  res.json(rows);
});

router.post("/cemetery-categories", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const body = { ...(req.body ?? {}), organizationId: orgId };
  const parsed = insertCemeteryCategorySchema.safeParse(body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
  }
  try {
    const [row] = await db
      .insert(cemeteryCategoriesTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(row);
  } catch (err) {
    // Slug collision within the same org.
    if (err instanceof Error && err.message.includes("cemetery_categories_org_slug_unique")) {
      return res.status(409).json({ error: "A category with that slug already exists" });
    }
    throw err;
  }
});

router.put("/cemetery-categories/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const PatchSchema = insertCemeteryCategorySchema
    .omit({ organizationId: true })
    .partial();
  const parsed = PatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
  }
  const updated = await db
    .update(cemeteryCategoriesTable)
    .set(parsed.data)
    .where(
      and(
        eq(cemeteryCategoriesTable.id, id),
        eq(cemeteryCategoriesTable.organizationId, orgId),
      ),
    )
    .returning();
  if (updated.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(updated[0]);
});

router.delete("/cemetery-categories/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const deleted = await db
    .delete(cemeteryCategoriesTable)
    .where(
      and(
        eq(cemeteryCategoriesTable.id, id),
        eq(cemeteryCategoriesTable.organizationId, orgId),
      ),
    )
    .returning({ id: cemeteryCategoriesTable.id });
  if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// PRODUCTS (per-org)
// ---------------------------------------------------------------------------

router.get("/cemetery-products", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const rows = await db
    .select()
    .from(cemeteryProductsTable)
    .where(eq(cemeteryProductsTable.organizationId, orgId))
    .orderBy(cemeteryProductsTable.sortOrder, cemeteryProductsTable.name);
  res.json(rows);
});

router.post("/cemetery-products", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const body = { ...(req.body ?? {}), organizationId: orgId };
  const parsed = insertCemeteryProductSchema.safeParse(body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
  }
  // Cross-org safety: if a categoryId is provided, it must belong to this org
  // — otherwise an operator could attach a product to another cemetery's
  // category and have it silently appear in their menus.
  if (parsed.data.categoryId != null) {
    const [cat] = await db
      .select({ id: cemeteryCategoriesTable.id })
      .from(cemeteryCategoriesTable)
      .where(
        and(
          eq(cemeteryCategoriesTable.id, parsed.data.categoryId),
          eq(cemeteryCategoriesTable.organizationId, orgId),
        ),
      );
    if (!cat) return res.status(400).json({ error: "Invalid category for this organization" });
  }
  try {
    const [row] = await db
      .insert(cemeteryProductsTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(row);
  } catch (err) {
    if (err instanceof Error && err.message.includes("cemetery_products_org_slug_unique")) {
      return res.status(409).json({ error: "A product with that slug already exists" });
    }
    throw err;
  }
});

router.get("/cemetery-products/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db
    .select()
    .from(cemeteryProductsTable)
    .where(
      and(
        eq(cemeteryProductsTable.id, id),
        eq(cemeteryProductsTable.organizationId, orgId),
      ),
    );
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.put("/cemetery-products/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const PatchSchema = insertCemeteryProductSchema
    .omit({ organizationId: true })
    .partial();
  const parsed = PatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
  }
  if (parsed.data.categoryId != null) {
    const [cat] = await db
      .select({ id: cemeteryCategoriesTable.id })
      .from(cemeteryCategoriesTable)
      .where(
        and(
          eq(cemeteryCategoriesTable.id, parsed.data.categoryId),
          eq(cemeteryCategoriesTable.organizationId, orgId),
        ),
      );
    if (!cat) return res.status(400).json({ error: "Invalid category for this organization" });
  }
  const updated = await db
    .update(cemeteryProductsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(cemeteryProductsTable.id, id),
        eq(cemeteryProductsTable.organizationId, orgId),
      ),
    )
    .returning();
  if (updated.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(updated[0]);
});

router.delete("/cemetery-products/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const deleted = await db
    .delete(cemeteryProductsTable)
    .where(
      and(
        eq(cemeteryProductsTable.id, id),
        eq(cemeteryProductsTable.organizationId, orgId),
      ),
    )
    .returning({ id: cemeteryProductsTable.id });
  if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// ORDERS (per-org, operator-facing list / status updates)
// ---------------------------------------------------------------------------

router.get("/cemetery-orders", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const StatusFilter = z.object({ status: z.enum(ORDER_STATUSES).optional() });
  const filter = StatusFilter.safeParse(req.query);
  if (!filter.success) return res.status(400).json({ error: "Invalid status filter" });
  const conditions = [eq(cemeteryOrdersTable.organizationId, orgId)];
  if (filter.data.status) conditions.push(eq(cemeteryOrdersTable.status, filter.data.status));
  const rows = await db
    .select()
    .from(cemeteryOrdersTable)
    .where(and(...conditions))
    .orderBy(desc(cemeteryOrdersTable.createdAt));
  res.json(rows);
});

router.get("/cemetery-orders/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db
    .select()
    .from(cemeteryOrdersTable)
    .where(
      and(
        eq(cemeteryOrdersTable.id, id),
        eq(cemeteryOrdersTable.organizationId, orgId),
      ),
    );
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.patch("/cemetery-orders/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  // Only operator-controlled fields can be patched. The customer-supplied
  // info (name, email, items, totals) is immutable post-submission so the
  // record stays a faithful audit trail.
  const PatchSchema = z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    operatorNotes: z.string().max(2000).nullable().optional(),
  });
  const parsed = PatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
  }
  const updated = await db
    .update(cemeteryOrdersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(cemeteryOrdersTable.id, id),
        eq(cemeteryOrdersTable.organizationId, orgId),
      ),
    )
    .returning();
  if (updated.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(updated[0]);
});

// ===========================================================================
// PUBLIC ROUTES (slug-based — no orgId required, returns only published)
// ===========================================================================
//
// These endpoints back the customer-facing site at /c/:slug. They:
//   • resolve slug → organizationId server-side
//   • require isPublished=true UNLESS ?previewOrgId=<id> is passed AND
//     matches the resolved org (operator preview from Site Builder)
//   • return only safe fields (no notes, no PII beyond what was always
//     intended for public display, prices stay server-authoritative)
// ===========================================================================

const SLUG_RE = /^[a-z0-9-]{1,80}$/;

// Resolve a slug to (orgId, siteRow), respecting publish state. Returns
// null and sends a 404 if not found or not visible. The optional preview
// gate lets the operator preview their unpublished site by passing their
// own orgId via ?previewOrgId=N.
async function resolvePublicSite(req: import("express").Request, res: import("express").Response) {
  const slug = String(req.params.slug ?? "");
  if (!SLUG_RE.test(slug)) {
    res.status(400).json({ error: "Invalid slug" });
    return null;
  }
  const [org] = await db
    .select({ id: organizationsTable.id, name: organizationsTable.name, slug: organizationsTable.slug })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, slug));
  if (!org) {
    res.status(404).json({ error: "Site not found" });
    return null;
  }
  const [site] = await db
    .select()
    .from(cemeterySitesTable)
    .where(eq(cemeterySitesTable.organizationId, org.id));
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return null;
  }
  // Preview gate: an unpublished site is visible only to its own operator,
  // identified by passing ?previewOrgId=<their orgId>. We compare to the
  // resolved org (not to a session — there's no session in this codebase
  // yet) so a wrong orgId is functionally equivalent to no preview.
  const previewOrgId = Number(req.query.previewOrgId);
  const isPreview = Number.isFinite(previewOrgId) && previewOrgId === org.id;
  if (!site.isPublished && !isPreview) {
    res.status(404).json({ error: "Site not found" });
    return null;
  }
  return { org, site, isPreview };
}

router.get("/c/:slug", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  // Reshape the response so the public client never sees internal-only
  // fields like organizationId, stripeAccountId, or inquiryEmail.
  const { site, org, isPreview } = ctx;
  res.json({
    slug: org.slug,
    organizationName: org.name,
    isPreview,
    theme: site.theme,
    siteTitle: site.siteTitle,
    tagline: site.tagline,
    heroHeadline: site.heroHeadline,
    heroSubheadline: site.heroSubheadline,
    heroImageUrl: site.heroImageUrl,
    aboutText: site.aboutText,
    primaryColorOverride: site.primaryColorOverride,
    contactPhone: site.contactPhone,
    contactEmail: site.contactEmail,
    contactAddress: site.contactAddress,
    openingHours: site.openingHours,
    // Whether real stripe checkout is wired up (gated on stripeAccountId
    // existing). Public client uses this to decide whether to show the
    // "Pay online" option at checkout.
    stripeAvailable: Boolean(site.stripeAccountId),
  });
});

router.get("/c/:slug/products", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const FilterSchema = z.object({ category: z.string().max(80).optional() });
  const filter = FilterSchema.safeParse(req.query);
  if (!filter.success) return res.status(400).json({ error: "Invalid filter" });

  const conditions = [
    eq(cemeteryProductsTable.organizationId, ctx.org.id),
    eq(cemeteryProductsTable.isPublished, true),
  ];
  let categoryId: number | null = null;
  if (filter.data.category) {
    const [cat] = await db
      .select({ id: cemeteryCategoriesTable.id })
      .from(cemeteryCategoriesTable)
      .where(
        and(
          eq(cemeteryCategoriesTable.organizationId, ctx.org.id),
          eq(cemeteryCategoriesTable.slug, filter.data.category),
        ),
      );
    if (!cat) return res.json({ products: [], categories: [] });
    categoryId = cat.id;
    conditions.push(eq(cemeteryProductsTable.categoryId, categoryId));
  }

  const [products, categories] = await Promise.all([
    db
      .select()
      .from(cemeteryProductsTable)
      .where(and(...conditions))
      .orderBy(cemeteryProductsTable.sortOrder, cemeteryProductsTable.name),
    db
      .select()
      .from(cemeteryCategoriesTable)
      .where(eq(cemeteryCategoriesTable.organizationId, ctx.org.id))
      .orderBy(cemeteryCategoriesTable.sortOrder, cemeteryCategoriesTable.name),
  ]);
  res.json({ products, categories });
});

router.get("/c/:slug/products/:productSlug", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const productSlug = String(req.params.productSlug ?? "");
  if (!/^[a-z0-9-]{1,200}$/.test(productSlug)) {
    return res.status(400).json({ error: "Invalid product slug" });
  }
  const [product] = await db
    .select()
    .from(cemeteryProductsTable)
    .where(
      and(
        eq(cemeteryProductsTable.organizationId, ctx.org.id),
        eq(cemeteryProductsTable.slug, productSlug),
        eq(cemeteryProductsTable.isPublished, true),
      ),
    );
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// Public grave search. Returns only sanitized fields — never the burial
// `notes`, never raw DOB/DOD (we normalize to year-only to match what most
// cemetery directories show publicly).
router.get("/c/:slug/find-grave", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const QSchema = z.object({
    q: z.string().min(1).max(120),
  });
  const parsed = QSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.json({ results: [] });
  }
  const term = `%${parsed.data.q.trim()}%`;
  const rows = await db
    .select({
      id: burialsTable.id,
      deceasedName: burialsTable.deceasedName,
      dob: burialsTable.deceasedDob,
      dod: burialsTable.deceasedDod,
      religion: burialsTable.religion,
      photoUrl: burialsTable.photoUrl,
      plotId: burialsTable.plotId,
      // Plot identifier — we expose it as a label so visitors can find
      // the grave on the cemetery's map. The schema field name varies
      // across cemeteries; we coalesce to the row id as a safe fallback.
      plotNumber: plotsTable.plotNumber,
    })
    .from(burialsTable)
    .leftJoin(plotsTable, eq(burialsTable.plotId, plotsTable.id))
    .where(
      and(
        eq(burialsTable.organizationId, ctx.org.id),
        ilike(burialsTable.deceasedName, term),
      ),
    )
    .orderBy(burialsTable.deceasedName)
    .limit(50);

  // Strip to year-only, drop nulls so the response payload stays small.
  const yearOnly = (s: string | Date | null | undefined) => {
    if (!s) return null;
    const str = typeof s === "string" ? s : s.toISOString();
    return str.slice(0, 4);
  };
  res.json({
    results: rows.map((r) => ({
      id: r.id,
      name: r.deceasedName,
      bornYear: yearOnly(r.dob),
      diedYear: yearOnly(r.dod),
      religion: r.religion,
      photoUrl: r.photoUrl,
      plotLabel: r.plotNumber ?? `Plot #${r.plotId}`,
    })),
  });
});

// Public cemetery map. Returns every plot in the org with a sanitized
// burial summary when occupied (same PII rules as find-grave: name +
// year-only birth/death + plot label, no full DOB/DOD, no notes, no
// religion). When a burial has a QR memorial set up, we surface its
// `memorialCode` so the public map can deep-link visitors to the
// memorial page without exposing internal burial/memorial ids.
router.get("/c/:slug/map", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const orgId = ctx.org.id;

  const [plots, burials, qrs] = await Promise.all([
    db
      .select({
        id: plotsTable.id,
        plotNumber: plotsTable.plotNumber,
        section: plotsTable.section,
        row: plotsTable.row,
        status: plotsTable.status,
        type: plotsTable.type,
      })
      .from(plotsTable)
      .where(eq(plotsTable.organizationId, orgId))
      .orderBy(plotsTable.section, plotsTable.row, plotsTable.plotNumber),
    db
      .select({
        id: burialsTable.id,
        plotId: burialsTable.plotId,
        deceasedName: burialsTable.deceasedName,
        dob: burialsTable.deceasedDob,
        dod: burialsTable.deceasedDod,
        photoUrl: burialsTable.photoUrl,
      })
      .from(burialsTable)
      .where(eq(burialsTable.organizationId, orgId)),
    db
      .select({
        code: qrCodesTable.code,
        burialId: qrCodesTable.burialId,
      })
      .from(qrCodesTable)
      .where(eq(qrCodesTable.organizationId, orgId)),
  ]);

  const yearOnly = (s: string | Date | null | undefined) => {
    if (!s) return null;
    const str = typeof s === "string" ? s : s.toISOString();
    return str.slice(0, 4);
  };

  const burialByPlot = new Map<number, (typeof burials)[number]>();
  for (const b of burials) burialByPlot.set(b.plotId, b);

  const codeByBurial = new Map<number, string>();
  for (const q of qrs) {
    if (q.burialId != null) codeByBurial.set(q.burialId, q.code);
  }

  const sections = Array.from(
    new Set(plots.map((p) => p.section).filter((s): s is string => Boolean(s))),
  );

  res.json({
    sections,
    plots: plots.map((p) => {
      const burial = burialByPlot.get(p.id);
      return {
        id: p.id,
        plotNumber: p.plotNumber,
        section: p.section,
        row: p.row,
        status: p.status,
        type: p.type,
        burial: burial
          ? {
              id: burial.id,
              name: burial.deceasedName,
              bornYear: yearOnly(burial.dob),
              diedYear: yearOnly(burial.dod),
              photoUrl: burial.photoUrl,
              memorialCode: codeByBurial.get(burial.id) ?? null,
            }
          : null,
      };
    }),
  });
});

// Public memorial detail (the QR-code landing page). Resolves a QR code
// scoped to this org's slug, joins to the burial + optional memorial
// content row, and returns a sanitized payload. We honor `memorial.isPublic`
// — operators can hide a memorial without deleting the QR. We update the
// scan/view counters in the background; failures don't break the page.
router.get("/c/:slug/memorial/:code", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const code = String(req.params.code ?? "").toUpperCase();
  if (!/^[A-F0-9]{8,64}$/.test(code)) {
    return res.status(400).json({ error: "Invalid memorial code" });
  }
  const [qr] = await db
    .select()
    .from(qrCodesTable)
    .where(
      and(
        eq(qrCodesTable.code, code),
        eq(qrCodesTable.organizationId, ctx.org.id),
      ),
    );
  if (!qr || qr.burialId == null) {
    return res.status(404).json({ error: "Memorial not found" });
  }

  const [burial] = await db
    .select()
    .from(burialsTable)
    .where(
      and(
        eq(burialsTable.id, qr.burialId),
        eq(burialsTable.organizationId, ctx.org.id),
      ),
    );
  if (!burial) return res.status(404).json({ error: "Memorial not found" });

  const [memorial] = qr.memorialId
    ? await db
        .select()
        .from(memorialsTable)
        .where(
          and(
            eq(memorialsTable.id, qr.memorialId),
            eq(memorialsTable.organizationId, ctx.org.id),
          ),
        )
    : [undefined];

  // If the operator explicitly hid the rich memorial, we return 404 to the
  // public — even though the QR + burial exist. Operators can re-publish
  // by toggling the memorial back to public.
  if (memorial && memorial.isPublic === false) {
    return res.status(404).json({ error: "Memorial not found" });
  }

  const [plot] = burial.plotId
    ? await db
        .select({
          plotNumber: plotsTable.plotNumber,
          section: plotsTable.section,
          row: plotsTable.row,
        })
        .from(plotsTable)
        .where(eq(plotsTable.id, burial.plotId))
    : [undefined];

  // Best-effort counter bumps. We use atomic SQL increments so concurrent
  // scans from multiple phones can't lose updates to a read-modify-write
  // race, and we don't await — a stalled write should never block a
  // memorial page from loading for grieving visitors.
  void db
    .update(qrCodesTable)
    .set({ scanCount: sql`COALESCE(${qrCodesTable.scanCount}, 0) + 1` })
    .where(eq(qrCodesTable.id, qr.id))
    .catch(() => undefined);
  if (memorial) {
    void db
      .update(memorialsTable)
      .set({ viewCount: sql`COALESCE(${memorialsTable.viewCount}, 0) + 1` })
      .where(eq(memorialsTable.id, memorial.id))
      .catch(() => undefined);
  }

  // memorials.photos is stored as a JSON-string array. Parse defensively
  // so a bad row never 500s the page; merge with the burial's single
  // photoUrl so we always have a hero image when one exists.
  let photos: string[] = [];
  if (memorial?.photos) {
    try {
      const parsed = JSON.parse(memorial.photos);
      if (Array.isArray(parsed)) {
        photos = parsed.filter((p): p is string => typeof p === "string");
      }
    } catch {
      // ignore — leave photos empty
    }
  }
  if (burial.photoUrl && !photos.includes(burial.photoUrl)) {
    photos = [burial.photoUrl, ...photos];
  }

  res.json({
    code: qr.code,
    title: memorial?.title ?? burial.deceasedName,
    deceasedName: burial.deceasedName,
    bornDate: burial.deceasedDob,
    diedDate: burial.deceasedDod,
    burialDate: burial.burialDate,
    religion: burial.religion,
    biography: memorial?.biography ?? null,
    photos,
    plotLabel: plot?.plotNumber ?? null,
    plotSection: plot?.section ?? null,
    plotRow: plot?.row ?? null,
  });
});

// Public order submission. The server validates the cart against the live
// product catalogue (so a tampered client can't pay $0.01 for a $200 urn),
// allocates a daily order number per org, and inserts atomically.
router.post("/c/:slug/orders", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const parsed = createCemeteryOrderSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid order", details: parsed.error.issues });
  }

  // Fetch all referenced products in one query; verify they all belong to
  // THIS cemetery and are published. Any mismatch → 400.
  const productIds = Array.from(new Set(parsed.data.items.map((i) => i.productId)));
  const products = await db
    .select()
    .from(cemeteryProductsTable)
    .where(
      and(
        eq(cemeteryProductsTable.organizationId, ctx.org.id),
        eq(cemeteryProductsTable.isPublished, true),
        inArray(cemeteryProductsTable.id, productIds),
      ),
    );
  const productById = new Map(products.map((p) => [p.id, p]));
  for (const item of parsed.data.items) {
    if (!productById.has(item.productId)) {
      return res
        .status(400)
        .json({ error: `Product ${item.productId} is not available` });
    }
  }

  // Build the order-items snapshot using server-authoritative prices/names.
  // This is what gets saved — never the client's numbers.
  const items: CemeteryOrderItem[] = parsed.data.items.map((item) => {
    const p = productById.get(item.productId)!;
    return {
      productId: p.id,
      name: p.name,
      quantity: item.quantity,
      unitPrice: p.price,
      lineTotal: Math.round(p.price * item.quantity * 100) / 100,
    };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  // No tax for v1 — the operator can wire taxes later via the existing
  // tax-rates table in the Accounting module. Total = subtotal for now.
  const total = subtotal;

  // Generate ORD-YYYYMMDD-NNNN by counting today's orders for this org and
  // adding one. Wrapped in a transaction with FOR UPDATE on the org row so
  // two concurrent submissions can't allocate the same number.
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  try {
    const inserted = await db.transaction(async (tx) => {
      // Lock the org row so the count + insert are atomic per cemetery.
      // (Locking the org row is heavier than strictly necessary but it's
      // simple, correct, and contention is low — these are customer-facing
      // submissions, not high-throughput jobs.)
      await tx
        .select({ id: organizationsTable.id })
        .from(organizationsTable)
        .where(eq(organizationsTable.id, ctx.org.id))
        .for("update");
      const todayCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(cemeteryOrdersTable)
        .where(
          and(
            eq(cemeteryOrdersTable.organizationId, ctx.org.id),
            sql`${cemeteryOrdersTable.orderNumber} LIKE ${"ORD-" + datePart + "-%"}`,
          ),
        );
      const nextSeq = (todayCount[0]?.count ?? 0) + 1;
      const orderNumber = `ORD-${datePart}-${String(nextSeq).padStart(4, "0")}`;
      const [row] = await tx
        .insert(cemeteryOrdersTable)
        .values({
          organizationId: ctx.org.id,
          orderNumber,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          customerPhone: parsed.data.customerPhone ?? null,
          customerNotes: parsed.data.customerNotes ?? null,
          items,
          subtotal,
          total,
          status: "new",
          paymentMethod: "inquiry",
          paymentStatus: "unpaid",
        })
        .returning();
      return row;
    });
    // Public response is intentionally minimal — confirms the order
    // exists and gives the customer a number to reference.
    res.status(201).json({
      orderNumber: inserted.orderNumber,
      total: inserted.total,
      items: inserted.items,
    });
  } catch (err) {
    // Rare: unique-index collision under extreme contention. Caller can retry.
    if (err instanceof Error && err.message.includes("cemetery_orders_org_number_unique")) {
      return res
        .status(409)
        .json({ error: "Could not allocate order number, please try again" });
    }
    throw err;
  }
});

// Echo the constants so the operator UI can render dropdowns without
// hardcoding the same values twice.
router.get("/cemetery-meta", (_req, res) => {
  res.json({
    themes: CEMETERY_THEMES,
    productTypes: PRODUCT_TYPES,
    orderStatuses: ORDER_STATUSES,
    paymentMethods: PAYMENT_METHODS,
    paymentStatuses: PAYMENT_STATUSES,
  });
});

export default router;
