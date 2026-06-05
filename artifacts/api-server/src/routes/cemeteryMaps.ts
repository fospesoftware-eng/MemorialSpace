import { Router, type IRouter } from "express";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, organizationsTable, plotsTable, burialsTable, qrCodesTable, memorialsTable } from "@workspace/db";

const authedRouter: IRouter = Router();
const publicRouter: IRouter = Router();

type MapPayload = {
  doc?: unknown;
  plotTypes?: unknown[];
  spotTypes?: unknown[];
  cemetery?: { id: number; name: string; slug: string };
  publishedAt?: number;
};

type GlobalSpotRecord = {
  mapSpotId: string;
  plotId: number;
  plotNumber: string;
  section: string | null;
  row: string | null;
  status: string;
  type: string | null;
  latitude: number | null;
  longitude: number | null;
  x: number | null;
  y: number | null;
  gprX: number | null;
  gprY: number | null;
  gprZ: number | null;
  deceasedName: string | null;
  deceasedDob: string | null;
  deceasedDod: string | null;
  photoUrl: string | null;
  headstonePath: string | null;
  notes: string | null;
};

function publicRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith(path.join("artifacts", "api-server"))) {
    return path.resolve(cwd, "../memorial-space/public");
  }
  return path.resolve(cwd, "artifacts/memorial-space/public");
}

function mapFolder(organizationId: number): { absolute: string; publicBase: string } {
  const publicBase = `/uploads/cemeteries/${organizationId}/maps`;
  return {
    absolute: path.join(publicRoot(), publicBase),
    publicBase,
  };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function getOrganizationById(id: number) {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  return org ?? null;
}

async function getOrganizationBySlug(slug: string) {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, slug)).limit(1);
  return org ?? null;
}

function asPositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mapUrls(slug: string) {
  const previewUrl = `/map-maker/preview/${encodeURIComponent(slug)}`;
  return {
    previewUrl,
    permanentUrl: previewUrl,
  };
}

function buildPayload(body: unknown, cemetery: { id: number; name: string; slug: string }, published = false): MapPayload {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const inputDoc = input.doc && typeof input.doc === "object" ? (input.doc as Record<string, unknown>) : {};
  return {
    doc: {
      ...inputDoc,
      cemeteryId: cemetery.id,
      projectStatus: published ? "published" : (inputDoc.projectStatus === "published" ? "published" : "draft"),
    },
    plotTypes: Array.isArray(input.plotTypes) ? input.plotTypes : [],
    spotTypes: Array.isArray(input.spotTypes) ? input.spotTypes : [],
    cemetery,
    publishedAt: published ? Date.now() : undefined,
  };
}

function requestedCemeteryId(req: { query: Record<string, unknown> }): number | null {
  return (
    asPositiveId(req.query.cemeteryId) ??
    asPositiveId(req.query.organizationId) ??
    asPositiveId(req.query.orgId)
  );
}

function projectIdFromBody(body: unknown): string {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const doc = (input.doc && typeof input.doc === "object" ? input.doc : {}) as Record<string, unknown>;
  const raw = String(doc.projectId ?? input.projectId ?? "default").trim();
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "default";
}

function asFiniteNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asStringOrNull(value: unknown): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return v.length ? v : null;
}

