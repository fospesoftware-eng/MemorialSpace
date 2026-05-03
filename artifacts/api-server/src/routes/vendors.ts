/**
 * Marketplace vendors — third-party service providers (florists, stonemasons,
 * caterers, transport) with their own auth tier, service catalog, and
 * request inbox.
 *
 * Layout:
 *   PUBLIC (no auth)
 *     POST   /api/vendor/signup            — rate-limited account creation
 *     GET    /api/vendors                  — directory list (filterable)
 *     GET    /api/vendors/:slug            — public profile + services
 *     POST   /api/vendors/:slug/requests   — family submits a request
 *
 *   VENDOR (requireVendor middleware mounted in routes/index.ts)
 *     GET    /api/vendor/me                — current vendor row
 *     PATCH  /api/vendor/me                — edit profile/areas/categories
 *     GET    /api/vendor/services          — own services
 *     POST   /api/vendor/services          — create service
 *     PATCH  /api/vendor/services/:id      — update service
 *     DELETE /api/vendor/services/:id      — delete service
 *     GET    /api/vendor/requests          — own request inbox (?status=)
 *     PATCH  /api/vendor/requests/:id      — change status / vendor notes
 *     GET    /api/vendor/metrics           — KPIs (counts by status, etc)
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod/v4";
import { and, count, countDistinct, desc, eq, ilike, inArray, or, sql, sum } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  marketplaceVendorsTable,
  vendorServicesTable,
  vendorRequestsTable,
  VENDOR_REQUEST_STATUSES,
  PRICING_MODELS,
  BILLING_CADENCES,
  VENDOR_PAYMENT_STATUSES,
  FUNERAL_CATEGORIES,
} from "@workspace/db";
import { hashPassword, type SessionUser } from "../lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lower-case + URL-safe slug from a business name. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Pick a slug that doesn't collide. Tries the base slug first, then suffixes. */
async function uniqueSlug(base: string): Promise<string> {
  const fallback = base || "vendor";
  for (let i = 0; i < 12; i++) {
    const candidate = i === 0 ? fallback : `${fallback}-${i + 1}`;
    const [hit] = await db
      .select({ id: marketplaceVendorsTable.id })
      .from(marketplaceVendorsTable)
      .where(eq(marketplaceVendorsTable.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  // Last-resort fallback — a random 6-char tail. Practically never hit.
  return `${fallback}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Strip the password hash from any vendor row before returning over the wire. */
function publicVendor<T extends { passwordHash?: string }>(v: T) {
  const { passwordHash: _ph, ...rest } = v;
  return rest;
}

const stringArray = z
  .array(z.string().trim().min(1).max(80))
  .max(40)
  .default([]);

/** Categories must be drawn from the canonical funeral-lifecycle taxonomy so
 * the public marketplace's hero category grid can reach every published
 * vendor. Free-form tags would silently fall outside the 5 known buckets. */
const categoryArray = z.array(z.enum(FUNERAL_CATEGORIES)).max(5).default([]);

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

const publicRouter = Router();

/**
 * Rate-limit signup and public request submission so we don't get spammed.
 * 10 / 15min per IP is generous for honest use, painful for spammers.
 */
const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  description: z.string().trim().max(2000).optional(),
  categories: categoryArray.optional(),
  serviceAreas: stringArray.optional(),
});

publicRouter.post("/vendor/signup", publicWriteLimiter, async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid signup", details: parsed.error.issues });
      return;
    }
    const { email, password, businessName, contactName, contactPhone, description, categories, serviceAreas } = parsed.data;
    const normalized = email.trim().toLowerCase();

    // Detect duplicates up-front so we can return a friendly 409 instead of
    // a unique-constraint 500.
    const [existing] = await db
      .select({ id: marketplaceVendorsTable.id })
      .from(marketplaceVendorsTable)
      .where(eq(marketplaceVendorsTable.email, normalized))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }

    const passwordHash = await hashPassword(password);
    // Pre-check + DB unique index handle slug uniqueness; on the rare race
    // where two concurrent signups pick the same slug, retry with a fresh one
    // up to 3 times before surfacing a 409. Email collisions go straight to 409
    // since they're user-fixable. PG unique-violation = `23505`.
    let created: typeof marketplaceVendorsTable.$inferSelect | undefined;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const slug = await uniqueSlug(slugify(businessName));
      try {
        [created] = await db
          .insert(marketplaceVendorsTable)
          .values({
            email: normalized,
            passwordHash,
            slug,
            businessName: businessName.trim(),
            contactName: contactName?.trim() || null,
            contactPhone: contactPhone?.trim() || null,
            description: description?.trim() || null,
            categories: categories ?? [],
            serviceAreas: serviceAreas ?? [],
            isPublished: false,
            status: "active",
          })
          .returning();
      } catch (e: unknown) {
        const code = (e as { code?: string } | null)?.code;
        if (code !== "23505") throw e;
        const detail = (e as { detail?: string } | null)?.detail ?? "";
        if (detail.includes("(email)")) {
          res.status(409).json({ error: "An account with that email already exists." });
          return;
        }
        // slug race — loop and try again
      }
    }
    if (!created) {
      res.status(409).json({ error: "Could not allocate a unique vendor slug. Please retry." });
      return;
    }

    // Sign the new vendor in immediately so they land on the dashboard.
    const sessionUser: SessionUser = {
      kind: "vendor",
      vendorId: created.id,
      email: created.email,
      name: created.businessName,
      role: "vendor",
    };
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = sessionUser;
      res.status(201).json({
        user: sessionUser,
        vendor: publicVendor(created),
        redirectTo: "/vendor",
      });
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get("/vendors", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const area = typeof req.query.area === "string" ? req.query.area.trim() : "";

    const filters = [eq(marketplaceVendorsTable.isPublished, true), eq(marketplaceVendorsTable.status, "active")];
    if (q) {
      const like = `%${q}%`;
      const orExpr = or(
        ilike(marketplaceVendorsTable.businessName, like),
        ilike(marketplaceVendorsTable.description, like),
      );
      if (orExpr) filters.push(orExpr);
    }
    // categories / serviceAreas are jsonb string-arrays. Postgres can do
    // case-insensitive contains via `?` would be exact; we use a text-cast
    // ILIKE so partial matches work too ("flori" matches "florist").
    if (category) {
      filters.push(sql`${marketplaceVendorsTable.categories}::text ilike ${"%" + category + "%"}`);
    }
    if (area) {
      filters.push(sql`${marketplaceVendorsTable.serviceAreas}::text ilike ${"%" + area + "%"}`);
    }

    const rows = await db
      .select({
        id: marketplaceVendorsTable.id,
        slug: marketplaceVendorsTable.slug,
        businessName: marketplaceVendorsTable.businessName,
        description: marketplaceVendorsTable.description,
        logoUrl: marketplaceVendorsTable.logoUrl,
        categories: marketplaceVendorsTable.categories,
        serviceAreas: marketplaceVendorsTable.serviceAreas,
        contactPhone: marketplaceVendorsTable.contactPhone,
        websiteUrl: marketplaceVendorsTable.websiteUrl,
      })
      .from(marketplaceVendorsTable)
      .where(and(...filters))
      .orderBy(desc(marketplaceVendorsTable.lastActiveAt), desc(marketplaceVendorsTable.createdAt))
      .limit(200);

    res.json({ vendors: rows });
  } catch (err) {
    next(err);
  }
});

publicRouter.get("/vendors/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? "").trim().toLowerCase();
    if (!slug) { res.status(404).json({ error: "Vendor not found" }); return; }
    const [vendor] = await db
      .select()
      .from(marketplaceVendorsTable)
      .where(
        and(
          eq(marketplaceVendorsTable.slug, slug),
          eq(marketplaceVendorsTable.isPublished, true),
          eq(marketplaceVendorsTable.status, "active"),
        ),
      )
      .limit(1);
    if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

    const services = await db
      .select()
      .from(vendorServicesTable)
      .where(
        and(
          eq(vendorServicesTable.vendorId, vendor.id),
          eq(vendorServicesTable.isPublished, true),
        ),
      )
      .orderBy(vendorServicesTable.sortOrder, vendorServicesTable.id);

    res.json({ vendor: publicVendor(vendor), services });
  } catch (err) {
    next(err);
  }
});

const requestSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().email().max(254),
  customerPhone: z.string().trim().max(40).optional(),
  deceasedName: z.string().trim().max(200).optional(),
  serviceLocation: z.string().trim().max(200).optional(),
  message: z.string().trim().min(5).max(4000),
  serviceId: z.number().int().positive().optional(),
});

publicRouter.post("/vendors/:slug/requests", publicWriteLimiter, async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? "").trim().toLowerCase();
    const parsed = requestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      return;
    }
    const [vendor] = await db
      .select({ id: marketplaceVendorsTable.id })
      .from(marketplaceVendorsTable)
      .where(
        and(
          eq(marketplaceVendorsTable.slug, slug),
          eq(marketplaceVendorsTable.isPublished, true),
          eq(marketplaceVendorsTable.status, "active"),
        ),
      )
      .limit(1);
    if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

    // If the family pinned a specific service, verify it belongs to this
    // vendor — never trust the client to scope it for us.
    let serviceId: number | null = null;
    if (parsed.data.serviceId != null) {
      const [svc] = await db
        .select({ id: vendorServicesTable.id })
        .from(vendorServicesTable)
        .where(
          and(
            eq(vendorServicesTable.id, parsed.data.serviceId),
            eq(vendorServicesTable.vendorId, vendor.id),
          ),
        )
        .limit(1);
      if (svc) serviceId = svc.id;
    }

    const [created] = await db
      .insert(vendorRequestsTable)
      .values({
        vendorId: vendor.id,
        serviceId,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail.trim().toLowerCase(),
        customerPhone: parsed.data.customerPhone || null,
        deceasedName: parsed.data.deceasedName || null,
        serviceLocation: parsed.data.serviceLocation || null,
        message: parsed.data.message,
        status: "pending",
      })
      .returning({ id: vendorRequestsTable.id, createdAt: vendorRequestsTable.createdAt });

    res.status(201).json({ ok: true, requestId: created.id, createdAt: created.createdAt });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Vendor-authenticated routes (mounted under requireVendor)
// ---------------------------------------------------------------------------

const vendorRouter = Router();

/** Resolve `vendorId` from the session. Always present after `requireVendor`. */
function vendorId(req: import("express").Request): number {
  return req.session!.user!.vendorId as number;
}

vendorRouter.get("/me", async (req, res, next) => {
  try {
    const [v] = await db
      .select()
      .from(marketplaceVendorsTable)
      .where(eq(marketplaceVendorsTable.id, vendorId(req)))
      .limit(1);
    if (!v) { res.status(404).json({ error: "Vendor not found" }); return; }
    res.json({ vendor: publicVendor(v) });
  } catch (err) {
    next(err);
  }
});

const profileSchema = z.object({
  businessName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullish(),
  logoUrl: z.string().url().max(2048).nullish(),
  contactName: z.string().trim().max(120).nullish(),
  contactPhone: z.string().trim().max(40).nullish(),
  websiteUrl: z.string().url().max(2048).nullish(),
  categories: categoryArray.optional(),
  serviceAreas: stringArray.optional(),
  isPublished: z.boolean().optional(),
});

vendorRouter.patch("/me", async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid profile", details: parsed.error.issues });
      return;
    }
    // Drizzle complains if you pass undefined for a notNull column; build the
    // patch manually so optional fields are omitted entirely.
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const d = parsed.data;
    if (d.businessName !== undefined) patch.businessName = d.businessName;
    if (d.description !== undefined) patch.description = d.description ?? null;
    if (d.logoUrl !== undefined) patch.logoUrl = d.logoUrl ?? null;
    if (d.contactName !== undefined) patch.contactName = d.contactName ?? null;
    if (d.contactPhone !== undefined) patch.contactPhone = d.contactPhone ?? null;
    if (d.websiteUrl !== undefined) patch.websiteUrl = d.websiteUrl ?? null;
    if (d.categories !== undefined) patch.categories = d.categories;
    if (d.serviceAreas !== undefined) patch.serviceAreas = d.serviceAreas;
    if (d.isPublished !== undefined) patch.isPublished = d.isPublished;

    const [updated] = await db
      .update(marketplaceVendorsTable)
      .set(patch)
      .where(eq(marketplaceVendorsTable.id, vendorId(req)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Vendor not found" }); return; }
    res.json({ vendor: publicVendor(updated) });
  } catch (err) {
    next(err);
  }
});

vendorRouter.get("/services", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(vendorServicesTable)
      .where(eq(vendorServicesTable.vendorId, vendorId(req)))
      .orderBy(vendorServicesTable.sortOrder, vendorServicesTable.id);
    res.json({ services: rows });
  } catch (err) {
    next(err);
  }
});

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullish(),
  pricingModel: z.enum(PRICING_MODELS).default("range"),
  priceFrom: z.number().nonnegative().nullish(),
  priceTo: z.number().nonnegative().nullish(),
  priceAmount: z.number().nonnegative().nullish(),
  billingCadence: z.enum(BILLING_CADENCES).default("one-time"),
  category: z.enum(FUNERAL_CATEGORIES).nullish(),
  photos: z.array(z.string().url().max(2048)).max(20).default([]),
  isPublished: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

vendorRouter.post("/services", async (req, res, next) => {
  try {
    const parsed = serviceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid service", details: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    if (d.priceFrom != null && d.priceTo != null && d.priceTo < d.priceFrom) {
      res.status(400).json({ error: "priceTo must be greater than or equal to priceFrom" });
      return;
    }
    const [created] = await db
      .insert(vendorServicesTable)
      .values({
        vendorId: vendorId(req),
        name: d.name,
        description: d.description ?? null,
        pricingModel: d.pricingModel,
        priceFrom: d.priceFrom ?? null,
        priceTo: d.priceTo ?? null,
        priceAmount: d.priceAmount ?? null,
        billingCadence: d.billingCadence,
        category: d.category ?? null,
        photos: d.photos,
        isPublished: d.isPublished,
        sortOrder: d.sortOrder,
      })
      .returning();
    res.status(201).json({ service: created });
  } catch (err) {
    next(err);
  }
});

const servicePatchSchema = serviceSchema.partial();

vendorRouter.patch("/services/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) { res.status(404).json({ error: "Service not found" }); return; }
    const parsed = servicePatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid service", details: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.name !== undefined) patch.name = d.name;
    if (d.description !== undefined) patch.description = d.description ?? null;
    if (d.pricingModel !== undefined) patch.pricingModel = d.pricingModel;
    if (d.priceFrom !== undefined) patch.priceFrom = d.priceFrom ?? null;
    if (d.priceTo !== undefined) patch.priceTo = d.priceTo ?? null;
    if (d.priceAmount !== undefined) patch.priceAmount = d.priceAmount ?? null;
    if (d.billingCadence !== undefined) patch.billingCadence = d.billingCadence;
    if (d.category !== undefined) patch.category = d.category ?? null;
    if (d.photos !== undefined) patch.photos = d.photos;
    if (d.isPublished !== undefined) patch.isPublished = d.isPublished;
    if (d.sortOrder !== undefined) patch.sortOrder = d.sortOrder;

    const [updated] = await db
      .update(vendorServicesTable)
      .set(patch)
      .where(
        and(
          eq(vendorServicesTable.id, id),
          // Ownership scope — never let a vendor edit another vendor's row.
          eq(vendorServicesTable.vendorId, vendorId(req)),
        ),
      )
      .returning();
    if (!updated) { res.status(404).json({ error: "Service not found" }); return; }
    res.json({ service: updated });
  } catch (err) {
    next(err);
  }
});

vendorRouter.delete("/services/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) { res.status(404).json({ error: "Service not found" }); return; }
    const [deleted] = await db
      .delete(vendorServicesTable)
      .where(
        and(
          eq(vendorServicesTable.id, id),
          eq(vendorServicesTable.vendorId, vendorId(req)),
        ),
      )
      .returning({ id: vendorServicesTable.id });
    if (!deleted) { res.status(404).json({ error: "Service not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

vendorRouter.get("/requests", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const filters = [eq(vendorRequestsTable.vendorId, vendorId(req))];
    if (status && (VENDOR_REQUEST_STATUSES as readonly string[]).includes(status)) {
      filters.push(eq(vendorRequestsTable.status, status));
    }
    const rows = await db
      .select()
      .from(vendorRequestsTable)
      .where(and(...filters))
      .orderBy(desc(vendorRequestsTable.createdAt))
      .limit(500);
    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
});

const requestPatchSchema = z.object({
  status: z.enum(VENDOR_REQUEST_STATUSES).optional(),
  vendorNotes: z.string().trim().max(4000).nullish(),
  quotedAmount: z.number().nonnegative().nullish(),
  paidAmount: z.number().nonnegative().nullish(),
  paymentStatus: z.enum(VENDOR_PAYMENT_STATUSES).optional(),
  // ISO date string. We coerce to a Date below so Drizzle's pg type-binding
  // accepts it without a type mismatch.
  scheduledFor: z.string().datetime().nullish(),
  isRecurring: z.boolean().optional(),
});

vendorRouter.patch("/requests/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) { res.status(404).json({ error: "Request not found" }); return; }
    const parsed = requestPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid update", details: parsed.error.issues });
      return;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const { status, vendorNotes, quotedAmount, paidAmount, paymentStatus, scheduledFor, isRecurring } = parsed.data;
    if (status !== undefined) {
      patch.status = status;
      // Stamp respondedAt the first time the vendor moves the request out of
      // pending. COALESCE preserves any prior timestamp so historical revenue
      // buckets (which group by respondedAt) stay anchored — re-saving a
      // completed order must not rebase its month.
      if (status !== "pending") {
        patch.respondedAt = sql`COALESCE(${vendorRequestsTable.respondedAt}, NOW())`;
      }
    }
    if (vendorNotes !== undefined) patch.vendorNotes = vendorNotes ?? null;
    if (quotedAmount !== undefined) patch.quotedAmount = quotedAmount ?? null;
    if (paidAmount !== undefined) patch.paidAmount = paidAmount ?? null;
    if (paymentStatus !== undefined) patch.paymentStatus = paymentStatus;
    if (scheduledFor !== undefined) patch.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
    if (isRecurring !== undefined) patch.isRecurring = isRecurring;

    const [updated] = await db
      .update(vendorRequestsTable)
      .set(patch)
      .where(
        and(
          eq(vendorRequestsTable.id, id),
          eq(vendorRequestsTable.vendorId, vendorId(req)),
        ),
      )
      .returning();
    if (!updated) { res.status(404).json({ error: "Request not found" }); return; }
    res.json({ request: updated });
  } catch (err) {
    next(err);
  }
});

vendorRouter.get("/metrics", async (req, res, next) => {
  try {
    const vid = vendorId(req);
    // One round-trip — group counts by status.
    const byStatus = await db
      .select({
        status: vendorRequestsTable.status,
        count: count(vendorRequestsTable.id),
      })
      .from(vendorRequestsTable)
      .where(eq(vendorRequestsTable.vendorId, vid))
      .groupBy(vendorRequestsTable.status);

    const counts: Record<string, number> = { pending: 0, accepted: 0, declined: 0, completed: 0, cancelled: 0 };
    for (const r of byStatus) counts[r.status] = Number(r.count);

    const [{ servicesCount } = { servicesCount: 0 }] = await db
      .select({ servicesCount: count(vendorServicesTable.id) })
      .from(vendorServicesTable)
      .where(eq(vendorServicesTable.vendorId, vid));

    // Revenue rollups. We only count paid amounts on requests the vendor has
    // actually accepted or completed — pending/declined/cancelled rows with a
    // stale paidAmount must never inflate KPIs. customerCount mirrors the
    // same filter so the "customers" tile matches the CRM page.
    const realisedRevenueFilter = sql`${vendorRequestsTable.status} IN ('accepted', 'completed') AND ${vendorRequestsTable.paidAmount} IS NOT NULL`;

    const [revRow] = await db
      .select({
        totalRevenue: sum(vendorRequestsTable.paidAmount),
        customerCount: countDistinct(vendorRequestsTable.customerEmail),
      })
      .from(vendorRequestsTable)
      .where(and(eq(vendorRequestsTable.vendorId, vid), realisedRevenueFilter));

    const [monthRow] = await db
      .select({ monthRevenue: sum(vendorRequestsTable.paidAmount) })
      .from(vendorRequestsTable)
      .where(
        and(
          eq(vendorRequestsTable.vendorId, vid),
          realisedRevenueFilter,
          sql`${vendorRequestsTable.respondedAt} >= date_trunc('month', now())`,
        ),
      );

    // Last 6 calendar months of revenue, ordered oldest→newest. Empty months
    // are filled in JS so the chart doesn't have gaps.
    const monthlyRows = await db
      .select({
        bucket: sql<string>`to_char(date_trunc('month', ${vendorRequestsTable.respondedAt}), 'YYYY-MM')`,
        revenue: sum(vendorRequestsTable.paidAmount),
        orders: count(vendorRequestsTable.id),
      })
      .from(vendorRequestsTable)
      .where(
        and(
          eq(vendorRequestsTable.vendorId, vid),
          realisedRevenueFilter,
          sql`${vendorRequestsTable.respondedAt} >= (date_trunc('month', now()) - interval '5 months')`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${vendorRequestsTable.respondedAt})`)
      .orderBy(sql`date_trunc('month', ${vendorRequestsTable.respondedAt})`);

    const monthlyMap = new Map(monthlyRows.map((r) => [r.bucket, r]));
    const monthlyTrend: { bucket: string; revenue: number; orders: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const bucket = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const hit = monthlyMap.get(bucket);
      monthlyTrend.push({
        bucket,
        revenue: Number(hit?.revenue ?? 0),
        orders: Number(hit?.orders ?? 0),
      });
    }

    // Top services by revenue (paid only, accepted/completed) — for the
    // dashboard "what's selling" widget.
    const topServices = await db
      .select({
        serviceId: vendorRequestsTable.serviceId,
        serviceName: vendorServicesTable.name,
        revenue: sum(vendorRequestsTable.paidAmount),
        orders: count(vendorRequestsTable.id),
      })
      .from(vendorRequestsTable)
      .leftJoin(
        vendorServicesTable,
        eq(vendorRequestsTable.serviceId, vendorServicesTable.id),
      )
      .where(and(eq(vendorRequestsTable.vendorId, vid), realisedRevenueFilter))
      .groupBy(vendorRequestsTable.serviceId, vendorServicesTable.name)
      .orderBy(desc(sum(vendorRequestsTable.paidAmount)))
      .limit(5);

    const recent = await db
      .select()
      .from(vendorRequestsTable)
      .where(eq(vendorRequestsTable.vendorId, vid))
      .orderBy(desc(vendorRequestsTable.createdAt))
      .limit(5);

    res.json({
      requestCounts: counts,
      total: byStatus.reduce((a, r) => a + Number(r.count), 0),
      servicesCount: Number(servicesCount),
      totalRevenue: Number(revRow?.totalRevenue ?? 0),
      monthRevenue: Number(monthRow?.monthRevenue ?? 0),
      customerCount: Number(revRow?.customerCount ?? 0),
      monthlyTrend,
      topServices: topServices.map((t) => ({
        serviceId: t.serviceId,
        serviceName: t.serviceName ?? "Unattached",
        revenue: Number(t.revenue ?? 0),
        orders: Number(t.orders),
      })),
      recentRequests: recent,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Vendor orders — every accepted/completed request, joined with the service
 * name. This is the "real revenue" view powering /orders and the orders
 * widget on the dashboard.
 */
vendorRouter.get("/orders", async (req, res, next) => {
  try {
    const vid = vendorId(req);
    const rows = await db
      .select({
        id: vendorRequestsTable.id,
        customerName: vendorRequestsTable.customerName,
        customerEmail: vendorRequestsTable.customerEmail,
        deceasedName: vendorRequestsTable.deceasedName,
        serviceLocation: vendorRequestsTable.serviceLocation,
        status: vendorRequestsTable.status,
        quotedAmount: vendorRequestsTable.quotedAmount,
        paidAmount: vendorRequestsTable.paidAmount,
        paymentStatus: vendorRequestsTable.paymentStatus,
        scheduledFor: vendorRequestsTable.scheduledFor,
        isRecurring: vendorRequestsTable.isRecurring,
        respondedAt: vendorRequestsTable.respondedAt,
        createdAt: vendorRequestsTable.createdAt,
        serviceId: vendorRequestsTable.serviceId,
        serviceName: vendorServicesTable.name,
      })
      .from(vendorRequestsTable)
      .leftJoin(vendorServicesTable, eq(vendorRequestsTable.serviceId, vendorServicesTable.id))
      .where(
        and(
          eq(vendorRequestsTable.vendorId, vid),
          inArray(vendorRequestsTable.status, ["accepted", "completed"]),
        ),
      )
      .orderBy(desc(vendorRequestsTable.respondedAt), desc(vendorRequestsTable.createdAt))
      .limit(500);
    res.json({ orders: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * Customer CRM rollup — distinct customers (by email) with per-customer
 * aggregates. Powers /customers and the dashboard "customer count" KPI.
 */
vendorRouter.get("/customers", async (req, res, next) => {
  try {
    const vid = vendorId(req);
    const rows = await db
      .select({
        customerEmail: vendorRequestsTable.customerEmail,
        customerName: sql<string>`max(${vendorRequestsTable.customerName})`,
        customerPhone: sql<string | null>`max(${vendorRequestsTable.customerPhone})`,
        requestCount: count(vendorRequestsTable.id),
        totalSpent: sum(vendorRequestsTable.paidAmount),
        lastContactAt: sql<Date>`max(${vendorRequestsTable.createdAt})`,
        firstContactAt: sql<Date>`min(${vendorRequestsTable.createdAt})`,
      })
      .from(vendorRequestsTable)
      .where(eq(vendorRequestsTable.vendorId, vid))
      .groupBy(vendorRequestsTable.customerEmail)
      .orderBy(desc(sql`max(${vendorRequestsTable.createdAt})`))
      .limit(500);
    res.json({
      customers: rows.map((r) => ({
        ...r,
        totalSpent: Number(r.totalSpent ?? 0),
        requestCount: Number(r.requestCount),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Public list of canonical funeral-lifecycle categories. Used by the
 *  marketplace landing to render category tiles without coupling the FE
 *  build-time bundle to the DB schema. */
publicRouter.get("/marketplace/categories", (_req, res) => {
  res.json({ categories: FUNERAL_CATEGORIES });
});

// ---------------------------------------------------------------------------
// Combined export
// ---------------------------------------------------------------------------

export const vendorPublicRouter = publicRouter;
export const vendorAuthedRouter = vendorRouter;
