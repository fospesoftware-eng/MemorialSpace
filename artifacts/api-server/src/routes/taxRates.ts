import { Router, type IRouter } from "express";
import { db, taxRatesTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import {
  CreateTaxRateBody,
  UpdateTaxRateBody,
  UpdateTaxRateParams,
  DeleteTaxRateParams,
  ListTaxRatesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function readOrgIdQuery(req: { query: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

router.get("/tax-rates", async (req, res): Promise<void> => {
  const params = ListTaxRatesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { organizationId, includeArchived } = params.data;
  if (organizationId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const conditions = [eq(taxRatesTable.organizationId, organizationId)];
  if (!includeArchived) conditions.push(eq(taxRatesTable.isArchived, false));

  const rows = await db
    .select()
    .from(taxRatesTable)
    .where(and(...conditions))
    .orderBy(asc(taxRatesTable.name));

  res.json(rows);
});

router.post("/tax-rates", async (req, res): Promise<void> => {
  const parsed = CreateTaxRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(taxRatesTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.put("/tax-rates/:id", async (req, res): Promise<void> => {
  const params = UpdateTaxRateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaxRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .update(taxRatesTable)
    .set(parsed.data)
    .where(
      and(
        eq(taxRatesTable.id, params.data.id),
        eq(taxRatesTable.organizationId, parsed.data.organizationId),
      ),
    )
    .returning();

  if (!row) {
    res.status(404).json({ error: "Tax rate not found" });
    return;
  }
  res.json(row);
});

router.delete("/tax-rates/:id", async (req, res): Promise<void> => {
  const params = DeleteTaxRateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = readOrgIdQuery(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  // Soft-delete by archiving so historical invoices keep referential integrity.
  const [row] = await db
    .update(taxRatesTable)
    .set({ isArchived: true })
    .where(
      and(eq(taxRatesTable.id, params.data.id), eq(taxRatesTable.organizationId, orgId)),
    )
    .returning();

  if (!row) {
    res.status(404).json({ error: "Tax rate not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