function normalizeSqlDate(value: unknown): string | null {
  const raw = asStringOrNull(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3].length === 2 ? `19${slash[3]}` : slash[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function extractDocSpots(body: unknown): Array<Record<string, unknown>> {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const doc = (input.doc && typeof input.doc === "object" ? input.doc : {}) as Record<string, unknown>;
  const spots = doc.spots;
  return Array.isArray(spots) ? (spots.filter((spot) => spot && typeof spot === "object") as Array<Record<string, unknown>>) : [];
}

function plotNumberFromSpot(spot: Record<string, unknown>, index: number): string {
  const explicit = asStringOrNull(spot.temporaryId) ?? asStringOrNull(spot.plotNumber) ?? asStringOrNull(spot.name);
  if (explicit) return explicit;
  return `MAP-${String(index + 1).padStart(4, "0")}`;
}

function parseGeoJsonMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toPlotType(rawType: string | null): "standard" | "double" | "family" | "mausoleum" | "cremation" {
  const value = (rawType ?? "").toLowerCase();
  if (value.includes("family")) return "family";
  if (value.includes("mausoleum")) return "mausoleum";
  if (value.includes("cremation") || value.includes("columb")) return "cremation";
  if (value.includes("double")) return "double";
  return "standard";
}

async function syncPublishedSpotsToGlobal(
  organizationId: number,
  projectId: string,
  spots: Array<Record<string, unknown>>,
): Promise<GlobalSpotRecord[]> {
  const existingPlots = await db.select().from(plotsTable).where(eq(plotsTable.organizationId, organizationId));
  const existingBurials = await db.select().from(burialsTable).where(eq(burialsTable.organizationId, organizationId));

  const byPlotNumber = new Map(existingPlots.map((plot) => [plot.plotNumber.toLowerCase(), plot]));
  const byMapSpotId = new Map<string, (typeof existingPlots)[number]>();
  for (const plot of existingPlots) {
    const meta = parseGeoJsonMeta(plot.geoJson);
    const mapSpotId = asStringOrNull(meta.mapSpotId);
    if (mapSpotId) byMapSpotId.set(mapSpotId, plot);
  }

  const out: GlobalSpotRecord[] = [];
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const mapSpotId = asStringOrNull(spot.id) ?? `spot-${i + 1}`;
    const plotNumber = plotNumberFromSpot(spot, i);
    const x = asFiniteNumber(spot.x);
    const y = asFiniteNumber(spot.y);
    const lat = asFiniteNumber(spot.lat);
    const lon = asFiniteNumber(spot.lon);
    const gprX = asFiniteNumber(spot.gprX);
    const gprY = asFiniteNumber(spot.gprY);
    const gprZ = asFiniteNumber(spot.gprZ);
    const notes = asStringOrNull(spot.notes);
    const deceasedName = asStringOrNull(spot.name);
    const deceasedDob = normalizeSqlDate(spot.dob);
    const deceasedDod = normalizeSqlDate(spot.dod);
    const imagePath = asStringOrNull(spot.imagePath);
    const imageFileName = asStringOrNull(spot.imageFileName);
    const reviewStatus = asStringOrNull(spot.reviewStatus);
    const plotStatus = reviewStatus === "published" || deceasedName ? "occupied" : "available";
    const plotType = toPlotType(asStringOrNull(spot.spotTypeId));

    const geoMeta = {
      source: "map-maker",
      projectId,
      mapSpotId,
      x,
      y,
      gprX,
      gprY,
      gprZ,
      imagePath,
      imageFileName,
      reviewStatus,
    };

    const existingPlot = byMapSpotId.get(mapSpotId) ?? byPlotNumber.get(plotNumber.toLowerCase());
    const [plot] = existingPlot
      ? await db.update(plotsTable).set({
          plotNumber,
          status: plotStatus as "available" | "reserved" | "occupied" | "maintenance",
          type: plotType,
          latitude: lat,
          longitude: lon,
          notes,
          geoJson: JSON.stringify(geoMeta),
        }).where(eq(plotsTable.id, existingPlot.id)).returning()
      : await db.insert(plotsTable).values({
          organizationId,
          plotNumber,
          status: plotStatus as "available" | "reserved" | "occupied" | "maintenance",
          type: plotType,
          latitude: lat,
          longitude: lon,
          notes,
          geoJson: JSON.stringify(geoMeta),
        }).returning();

    byMapSpotId.set(mapSpotId, plot);
    byPlotNumber.set(plotNumber.toLowerCase(), plot);

    if (deceasedName) {
      const burial = existingBurials.find((item) => item.plotId === plot.id) ?? null;
      const burialNotes = [notes, imagePath ? `Headstone: ${imagePath}` : null].filter(Boolean).join("\n");
      if (burial) {
        const [updated] = await db.update(burialsTable).set({
          deceasedName,
          deceasedDob,
          deceasedDod,
          notes: burialNotes || burial.notes,
          photoUrl: imagePath ?? burial.photoUrl,
          spotTypeId: asStringOrNull(spot.spotTypeId) ?? null,
          veteranStatus: asStringOrNull(spot.veteranStatus) ?? null,
          latitude: asFiniteNumber(spot.lat) ?? null,
          longitude: asFiniteNumber(spot.lon) ?? null,
          headstoneImages: (() => {
            const ip = asStringOrNull(spot.imagePath);
            const ifn = asStringOrNull(spot.imageFileName);
            const img = ip ?? ifn;
            return img ? JSON.stringify([img]) : null;
          })(),
        }).where(eq(burialsTable.id, burial.id)).returning();
        const idx = existingBurials.findIndex((item) => item.id === burial.id);
        if (idx >= 0) existingBurials[idx] = updated;
      } else {
        const [inserted] = await db.insert(burialsTable).values({
          organizationId,
          plotId: plot.id,
          deceasedName,
          deceasedDob,
          deceasedDod,
          notes: burialNotes || null,
          photoUrl: imagePath,
          spotTypeId: asStringOrNull(spot.spotTypeId) ?? null,
          veteranStatus: asStringOrNull(spot.veteranStatus) ?? null,
          latitude: asFiniteNumber(spot.lat) ?? null,
          longitude: asFiniteNumber(spot.lon) ?? null,
          headstoneImages: (() => {
            const ip = asStringOrNull(spot.imagePath);
            const ifn = asStringOrNull(spot.imageFileName);
            const img = ip ?? ifn;
            return img ? JSON.stringify([img]) : null;
          })(),
        }).returning();
        existingBurials.push(inserted);
      }
    }

    const linkedBurial = existingBurials.find((item) => item.plotId === plot.id) ?? null;
    out.push({
      mapSpotId,
      plotId: plot.id,
      plotNumber: plot.plotNumber,
      section: plot.section,
      row: plot.row,
      status: plot.status,
      type: plot.type,
      latitude: plot.latitude,
      longitude: plot.longitude,
      x,
      y,
      gprX,
      gprY,
      gprZ,
      deceasedName: linkedBurial?.deceasedName ?? null,
      deceasedDob: linkedBurial?.deceasedDob ?? null,
      deceasedDod: linkedBurial?.deceasedDod ?? null,
      photoUrl: linkedBurial?.photoUrl ?? null,
      headstonePath: imagePath ?? imageFileName ?? null,
      notes: linkedBurial?.notes ?? plot.notes ?? null,
    });
  }

  return out;
}

async function hydratePayloadWithGlobalSpots(organizationId: number, payload: MapPayload | null): Promise<MapPayload | null> {
  if (!payload?.doc || typeof payload.doc !== "object") return payload;
  const doc = payload.doc as Record<string, unknown>;
  const spots = Array.isArray(doc.spots)
    ? (doc.spots.filter((spot) => spot && typeof spot === "object") as Array<Record<string, unknown>>)
    : [];
  if (!spots.length) return payload;

  const [plots, burials, qrCodes] = await Promise.all([
    db.select().from(plotsTable).where(eq(plotsTable.organizationId, organizationId)),
    db.select().from(burialsTable).where(eq(burialsTable.organizationId, organizationId)),
    db.select().from(qrCodesTable).where(eq(qrCodesTable.organizationId, organizationId)),
  ]);
  const byMapSpotId = new Map<string, (typeof plots)[number]>();
  const byPlotNumber = new Map<string, (typeof plots)[number]>();
  for (const plot of plots) {
    byPlotNumber.set(plot.plotNumber.toLowerCase(), plot);
    const meta = parseGeoJsonMeta(plot.geoJson);
    const mapSpotId = asStringOrNull(meta.mapSpotId);
    if (mapSpotId) byMapSpotId.set(mapSpotId, plot);
  }
  // QR code lookup by burialId
  const qrByBurial = new Map<number, (typeof qrCodes)[number]>();
  for (const qr of qrCodes) {
    if (qr.burialId) qrByBurial.set(qr.burialId, qr);
  }

  const hydratedSpots = spots.map((spot, index) => {
    const spotId = asStringOrNull(spot.id);
    const plotNumber = plotNumberFromSpot(spot, index);
    const plot = (spotId ? byMapSpotId.get(spotId) : null) ?? byPlotNumber.get(plotNumber.toLowerCase());
    if (!plot) return spot;
    const burial = burials.find((item) => item.plotId === plot.id) ?? null;
    const qr = burial ? qrByBurial.get(burial.id) ?? null : null;
    const geo = parseGeoJsonMeta(plot.geoJson);
    return {
      ...spot,
      id: asStringOrNull(geo.mapSpotId) ?? spot.id,
      temporaryId: plot.plotNumber,
      x: asFiniteNumber(geo.x) ?? spot.x,
      y: asFiniteNumber(geo.y) ?? spot.y,
      name: burial?.deceasedName ?? spot.name,
      dob: burial?.deceasedDob ?? spot.dob,
      dod: burial?.deceasedDod ?? spot.dod,
      lat: plot.latitude ?? burial?.latitude ?? spot.lat ?? null,
      lon: plot.longitude ?? burial?.longitude ?? spot.lon ?? null,
      spotTypeId: burial?.spotTypeId ?? spot.spotTypeId ?? null,
      veteranStatus: burial?.veteranStatus ?? spot.veteranStatus ?? null,
      gprX: asFiniteNumber(geo.gprX) ?? spot.gprX,
      gprY: asFiniteNumber(geo.gprY) ?? spot.gprY,
      gprZ: asFiniteNumber(geo.gprZ) ?? spot.gprZ,
      imagePath: burial?.photoUrl ?? asStringOrNull(geo.imagePath) ?? spot.imagePath,
      imageFileName: asStringOrNull(geo.imageFileName) ?? spot.imageFileName,
      notes: burial?.notes ?? plot.notes ?? spot.notes,
      reviewStatus: "published",
      // Memorial QR code fields (null when not yet generated)
      burialId: burial?.id ?? null,
      memorialCode: qr?.code ?? null,
      qrImageUrl: qr?.qrImageUrl ?? null,
    };
  });

  return {
    ...payload,
    doc: {
      ...doc,
      spots: hydratedSpots,
    },
  };
}

authedRouter.get("/cemetery-maps", async (req, res) => {
  const organizationId = requestedCemeteryId(req);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const folder = mapFolder(org.id);
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "default";
  const draft = await readJson<MapPayload>(path.join(folder.absolute, `${projectId}-draft-map.json`))
    ?? await readJson<MapPayload>(path.join(folder.absolute, "draft-map.json"));
  const published = await readJson<MapPayload>(path.join(folder.absolute, "published-map.json"));
  const hydratedPublished = await hydratePayloadWithGlobalSpots(org.id, published);
  res.json({
    organizationId: org.id,
    slug: org.slug,
    draft,
    published: hydratedPublished,
    ...mapUrls(org.slug),
  });
});

authedRouter.put("/cemetery-maps", async (req, res) => {
  const organizationId = requestedCemeteryId(req);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const folder = mapFolder(org.id);
  await mkdir(folder.absolute, { recursive: true });
  const cemetery = { id: org.id, name: org.name, slug: org.slug };
  const projectId = projectIdFromBody(req.body);
  const payload = buildPayload(req.body, cemetery, false);
  await writeFile(path.join(folder.absolute, `${projectId}-draft-map.json`), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(path.join(folder.absolute, "draft-map.json"), JSON.stringify(payload, null, 2), "utf8");
  res.json({ ok: true, organizationId: org.id, slug: org.slug, projectId, ...mapUrls(org.slug), publicBase: folder.publicBase });
});

// Auto-generate QR codes for every burial in an org that doesn't already
// have one. Idempotent — safe to call on every publish.
async function autoGenerateQrCodes(
  organizationId: number,
  orgSlug: string,
  origin: string,
): Promise<number> {
  const burials = await db.select({ id: burialsTable.id, deceasedName: burialsTable.deceasedName, plotId: burialsTable.plotId })
    .from(burialsTable).where(eq(burialsTable.organizationId, organizationId));
  if (!burials.length) return 0;

  const existingQrs = await db.select({ burialId: qrCodesTable.burialId })
    .from(qrCodesTable).where(eq(qrCodesTable.organizationId, organizationId));
  const covered = new Set(existingQrs.map((q) => q.burialId).filter((x): x is number => x != null));

  const todo = burials.filter((b) => !covered.has(b.id));
  let created = 0;
  for (const burial of todo) {
    const code = crypto.randomBytes(8).toString("hex").toUpperCase();
    const memorialUrl = orgSlug
      ? `${origin}/c/${orgSlug}/memorial/${code}`
      : `${origin}/memorial/${code}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(memorialUrl)}`;
    const editPin = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      await db.transaction(async (tx) => {
        const [memorial] = await tx.insert(memorialsTable).values({
          burialId: burial.id,
          organizationId,
          title: burial.deceasedName,
          biography: null,
          photos: null,
          isPublic: true,
        }).returning({ id: memorialsTable.id });
        await tx.insert(qrCodesTable).values({
          code,
          burialId: burial.id,
          plotId: burial.plotId ?? undefined,
          memorialId: memorial.id,
          organizationId,
          qrImageUrl,
          editPin,
        });
      });
      created++;
    } catch {
      // skip — will be picked up on next publish or manual generate
    }
  }
  return created;
}

authedRouter.post("/cemetery-maps/publish", async (req, res) => {
  const organizationId = requestedCemeteryId(req);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const folder = mapFolder(org.id);
  await mkdir(folder.absolute, { recursive: true });
  const cemetery = { id: org.id, name: org.name, slug: org.slug };
  const projectId = projectIdFromBody(req.body);
  const payload = buildPayload(req.body, cemetery, true);
  await writeFile(path.join(folder.absolute, `${projectId}-draft-map.json`), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(path.join(folder.absolute, "draft-map.json"), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(path.join(folder.absolute, "published-map.json"), JSON.stringify(payload, null, 2), "utf8");
  let globalSpots: GlobalSpotRecord[] = [];
  let syncWarning: string | null = null;
  try {
    globalSpots = await syncPublishedSpotsToGlobal(org.id, projectId, extractDocSpots(req.body));
  } catch (err) {
    req.log?.error({ err, organizationId: org.id, projectId }, "Published map saved but burial spot sync failed");
    syncWarning = "Map was published, but Burial Spots sync needs attention. Check imported dates/spot data and publish again.";
  }

  // Auto-generate QR codes for any burials that don't have one yet
  let qrGenerated = 0;
  try {
    const proto = (String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim()) || "https";
    const origin = req.get("host") ? `${proto}://${req.get("host")}` : "https://memorialspace.app";
    qrGenerated = await autoGenerateQrCodes(org.id, org.slug, origin);
  } catch (err) {
    req.log?.warn({ err, organizationId: org.id }, "QR code auto-generation failed on publish");
  }

  res.json({
    ok: true,
    organizationId: org.id,
    slug: org.slug,
    projectId,
    syncedSpots: globalSpots.length,
    qrGenerated,
    syncWarning,
    ...mapUrls(org.slug),
    publicBase: folder.publicBase,
  });
});

authedRouter.get("/cemetery-maps/published", async (req, res) => {
  const organizationId = requestedCemeteryId(req);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }
  const org = await getOrganizationById(organizationId);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }
  const folder = mapFolder(org.id);
  const published = await hydratePayloadWithGlobalSpots(
    org.id,
    await readJson<MapPayload>(path.join(folder.absolute, "published-map.json")),
  );
  res.json({
    organizationId: org.id,
    slug: org.slug,
    projectId: "live",
    published,
    ...mapUrls(org.slug),
  });
});

authedRouter.get("/cemetery-maps/global-spots", async (req, res) => {
  const organizationId = requestedCemeteryId(req);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }
  const plots = await db.select().from(plotsTable).where(eq(plotsTable.organizationId, organizationId));
  const burials = await db.select().from(burialsTable).where(eq(burialsTable.organizationId, organizationId));
  const records: GlobalSpotRecord[] = plots.map((plot) => {
    const burial = burials.find((item) => item.plotId === plot.id) ?? null;
    const geo = parseGeoJsonMeta(plot.geoJson);
    return {
      mapSpotId: asStringOrNull(geo.mapSpotId) ?? `plot-${plot.id}`,
      plotId: plot.id,
      plotNumber: plot.plotNumber,
      section: plot.section,
      row: plot.row,
      status: plot.status,
      type: plot.type,
      latitude: plot.latitude,
      longitude: plot.longitude,
      x: asFiniteNumber(geo.x),
      y: asFiniteNumber(geo.y),
      gprX: asFiniteNumber(geo.gprX),
      gprY: asFiniteNumber(geo.gprY),
      gprZ: asFiniteNumber(geo.gprZ),
      deceasedName: burial?.deceasedName ?? null,
      deceasedDob: burial?.deceasedDob ?? null,
      deceasedDod: burial?.deceasedDod ?? null,
      photoUrl: burial?.photoUrl ?? null,
      headstonePath: asStringOrNull(geo.imagePath) ?? asStringOrNull(geo.imageFileName),
      notes: burial?.notes ?? plot.notes ?? null,
    };
  });
  res.json({ organizationId, spots: records });
});

