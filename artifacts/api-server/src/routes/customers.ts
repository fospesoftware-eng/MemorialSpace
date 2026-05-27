import { Router, type IRouter } from "express";
import { db, customersTable } from "@workspace/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  DeleteCustomerParams,
  ListCustomersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

/** Read `?organizationId=` from raw req.query and validate it's a finite number. */
function readOrgIdQuery(req: { query: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

router.get("/customers", async (req, res): Promise<void> => {
  const params = ListCustomersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { organizationId, search } = params.data;
  if (organizationId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const conditions = [eq(customersTable.organizationId, organizationId)];
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(customersTable.name, pattern),
        ilike(customersTable.email, pattern),
        ilike(customersTable.phone, pattern),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(customersTable)
    .where(and(...conditions))
    .orderBy(desc(customersTable.createdAt));

  res.json(rows);
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid customer body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(customersTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = readOrgIdQuery(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  const [row] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.organizationId, orgId)));
  if (!row) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(row);
});

router.put("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Body carries organizationId (Update*Body reuses Create*Body); use it to
  // scope the update so a request can never modify another org's customer.
  const [row] = await db
    .update(customersTable)
    .set(parsed.data)
    .where(
      and(
        eq(customersTable.id, params.data.id),
        eq(customersTable.organizationId, parsed.data.organizationId),
      ),
    )
    .returning();

  if (!row) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(row);
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const orgId = readOrgIdQuery(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  await db
    .delete(customersTable)
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.organizationId, orgId)));
  res.sendStatus(204);
});

export default router;
