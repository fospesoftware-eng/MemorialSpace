import { Router, type IRouter } from "express";
import { db, maintenanceSchedulesTable, workOrdersTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function readOrgId(req: { query: Record<string, unknown> }): number | null {
  const raw = req.query.organizationId;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function addDaysISO(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

router.get("/maintenance-schedules", async (req, res): Promise<void> => {
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const conditions = [eq(maintenanceSchedulesTable.organizationId, orgId)];
  if (req.query.assetId) conditions.push(eq(maintenanceSchedulesTable.assetId, Number(req.query.assetId)));
  if (req.query.isActive != null) conditions.push(eq(maintenanceSchedulesTable.isActive, String(req.query.isActive) === "true"));
  const rows = await db
    .select()
    .from(maintenanceSchedulesTable)
    .where(and(...conditions))
    .orderBy(desc(maintenanceSchedulesTable.createdAt));
  res.json(rows);
});

router.post("/maintenance-schedules", async (req, res): Promise<void> => {
  if (!req.body?.organizationId || !req.body?.title || !req.body?.frequency) {
    res.status(400).json({ error: "organizationId, title, and frequency are required" });
    return;
  }
  const intervalDays = req.body.intervalDays ?? defaultIntervalFor(req.body.frequency);
  const nextDueAt = req.body.nextDueAt ?? addDaysISO(new Date(), intervalDays);
  const [row] = await db
    .insert(maintenanceSchedulesTable)
    .values({ ...req.body, intervalDays, nextDueAt })
    .returning();
  res.status(201).json(row);
});

function defaultIntervalFor(freq: string): number {
  switch (freq) {
    case "daily": return 1;
    case "weekly": return 7;
    case "monthly": return 30;
    case "quarterly": return 90;
    case "yearly": return 365;
    default: return 30;
  }
}

router.get("/maintenance-schedules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .select()
    .from(maintenanceSchedulesTable)
    .where(and(eq(maintenanceSchedulesTable.id, id), eq(maintenanceSchedulesTable.organizationId, orgId)));
  if (!row) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  res.json(row);
});

router.put("/maintenance-schedules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!req.body?.organizationId) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [row] = await db
    .update(maintenanceSchedulesTable)
    .set(req.body)
    .where(and(eq(maintenanceSchedulesTable.id, id), eq(maintenanceSchedulesTable.organizationId, req.body.organizationId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  res.json(row);
});

router.delete("/maintenance-schedules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = readOrgId(req);
  if (orgId == null) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  await db
    .delete(maintenanceSchedulesTable)
    .where(and(eq(maintenanceSchedulesTable.id, id), eq(maintenanceSchedulesTable.organizationId, orgId)));
  res.sendStatus(204);
});

// Generate a Work Order from this schedule, advance lastPerformedAt + nextDueAt.
router.post("/maintenance-schedules/:id/generate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const orgId = Number(req.body?.organizationId);
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [schedule] = await db
    .select()
    .from(maintenanceSchedulesTable)
    .where(and(eq(maintenanceSchedulesTable.id, id), eq(maintenanceSchedulesTable.organizationId, orgId)));
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const nextDue = addDaysISO(today, schedule.intervalDays);

  const [wo] = await db
    .insert(workOrdersTable)
    .values({
      organizationId: orgId,
      assetId: schedule.assetId,
      assignedTo: schedule.assignedTo,
      title: schedule.title,
      description: schedule.description ?? `Generated from maintenance schedule #${schedule.id}`,
      type: "maintenance",
      status: "open",
      priority: schedule.priority,
      dueDate: schedule.nextDueAt ?? nextDue,
    })
    .returning();

  await db
    .update(maintenanceSchedulesTable)
    .set({ lastPerformedAt: todayISO, nextDueAt: nextDue })
    .where(eq(maintenanceSchedulesTable.id, schedule.id));

  res.status(201).json(wo);
});

export default router;
