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
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  const [existing] = await db
    .select()
    .from(cemeterySitesTable)
    .where(eq(cemeterySitesTable.organizationId, orgId));
  if (existing) { res.json(existing); return; }

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
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }
  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

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
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
    return;
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
      res.status(409).json({ error: "A category with that slug already exists" });
      return;
    }
    throw err;
  }
});

router.put("/cemetery-categories/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const PatchSchema = insertCemeteryCategorySchema
    .omit({ organizationId: true })
    .partial();
  const parsed = PatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
    return;
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
  if (updated.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated[0]);
});

router.delete("/cemetery-categories/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const deleted = await db
    .delete(cemeteryCategoriesTable)
    .where(
      and(
        eq(cemeteryCategoriesTable.id, id),
        eq(cemeteryCategoriesTable.organizationId, orgId),
      ),
    )
    .returning({ id: cemeteryCategoriesTable.id });
  if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
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
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
    return;
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
    if (!cat) { res.status(400).json({ error: "Invalid category for this organization" }); return; }
  }
  try {
    const [row] = await db
      .insert(cemeteryProductsTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(row);
  } catch (err) {
    if (err instanceof Error && err.message.includes("cemetery_products_org_slug_unique")) {
      res.status(409).json({ error: "A product with that slug already exists" });
      return;
    }
    throw err;
  }
});

router.get("/cemetery-products/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .select()
    .from(cemeteryProductsTable)
    .where(
      and(
        eq(cemeteryProductsTable.id, id),
        eq(cemeteryProductsTable.organizationId, orgId),
      ),
    );
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/cemetery-products/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const PatchSchema = insertCemeteryProductSchema
    .omit({ organizationId: true })
    .partial();
  const parsed = PatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
    return;
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
    if (!cat) { res.status(400).json({ error: "Invalid category for this organization" }); return; }
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
  if (updated.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated[0]);
});

