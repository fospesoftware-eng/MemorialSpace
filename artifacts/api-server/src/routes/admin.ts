import { Router, type IRouter } from "express";
import {
  db,
  organizationsTable,
  usersTable,
  subscriptionPlansTable,
  subscriptionsTable,
  platformInvoicesTable,
  platformPaymentsTable,
  auditLogTable,
  productsTable,
  insertSubscriptionPlanSchema,
  insertSubscriptionSchema,
  insertPlatformInvoiceSchema,
  insertPlatformPaymentSchema,
  SUBSCRIPTION_STATUSES,
  PLATFORM_INVOICE_STATUSES,
  BILLING_PERIODS,
  PLATFORM_PAYMENT_METHODS,
  CEMETERY_TYPES,
  PLATFORM_FEATURES,
} from "@workspace/db";
import { and, desc, eq, gte, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requirePlatformAdmin } from "../lib/auth";

const router: IRouter = Router();

// Every /api/admin/* endpoint requires a signed-in platform admin. Without
// this guard the entire SaaS control plane is open to the world.
router.use("/admin", requirePlatformAdmin);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Append an audit-log entry. Best-effort: if the log write itself fails we
 * never break the originating action — the caller has already committed.
 * `actor` reads from the `x-admin-email` request header (whatever the
 * platform-admin sign-in surface set). When absent, falls back to "system".
 */
async function audit(
  actorEmail: string | undefined,
  action: string,
  opts: {
    targetType?: string;
    targetId?: number;
    organizationId?: number;
    summary?: string;
    details?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      actorEmail: actorEmail ?? "system",
      action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      organizationId: opts.organizationId ?? null,
      summary: opts.summary ?? null,
      details: opts.details ?? {},
    });
  } catch {
    // never let logging break the action
  }
}

function actor(req: import("express").Request): string | undefined {
  // Trust ONLY the session for the audit actor — the legacy `x-admin-email`
  // header was forgeable and is no longer consulted.
  return req.session?.user?.email;
}

function periodEndFromStart(start: Date, period: "monthly" | "yearly"): Date {
  const d = new Date(start);
  if (period === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

function periodStartOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Allocate the next platform invoice number with a retry-on-23505 loop —
// matches the pattern used by the B2B accounting module for INV-YYYY-NNNN.
async function nextPlatformInvoiceNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `PINV-${year}-`;
  const rows = await db
    .select({ n: platformInvoicesTable.invoiceNumber })
    .from(platformInvoicesTable)
    .where(ilike(platformInvoicesTable.invoiceNumber, `${prefix}%`));
  let max = 0;
  for (const r of rows) {
    const m = (r.n ?? "").match(/-(\d+)$/);
    if (m) {
      const v = parseInt(m[1], 10);
      if (Number.isFinite(v) && v > max) max = v;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

// -----------------------------------------------------------------------------
// Metrics / Dashboard
// -----------------------------------------------------------------------------

router.get("/admin/metrics", async (_req, res) => {
  const [
    activeSubs,
    trialSubs,
    cancelledSubs,
    pastDueSubs,
    allOrgs,
    plans,
    recentInvoices,
    recentPayments,
  ] = await Promise.all([
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "trialing")),
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "cancelled")),
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "past_due")),
    db.select().from(organizationsTable),
    db.select().from(subscriptionPlansTable),
    db
      .select()
      .from(platformInvoicesTable)
      .orderBy(desc(platformInvoicesTable.createdAt))
      .limit(10),
    db
      .select()
      .from(platformPaymentsTable)
      .orderBy(desc(platformPaymentsTable.paidAt))
      .limit(10),
  ]);

  // MRR — normalize yearly plans to monthly. Cents.
  const mrrCents = activeSubs.reduce((sum, s) => {
    const monthly =
      s.billingPeriod === "yearly"
        ? Math.round(s.pricePerPeriodCents / 12)
        : s.pricePerPeriodCents;
    return sum + monthly;
  }, 0);
  const arrCents = mrrCents * 12;

  // Plan distribution among ALL non-cancelled subs.
  const planDistribution: Record<string, number> = {};
  for (const s of [...activeSubs, ...trialSubs, ...pastDueSubs]) {
    const plan = plans.find((p) => p.id === s.planId);
    const name = plan?.name ?? "Unknown";
    planDistribution[name] = (planDistribution[name] ?? 0) + 1;
  }

  // Signups by month for the trailing 12 months.
  const now = new Date();
  const months: { month: string; signups: number; mrrCents: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const monthKey = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const signups = allOrgs.filter(
      (o) => o.createdAt && o.createdAt >= d && o.createdAt < next,
    ).length;
    // MRR-by-month is approximated as the sum of monthly-equivalent prices
    // for subs created at-or-before the end of that month and not cancelled
    // before the start of that month.
    const monthMrr = activeSubs
      .filter((s) => s.createdAt <= next && (!s.cancelledAt || s.cancelledAt > d))
      .reduce((sum, s) => {
        const monthly =
          s.billingPeriod === "yearly"
            ? Math.round(s.pricePerPeriodCents / 12)
            : s.pricePerPeriodCents;
        return sum + monthly;
      }, 0);
    months.push({ month: monthKey, signups, mrrCents: monthMrr });
  }

  // Outstanding invoices (open + uncollectible past due).
  const openInvoices = await db
    .select()
    .from(platformInvoicesTable)
    .where(eq(platformInvoicesTable.status, "open"));
  const outstandingCents = openInvoices.reduce(
    (sum, i) => sum + (i.totalCents - i.amountPaidCents),
    0,
  );

  // Total revenue collected ever.
  const [{ collectedCents }] = await db
    .select({
      collectedCents: sql<number>`COALESCE(SUM(${platformPaymentsTable.amountCents}), 0)::int`,
    })
    .from(platformPaymentsTable);

  res.json({
    mrrCents,
    arrCents,
    activeSubscriptions: activeSubs.length,
    trialingSubscriptions: trialSubs.length,
    pastDueSubscriptions: pastDueSubs.length,
    cancelledSubscriptions: cancelledSubs.length,
    totalOrganizations: allOrgs.length,
    suspendedOrganizations: allOrgs.filter((o) => o.status === "suspended").length,
    outstandingCents,
    collectedCents: collectedCents ?? 0,
    planDistribution,
    monthly: months,
    recentInvoices,
    recentPayments,
  });
});

