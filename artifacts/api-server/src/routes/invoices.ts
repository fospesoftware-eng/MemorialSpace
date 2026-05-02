import { Router, type IRouter } from "express";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  customersTable,
  paymentsTable,
} from "@workspace/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  DeleteInvoiceParams,
  IssueInvoiceParams,
  VoidInvoiceParams,
  ListInvoicesQueryParams,
} from "@workspace/api-zod";
import {
  computeInvoiceTotals,
  generateInvoiceNumber,
  isUniqueViolation,
  loadInvoiceWithItems,
  TaxRateValidationError,
} from "../lib/accounting";

const router: IRouter = Router();

const round2 = (n: number): number => Math.round(n * 100) / 100;

router.get("/invoices", async (req, res): Promise<void> => {
  const params = ListInvoicesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { organizationId, status, customerId } = params.data;
  if (organizationId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const conditions = [eq(invoicesTable.organizationId, organizationId)];
  if (status) conditions.push(eq(invoicesTable.status, status));
  if (customerId != null) conditions.push(eq(invoicesTable.customerId, customerId));

  const rows = await db
    .select({
      id: invoicesTable.id,
      organizationId: invoicesTable.organizationId,
      customerId: invoicesTable.customerId,
      bookingId: invoicesTable.bookingId,
      invoiceNumber: invoicesTable.invoiceNumber,
      status: invoicesTable.status,
      issueDate: invoicesTable.issueDate,
      dueDate: invoicesTable.dueDate,
      subtotal: invoicesTable.subtotal,
      taxTotal: invoicesTable.taxTotal,
      total: invoicesTable.total,
      amountPaid: invoicesTable.amountPaid,
      notes: invoicesTable.notes,
      createdAt: invoicesTable.createdAt,
      updatedAt: invoicesTable.updatedAt,
      customerName: customersTable.name,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(and(...conditions))
    .orderBy(desc(invoicesTable.createdAt));

  res.json(
    rows.map((r) => ({
      ...r,
      customerName: r.customerName ?? "(deleted customer)",
      balanceDue: round2((r.total ?? 0) - (r.amountPaid ?? 0)),
    })),
  );
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid invoice body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { organizationId, customerId, bookingId, issueDate, dueDate, notes, items } = parsed.data;

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer || customer.organizationId !== organizationId) {
    res.status(400).json({ error: "Customer does not belong to organization" });
    return;
  }

  let totals;
  try {
    totals = await computeInvoiceTotals(organizationId, items);
  } catch (err) {
    if (err instanceof TaxRateValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      organizationId,
      customerId,
      bookingId: bookingId ?? null,
      issueDate: issueDate ?? null,
      dueDate: dueDate ?? null,
      notes: notes ?? null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid: 0,
      status: "draft",
    })
    .returning();

  if (totals.items.length) {
    await db.insert(invoiceItemsTable).values(
      totals.items.map((i) => ({
        invoiceId: invoice.id,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRateId: i.taxRateId ?? null,
        lineSubtotal: i.lineSubtotal,
        lineTax: i.lineTax,
        lineTotal: i.lineTotal,
        position: i.position,
      })),
    );
  }

  const full = await loadInvoiceWithItems(invoice.id);
  res.status(201).json(full);
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgIdRaw = req.query.organizationId;
  const orgId = orgIdRaw != null ? Number(orgIdRaw) : NaN;
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, params.data.id), eq(invoicesTable.organizationId, orgId)));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const [items, payments, [customer]] = await Promise.all([
    db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, invoice.id))
      .orderBy(asc(invoiceItemsTable.position)),
    db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.invoiceId, invoice.id))
      .orderBy(desc(paymentsTable.paymentDate)),
    db.select().from(customersTable).where(eq(customersTable.id, invoice.customerId)),
  ]);

  res.json({
    ...invoice,
    items,
    payments,
    customer: customer ?? null,
    balanceDue: round2((invoice.total ?? 0) - (invoice.amountPaid ?? 0)),
  });
});

