import { Router } from "express";
import { db } from "@workspace/db";
import { qrCodesTable, burialsTable, memorialsTable, plotsTable, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// Resolve the public origin a scanner will reach this server at. We use
// the request's own protocol+host so QR codes generated in dev hit the
// dev preview domain and codes generated in prod hit the published
// domain — no env var wiring required, no manual rebuilds when the
// custom domain changes.
function publicOrigin(req: import("express").Request): string {
  const host = req.get("host");
  // Replit preview proxies forward https, but `req.protocol` may report
  // http behind the proxy. Trust x-forwarded-proto when present; fall
  // back to https so QRs always encode an https URL (most phones reject
  // unencrypted scanned URLs).
  const xfp = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim();
  const proto = xfp || (req.secure ? "https" : "https");
  return host ? `${proto}://${host}` : "https://memorialspace.app";
}

router.get("/qr-codes", async (req, res) => {
  const { organizationId } = req.query;
  const qrCodes = organizationId
    ? await db.select().from(qrCodesTable).where(eq(qrCodesTable.organizationId, Number(organizationId)))
    : await db.select().from(qrCodesTable);
  res.json(qrCodes);
});

// Create a QR code. The encoded URL points at the cemetery's branded
// public memorial page (`/c/<orgSlug>/memorial/<code>`) so a phone scan
// lands inside the operator's themed site, not on a generic page. If the
// org has no slug we still generate the QR but encode a fallback URL —
// the operator can regenerate after publishing their site.
router.post("/qr-codes", async (req, res) => {
  const code = crypto.randomBytes(8).toString("hex").toUpperCase();
  const orgId = Number(req.body?.organizationId);
  let memorialUrl = `${publicOrigin(req)}/memorial/${code}`;
  if (Number.isFinite(orgId) && orgId > 0) {
    const [org] = await db
      .select({ slug: organizationsTable.slug })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId));
    if (org?.slug) {
      memorialUrl = `${publicOrigin(req)}/c/${org.slug}/memorial/${code}`;
    }
  }
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(memorialUrl)}`;
  const [qrCode] = await db
    .insert(qrCodesTable)
    .values({ ...req.body, code, qrImageUrl })
    .returning();
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