// -----------------------------------------------------------------------------
// Plans CRUD
// -----------------------------------------------------------------------------

router.get("/admin/plans", async (_req, res) => {
  const rows = await db
    .select()
    .from(subscriptionPlansTable)
    .orderBy(subscriptionPlansTable.displayOrder, subscriptionPlansTable.priceCents);
  res.json(rows);
});

router.post("/admin/plans", async (req, res) => {
  const parsed = insertSubscriptionPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues }); return;
  }
  try {
    const [row] = await db
      .insert(subscriptionPlansTable)
      .values(parsed.data)
      .returning();
    await audit(actor(req), "plan.created", {
      targetType: "plan",
      targetId: row.id,
      summary: `Created plan ${row.name}`,
      details: { slug: row.slug, priceCents: row.priceCents },
    });
    res.status(201).json(row);
  } catch (e: unknown) {
    if (typeof e === "object" && e && (e as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Plan slug already exists" }); return;
    }
    throw e;
  }
});

router.patch("/admin/plans/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const Partial = insertSubscriptionPlanSchema.partial();
  const parsed = Partial.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues }); return;
  }
  const [row] = await db
    .update(subscriptionPlansTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(subscriptionPlansTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await audit(actor(req), "plan.updated", {
    targetType: "plan",
    targetId: id,
    summary: `Updated plan ${row.name}`,
    details: parsed.data,
  });
  res.json(row);
});

