import { Router } from "express";
import { db } from "@workspace/db";
import { qrCodesTable, burialsTable, memorialsTable, plotsTable, organizationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// Resolve the public origin a scanner will reach this server at. We use
// the request's own protocol+host so QR codes generated in dev hit the
// dev preview domain and codes generated in prod hit the published
// domain — no env var wiring required, no manual rebuilds when the
// custom domain changes.
// 6-digit numeric PIN — high enough entropy to resist casual guessing
// (1-in-1M per attempt) while being short enough to read off a printed
// plaque or family handout. Pair with rate limiting on the PATCH endpoint
// in the future if guessing becomes a concern.
function newEditPin(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

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
  // Cap to 1000 codes per request — operators paginate in the UI.
  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const qrCodes = organizationId
    ? await db
        .select()
        .from(qrCodesTable)
        .where(eq(qrCodesTable.organizationId, Number(organizationId)))
        .limit(limit)
        .offset(offset)
    : await db.select().from(qrCodesTable).limit(limit).offset(offset);
  res.json(qrCodes);
});

// Create a QR code. The encoded URL points at the cemetery's branded
// public memorial page (`/c/<orgSlug>/memorial/<code>`) so a phone scan
// lands inside the operator's themed site, not on a generic page. If the
// org has no slug we still generate the QR but encode a fallback URL —
// the operator can regenerate after publishing their site.
router.post("/qr-codes", async (req, res) => {
  const orgId = Number(req.body?.organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }

  // Verify the org exists and get its slug for the memorial URL
  const [org] = await db
    .select({ id: organizationsTable.id, slug: organizationsTable.slug })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const burialId = req.body?.burialId != null ? Number(req.body.burialId) : undefined;
  const plotId   = req.body?.plotId   != null ? Number(req.body.plotId)   : undefined;
  const memorialId = req.body?.memorialId != null ? Number(req.body.memorialId) : undefined;

  const code = crypto.randomBytes(8).toString("hex").toUpperCase();
  const memorialUrl = org.slug
    ? `${publicOrigin(req)}/c/${org.slug}/memorial/${code}`
    : `${publicOrigin(req)}/memorial/${code}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(memorialUrl)}`;
  const editPin = newEditPin();

  // Create a stub memorial row so the QR code has a destination page
  let resolvedMemorialId = memorialId;
  if (!resolvedMemorialId && burialId) {
    try {
      const burialName = await db
        .select({ name: burialsTable.deceasedName })
        .from(burialsTable)
        .where(eq(burialsTable.id, burialId))
        .limit(1)
        .then((r) => r[0]?.name ?? null);
      const [memorial] = await db.insert(memorialsTable).values({
        burialId,
        organizationId: orgId,
        title: burialName,
        biography: null,
        photos: null,
        isPublic: true,
      }).returning({ id: memorialsTable.id });
      resolvedMemorialId = memorial.id;
    } catch {
      // Memorial creation is best-effort; QR still works without it
    }
  }

  const [qrCode] = await db
    .insert(qrCodesTable)
    .values({
      code,
      organizationId: orgId,
      burialId: Number.isFinite(burialId) ? burialId : undefined,
      plotId: Number.isFinite(plotId) ? plotId : undefined,
      memorialId: resolvedMemorialId,
      qrImageUrl,
      editPin,
    })
    .returning();
  res.status(201).json(qrCode);
});

