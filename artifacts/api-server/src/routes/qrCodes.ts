import { Router } from "express";
import { db } from "@workspace/db";
import { qrCodesTable, burialsTable, memorialsTable, plotsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

router.get("/qr-codes", async (req, res) => {
  const { organizationId } = req.query;
  const qrCodes = organizationId
    ? await db.select().from(qrCodesTable).where(eq(qrCodesTable.organizationId, Number(organizationId)))
    : await db.select().from(qrCodesTable);
  res.json(qrCodes);
});

router.post("/qr-codes", async (req, res) => {
  const code = crypto.randomBytes(8).toString("hex").toUpperCase();
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://memorialspace.app/memorial/${code}`;
  const [qrCode] = await db.insert(qrCodesTable).values({ ...req.body, code, qrImageUrl }).returning();
  res.status(201).json(qrCode);
});

router.get("/qr-codes/:code", async (req, res) => {
  const { code } = req.params;
  const [qrCode] = await db.select().from(qrCodesTable).where(eq(qrCodesTable.code, code));
  if (!qrCode) return res.status(404).json({ error: "QR code not found" });

  // Increment scan count
  await db.update(qrCodesTable).set({ scanCount: (qrCode.scanCount ?? 0) + 1 }).where(eq(qrCodesTable.id, qrCode.id));

  const [burial] = qrCode.burialId
    ? await db.select().from(burialsTable).where(eq(burialsTable.id, qrCode.burialId))
    : [undefined];
  const [memorial] = qrCode.memorialId
    ? await db.select().from(memorialsTable).where(eq(memorialsTable.id, qrCode.memorialId))
    : [undefined];
  const [plot] = qrCode.plotId
    ? await db.select().from(plotsTable).where(eq(plotsTable.id, qrCode.plotId))
    : [undefined];

  res.json({ qrCode, burial, memorial, plot });
});

export default router;