router.delete("/admin/plans/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Refuse if any non-cancelled subscription is using this plan — preserves
  // historical pricing references.
  const [{ inUse }] = await db
    .select({ inUse: sql<number>`count(*)::int` })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.planId, id),
        ne(subscriptionsTable.status, "cancelled"),
      ),
    );
  if ((inUse ?? 0) > 0) {
    // Soft-delete: archive instead.
    const [row] = await db
      .update(subscriptionPlansTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(subscriptionPlansTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await audit(actor(req), "plan.archived", {
      targetType: "plan",
      targetId: id,
      summary: `Archived plan ${row.name} (in use by ${inUse} subscriptions)`,
    });
    res.json({ archived: true, plan: row });
    return;
  }
  const [row] = await db
    .delete(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await audit(actor(req), "plan.deleted", {
    targetType: "plan",
    targetId: id,
    summary: `Deleted plan ${row.name}`,
  });
  res.json({ deleted: true, plan: row });
});

// -----------------------------------------------------------------------------
// Subscriptions
// -----------------------------------------------------------------------------

router.get("/admin/subscriptions", async (req, res) => {
  const orgId = req.query.organizationId
    ? Number(req.query.organizationId)
    : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const conds = [];
  if (orgId !== undefined && Number.isFinite(orgId))
    conds.push(eq(subscriptionsTable.organizationId, orgId));
  if (status && (SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) {
    conds.push(eq(subscriptionsTable.status, status));
  }
  const rows = await db
    .select({
      sub: subscriptionsTable,
      plan: subscriptionPlansTable,
      org: organizationsTable,
    })
    .from(subscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(subscriptionsTable.planId, subscriptionPlansTable.id))
    .leftJoin(organizationsTable, eq(subscriptionsTable.organizationId, organizationsTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(subscriptionsTable.createdAt));
  res.json(rows);
});

const CreateSubscriptionBody = z.object({
  organizationId: z.number().int().positive(),
  planId: z.number().int().positive(),
  billingPeriod: z.enum(BILLING_PERIODS).default("monthly"),
  startTrial: z.boolean().default(false),
  seats: z.number().int().min(1).default(1),
  notes: z.string().optional(),
});

router.post("/admin/subscriptions", async (req, res) => {
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues }); return;
  }
  const { organizationId, planId, billingPeriod, startTrial, seats, notes } = parsed.data;

  const result = await db.transaction(async (tx) => {
    // Lock the org row so concurrent subscription creates don't race.
    const [org] = await tx
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organizationId))
      .for("update");
    if (!org) throw Object.assign(new Error("Organization not found"), { code: "NOT_FOUND" });

    const [plan] = await tx
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, planId));
    if (!plan) throw Object.assign(new Error("Plan not found"), { code: "NOT_FOUND" });

    // Cancel any existing non-cancelled subscription (including suspended) so
    // each org has at most one live subscription at a time.
    await tx
      .update(subscriptionsTable)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(subscriptionsTable.organizationId, organizationId),
          inArray(subscriptionsTable.status, ["trialing", "active", "past_due", "suspended"]),
        ),
      );

    const now = new Date();
    const trialEnd = startTrial
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + plan.trialDays))
      : null;
    const periodStart = periodStartOf(now);
    const periodEnd = periodEndFromStart(periodStart, billingPeriod);

    const pricePerPeriod =
      billingPeriod === "yearly" && plan.billingPeriod === "monthly"
        ? plan.priceCents * 12
        : billingPeriod === "monthly" && plan.billingPeriod === "yearly"
        ? Math.round(plan.priceCents / 12)
        : plan.priceCents;

    const [sub] = await tx
      .insert(subscriptionsTable)
      .values({
        organizationId,
        planId,
        status: startTrial ? "trialing" : "active",
        billingPeriod,
        seats,
        trialStartsAt: startTrial ? now : null,
        trialEndsAt: trialEnd,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        pricePerPeriodCents: pricePerPeriod,
        notes: notes ?? null,
      })
      .returning();

    // Mirror status onto the org for fast list queries.
    await tx
      .update(organizationsTable)
      .set({ status: startTrial ? "trial" : "active" })
      .where(eq(organizationsTable.id, organizationId));

    return { sub, plan, org };
  });

  await audit(actor(req), "subscription.created", {
    targetType: "subscription",
    targetId: result.sub.id,
    organizationId: result.sub.organizationId,
    summary: `Subscribed ${result.org.name} to ${result.plan.name} (${billingPeriod}${startTrial ? ", trial" : ""})`,
  });
  res.status(201).json(result.sub);
});

router.patch("/admin/subscriptions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const Body = z.object({
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    seats: z.number().int().min(1).optional(),
    notes: z.string().nullable().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    planId: z.number().int().positive().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues }); return;
  }
  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  // If plan is changing, snapshot the new price.
  if (parsed.data.planId !== undefined) {
    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, parsed.data.planId));
    if (!plan) { res.status(400).json({ error: "Plan not found" }); return; }
    const [existing] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    patch.pricePerPeriodCents =
      existing.billingPeriod === "yearly" && plan.billingPeriod === "monthly"
        ? plan.priceCents * 12
        : existing.billingPeriod === "monthly" && plan.billingPeriod === "yearly"
        ? Math.round(plan.priceCents / 12)
        : plan.priceCents;
  }

  const [row] = await db
    .update(subscriptionsTable)
    .set(patch)
    .where(eq(subscriptionsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  await audit(actor(req), "subscription.updated", {
    targetType: "subscription",
    targetId: id,
    organizationId: row.organizationId,
    summary: `Updated subscription #${id}`,
    details: parsed.data,
  });
  res.json(row);
});

