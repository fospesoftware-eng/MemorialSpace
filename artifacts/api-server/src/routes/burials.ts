import { Router } from "express";
import { db } from "@workspace/db";
import { burialsTable, plotsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { readPage } from "../lib/pagination";

const router = Router();

router.get("/burials", async (req, res) => {
  const { organizationId, plotId } = req.query;
  const { limit, offset } = readPage(req, { defaultLimit: 200, maxLimit: 1000 });
  const conditions = [];
  if (organizationId) conditions.push(eq(burialsTable.organizationId, Number(organizationId)));
  if (plotId) conditions.push(eq(burialsTable.plotId, Number(plotId)));
  const q = db.select().from(burialsTable).orderBy(desc(burialsTable.id)).limit(limit).offset(offset);
  const burials = conditions.length ? await q.where(and(...conditions)) : await q;
  const result = burials.map((b) => ({
    ...b,
    headstoneImages: (() => {
      try {
        return b.headstoneImages ? JSON.parse(b.headstoneImages) : [];
      } catch {
        return b.photoUrl ? [b.photoUrl] : [];
      }
    })(),
  }));
  res.json(result);
});

router.post("/burials", async (req, res) => {
  const [burial] = await db.insert(burialsTable).values(req.body).returning();
  res.status(201).json(burial);
});

router.get("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [burial] = await db.select().from(burialsTable).where(eq(burialsTable.id, id));
  if (!burial) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    ...burial,
    headstoneImages: (() => {
      try {
        return burial.headstoneImages ? JSON.parse(burial.headstoneImages) : [];
      } catch {
        return burial.photoUrl ? [burial.photoUrl] : [];
      }
    })(),
  });
});

router.put("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [burial] = await db.update(burialsTable).set(req.body).where(eq(burialsTable.id, id)).returning();
  if (!burial) { res.status(404).json({ error: "Not found" }); return; }
  res.json(burial);
});

router.delete("/burials/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(burialsTable).where(eq(burialsTable.id, id));
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// GET /cemetery-roster  — sorted burial roster with grid references
// GET /cemetery-roster/csv — downloadable CSV
// ---------------------------------------------------------------------------

interface RosterEntry {
  gridRef: string;
  plotNumber: string;
  deceasedName: string | null;
  deceasedDob: string | null;
  deceasedDod: string | null;
  veteranStatus: string | null;
  photoUrl: string | null;
  section: string | null;
  row: string | null;
  latitude: number | null;
  longitude: number | null;
}

async function buildRoster(organizationId: number): Promise<RosterEntry[]> {
  const burials = await db
    .select()
    .from(burialsTable)
    .where(eq(burialsTable.organizationId, organizationId));

  const plots = await db
    .select()
    .from(plotsTable)
    .where(eq(plotsTable.organizationId, organizationId));

  const plotById = new Map(plots.map((p) => [p.id, p]));

  // Attach plot info to each burial
  const enriched = burials.map((b) => {
    const plot = b.plotId ? (plotById.get(b.plotId) ?? null) : null;
    return {
      burial: b,
      plot,
      lat: plot?.latitude ?? b.latitude ?? null,
      lon: plot?.longitude ?? b.longitude ?? null,
    };
  });

  // Sort: north→south (lat DESC), west→east (lon ASC)
  enriched.sort((a, b) => {
    const latA = a.lat ?? -Infinity;
    const latB = b.lat ?? -Infinity;
    if (latB !== latA) return latB - latA;
    const lonA = a.lon ?? -Infinity;
    const lonB = b.lon ?? -Infinity;
    return lonA - lonB;
  });

  // Determine Y range for band assignment (~10m bands in degrees ≈ 0.00009°)
  const lats = enriched.map((e) => e.lat).filter((l): l is number => l !== null);
  const maxLat = lats.length ? Math.max(...lats) : 0;
  const minLat = lats.length ? Math.min(...lats) : 0;
  const range = maxLat - minLat;
  const bandSize = range > 0 ? range / Math.max(1, Math.round(range / 0.00009)) : 1;

  const result: RosterEntry[] = [];
  for (const { burial, plot, lat, lon } of enriched) {
    // Row letter: distance from northernmost band
    let rowLabel = "A";
    if (lat !== null && range > 0) {
      const rowIndex = Math.floor((maxLat - lat) / bandSize);
      rowLabel = String.fromCharCode(65 + Math.min(rowIndex, 25));
    }

    // Column: count how many entries in same row come before this one
    const colIndex = result.filter((e) => e.gridRef.startsWith(`${rowLabel}-`)).length + 1;
    const gridRef = `${rowLabel}-${colIndex}`;

    result.push({
      gridRef,
      plotNumber: plot?.plotNumber ?? String(burial.plotId ?? burial.id),
      deceasedName: burial.deceasedName,
      deceasedDob: burial.deceasedDob ?? null,
      deceasedDod: burial.deceasedDod ?? null,
      veteranStatus: burial.veteranStatus ?? null,
      photoUrl: burial.photoUrl ?? null,
      section: plot?.section ?? null,
      row: plot?.row ?? null,
      latitude: lat,
      longitude: lon,
    });
  }

  return result;
}

router.get("/cemetery-roster", async (req, res) => {
  const organizationId = Number(req.query.organizationId);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }
  const roster = await buildRoster(organizationId);
  res.json(roster);
});

router.get("/cemetery-roster/csv", async (req, res) => {
  const organizationId = Number(req.query.organizationId);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }
  const roster = await buildRoster(organizationId);

  const escape = (v: string | null | undefined): string => {
    const s = v ?? "";
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = "Grid Ref,Plot Number,Last Name,First Name,Date of Birth,Date of Death,Veteran Status,Photo";
  const rows = roster.map((e) => {
    const parts = (e.deceasedName ?? "").split(" ");
    const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : (e.deceasedName ?? "");
    return [
      escape(e.gridRef),
      escape(e.plotNumber),
      escape(lastName),
      escape(firstName),
      escape(e.deceasedDob),
      escape(e.deceasedDod),
      escape(e.veteranStatus),
      escape(e.photoUrl),
    ].join(",");
  });

  const csv = [header, ...rows].join("\r\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="cemetery-roster.csv"');
  res.send(csv);
});

export default router;