router.delete("/cemetery-products/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const deleted = await db
    .delete(cemeteryProductsTable)
    .where(
      and(
        eq(cemeteryProductsTable.id, id),
        eq(cemeteryProductsTable.organizationId, orgId),
      ),
    )
    .returning({ id: cemeteryProductsTable.id });
  if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
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
  if (!filter.success) { res.status(400).json({ error: "Invalid status filter" }); return; }
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
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .select()
    .from(cemeteryOrdersTable)
    .where(
      and(
        eq(cemeteryOrdersTable.id, id),
        eq(cemeteryOrdersTable.organizationId, orgId),
      ),
    );
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.patch("/cemetery-orders/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
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
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.issues });
    return;
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
  if (updated.length === 0) { res.status(404).json({ error: "Not found" }); return; }
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
  if (!filter.success) { res.status(400).json({ error: "Invalid filter" }); return; }

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
    if (!cat) { res.json({ products: [], categories: [] }); return; }
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
    res.status(400).json({ error: "Invalid product slug" });
    return;
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
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
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
    res.json({ results: [] });
    return;
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
  // Memorial GET responses vary by the unlock PIN supplied via header, and
  // returning a stale "unlocked" payload to a later anonymous visitor would
  // be a privacy regression. Disable shared/private caching unconditionally
  // and declare Vary so any well-behaved cache that does honor it keys per
  // PIN. We never want this endpoint cached across visitors.
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "x-edit-pin");

  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const code = String(req.params.code ?? "").toUpperCase();
  if (!/^[A-Z0-9]{8,64}$/.test(code)) {
    res.status(400).json({ error: "Invalid memorial code" });
    return;
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
    res.status(404).json({ error: "Memorial not found" });
    return;
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
  if (!burial) { res.status(404).json({ error: "Memorial not found" }); return; }

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
    res.status(404).json({ error: "Memorial not found" });
    return;
  }

  // Privacy mode — derived from the memorial row (defaults to "open" when
  // the memorial doesn't exist yet, since there's nothing private to hide).
  const visibility: "open" | "basic" | "private" =
    memorial?.visibility === "basic" || memorial?.visibility === "private"
      ? memorial.visibility
      : "open";

  // Optional unlock PIN — only accepted via the `x-edit-pin` header so the
  // secret never appears in URLs, server access logs, proxy logs, or
  // observability traces. (We deliberately removed query-string support;
  // since this PIN doubles as the edit credential, leaking it via a logged
  // URL would also enable memorial vandalism.)
  const submittedReadPin =
    typeof req.headers["x-edit-pin"] === "string"
      ? String(req.headers["x-edit-pin"])
      : "";
  let pinUnlocked = false;
  if (submittedReadPin && qr.editPin) {
    // Share the bucket with PATCH (`${ip}:${code}`) so wrong-PIN attempts
    // across read+edit consume one combined 5-per-15min budget. A separate
    // `:read` bucket would have doubled the attacker's effective budget.
    const rlKey = `${req.ip ?? "unknown"}:${code}`;
    if (submittedReadPin.trim() === qr.editPin) {
      pinUnlocked = true;
      resetEditPinRateLimit(rlKey);
    } else {
      // Wrong PIN — count and enforce. The PIN keyspace is 6 digits (10^6)
      // so without throttling the QR alone would let an attacker brute the
      // edit credential in seconds. We allow 5 attempts per 15min per
      // (ip + code) and otherwise 429 with Retry-After. This is the same
      // budget as the PATCH so an attacker can't spend two pools.
      const rl = checkEditPinRateLimit(rlKey);
      if (!rl.ok) {
        // `retryAfter` is already in seconds (see checkEditPinRateLimit).
        res.setHeader("Retry-After", String(rl.retryAfter));
        res.status(429).json({ error: "Too many PIN attempts. Please try again later." });
        return;
      }
    }
  }

  // Hard private gate — return a minimal payload so the frontend can render
  // an unlock prompt. We deliberately respond 200 (not 401) so the page
  // still renders shell + form without the query erroring out.
  if (visibility === "private" && !pinUnlocked) {
    res.json({
      code: qr.code,
      memorialId: memorial?.id ?? null,
      visibility,
      locked: true,
      title: null,
      deceasedName: null,
      bornDate: null,
      diedDate: null,
      burialDate: null,
      religion: null,
      biography: null,
      photos: [],
      videos: [],
      plotLabel: null,
      plotSection: null,
      plotRow: null,
      plotLatitude: null,
      plotLongitude: null,
      cemeteryName: ctx.org.name,
      cemeteryAddress: null,
      canEdit: true,
    });
    return;
  }

  const [plot] = burial.plotId
    ? await db
        .select({
          plotNumber: plotsTable.plotNumber,
          section: plotsTable.section,
          row: plotsTable.row,
          latitude: plotsTable.latitude,
          longitude: plotsTable.longitude,
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

  // memorials.videos mirrors the photos column shape — JSON-stringified
  // array of URLs, parsed defensively so a malformed row never 500s the
  // public memorial page.
  let videos: string[] = [];
  if (memorial?.videos) {
    try {
      const parsed = JSON.parse(memorial.videos);
      if (Array.isArray(parsed)) {
        videos = parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // ignore — leave videos empty
    }
  }

  // Pull the cemetery address so the public memorial page can offer
  // "Get directions" even for plots that don't have their own lat/lng
  // mapped yet — visitors are dropped at the cemetery gate and walk in.
  const [siteContact] = await db
    .select({ address: cemeterySitesTable.contactAddress })
    .from(cemeterySitesTable)
    .where(eq(cemeterySitesTable.organizationId, ctx.org.id));

  // "basic" visibility hides the rich content (bio + extra photos) unless
  // the visitor proves they have the PIN. We still expose name/dates/plot
  // because that's the headstone-equivalent info families typically want
  // public for visitors who walked up to the gravesite.
  const showRich = visibility === "open" || pinUnlocked;
  const richBiography = showRich ? memorial?.biography ?? null : null;
  const richPhotos = showRich ? photos : [];
  const richVideos = showRich ? videos : [];

  res.json({
    code: qr.code,
    memorialId: memorial?.id ?? null,
    visibility,
    locked: !showRich,
    title: memorial?.title ?? burial.deceasedName,
    deceasedName: burial.deceasedName,
    bornDate: burial.deceasedDob,
    diedDate: burial.deceasedDod,
    burialDate: burial.burialDate,
    religion: burial.religion,
    biography: richBiography,
    photos: richPhotos,
    videos: richVideos,
    plotLabel: plot?.plotNumber ?? null,
    plotSection: plot?.section ?? null,
    plotRow: plot?.row ?? null,
    plotLatitude: plot?.latitude ?? null,
    plotLongitude: plot?.longitude ?? null,
    cemeteryName: ctx.org.name,
    cemeteryAddress: siteContact?.address ?? null,
    canEdit: true,
  });
});

// Public memorial edit. Gated by the QR code itself acting as the secret —
// the physical plaque on the gravesite IS the credential. This matches the
// real-world UX families expect ("I'm at the grave with the QR, I should be
// able to update grandma's bio"). The code is 16 hex chars (~64 bits of
// entropy) which is acceptable for a low-value, idempotent edit. Operators
// can disable the surface entirely by toggling `memorial.isPublic = false`,
// which makes both the GET and this PATCH return 404.
// In-memory rate limiter for the PIN gate. The PIN is only 6 digits
// (10^6 keyspace) so without throttling an attacker with the public QR
// code could brute-force it in seconds. We allow a burst of 5 attempts
// per 15 minutes per (ip + code) tuple — enough for fat-finger families,
// way too few for online brute force. Cleared periodically so the map
// can't grow without bound.
const editPinAttempts = new Map<string, { count: number; resetAt: number }>();
const EDIT_PIN_WINDOW_MS = 15 * 60 * 1000;
const EDIT_PIN_MAX = 5;
function checkEditPinRateLimit(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const entry = editPinAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    editPinAttempts.set(key, { count: 1, resetAt: now + EDIT_PIN_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= EDIT_PIN_MAX) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true };
}
// Reset successful keys so a legitimate user isn't penalised after one mistake.
function resetEditPinRateLimit(key: string) { editPinAttempts.delete(key); }
// Best-effort cleanup so the map stays small in long-running processes.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of editPinAttempts) if (v.resetAt < now) editPinAttempts.delete(k);
}, EDIT_PIN_WINDOW_MS).unref?.();