router.post("/admin/subscriptions/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const immediate = req.body?.immediate === true;
  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const now = new Date();
  const [row] = await db
    .update(subscriptionsTable)
    .set(
      immediate
        ? { status: "cancelled", cancelledAt: now, cancelAtPeriodEnd: false, updatedAt: now }
        : { cancelAtPeriodEnd: true, updatedAt: now },
    )
    .where(eq(subscriptionsTable.id, id))
    .returning();

  if (immediate) {
    await db
      .update(organizationsTable)
      .set({ status: "cancelled" })
      .where(eq(organizationsTable.id, existing.organizationId));
  }

  await audit(actor(req), immediate ? "subscription.cancelled_immediate" : "subscription.cancel_scheduled", {
    targetType: "subscription",
    targetId: id,
    organizationId: existing.organizationId,
    summary: immediate
      ? `Cancelled subscription #${id} immediately`
      : `Scheduled subscription #${id} cancellation at period end`,
  });
  res.json(row);
});

// -----------------------------------------------------------------------------
// Organizations (admin lens — list with sub + plan + invoice summary)
// -----------------------------------------------------------------------------

router.get("/admin/organizations", async (req, res) => {
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const conds = [];
  if (search) {
    conds.push(
      or(
        ilike(organizationsTable.name, `%${search}%`),
        ilike(organizationsTable.slug, `%${search}%`),
        ilike(organizationsTable.email, `%${search}%`),
      ),
    );
  }
  if (status && ["active", "trial", "suspended", "cancelled"].includes(status)) {
    conds.push(eq(organizationsTable.status, status));
  }
  const orgs = await db
    .select()
    .from(organizationsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(organizationsTable.createdAt));

  if (orgs.length === 0) { res.json([]); return; }
  const orgIds = orgs.map((o) => o.id);

  const [subs, userCounts, openInvoices] = await Promise.all([
    db
      .select({ sub: subscriptionsTable, plan: subscriptionPlansTable })
      .from(subscriptionsTable)
      .leftJoin(
        subscriptionPlansTable,
        eq(subscriptionsTable.planId, subscriptionPlansTable.id),
      )
      .where(
        and(
          inArray(subscriptionsTable.organizationId, orgIds),
          inArray(subscriptionsTable.status, ["trialing", "active", "past_due"]),
        ),
      ),
    db
      .select({
        organizationId: usersTable.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(usersTable)
      .where(inArray(usersTable.organizationId, orgIds))
      .groupBy(usersTable.organizationId),
    db
      .select({
        organizationId: platformInvoicesTable.organizationId,
        outstandingCents: sql<number>`COALESCE(SUM(${platformInvoicesTable.totalCents} - ${platformInvoicesTable.amountPaidCents}), 0)::int`,
      })
      .from(platformInvoicesTable)
      .where(
        and(
          inArray(platformInvoicesTable.organizationId, orgIds),
          eq(platformInvoicesTable.status, "open"),
        ),
      )
      .groupBy(platformInvoicesTable.organizationId),
  ]);

  const subByOrg = new Map(subs.map((s) => [s.sub.organizationId, s]));
  const userCountByOrg = new Map(userCounts.map((u) => [u.organizationId, u.count]));
  const outstandingByOrg = new Map(openInvoices.map((i) => [i.organizationId, i.outstandingCents]));

  const enriched = orgs.map((o) => ({
    ...o,
    subscription: subByOrg.get(o.id)?.sub ?? null,
    plan: subByOrg.get(o.id)?.plan ?? null,
    userCount: userCountByOrg.get(o.id) ?? 0,
    outstandingCents: outstandingByOrg.get(o.id) ?? 0,
  }));
  res.json(enriched);
});

router.get("/admin/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id));
  if (!org) { res.status(404).json({ error: "Not found" }); return; }

  const [subs, invoices, users] = await Promise.all([
    db
      .select({ sub: subscriptionsTable, plan: subscriptionPlansTable })
      .from(subscriptionsTable)
      .leftJoin(
        subscriptionPlansTable,
        eq(subscriptionsTable.planId, subscriptionPlansTable.id),
      )
      .where(eq(subscriptionsTable.organizationId, id))
      .orderBy(desc(subscriptionsTable.createdAt)),
    db
      .select()
      .from(platformInvoicesTable)
      .where(eq(platformInvoicesTable.organizationId, id))
      .orderBy(desc(platformInvoicesTable.createdAt))
      .limit(50),
    db.select().from(usersTable).where(eq(usersTable.organizationId, id)),
  ]);

  res.json({ org, subscriptions: subs, invoices, users });
});

router.patch("/admin/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const Body = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    cemeteryType: z.enum(CEMETERY_TYPES).optional(),
    cemeteryTypes: z.array(z.enum(CEMETERY_TYPES)).optional(),
    enabledFeatures: z.record(z.enum(PLATFORM_FEATURES), z.boolean()).optional(),
    featuresColumbarium: z.boolean().optional(),
    internalNotes: z.string().nullable().optional(),
    suspensionReason: z.string().nullable().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues }); return;
  }
  // Server-side consistency: every org must have at least one cemetery type;
  // when types or features change, keep the legacy primary `cemeteryType` and
  // `featuresColumbarium` mirror in sync so older code paths still see truth.
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.cemeteryTypes !== undefined) {
    if (parsed.data.cemeteryTypes.length === 0) {
      res.status(400).json({ error: "At least one cemetery type is required." });
      return;
    }
    if (parsed.data.cemeteryType === undefined) {
      patch.cemeteryType = parsed.data.cemeteryTypes[0];
    }
  }
  if (parsed.data.enabledFeatures !== undefined) {
    const cb = parsed.data.enabledFeatures.columbarium;
    if (typeof cb === "boolean" && parsed.data.featuresColumbarium === undefined) {
      patch.featuresColumbarium = cb;
    }
  }
  const [row] = await db
    .update(organizationsTable)
    .set(patch)
    .where(eq(organizationsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await audit(actor(req), "organization.updated", {
    targetType: "organization",
    targetId: id,
    organizationId: id,
    summary: `Updated ${row.name}`,
    details: parsed.data,
  });
  res.json(row);
});

