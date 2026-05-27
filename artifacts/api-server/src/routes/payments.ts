import { Router, type IRouter } from "express";
import { db, paymentsTable, invoicesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  CreatePaymentBody,
  DeletePaymentParams,
  ListPaymentsQueryParams,
} from "@workspace/api-zod";
import { recomputeInvoicePayments } from "../lib/accounting";

const router: IRouter = Router();

function readOrgIdQuery(req: { query: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

router.get("/payments", async (req, res): Promise<void> => {
  const params = ListPaymentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { organizationId, invoiceId } = params.data;
  if (organizationId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const conditions = [eq(paymentsTable.organizationId, organizationId)];
  if (invoiceId != null) conditions.push(eq(paymentsTable.invoiceId, invoiceId));

  const rows = await db
    .select()
    .from(paymentsTable)
    .where(and(...conditions))
    .orderBy(desc(paymentsTable.paymentDate));

  res.json(rows);
});

router.post("/payments", async (req, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid payment body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { organizationId, invoiceId, amount, paymentDate, method, reference, notes } = parsed.data;

  if (amount <= 0) {
    res.status(400).json({ error: "Payment amount must be positive" });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!invoice || invoice.organizationId !== organizationId) {
    res.status(400).json({ error: "Invoice not found in organization" });
    return;
  }
  if (invoice.status === "draft" || invoice.status === "voided") {
    res.status(400).json({ error: "Cannot record a payment against a draft or voided invoice" });
    return;
  }

  const dateValue = typeof paymentDate === "string"
    ? paymentDate
    : new Date(paymentDate as unknown as string).toISOString().slice(0, 10);

  const [row] = await db
    .insert(paymentsTable)
    .values({
      organizationId,
      invoiceId,
      amount,
      paymentDate: dateValue,
      method,
      reference: reference ?? null,
      notes: notes ?? null,
    })
    .returning();

  await recomputeInvoicePayments(invoiceId);

  res.status(201).json(row);
});

router.delete("/payments/:id", async (req, res): Promise<void> => {
  const params = DeletePaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = readOrgIdQuery(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.id, params.data.id), eq(paymentsTable.organizationId, orgId)));
  if (!existing) {
    res.sendStatus(204);
    return;
  }

  await db.delete(paymentsTable).where(eq(paymentsTable.id, params.data.id));
  await recomputeInvoicePayments(existing.invoiceId);

  res.sendStatus(204);
});

export default router;