publicRouter.get("/cemetery-maps/public/:slug", async (req, res) => {
  const org = await getOrganizationBySlug(req.params.slug);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const folder = mapFolder(org.id);
  const published = await hydratePayloadWithGlobalSpots(
    org.id,
    await readJson<MapPayload>(path.join(folder.absolute, "published-map.json")),
  );
  if (!published?.doc) {
    res.status(404).json({ error: "Cemetery map not found. Publish the map first." });
    return;
  }
  res.json({
    ...published,
    cemetery: { id: org.id, name: org.name, slug: org.slug },
    ...mapUrls(org.slug),
  });
});

authedRouter.post("/cemetery-maps/rebuild-all", async (_req, res) => {
  const orgs = await db.select().from(organizationsTable);
  const results: Array<{ organizationId: number; slug: string; status: string }> = [];

  for (const org of orgs) {
    const folder = mapFolder(org.id);
    const published = await readJson<MapPayload>(path.join(folder.absolute, "published-map.json"));
    if (!published?.doc) {
      results.push({ organizationId: org.id, slug: org.slug, status: "skipped (no published map)" });
      continue;
    }

    try {
      const doc = published.doc as Record<string, unknown>;
      const spots = Array.isArray(doc.spots)
        ? (doc.spots as Array<Record<string, unknown>>).filter((s) => s && typeof s === "object")
        : [];

      const rawPoints = spots
        .filter((s) => Number.isFinite(Number(s.gprX)) && Number.isFinite(Number(s.gprY)))
        .map((s) => ({ x: Number(s.gprX), y: Number(s.gprY) }));

      if (rawPoints.length < 2) {
        results.push({ organizationId: org.id, slug: org.slug, status: "skipped (insufficient GPR data)" });
        continue;
      }

      const minX = Math.min(...rawPoints.map((p) => p.x));
      const maxX = Math.max(...rawPoints.map((p) => p.x));
      const minY = Math.min(...rawPoints.map((p) => p.y));
      const maxY = Math.max(...rawPoints.map((p) => p.y));
      const pad = 80;
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      const longSide = Math.max(spanX, spanY);
      const scale = Math.max(2, Math.min(24, (4000 - pad * 2) / longSide));
      const imgWidth = Math.max(900, Math.ceil(spanX * scale + pad * 2));
      const imgHeight = Math.max(650, Math.ceil(spanY * scale + pad * 2));

      const updatedSpots = spots.map((s) => {
        const gprX = Number(s.gprX);
        const gprY = Number(s.gprY);
        if (!Number.isFinite(gprX) || !Number.isFinite(gprY)) return s;
        return {
          ...s,
          x: pad + (gprX - minX) * scale,
          y: pad + (maxY - gprY) * scale,
        };
      });

      const updatedDoc = { ...doc, imgWidth, imgHeight, spots: updatedSpots };
      const updatedPayload: MapPayload = { ...published, doc: updatedDoc };
      await writeFile(path.join(folder.absolute, "published-map.json"), JSON.stringify(updatedPayload, null, 2), "utf8");
      results.push({ organizationId: org.id, slug: org.slug, status: `rebuilt (${updatedSpots.length} spots, scale=${scale.toFixed(2)})` });
    } catch (err) {
      results.push({ organizationId: org.id, slug: org.slug, status: `error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  res.json({ ok: true, rebuilt: results.filter((r) => r.status.startsWith("rebuilt")).length, results });
});

// ---------------------------------------------------------------------------
// Field survey CSV import helpers
// ---------------------------------------------------------------------------

function parseSimpleCsv(text: string): Array<Record<string, string>> {
  // Strip BOM and normalise line endings
  const cleaned = text.replace(/^﻿/, "").replace(/\r\n|\r/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { fields.push(field); field = ""; }
        else { field += ch; }
      }
    }
    fields.push(field);
    return fields;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim());
  const result: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (values[j] ?? "").trim();
    }
    result.push(obj);
  }
  return result;
}

interface CoordSystem {
  minX: number; minY: number; maxX: number; maxY: number;
  scale: number; pad: number; width: number; height: number;
}

function buildCoordSystem(allPoints: Array<{ x: number; y: number }>): CoordSystem {
  const width = 2200;
  const height = 1800;
  const pad = 72;
  const minX = Math.min(...allPoints.map((p) => p.x));
  const maxX = Math.max(...allPoints.map((p) => p.x));
  const minY = Math.min(...allPoints.map((p) => p.y));
  const maxY = Math.max(...allPoints.map((p) => p.y));
  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);
  const scale = Math.min((width - 2 * pad) / rangeX, (height - 2 * pad) / rangeY);
  return { minX, minY, maxX, maxY, scale, pad, width, height };
}

function projectPoint(cs: CoordSystem, x: number, y: number): { x: number; y: number } {
  return {
    x: (x - cs.minX) * cs.scale + cs.pad,
    y: cs.height - ((y - cs.minY) * cs.scale + cs.pad),
  };
}

function parseWktPolygon(wkt: string): Array<{ x: number; y: number }> {
  // Handles POLYGON Z((x y z, ...)) and POLYGON((x y, ...))
  const inner = wkt.replace(/^POLYGON\s*Z?\s*\(\(/, "").replace(/\)\)\s*$/, "");
  return inner.split(",").map((part) => {
    const coords = part.trim().split(/\s+/);
    return { x: parseFloat(coords[0] ?? "0"), y: parseFloat(coords[1] ?? "0") };
  }).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function fullName(first: string, middle: string, last: string): string {
  return [first, middle, last].map((s) => s.trim()).filter(Boolean).join(" ");
}

function canvasDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// ---------------------------------------------------------------------------
// POST /api/field-survey-import
// ---------------------------------------------------------------------------
authedRouter.post("/field-survey-import", async (req, res) => {
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const organizationId = asPositiveId(body.organizationId);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const burialCsvText = typeof body.burialCsv === "string" ? body.burialCsv : "";
  const gprCsvText = typeof body.gprCsv === "string" ? body.gprCsv : "";
  const copingCsvText = typeof body.copingCsv === "string" ? body.copingCsv : "";
  const miscCsvText = typeof body.miscCsv === "string" ? body.miscCsv : "";

  const burialRows = burialCsvText ? parseSimpleCsv(burialCsvText) : [];
  const gprRows = gprCsvText ? parseSimpleCsv(gprCsvText) : [];
  const copingRows = copingCsvText ? parseSimpleCsv(copingCsvText) : [];
  const miscRows = miscCsvText ? parseSimpleCsv(miscCsvText) : [];

  // Collect all raw projected points to build coordinate system
  const allRawPoints: Array<{ x: number; y: number }> = [];
  for (const r of burialRows) {
    const x = parseFloat(r.X ?? r.x ?? ""); const y = parseFloat(r.Y ?? r.y ?? "");
    if (Number.isFinite(x) && Number.isFinite(y)) allRawPoints.push({ x, y });
  }
  for (const r of gprRows) {
    const x = parseFloat(r.X ?? r.x ?? ""); const y = parseFloat(r.Y ?? r.y ?? "");
    if (Number.isFinite(x) && Number.isFinite(y)) allRawPoints.push({ x, y });
  }
  for (const r of copingRows) {
    const wkt = r.WKT ?? r.wkt ?? r.geometry ?? "";
    const pts = wkt ? parseWktPolygon(wkt) : [];
    allRawPoints.push(...pts);
  }
  for (const r of miscRows) {
    const x = parseFloat(r.X ?? r.x ?? ""); const y = parseFloat(r.Y ?? r.y ?? "");
    if (Number.isFinite(x) && Number.isFinite(y)) allRawPoints.push({ x, y });
  }

  if (allRawPoints.length < 2) {
    res.status(400).json({ error: "Not enough coordinate data in CSVs to build a coordinate system." });
    return;
  }

  const cs = buildCoordSystem(allRawPoints);

  const spots: Array<Record<string, unknown>> = [];

  // --- Burial spots ---
  const burialCanvasPoints: Array<{ cx: number; cy: number }> = [];
  for (let i = 0; i < burialRows.length; i++) {
    const r = burialRows[i];
    const rawX = parseFloat(r.X ?? r.x ?? "");
    const rawY = parseFloat(r.Y ?? r.y ?? "");
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;
    const { x: cx, y: cy } = projectPoint(cs, rawX, rawY);
    const name = fullName(r.FirstName ?? "", r.Middle ?? "", r.LastName ?? "");
    const imagePath = r.Image ? r.Image.trim() : null;
    const veteranStatus = r.VeteranStatus ? r.VeteranStatus.trim() : null;
    const spotTypeId = veteranStatus && veteranStatus.toLowerCase() !== "no" && veteranStatus.toLowerCase() !== "false"
      ? "veteran" : "standard";
    const spotId = `CSV-${i + 1}`;
    spots.push({
      id: spotId,
      x: cx, y: cy,
      gprX: rawX, gprY: rawY, gprZ: parseFloat(r.Z ?? r.z ?? "0") || 0,
      name: name || null,
      dob: r.DOB ?? null,
      dod: r.DOD ?? null,
      imagePath,
      veteranStatus,
      spotTypeId,
      reviewStatus: name ? "published" : "draft",
      spotCategory: "burial",
    });
    burialCanvasPoints.push({ cx, cy });
  }

  // --- GPR spots (only those not within 25 canvas pixels of a burial) ---
  let importedGpr = 0;
  for (let i = 0; i < gprRows.length; i++) {
    const r = gprRows[i];
    const rawX = parseFloat(r.X ?? r.x ?? "");
    const rawY = parseFloat(r.Y ?? r.y ?? "");
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;
    const { x: cx, y: cy } = projectPoint(cs, rawX, rawY);
    const tooClose = burialCanvasPoints.some(({ cx: bx, cy: by }) => canvasDistance(cx, cy, bx, by) < 25);
    if (tooClose) continue;
    const choice = r.Choice ?? r.choice ?? "Adult";
    spots.push({
      id: `GPR-${i + 1}`,
      x: cx, y: cy,
      gprX: rawX, gprY: rawY, gprZ: parseFloat(r.Z ?? r.z ?? "0") || 0,
      name: null,
      spotTypeId: `gpr-${choice.toLowerCase()}`,
      spotCategory: "gpr",
      reviewStatus: "draft",
    });
    importedGpr++;
  }

  // --- Coping polygons ---
  const polygons: Array<Record<string, unknown>> = [];
  for (let i = 0; i < copingRows.length; i++) {
    const r = copingRows[i];
    const wkt = r.WKT ?? r.wkt ?? r.geometry ?? "";
    if (!wkt) continue;
    const rawPoints = parseWktPolygon(wkt);
    const projectedPoints = rawPoints.map(({ x, y }) => projectPoint(cs, x, y));
    polygons.push({
      id: `COPING-${i + 1}`,
      type: "coping",
      points: projectedPoints,
      label: r.Name ?? r.name ?? null,
    });
  }

  // --- Misc points ---
  for (let i = 0; i < miscRows.length; i++) {
    const r = miscRows[i];
    const rawX = parseFloat(r.X ?? r.x ?? "");
    const rawY = parseFloat(r.Y ?? r.y ?? "");
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;
    const { x: cx, y: cy } = projectPoint(cs, rawX, rawY);
    spots.push({
      id: `MISC-${i + 1}`,
      x: cx, y: cy,
      gprX: rawX, gprY: rawY,
      name: r.Name ?? r.name ?? r.Type ?? r.type ?? "Misc",
      spotTypeId: "misc",
      spotCategory: "misc",
      reviewStatus: "draft",
    });
  }

  // Build map doc
  const cemetery = { id: org.id, name: org.name, slug: org.slug };
  const doc = {
    cemeteryId: org.id,
    projectStatus: "published",
    coordinateSystem: cs,
    spots,
    polygons,
  };
  const payload: MapPayload = {
    doc,
    plotTypes: [],
    spotTypes: [],
    cemetery,
    publishedAt: Date.now(),
  };

  const folder = mapFolder(org.id);
  await mkdir(folder.absolute, { recursive: true });
  await writeFile(path.join(folder.absolute, "draft-map.json"), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(path.join(folder.absolute, "published-map.json"), JSON.stringify(payload, null, 2), "utf8");

  // Sync burial spots to DB
  let syncedToDb = 0;
  const existingPlots = await db.select().from(plotsTable).where(eq(plotsTable.organizationId, organizationId));
  const existingBurials = await db.select().from(burialsTable).where(eq(burialsTable.organizationId, organizationId));
  const byPlotNumber = new Map(existingPlots.map((p) => [p.plotNumber.toLowerCase(), p]));
  const byPlotId = new Map(existingBurials.map((b) => [b.plotId ?? -1, b]));

  for (const spot of spots) {
    if (spot.spotCategory === "gpr") {
      // GPR-only: insert plot as available
      const pn = String(spot.id);
      const existingPlot = byPlotNumber.get(pn.toLowerCase());
      if (!existingPlot) {
        await db.insert(plotsTable).values({
          organizationId,
          plotNumber: pn,
          status: "available",
          type: "standard",
          geoJson: JSON.stringify({ source: "field-survey", mapSpotId: spot.id, x: spot.x, y: spot.y, gprX: spot.gprX, gprY: spot.gprY }),
        });
        syncedToDb++;
      }
      continue;
    }
    if (spot.spotCategory !== "burial" && spot.spotCategory !== "misc") continue;

    const pn = String(spot.id);
    const name = typeof spot.name === "string" && spot.name ? spot.name : null;
    const dob = normalizeSqlDate(spot.dob);
    const dod = normalizeSqlDate(spot.dod);
    const imagePath = typeof spot.imagePath === "string" && spot.imagePath ? spot.imagePath : null;
    const veteranStatus = typeof spot.veteranStatus === "string" && spot.veteranStatus ? spot.veteranStatus : null;
    const plotStatus = name ? "occupied" : "available";
    const geoMeta = { source: "field-survey", mapSpotId: spot.id, x: spot.x, y: spot.y, gprX: spot.gprX, gprY: spot.gprY, gprZ: spot.gprZ, imagePath };

    const existingPlot = byPlotNumber.get(pn.toLowerCase());
    const [plot] = existingPlot
      ? await db.update(plotsTable).set({ status: plotStatus as "available" | "occupied", geoJson: JSON.stringify(geoMeta) })
          .where(eq(plotsTable.id, existingPlot.id)).returning()
      : await db.insert(plotsTable).values({
          organizationId,
          plotNumber: pn,
          status: plotStatus as "available" | "occupied",
          type: (typeof spot.spotTypeId === "string" && spot.spotTypeId === "veteran") ? "standard" : "standard",
          geoJson: JSON.stringify(geoMeta),
        }).returning();

    byPlotNumber.set(pn.toLowerCase(), plot);
    syncedToDb++;

    if (name) {
      const existingBurial = byPlotId.get(plot.id);
      const burialNotes = imagePath ? `Headstone: ${imagePath}` : null;
      if (existingBurial) {
        await db.update(burialsTable).set({
          deceasedName: name,
          deceasedDob: dob,
          deceasedDod: dod,
          photoUrl: imagePath ?? existingBurial.photoUrl,
          veteranStatus,
          spotTypeId: typeof spot.spotTypeId === "string" ? spot.spotTypeId : null,
          headstoneImages: imagePath ? JSON.stringify([imagePath]) : null,
          notes: burialNotes ?? existingBurial.notes,
        }).where(eq(burialsTable.id, existingBurial.id));
      } else {
        const [inserted] = await db.insert(burialsTable).values({
          organizationId,
          plotId: plot.id,
          deceasedName: name,
          deceasedDob: dob,
          deceasedDod: dod,
          photoUrl: imagePath,
          veteranStatus,
          spotTypeId: typeof spot.spotTypeId === "string" ? spot.spotTypeId : null,
          headstoneImages: imagePath ? JSON.stringify([imagePath]) : null,
          notes: burialNotes,
        }).returning();
        byPlotId.set(plot.id, inserted);
      }
    }
  }

  const importedBurials = burialRows.length;
  const importedCoping = copingRows.length;
  const totalSpots = spots.length;

  res.json({
    ok: true,
    importedBurials,
    importedGpr,
    importedCoping,
    totalSpots,
    syncedToDb,
  });
});

export { publicRouter as cemeteryMapsPublicRouter };
export default authedRouter;