router.post("/admin/organizations/:id/suspend", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const reason =
    typeof req.body?.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim()
      : null;
  const result = await db.transaction(async (tx) => {
    const [org] = await tx
      .update(organizationsTable)
      .set({ status: "suspended", suspendedAt: new Date(), suspensionReason: reason })
      .where(eq(organizationsTable.id, id))
      .returning();
    if (!org) return null;
    await tx
      .update(subscriptionsTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(
        and(
          eq(subscriptionsTable.organizationId, id),
          inArray(subscriptionsTable.status, ["trialing", "active", "past_due"]),
        ),
      );
    return org;
  });
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  await audit(actor(req), "organization.suspended", {
    targetType: "organization",
    targetId: id,
    organizationId: id,
    summary: `Suspended ${result.name}${reason ? `: ${reason}` : ""}`,
  });
  res.json(result);
});

router.post("/admin/organizations/:id/reactivate", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db.transaction(async (tx) => {
    const [org] = await tx
      .update(organizationsTable)
      .set({ status: "active", suspendedAt: null, suspensionReason: null })
      .where(eq(organizationsTable.id, id))
      .returning();
    if (!org) return null;
    // Restore every suspended subscription on this org back to active.
    // Normally there is exactly one, but be defensive.
    await tx
      .update(subscriptionsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(subscriptionsTable.organizationId, id),
          eq(subscriptionsTable.status, "suspended"),
        ),
      );
    return org;
  });
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  await audit(actor(req), "organization.reactivated", {
    targetType: "organization",
    targetId: id,
    organizationId: id,
    summary: `Reactivated ${result.name}`,
  });
  res.json(result);
});

router.delete("/admin/organizations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id));
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(organizationsTable).where(eq(organizationsTable.id, id));
  await audit(actor(req), "organization.deleted", {
    targetType: "organization",
    targetId: id,
    organizationId: id,
    summary: `Deleted ${org.name}`,
  });
  res.status(204).send();
});

// -----------------------------------------------------------------------------
// Platform invoices
// -----------------------------------------------------------------------------

