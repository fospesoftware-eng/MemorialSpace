import { Router, type IRouter } from "express";
import { db, invoicesTable, paymentsTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { GetAccountingSummaryQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

const round2 = (n: number): number => Math.round(n * 100) / 100;

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
  maxDays: number; // upper bound (inclusive). Number.POSITIVE_INFINITY for the last bucket.
}

router.get("/accounting/summary", async (req, res): Promise<void> => {
  const params = GetAccountingSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { organizationId } = params.data;

  const allInvoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.organizationId, organizationId));

  const today = new Date();
  const startOfMonthIso = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString();

  const [{ paidThisMonth }] = await db
    .select({ paidThisMonth: sql<number>`COALESCE(SUM(${paymentsTable.amount}), 0)::float8` })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.organizationId, organizationId),
        gte(paymentsTable.paymentDate, startOfMonthIso.slice(0, 10)),
      ),
    );

  let totalOutstanding = 0;
  let totalOverdue = 0;
  let invoicedThisMonth = 0;
  let draftCount = 0;
  let issuedCount = 0;
  let overdueCount = 0;
  let paidCount = 0;

  // Aging buckets in days past due (only counts open invoices).
  const buckets: AgingBucket[] = [
    { label: "Current", count: 0, amount: 0, maxDays: 0 },
    { label: "1-30", count: 0, amount: 0, maxDays: 30 },
    { label: "31-60", count: 0, amount: 0, maxDays: 60 },
    { label: "61-90", count: 0, amount: 0, maxDays: 90 },
    { label: "90+", count: 0, amount: 0, maxDays: Number.POSITIVE_INFINITY },
  ];

  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  for (const inv of allInvoices) {
    if (inv.createdAt && inv.createdAt.toISOString() >= startOfMonthIso) {
      invoicedThisMonth += inv.total ?? 0;
    }

    if (inv.status === "draft") draftCount += 1;
    if (inv.status === "issued") issuedCount += 1;
    if (inv.status === "paid") paidCount += 1;

    if (inv.status === "voided" || inv.status === "draft" || inv.status === "paid") continue;

    const balance = round2((inv.total ?? 0) - (inv.amountPaid ?? 0));
    if (balance <= 0) continue;
    totalOutstanding += balance;

    const dueIso = inv.dueDate ?? inv.issueDate;
    let daysPastDue = 0;
    if (dueIso) {
      const due = new Date(dueIso + "T00:00:00Z").getTime();
      daysPastDue = Math.max(0, Math.floor((todayMs - due) / 86_400_000));
    }
    if (daysPastDue > 0) {
      totalOverdue += balance;
      overdueCount += 1;
    }

    const bucket = buckets.find((b) => daysPastDue <= b.maxDays) ?? buckets[buckets.length - 1];
    bucket.count += 1;
    bucket.amount = round2(bucket.amount + balance);
  }

  res.json({
    totalOutstanding: round2(totalOutstanding),
    totalOverdue: round2(totalOverdue),
    paidThisMonth: round2(paidThisMonth ?? 0),
    invoicedThisMonth: round2(invoicedThisMonth),
    draftCount,
    issuedCount,
    overdueCount,
    paidCount,
    aging: buckets.map(({ label, count, amount }) => ({ label, count, amount })),
  });
});

export default router;
