/**
 * Seeds the SaaS billing module with three default plans, assigns each
 * existing organization to a plan with a sensible mix of trial/active
 * subscriptions, generates a few platform invoices, and records one paid
 * invoice. Idempotent: running it twice is a no-op for plans (slug-unique)
 * and only creates subscriptions for orgs that don't already have one.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-saas
 */
import {
  db,
  organizationsTable,
  subscriptionPlansTable,
  subscriptionsTable,
  platformInvoicesTable,
  platformPaymentsTable,
  auditLogTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

const PLANS = [
  {
    name: "Starter",
    slug: "starter",
    description: "For small cemeteries starting digital transformation. 1 map, up to 500 spots, 3 users.",
    priceCents: 4900,
    trialDays: 14,
    maxUsers: 3,
    maxPlots: 500,
    maxStorageMb: 2_000,
    features: { maps: 1, spots: 500, columbariums: 0, mausoleums: 0, website: true, accounting: false, ai_map: false, qr: true, columbarium: false },
    isFeatured: false,
    displayOrder: 1,
  },
  {
    name: "Professional",
    slug: "professional",
    description: "For growing cemetery, columbarium, and mausoleum operators. 3 maps, up to 5,000 spots, 1 columbarium, 1 mausoleum, 15 users.",
    priceCents: 14900,
    trialDays: 14,
    maxUsers: 15,
    maxPlots: 5_000,
    maxStorageMb: 20_000,
    features: { maps: 3, spots: 5_000, columbariums: 1, mausoleums: 1, website: true, accounting: true, ai_map: true, qr: true, columbarium: true },
    isFeatured: true,
    displayOrder: 2,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "For municipalities, cemetery groups, and multi-location memorial operators. 10 maps, unlimited spots, up to 5 columbariums and 5 mausoleums.",
    priceCents: 49900,
    trialDays: 30,
    maxUsers: null,
    maxPlots: null,
    maxStorageMb: null,
    features: {
      maps: 10,
      spots: null,
      columbariums: 5,
      mausoleums: 5,
      website: true,
      accounting: true,
      ai_map: true,
      qr: true,
      columbarium: true,
      priority_support: true,
      sso: true,
    },
    isFeatured: false,
    displayOrder: 3,
  },
] as const;

async function main(): Promise<void> {
  console.log("Seeding SaaS billing module…");

  // 1. Plans (insert-or-update by slug).
  for (const p of PLANS) {
    const [existing] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.slug, p.slug));
    if (existing) {
      await db
        .update(subscriptionPlansTable)
        .set({ ...p, updatedAt: new Date() })
        .where(eq(subscriptionPlansTable.id, existing.id));
      console.log(`  • plan ${p.slug} updated`);
    } else {
      await db.insert(subscriptionPlansTable).values(p);
      console.log(`  • plan ${p.slug} inserted`);
    }
  }

  const plans = await db.select().from(subscriptionPlansTable);
  const byName = new Map(plans.map((p) => [p.slug, p]));

  // 2. Assign each existing org to a plan if it doesn't have a live sub.
  const orgs = await db.select().from(organizationsTable);
  console.log(`Found ${orgs.length} organizations`);

  let i = 0;
  const distribution = ["professional", "starter", "professional", "enterprise", "starter"];
  for (const org of orgs) {
    const live = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.organizationId, org.id),
          inArray(subscriptionsTable.status, ["trialing", "active", "past_due"]),
        ),
      );
    if (live.length > 0) {
      console.log(`  • ${org.name}: already has subscription, skipping`);
      i++;
      continue;
    }
    const slug = distribution[i % distribution.length];
    const plan = byName.get(slug)!;
    const isTrial = i % 4 === 1;
    const now = new Date();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()));
    const trialEnd = isTrial
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + plan.trialDays))
      : null;

    await db.insert(subscriptionsTable).values({
      organizationId: org.id,
      planId: plan.id,
      status: isTrial ? "trialing" : "active",
      billingPeriod: "monthly",
      seats: 1,
      trialStartsAt: isTrial ? now : null,
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      pricePerPeriodCents: plan.priceCents,
    });
    await db
      .update(organizationsTable)
      .set({ status: isTrial ? "trial" : "active" })
      .where(eq(organizationsTable.id, org.id));
    console.log(`  • ${org.name}: subscribed to ${plan.name}${isTrial ? " (trialing)" : ""}`);
    i++;
  }

  // 3. Generate one paid invoice for the first active org so the
  //    dashboard has revenue + a payment to show off.
  const firstActive = orgs.find((o) => o.status === "active") ?? orgs[0];
  if (firstActive) {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.organizationId, firstActive.id))
      .limit(1);
    if (sub) {
      const existingDemo = await db
        .select()
        .from(platformInvoicesTable)
        .where(eq(platformInvoicesTable.organizationId, firstActive.id));
      if (existingDemo.length === 0) {
        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
        const lineItem = {
          description: `Subscription — Last month`,
          quantity: 1,
          unitPriceCents: sub.pricePerPeriodCents,
          lineTotalCents: sub.pricePerPeriodCents,
        };
        const [inv] = await db
          .insert(platformInvoicesTable)
          .values({
            organizationId: firstActive.id,
            subscriptionId: sub.id,
            invoiceNumber: `PINV-${new Date().getUTCFullYear()}-0001`,
            status: "paid",
            periodStart,
            periodEnd,
            issuedAt: periodEnd,
            dueDate: new Date(periodEnd.getTime() + 14 * 86_400_000),
            paidAt: new Date(periodEnd.getTime() + 5 * 86_400_000),
            subtotalCents: sub.pricePerPeriodCents,
            taxCents: 0,
            totalCents: sub.pricePerPeriodCents,
            amountPaidCents: sub.pricePerPeriodCents,
            description: "Monthly subscription",
            lineItems: [lineItem],
          })
          .returning();
        await db.insert(platformPaymentsTable).values({
          invoiceId: inv.id,
          organizationId: firstActive.id,
          amountCents: sub.pricePerPeriodCents,
          method: "card",
          reference: "ch_seed_demo",
          paidAt: inv.paidAt!,
        });
        console.log(`  • Paid invoice ${inv.invoiceNumber} seeded for ${firstActive.name}`);
      }
    }
  }

  // 4. A couple of audit log entries so the support page isn't empty.
  await db.insert(auditLogTable).values([
    {
      actorEmail: "system",
      action: "seed.completed",
      summary: "Seeded SaaS plans and subscriptions",
    },
  ]);

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