router.get("/admin/platform-invoices", async (req, res) => {
  const orgId = req.query.organizationId
    ? Number(req.query.organizationId)
    : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const conds = [];
  if (orgId !== undefined && Number.isFinite(orgId))
    conds.push(eq(platformInvoicesTable.organizationId, orgId));
  if (status && (PLATFORM_INVOICE_STATUSES as readonly string[]).includes(status)) {
    conds.push(eq(platformInvoicesTable.status, status));
  }
  const rows = await db
    .select({ inv: platformInvoicesTable, org: organizationsTable })
    .from(platformInvoicesTable)
    .leftJoin(organizationsTable, eq(platformInvoicesTable.organizationId, organizationsTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(platformInvoicesTable.createdAt));
  res.json(rows);
});

router.get("/admin/platform-invoices/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [inv] = await db
    .select()
    .from(platformInvoicesTable)
    .where(eq(platformInvoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, inv.organizationId));
  const payments = await db
    .select()
    .from(platformPaymentsTable)
    .where(eq(platformPaymentsTable.invoiceId, id))
    .orderBy(desc(platformPaymentsTable.paidAt));
  res.json({ invoice: inv, organization: org, payments });
});

const CreateInvoiceBody = z.object({
  organizationId: z.number().int().positive(),
  subscriptionId: z.number().int().positive().optional(),
  periodStart: z.string(), // ISO
  periodEnd: z.string(),
  dueDate: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().min(1),
        unitPriceCents: z.number().int().min(0),
      }),
    )
    .min(1),
  taxCents: z.number().int().min(0).default(0),
});

router.post("/admin/platform-invoices", async (req, res) => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues }); return;
  }
  const lineItems = parsed.data.lineItems.map((li) => ({
    ...li,
    lineTotalCents: li.quantity * li.unitPriceCents,
  }));
  const subtotalCents = lineItems.reduce((sum, li) => sum + li.lineTotalCents, 0);
  const totalCents = subtotalCents + parsed.data.taxCents;

  const [row] = await db
    .insert(platformInvoicesTable)
    .values({
      organizationId: parsed.data.organizationId,
      subscriptionId: parsed.data.subscriptionId ?? null,
      status: "draft",
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      subtotalCents,
      taxCents: parsed.data.taxCents,
      totalCents,
      description: parsed.data.description ?? null,
      notes: parsed.data.notes ?? null,
      lineItems,
    })
    .returning();

  await audit(actor(req), "invoice.created", {
    targetType: "invoice",
    targetId: row.id,
    organizationId: row.organizationId,
    summary: `Created draft invoice #${row.id} ($${(totalCents / 100).toFixed(2)})`,
  });
  res.status(201).json(row);
});

router.post("/admin/platform-invoices/:id/issue", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Status-guarded UPDATE so concurrent issues collapse: only one wins.
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(platformInvoicesTable)
      .where(eq(platformInvoicesTable.id, id))
      .for("update");
    if (!existing) return { code: "NOT_FOUND" as const };
    if (existing.status !== "draft") return { code: "BAD_STATUS" as const, current: existing.status };

    // Retry-on-23505 for the unique invoice number.
    let attempts = 0;
    while (attempts < 8) {
      const number = await nextPlatformInvoiceNumber();
      try {
        const [row] = await tx
          .update(platformInvoicesTable)
          .set({
            status: "open",
            invoiceNumber: number,
            issuedAt: new Date(),
            dueDate: existing.dueDate ?? new Date(Date.now() + 14 * 86_400_000),
          })
          .where(eq(platformInvoicesTable.id, id))
          .returning();
        return { code: "OK" as const, row };
      } catch (e: unknown) {
        if (typeof e === "object" && e && (e as { code?: string }).code === "23505") {
          attempts++;
          continue;
        }
        throw e;
      }
    }
    return { code: "RETRY_EXHAUSTED" as const };
  });

  if (result.code === "NOT_FOUND") { res.status(404).json({ error: "Not found" }); return; }
  if (result.code === "BAD_STATUS") {
    res.status(409).json({ error: `Cannot issue invoice in status '${result.current}'` });
    return;
  }
  if (result.code === "RETRY_EXHAUSTED") {
    res.status(503).json({ error: "Could not allocate invoice number" });
    return;
  }

  await audit(actor(req), "invoice.issued", {
    targetType: "invoice",
    targetId: id,
    organizationId: result.row.organizationId,
    summary: `Issued ${result.row.invoiceNumber}`,
  });
  res.json(result.row);
});