// Bulk-generate QR codes for every burial in an org that doesn't already
// have one. This is the "every burial spot has a QR" affordance — operators
// click once and a QR is minted (and a stub memorial is created) for each
// burial. Idempotent: re-running only mints codes for burials that are still
// missing one. Always associates a fresh memorial row so families have an
// edit surface from day one.
router.post("/qr-codes/bulk-generate", async (req, res) => {
  const orgId = Number(req.body?.organizationId ?? req.query.organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const [org] = await db
    .select({ slug: organizationsTable.slug })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  // Burials without a QR yet — anti-join via NOT EXISTS would be cleaner,
  // but a small SELECT over the QR table per org is fine at our scale.
  const burials = await db
    .select({ id: burialsTable.id, deceasedName: burialsTable.deceasedName, plotId: burialsTable.plotId })
    .from(burialsTable)
    .where(eq(burialsTable.organizationId, orgId));
  const existingQrs = await db
    .select({ burialId: qrCodesTable.burialId })
    .from(qrCodesTable)
    .where(eq(qrCodesTable.organizationId, orgId));
  const covered = new Set(existingQrs.map((q) => q.burialId).filter((x): x is number => x != null));

  const todo = burials.filter((b) => !covered.has(b.id));
  let created = 0;
  for (const burial of todo) {
    const code = crypto.randomBytes(8).toString("hex").toUpperCase();
    const memorialUrl = org.slug
      ? `${publicOrigin(req)}/c/${org.slug}/memorial/${code}`
      : `${publicOrigin(req)}/memorial/${code}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(memorialUrl)}`;
    const editPin = newEditPin();

    // One transaction per burial so the memorial+qr inserts can't split.
    // We accept a possible per-burial failure (collision on `code` etc.)
    // — the loop continues with the next burial and the operator can
    // re-run bulk-generate to pick up stragglers.
    try {
      await db.transaction(async (tx) => {
        const [memorial] = await tx
          .insert(memorialsTable)
          .values({
            burialId: burial.id,
            organizationId: orgId,
            title: burial.deceasedName,
            biography: null,
            photos: null,
            isPublic: true,
          })
          .returning({ id: memorialsTable.id });
        await tx.insert(qrCodesTable).values({
          code,
          burialId: burial.id,
          plotId: burial.plotId ?? undefined,
          memorialId: memorial.id,
          organizationId: orgId,
          qrImageUrl,
          editPin,
        });
      });
      created += 1;
    } catch (err) {
      req.log?.warn?.({ err, burialId: burial.id }, "bulk-generate: skipped burial");
    }
  }

  res.json({ created, alreadyCovered: covered.size, total: burials.length });
});

// Backfill edit PINs for any QR codes minted before this column existed.
// Idempotent: only fills NULLs. Operator clicks "Issue PINs" once, then
// every existing QR has a PIN they can read out.
router.post("/qr-codes/backfill-pins", async (req, res) => {
  const orgId = Number(req.body?.organizationId ?? req.query.organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    res.status(400).json({ error: "organizationId is required" });
    return;
  }
  const rows = await db
    .select({ id: qrCodesTable.id })
    .from(qrCodesTable)
    .where(eq(qrCodesTable.organizationId, orgId));
  let updated = 0;
  for (const row of rows) {
    const [r] = await db
      .select({ pin: qrCodesTable.editPin })
      .from(qrCodesTable)
      .where(eq(qrCodesTable.id, row.id));
    if (r?.pin) continue;
    await db.update(qrCodesTable).set({ editPin: newEditPin() }).where(eq(qrCodesTable.id, row.id));
    updated += 1;
  }
  res.json({ updated, total: rows.length });
});

router.get("/qr-codes/:code", async (req, res) => {
  const { code } = req.params;
  // Tenant-scope by session org. Without this, any authenticated cemetery
  // user could resolve another org's QR by guessing/sniffing the code and
  // read its `editPin` (cross-tenant IDOR + secret leak). 404 on mismatch
  // so we don't leak existence across orgs either.
  const sessionOrgId = req.session?.user?.organizationId;
  if (!sessionOrgId) {
    res.status(403).json({ error: "Cemetery user required" });
    return;
  }
  const [qrCode] = await db
    .select()
    .from(qrCodesTable)
    .where(and(eq(qrCodesTable.code, code), eq(qrCodesTable.organizationId, sessionOrgId)));
  if (!qrCode) { res.status(404).json({ error: "QR code not found" }); return; }

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
