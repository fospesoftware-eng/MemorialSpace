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
  insertSubscriptionPlanSchema,
  insertSubscriptionSchema,
  insertPlatformInvoiceSchema,
  insertPlatformPaymentSchema,
  SUBSCRIPTION_STATUSES,
  PLATFORM_INVOICE_STATUSES,
  BILLING_PERIODS,
  PLATFORM_PAYMENT_METHODS,
} from "@workspace/db";
import { and, desc, eq, gte, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

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

function actor(req: { headers: Record<string, unknown> }): string | undefined {
  const v = req.headers["x-admin-email"];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
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
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
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
      return res.status(409).json({ error: "Plan slug already exists" });
    }
    throw e;
  }
});

router.patch("/admin/plans/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const Partial = insertSubscriptionPlanSchema.partial();
  const parsed = Partial.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
  }
  const [row] = await db
    .update(subscriptionPlansTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(subscriptionPlansTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
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
    if (!row) return res.status(404).json({ error: "Not found" });
    await audit(actor(req), "plan.archived", {
      targetType: "plan",
      targetId: id,
      summary: `Archived plan ${row.name} (in use by ${inUse} subscriptions)`,
    });
    return res.json({ archived: true, plan: row });
  }
  const [row] = await db
    .delete(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
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
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const Body = z.object({
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    seats: z.number().int().min(1).optional(),
    notes: z.string().nullable().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    planId: z.number().int().positive().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
  }
  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  // If plan is changing, snapshot the new price.
  if (parsed.data.planId !== undefined) {
    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, parsed.data.planId));
    if (!plan) return res.status(400).json({ error: "Plan not found" });
    const [existing] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
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
  if (!row) return res.status(404).json({ error: "Not found" });

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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const immediate = req.body?.immediate === true;
  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

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

  if (orgs.length === 0) return res.json([]);
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id));
  if (!org) return res.status(404).json({ error: "Not found" });

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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const Body = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    internalNotes: z.string().nullable().optional(),
    suspensionReason: z.string().nullable().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
  }
  const [row] = await db
    .update(organizationsTable)
    .set(parsed.data)
    .where(eq(organizationsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
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
  if (!result) return res.status(404).json({ error: "Not found" });
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
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
  if (!result) return res.status(404).json({ error: "Not found" });
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id));
  if (!org) return res.status(404).json({ error: "Not found" });
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [inv] = await db
    .select()
    .from(platformInvoicesTable)
    .where(eq(platformInvoicesTable.id, id));
  if (!inv) return res.status(404).json({ error: "Not found" });
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
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

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

  if (result.code === "NOT_FOUND") return res.status(404).json({ error: "Not found" });
  if (result.code === "BAD_STATUS")
    return res
      .status(409)
      .json({ error: `Cannot issue invoice in status '${result.current}'` });
  if (result.code === "RETRY_EXHAUSTED")
    return res.status(503).json({ error: "Could not allocate invoice number" });

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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
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

  if (result.code === "NOT_FOUND") return res.status(404).json({ error: "Not found" });
  if (result.code === "BAD_STATUS")
    return res
      .status(409)
      .json({ error: `Cannot pay invoice in status '${result.current}'` });

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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [existing] = await db
    .select()
    .from(platformInvoicesTable)
    .where(eq(platformInvoicesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "paid")
    return res.status(409).json({ error: "Cannot void a paid invoice" });
  if (existing.status === "void")
    return res.status(409).json({ error: "Already voided" });

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

export default router;