const RecordPaymentBody = z.object({
  amountCents: z.number().int().min(1),
  method: z.enum(PLATFORM_PAYMENT_METHODS).default("manual"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional(),
});

router.post("/admin/platform-invoices/:id/pay", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues }); return;
  }

  const result = await db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(platformInvoicesTable)
      .where(eq(platformInvoicesTable.id, id))
      .for("update");
    if (!inv) return { code: "NOT_FOUND" as const };
    if (inv.status === "void" || inv.status === "uncollectible")
      return { code: "BAD_STATUS" as const, current: inv.status };

    const [payment] = await tx
      .insert(platformPaymentsTable)
      .values({
        invoiceId: id,
        organizationId: inv.organizationId,
        amountCents: parsed.data.amountCents,
        method: parsed.data.method,
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
        paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
      })
      .returning();

    const newPaid = inv.amountPaidCents + parsed.data.amountCents;
    const fullyPaid = newPaid >= inv.totalCents;

    const [updated] = await tx
      .update(platformInvoicesTable)
      .set({
        amountPaidCents: newPaid,
        status: fullyPaid ? "paid" : inv.status === "draft" ? "open" : inv.status,
        paidAt: fullyPaid ? new Date() : inv.paidAt,
      })
      .where(eq(platformInvoicesTable.id, id))
      .returning();

    return { code: "OK" as const, payment, invoice: updated };
  });

  if (result.code === "NOT_FOUND") { res.status(404).json({ error: "Not found" }); return; }
  if (result.code === "BAD_STATUS") {
    res.status(409).json({ error: `Cannot pay invoice in status '${result.current}'` });
    return;
  }
  if (result.code !== "OK") return;

  await audit(actor(req), "invoice.payment_recorded", {
    targetType: "invoice",
    targetId: id,
    organizationId: result.invoice.organizationId,
    summary: `Recorded $${(parsed.data.amountCents / 100).toFixed(2)} payment on ${result.invoice.invoiceNumber ?? `#${id}`}`,
  });
  res.status(201).json(result);
});

router.post("/admin/platform-invoices/:id/void", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db
    .select()
    .from(platformInvoicesTable)
    .where(eq(platformInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "paid") {
    res.status(409).json({ error: "Cannot void a paid invoice" });
    return;
  }
  if (existing.status === "void") {
    res.status(409).json({ error: "Already voided" });
    return;
  }

  const [row] = await db
    .update(platformInvoicesTable)
    .set({ status: "void", voidedAt: new Date() })
    .where(eq(platformInvoicesTable.id, id))
    .returning();
  await audit(actor(req), "invoice.voided", {
    targetType: "invoice",
    targetId: id,
    organizationId: row.organizationId,
    summary: `Voided ${row.invoiceNumber ?? `#${id}`}`,
  });
  res.json(row);
});

// -----------------------------------------------------------------------------
// Audit log
// -----------------------------------------------------------------------------

router.get("/admin/audit-log", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const orgId = req.query.organizationId
    ? Number(req.query.organizationId)
    : undefined;
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const since = typeof req.query.since === "string" ? new Date(req.query.since) : undefined;
  const conds = [];
  if (orgId !== undefined && Number.isFinite(orgId))
    conds.push(eq(auditLogTable.organizationId, orgId));
  if (action) conds.push(ilike(auditLogTable.action, `${action}%`));
  if (since && !Number.isNaN(since.getTime()))
    conds.push(gte(auditLogTable.createdAt, since));
  const rows = await db
    .select()
    .from(auditLogTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit);
  res.json(rows);
});

// -----------------------------------------------------------------------------
// All-orgs user search (for the "Users" admin page)
// -----------------------------------------------------------------------------

router.get("/admin/users", async (req, res) => {
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const conds = [];
  if (search) {
    conds.push(
      or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.name, `%${search}%`),
      ),
    );
  }
  const rows = await db
    .select({ user: usersTable, org: organizationsTable })
    .from(usersTable)
    .leftJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit);
  res.json(rows);
});

/* ── Demo store seed ─────────────────────────────────────────────────── */