const PublicMemorialEditSchema = z.object({
  // Edit PIN issued at QR creation time and held by the operator/family —
  // separate from the QR code itself so a shared read URL can't be used
  // to vandalise the memorial. We accept it in the body OR a header
  // (`x-edit-pin`) so the UI can keep the PIN out of any URL bar history.
  editPin: z.string().min(4).max(12).optional(),
  title: z.string().min(1).max(200).optional(),
  biography: z.string().max(20000).nullable().optional(),
  photos: z.array(z.string().url().max(1000)).max(20).optional(),
  // YouTube video URLs. We deliberately enforce YouTube-only at the API
  // boundary because that's the only provider the renderer can actually
  // embed today — accepting a generic URL would let families save links
  // that silently disappear from the public memorial. When we add Vimeo
  // etc. we extend the regex here and the renderer in lockstep.
  videos: z
    .array(
      z
        .string()
        .url()
        .max(500)
        .refine((s) => {
          // Accept the common YouTube URL shapes: youtu.be/<id>,
          // youtube.com/watch?v=<id>, /embed/<id>, /shorts/<id>,
          // /v/<id>, /live/<id>. The video ID is always 11 chars from
          // [A-Za-z0-9_-]. Anything else is rejected with a clear 400.
          let url: URL;
          try { url = new URL(s); } catch { return false; }
          if (url.protocol !== "http:" && url.protocol !== "https:") return false;
          const host = url.hostname.replace(/^www\./, "").toLowerCase();
          if (host === "youtu.be") {
            const id = url.pathname.slice(1).split("/")[0] ?? "";
            return /^[A-Za-z0-9_-]{11}$/.test(id);
          }
          if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
            const v = url.searchParams.get("v");
            if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return true;
            return /^\/(?:embed|shorts|v|live)\/[A-Za-z0-9_-]{11}/.test(url.pathname);
          }
          return false;
        }, "Only YouTube video links are supported"),
    )
    .max(10)
    .optional(),
  // Privacy mode the family wants to apply. Accepts the three modes the
  // GET handler understands; anything else is rejected by Zod.
  visibility: z.enum(["open", "basic", "private"]).optional(),
});
router.patch("/c/:slug/memorial/:code/edit", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const code = String(req.params.code ?? "").toUpperCase();
  if (!/^[A-Z0-9]{8,64}$/.test(code)) {
    res.status(400).json({ error: "Invalid memorial code" });
    return;
  }
  const parsed = PublicMemorialEditSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  // Resolve QR → org-scoped to prevent code-spraying across cemeteries.
  const [qr] = await db
    .select()
    .from(qrCodesTable)
    .where(
      and(eq(qrCodesTable.code, code), eq(qrCodesTable.organizationId, ctx.org.id)),
    );
  if (!qr || qr.burialId == null) {
    res.status(404).json({ error: "Memorial not found" });
    return;
  }

  // Verify the edit PIN. We deliberately return a distinct 401 (not 404)
  // so families know the memorial exists and they just need the PIN —
  // no information leak since they already had a valid scan code. If the
  // QR has no PIN set (legacy row), refuse the edit until an operator
  // backfills one via the admin UI.
  const submittedPin =
    parsed.data.editPin ?? (typeof req.headers["x-edit-pin"] === "string" ? String(req.headers["x-edit-pin"]) : undefined);
  if (!qr.editPin) {
    res.status(409).json({ error: "Editing not yet enabled for this memorial. Ask the cemetery to issue an edit PIN." });
    return;
  }
  // Rate-limit per (client-ip, code). We deliberately key on `code` rather
  // than `qr.id` so the limit applies even before we trust the request.
  const rlKey = `${req.ip ?? "unknown"}:${code}`;
  const rl = checkEditPinRateLimit(rlKey);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    res.status(429).json({ error: "Too many edit attempts. Please try again later." });
    return;
  }
  if (!submittedPin || submittedPin.trim() !== qr.editPin) {
    res.status(401).json({ error: "Invalid edit PIN" });
    return;
  }
  // Successful auth — reset the counter so a family who mis-typed once
  // doesn't get locked out after legitimate edits.
  resetEditPinRateLimit(rlKey);

  const [burial] = await db
    .select()
    .from(burialsTable)
    .where(
      and(eq(burialsTable.id, qr.burialId), eq(burialsTable.organizationId, ctx.org.id)),
    );
  if (!burial) { res.status(404).json({ error: "Memorial not found" }); return; }

  // Find or create the memorial row. Most QRs created by the operator UI
  // already have memorialId set; legacy rows might not — for those we
  // upsert a fresh memorial pinned to the burial so the family can still
  // edit on first visit.
  let memorialId = qr.memorialId;
  if (memorialId) {
    const [existing] = await db
      .select({ isPublic: memorialsTable.isPublic })
      .from(memorialsTable)
      .where(
        and(
          eq(memorialsTable.id, memorialId),
          eq(memorialsTable.organizationId, ctx.org.id),
        ),
      );
    if (!existing) { res.status(404).json({ error: "Memorial not found" }); return; }
    if (existing.isPublic === false) {
      // Operator has hidden this memorial — refuse to edit (matches GET behaviour).
      res.status(404).json({ error: "Memorial not found" });
      return;
    }
  } else {
    // Wrap the memorial insert + QR update in a transaction so we can't
    // end up with an orphan memorial row if the QR link write fails
    // mid-flight.
    memorialId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(memorialsTable)
        .values({
          burialId: burial.id,
          organizationId: ctx.org.id,
          title: burial.deceasedName,
          biography: null,
          photos: null,
          isPublic: true,
        })
        .returning({ id: memorialsTable.id });
      await tx
        .update(qrCodesTable)
        .set({ memorialId: created.id })
        .where(eq(qrCodesTable.id, qr.id));
      return created.id;
    });
  }

  // Build the patch. Photos array is stringified to JSON because the
  // legacy column is `text` (we kept the on-disk shape stable).
  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.biography !== undefined) patch.biography = parsed.data.biography;
  if (parsed.data.photos !== undefined) patch.photos = JSON.stringify(parsed.data.photos);
  if (parsed.data.videos !== undefined) patch.videos = JSON.stringify(parsed.data.videos);
  if (parsed.data.visibility !== undefined) patch.visibility = parsed.data.visibility;

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  await db
    .update(memorialsTable)
    .set(patch)
    .where(
      and(
        eq(memorialsTable.id, memorialId),
        eq(memorialsTable.organizationId, ctx.org.id),
      ),
    );

  res.json({ ok: true });
});

