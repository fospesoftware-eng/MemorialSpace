import { db, invoicesTable, invoiceItemsTable, paymentsTable, taxRatesTable } from "@workspace/db";
import { and, asc, eq, inArray, like, sql } from "drizzle-orm";

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface IncomingItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateId?: number | null;
}

export interface ComputedItem extends IncomingItem {
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  position: number;
}

export interface ComputedTotals {
  items: ComputedItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Thrown when an invoice references a tax rate that doesn't belong to the
 * organization. Routes catch this and return 400.
 */
export class TaxRateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxRateValidationError";
  }
}

/**
 * Look up referenced tax rates and compute per-line + invoice totals.
 *
 * Validates that every `taxRateId` actually belongs to `organizationId`.
 * If any referenced rate is missing or cross-org we throw
 * `TaxRateValidationError` so the route can return 400 instead of silently
 * computing 0% tax.
 */
export async function computeInvoiceTotals(
  organizationId: number,
  rawItems: IncomingItem[],
): Promise<ComputedTotals> {
  const taxRateIds = Array.from(
    new Set(rawItems.map((i) => i.taxRateId).filter((v): v is number => typeof v === "number")),
  );

  let rateById = new Map<number, number>();
  if (taxRateIds.length) {
    const taxRates = await db
      .select()
      .from(taxRatesTable)
      .where(
        and(
          eq(taxRatesTable.organizationId, organizationId),
          inArray(taxRatesTable.id, taxRateIds),
        ),
      );
    rateById = new Map(taxRates.map((t) => [t.id, t.ratePercent]));
    const missing = taxRateIds.filter((id) => !rateById.has(id));
    if (missing.length) {
      throw new TaxRateValidationError(
        `Tax rate(s) ${missing.join(", ")} do not belong to organization ${organizationId}`,
      );
    }
  }

  const items: ComputedItem[] = rawItems.map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const lineSubtotal = round2(qty * price);
    const ratePct = item.taxRateId != null ? (rateById.get(item.taxRateId) ?? 0) : 0;
    const lineTax = round2(lineSubtotal * (ratePct / 100));
    const lineTotal = round2(lineSubtotal + lineTax);
    return {
      description: item.description,
      quantity: qty,
      unitPrice: price,
      taxRateId: item.taxRateId ?? null,
      lineSubtotal,
      lineTax,
      lineTotal,
      position: index,
    };
  });

  const subtotal = round2(items.reduce((s, i) => s + i.lineSubtotal, 0));
  const taxTotal = round2(items.reduce((s, i) => s + i.lineTax, 0));
  const total = round2(subtotal + taxTotal);

  return { items, subtotal, taxTotal, total };
}

/**
 * Generate the next invoice number for an organization in the given year.
 * Format: INV-{YYYY}-{0001..9999}.
 *
 * Uses MAX-based parsing instead of count(*) so deleted/voided drafts don't
 * shift future numbers, and is paired with a unique index on
 * (organization_id, invoice_number) plus a retry-on-conflict loop in the
 * issue route — that combination is what actually makes allocation
 * race-safe under concurrent issuers.
 */
export async function generateInvoiceNumber(organizationId: number, year: number): Promise<string> {
  const prefix = `INV-${year}-`;
  const rows = await db
    .select({ invoiceNumber: invoicesTable.invoiceNumber })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, organizationId),
        like(invoicesTable.invoiceNumber, `${prefix}%`),
      ),
    );

  let max = 0;
  for (const r of rows) {
    const tail = r.invoiceNumber?.slice(prefix.length) ?? "";
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/**
 * True iff a thrown error is a Postgres unique-violation (SQLSTATE 23505).
 * Used by the invoice-issue retry loop.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Recompute amountPaid + status for an invoice based on its current
 * payments. Voided and draft invoices are left alone.
 */
export async function recomputeInvoicePayments(invoiceId: number): Promise<void> {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!invoice) return;
  if (invoice.status === "voided" || invoice.status === "draft") return;

  const [{ paid }] = await db
    .select({ paid: sql<number>`COALESCE(SUM(${paymentsTable.amount}), 0)::float8` })
    .from(paymentsTable)
    .where(eq(paymentsTable.invoiceId, invoiceId));

  const amountPaid = Math.max(0, round2(Number(paid ?? 0)));
  let status: typeof invoice.status = "issued";
  let paidDate: string | null = invoice.paidDate ?? null;
  if (amountPaid >= invoice.total - 0.005) {
    status = "paid";
    if (!paidDate) paidDate = new Date().toISOString().slice(0, 10);
  } else if (amountPaid > 0) {
    status = "partially_paid";
    paidDate = null;
  } else {
    paidDate = null;
  }

  await db
    .update(invoicesTable)
    .set({ amountPaid, status, paidDate })
    .where(eq(invoicesTable.id, invoiceId));
}

/**
 * Load an invoice with its items in display order.
 */
export async function loadInvoiceWithItems(invoiceId: number) {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!invoice) return null;
  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, invoiceId))
    .orderBy(asc(invoiceItemsTable.position));
  return { ...invoice, items };
}