router.put("/invoices/:id", async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.id, params.data.id),
        eq(invoicesTable.organizationId, parsed.data.organizationId),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (existing.status !== "draft") {
    res.status(400).json({ error: "Only draft invoices can be edited" });
    return;
  }

  const { customerId, bookingId, issueDate, dueDate, notes, items } = parsed.data;
  // Validate the (possibly changed) customer is also in the same org.
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer || customer.organizationId !== existing.organizationId) {
    res.status(400).json({ error: "Customer does not belong to organization" });
    return;
  }

  let totals;
  try {
    totals = await computeInvoiceTotals(existing.organizationId, items);
  } catch (err) {
    if (err instanceof TaxRateValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  await db
    .update(invoicesTable)
    .set({
      customerId,
      bookingId: bookingId ?? null,
      issueDate: issueDate ?? null,
      dueDate: dueDate ?? null,
      notes: notes ?? null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
    })
    .where(eq(invoicesTable.id, existing.id));

  // Replace line items wholesale — simpler than diffing for the MVP.
  await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, existing.id));
  if (totals.items.length) {
    await db.insert(invoiceItemsTable).values(
      totals.items.map((i) => ({
        invoiceId: existing.id,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRateId: i.taxRateId ?? null,
        lineSubtotal: i.lineSubtotal,
        lineTax: i.lineTax,
        lineTotal: i.lineTotal,
        position: i.position,
      })),
    );
  }

  const full = await loadInvoiceWithItems(existing.id);
  res.json(full);
});

router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgIdRaw = req.query.organizationId;
  const orgId = orgIdRaw != null ? Number(orgIdRaw) : NaN;
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, params.data.id), eq(invoicesTable.organizationId, orgId)));
  if (!existing) {
    res.sendStatus(204);
    return;
  }
  if (existing.status !== "draft") {
    res.status(400).json({ error: "Only draft invoices can be deleted; void issued invoices instead" });
    return;
  }

  await db.delete(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/invoices/:id/issue", async (req, res): Promise<void> => {
  const params = IssueInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgIdRaw = req.query.organizationId;
  const orgId = orgIdRaw != null ? Number(orgIdRaw) : NaN;
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  // Pre-check for nicer error messages, but the authoritative check is the
  // status-guarded UPDATE inside the transaction below.
  const [existing] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, params.data.id), eq(invoicesTable.organizationId, orgId)));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (existing.status !== "draft") {
    res.status(400).json({ error: "Only draft invoices can be issued" });
    return;
  }

  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const isoDate = today.toISOString().slice(0, 10);

  // Concurrency model:
  //   1. Run inside a transaction.
  //   2. UPDATE is guarded by `status='draft'` — if a concurrent call already
  //      issued the same invoice, our UPDATE matches 0 rows and we return 409.
  //      This is the fix for the renumbering race (two concurrent issues of
  //      the same id).
  //   3. The unique index on (organization_id, invoice_number) protects
  //      against two different drafts in the same org+year being assigned the
  //      same number; retry on 23505 with a freshly computed number.
  const MAX_ATTEMPTS = 8;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await db.transaction(async (tx) => {
        const invoiceNumber = await generateInvoiceNumber(existing.organizationId, yyyy);
        const updated = await tx
          .update(invoicesTable)
          .set({
            status: "issued",
            invoiceNumber,
            issueDate: existing.issueDate ?? isoDate,
          })
          .where(
            and(
              eq(invoicesTable.id, existing.id),
              eq(invoicesTable.organizationId, orgId),
              eq(invoicesTable.status, "draft"),
            ),
          )
          .returning();
        return { invoiceNumber, updatedCount: updated.length };
      });

      if (result.updatedCount === 0) {
        // A concurrent issue won. The invoice is no longer a draft.
        res.status(409).json({ error: "Invoice was already issued by another request" });
        return;
      }
      const full = await loadInvoiceWithItems(existing.id);
      res.json(full);
      return;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < MAX_ATTEMPTS) {
        req.log.warn(
          { invoiceId: existing.id, attempt },
          "Invoice number collision, retrying",
        );
        continue;
      }
      throw err;
    }
  }
});

router.post("/invoices/:id/void", async (req, res): Promise<void> => {
  const params = VoidInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgIdRaw = req.query.organizationId;
  const orgId = orgIdRaw != null ? Number(orgIdRaw) : NaN;
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, params.data.id), eq(invoicesTable.organizationId, orgId)));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (existing.status === "voided") {
    const full = await loadInvoiceWithItems(existing.id);
    res.json(full);
    return;
  }

  // Drafts must be deleted, not voided — voiding a draft would create an
  // audit-trail row for an invoice that was never sent.
  if (existing.status === "draft") {
    res.status(400).json({ error: "Cannot void a draft invoice; delete it instead" });
    return;
  }

  // Disallow voiding fully-paid invoices to preserve cash basis integrity.
  // Cemeteries can issue a refund/credit note workflow later if needed.
  if (existing.status === "paid") {
    res.status(400).json({ error: "Cannot void a fully paid invoice" });
    return;
  }

  await db
    .update(invoicesTable)
    .set({ status: "voided" })
    .where(eq(invoicesTable.id, existing.id));

  const full = await loadInvoiceWithItems(existing.id);
  res.json(full);
});

// Drizzle keeps the ts-unused-locals checker happy by ensuring `sql` stays referenced.
void sql;

export default router;