// Public order submission. The server validates the cart against the live
// product catalogue (so a tampered client can't pay $0.01 for a $200 urn),
// allocates a daily order number per org, and inserts atomically.
router.post("/c/:slug/orders", async (req, res) => {
  const ctx = await resolvePublicSite(req, res);
  if (!ctx) return;
  const parsed = createCemeteryOrderSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid order", details: parsed.error.issues });
    return;
  }

  // Resolve the optional memorial code → burialId. We treat this as a hint:
  // any failure (bad code, foreign org, missing burial) silently drops the
  // link rather than rejecting the order, because losing a paying customer
  // because they had a stale URL is much worse than a missing back-link.
  let linkedBurialId: number | null = null;
  if (parsed.data.memorialCode) {
    const codeUpper = parsed.data.memorialCode.toUpperCase();
    const [qr] = await db
      .select({ burialId: qrCodesTable.burialId })
      .from(qrCodesTable)
      .where(
        and(
          eq(qrCodesTable.code, codeUpper),
          eq(qrCodesTable.organizationId, ctx.org.id),
        ),
      );
    if (qr?.burialId != null) {
      // Confirm the burial still belongs to this org before persisting.
      const [b] = await db
        .select({ id: burialsTable.id })
        .from(burialsTable)
        .where(
          and(
            eq(burialsTable.id, qr.burialId),
            eq(burialsTable.organizationId, ctx.org.id),
          ),
        );
      if (b) linkedBurialId = b.id;
    }
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
      res
        .status(400)
        .json({ error: `Product ${item.productId} is not available` });
      return;
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
          burialId: linkedBurialId,
          orderNumber,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          customerPhone: parsed.data.customerPhone ?? null,
          customerNotes: parsed.data.customerNotes ?? null,
          scheduledFor: parsed.data.scheduledFor ?? null,
          scheduleOccasion: parsed.data.scheduleOccasion ?? null,
          recurringYearly: parsed.data.recurringYearly ?? false,
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
    // exists and gives the customer a number to reference. We also echo
    // the scheduling info so the success page can confirm the booked date.
    res.status(201).json({
      orderNumber: inserted.orderNumber,
      total: inserted.total,
      items: inserted.items,
      scheduledFor: inserted.scheduledFor,
      scheduleOccasion: inserted.scheduleOccasion,
      recurringYearly: inserted.recurringYearly,
    });
  } catch (err) {
    // Rare: unique-index collision under extreme contention. Caller can retry.
    if (err instanceof Error && err.message.includes("cemetery_orders_org_number_unique")) {
      res
        .status(409)
        .json({ error: "Could not allocate order number, please try again" });
      return;
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
