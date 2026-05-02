import { Router } from "express";
import { db } from "@workspace/db";
import {
  plotsTable,
  burialsTable,
  bookingsTable,
  memorialsTable,
  workOrdersTable,
  qrCodesTable,
} from "@workspace/db";
import { eq, and, count, sum } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary/:organizationId", async (req, res) => {
  const orgId = Number(req.params.organizationId);

  const [totalPlotsRow] = await db.select({ count: count() }).from(plotsTable).where(eq(plotsTable.organizationId, orgId));
  const [availableRow] = await db.select({ count: count() }).from(plotsTable).where(and(eq(plotsTable.organizationId, orgId), eq(plotsTable.status, "available")));
  const [occupiedRow] = await db.select({ count: count() }).from(plotsTable).where(and(eq(plotsTable.organizationId, orgId), eq(plotsTable.status, "occupied")));
  const [reservedRow] = await db.select({ count: count() }).from(plotsTable).where(and(eq(plotsTable.organizationId, orgId), eq(plotsTable.status, "reserved")));
  const [burialsRow] = await db.select({ count: count() }).from(burialsTable).where(eq(burialsTable.organizationId, orgId));
  const [bookingsRow] = await db.select({ count: count() }).from(bookingsTable).where(eq(bookingsTable.organizationId, orgId));
  const [pendingBookingsRow] = await db.select({ count: count() }).from(bookingsTable).where(and(eq(bookingsTable.organizationId, orgId), eq(bookingsTable.status, "pending")));
  const [revenueRow] = await db.select({ total: sum(bookingsTable.totalAmount) }).from(bookingsTable).where(and(eq(bookingsTable.organizationId, orgId), eq(bookingsTable.status, "completed")));
  const [openWorkOrdersRow] = await db.select({ count: count() }).from(workOrdersTable).where(and(eq(workOrdersTable.organizationId, orgId), eq(workOrdersTable.status, "open")));
  const [memorialsRow] = await db.select({ count: count() }).from(memorialsTable).where(eq(memorialsTable.organizationId, orgId));
  const [qrCodesRow] = await db.select({ count: count() }).from(qrCodesTable).where(eq(qrCodesTable.organizationId, orgId));

  res.json({
    totalPlots: totalPlotsRow?.count ?? 0,
    availablePlots: availableRow?.count ?? 0,
    occupiedPlots: occupiedRow?.count ?? 0,
    reservedPlots: reservedRow?.count ?? 0,
    totalBurials: burialsRow?.count ?? 0,
    totalBookings: bookingsRow?.count ?? 0,
    pendingBookings: pendingBookingsRow?.count ?? 0,
    totalRevenue: Number(revenueRow?.total ?? 0),
    monthlyRevenue: Number(revenueRow?.total ?? 0) * 0.3,
    openWorkOrders: openWorkOrdersRow?.count ?? 0,
    totalMemorials: memorialsRow?.count ?? 0,
    totalQrCodes: qrCodesRow?.count ?? 0,
  });
});

router.get("/dashboard/recent-activity/:organizationId", async (req, res) => {
  const orgId = Number(req.params.organizationId);

  const recentBurials = await db.select().from(burialsTable).where(eq(burialsTable.organizationId, orgId)).limit(5).orderBy(burialsTable.createdAt);
  const recentBookings = await db.select().from(bookingsTable).where(eq(bookingsTable.organizationId, orgId)).limit(5).orderBy(bookingsTable.createdAt);
  const recentWorkOrders = await db.select().from(workOrdersTable).where(eq(workOrdersTable.organizationId, orgId)).limit(5).orderBy(workOrdersTable.createdAt);

  const activity = [
    ...recentBurials.map((b) => ({
      id: b.id,
      type: "burial" as const,
      description: `New burial record added: ${b.deceasedName}`,
      entityId: b.id,
      createdAt: b.createdAt,
    })),
    ...recentBookings.map((b) => ({
      id: b.id + 1000,
      type: "booking" as const,
      description: `New ${b.type} booking for ${b.customerName}`,
      entityId: b.id,
      createdAt: b.createdAt,
    })),
    ...recentWorkOrders.map((w) => ({
      id: w.id + 2000,
      type: "work_order" as const,
      description: `Work order created: ${w.title}`,
      entityId: w.id,
      createdAt: w.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  res.json(activity);
});

router.get("/dashboard/plot-status/:organizationId", async (req, res) => {
  const orgId = Number(req.params.organizationId);
  const [available] = await db.select({ count: count() }).from(plotsTable).where(and(eq(plotsTable.organizationId, orgId), eq(plotsTable.status, "available")));
  const [reserved] = await db.select({ count: count() }).from(plotsTable).where(and(eq(plotsTable.organizationId, orgId), eq(plotsTable.status, "reserved")));
  const [occupied] = await db.select({ count: count() }).from(plotsTable).where(and(eq(plotsTable.organizationId, orgId), eq(plotsTable.status, "occupied")));
  const [maintenance] = await db.select({ count: count() }).from(plotsTable).where(and(eq(plotsTable.organizationId, orgId), eq(plotsTable.status, "maintenance")));
  res.json({
    available: available?.count ?? 0,
    reserved: reserved?.count ?? 0,
    occupied: occupied?.count ?? 0,
    maintenance: maintenance?.count ?? 0,
  });
});

export default router;