function pollImg(prompt: string, seed: number) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1400&height=1000&model=flux&seed=${seed}&nologo=true`;
}

const DEMO_PRODUCTS: Array<{
  name: string; description: string;
  category: "flowers" | "urns" | "services" | "other";
  price: number; imageUrl: string; inStock: boolean; stockCount: number;
}> = [
  { name: "White Rose Memorial Bouquet", description: "12 long-stem white roses hand-tied with satin ribbon. Delivered fresh to the gravesite.", category: "flowers", price: 49.99, imageUrl: pollImg("studio product photo of a white rose memorial bouquet with satin ribbon on a neutral stone surface, soft natural light, photorealistic", 101), inStock: true, stockCount: 50 },
  { name: "Sympathy Lilies Arrangement", description: "Elegant white lilies with eucalyptus and baby's breath in a ceramic vase.", category: "flowers", price: 79.99, imageUrl: pollImg("elegant sympathy lilies arrangement in ceramic vase, memorial tribute floral product photography, clean background, photorealistic", 102), inStock: true, stockCount: 30 },
  { name: "White Chrysanthemum Wreath", description: "Traditional circular wreath of white chrysanthemums — a dignified tribute for any memorial.", category: "flowers", price: 89.99, imageUrl: pollImg("white chrysanthemum memorial wreath standing upright, respectful funeral product shot, realistic details, soft shadows", 103), inStock: true, stockCount: 20 },
  { name: "Forget-Me-Not Memory Basket", description: "Delicate forget-me-nots nestled in a woven willow basket with moss.", category: "flowers", price: 59.99, imageUrl: pollImg("forget me not flowers in a woven willow memory basket with moss, memorial gift product image, realistic", 104), inStock: true, stockCount: 40 },
  { name: "Classic Bronze Urn", description: "Hand-cast solid bronze urn with brushed finish and engraved nameplate. Holds up to 200 cubic inches.", category: "urns", price: 249.99, imageUrl: pollImg("classic bronze cremation urn with brushed metal finish and engraved plate, premium product photography, photorealistic", 201), inStock: true, stockCount: 15 },
  { name: "Biodegradable Earth Urn", description: "Eco-friendly sand and gelatin urn designed for water or earth burial. Dissolves naturally within 48 hours.", category: "urns", price: 129.99, imageUrl: pollImg("biodegradable eco urn made of natural sand material, modern memorial product photo on neutral background, realistic", 202), inStock: true, stockCount: 25 },
  { name: "Marble Keepsake Urn", description: "Carrara marble mini urn for sharing ashes among family. Sealed brass threaded lid.", category: "urns", price: 189.99, imageUrl: pollImg("small carrara marble keepsake urn with brass lid, close up studio product image, realistic stone texture", 203), inStock: true, stockCount: 18 },
  { name: "Granite Headstone — Classic Gray", description: "Polished gray granite headstone with beveled edges. Includes custom engraving of name and dates.", category: "other", price: 899.99, imageUrl: pollImg("polished gray granite headstone with engraved text in cemetery display setting, product-focused composition, photorealistic", 301), inStock: true, stockCount: 8 },
  { name: "Bronze Memorial Plaque", description: "Cast bronze wall or ground plaque with UV-resistant lacquer. 8×10 inches, mounting hardware included.", category: "other", price: 349.99, imageUrl: pollImg("cast bronze memorial plaque with mounting hardware on stone background, high detail product photo, realistic", 302), inStock: true, stockCount: 12 },
  { name: "Upright Marble Monument", description: "Statuary white marble upright monument with carved floral relief. Full installation coordination included.", category: "other", price: 1499.99, imageUrl: pollImg("upright white marble monument with carved floral relief, premium memorial product image, realistic lighting", 303), inStock: true, stockCount: 5 },
  { name: "Weekly Grave Care Plan", description: "Ongoing maintenance: trimming, debris removal, flower refreshing, and seasonal decorations.", category: "services", price: 29.99, imageUrl: pollImg("professional grave care service scene with caretaker cleaning headstone and fresh flowers, respectful realistic photo", 401), inStock: true, stockCount: 100 },
  { name: "Memorial Photography Session", description: "Professional photographer captures the memorial site, floral tributes, and family portraits.", category: "services", price: 149.99, imageUrl: pollImg("memorial photography service concept with camera and framed floral gravesite in background, realistic professional look", 402), inStock: true, stockCount: 20 },
  { name: "Headstone Cleaning & Restoration", description: "Gentle non-abrasive cleaning, moss removal, and minor repair of weathered inscriptions.", category: "services", price: 199.99, imageUrl: pollImg("headstone cleaning and restoration service in progress, before and after style visual, realistic respectful scene", 403), inStock: true, stockCount: 15 },
];

router.post("/admin/seed-store", async (_req, res) => {
  // Wipe existing demo products and replace with fresh set
  await db.delete(productsTable);
  const inserted = await db.insert(productsTable).values(DEMO_PRODUCTS).returning({ id: productsTable.id, name: productsTable.name });
  res.json({ seeded: inserted.length, products: inserted.map(p => p.name) });
});

export default router;
