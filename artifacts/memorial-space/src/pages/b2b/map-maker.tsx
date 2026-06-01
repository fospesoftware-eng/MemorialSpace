import { useState, useRef, useEffect, useMemo, useCallback, type ComponentType, type PointerEvent as ReactPointerEvent, type ChangeEvent, type DragEvent as ReactDragEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  Upload, MousePointer2, Square, Trash2, Save, Download, Image as ImageIcon,
  Box, Layers, Eye, EyeOff, FolderOpen, FileImage, Plus, Hand,
  ZoomIn, ZoomOut, RotateCcw, Sparkles, MapPin as MapPinIcon, X,
  Maximize2, Minimize2, ChevronLeft, ChevronRight, ArrowLeft, Maximize, Settings as SettingsIcon,
  Spline, Circle as CircleIcon, Hexagon, SquareDashed, FileSpreadsheet,
  GitMerge, AlertTriangle, CheckCircle2, Send, Database, ListChecks, ImagePlus, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  usePlotTypes, useSpotTypes, useBackgrounds,
  SPOT_ICONS, FALLBACK_PLOT_TYPE, FALLBACK_SPOT_TYPE,
  STATUS_COLORS, BACKGROUND_LIBRARY_LIMIT, MAX_HEADSTONE_IMAGES,
  type PlotType, type PlotShape, type SpotType, type PlotStatus, type BurialSpot, type BackgroundEntry,
  newId, fileToDataUrl, downscaleImage, calcAge,
} from "@/lib/cemetery-config";
import { cn } from "@/lib/utils";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Tool = "select" | "draw" | "rect-outline" | "circle" | "polygon" | "polygon-outline" | "path" | "spot" | "pan";

/** Tools that produce an axis-aligned rectangle (drag-to-draw). */
const isRectTool = (t: Tool): t is "draw" | "rect-outline" => t === "draw" || t === "rect-outline";
/** Tools that produce a closed polygon (click-to-place vertices). */
const isPolygonTool = (t: Tool): t is "polygon" | "polygon-outline" => t === "polygon" || t === "polygon-outline";
/** True for the outline-only variants (no fill, just a stroked boundary). */
const isOutlineTool = (t: Tool) => t === "rect-outline" || t === "polygon-outline";

/** Map a plot type's `defaultShape` to the canvas tool that draws it. */
function shapeToTool(shape: PlotShape | undefined): Extract<Tool, "draw" | "circle" | "polygon" | "path"> {
  if (shape === "circle") return "circle";
  if (shape === "polygon") return "polygon";
  if (shape === "path") return "path";
  return "draw";
}
type View = "2d" | "3d" | "preview";
type ProjectStatus = "draft" | "published";

type CemeteryOption = {
  id: number;
  name: string;
  slug: string;
};

type WorkflowTab = "project" | "import" | "headstones" | "publish";

type CsvRow = Record<string, string>;

type BurialCsvRecord = {
  rowNumber: number;
  name: string;
  dob?: string;
  dod?: string;
  veteranStatus?: string;
  imagePath?: string;
  x?: number;
  y?: number;
  z?: number;
  lat?: number;
  lon?: number;
  sourceCsv: string;
};

type MergeBucket = "exact" | "nearby" | "new" | "duplicate" | "conflict";

type MergeCandidate = {
  id: string;
  bucket: MergeBucket;
  burial: BurialCsvRecord;
  spotId?: string;
  distance?: number;
  reason: string;
  apply: boolean;
};

type MergeReview = {
  sourceCsv: string;
  createdAt: number;
  exact: MergeCandidate[];
  nearby: MergeCandidate[];
  newRecords: MergeCandidate[];
  duplicates: MergeCandidate[];
  conflicts: MergeCandidate[];
  unmatchedGpr: BurialSpot[];
};

type HeadstoneManifest = {
  folder?: string;
  images?: Array<{
    imageFileName?: string;
    storedPath?: string;
    status?: string;
    confidence?: number;
    people?: Array<{ name?: string; dateOfBirth?: string | null; dateOfDeath?: string | null }>;
    inscriptionText?: string;
  }>;
};

type PersistedMapPayload = {
  doc: MapDoc;
  plotTypes?: PlotType[];
  spotTypes?: SpotType[];
  cemetery?: CemeteryOption;
  previewUrl?: string;
  permanentUrl?: string;
  publishedAt?: number;
};

type PublishedMapItem = {
  projectId: string;
  name: string;
  updatedAt: number;
  url: string;
};

/** Default stroke thickness for new path/road plots, in SVG units. */
const DEFAULT_PATH_WIDTH = 14;
/** Hard cap on vertices per drawn path — guards against runaway clicks. */
const MAX_PATH_VERTICES = 200;

interface Plot {
  id: string;
  typeId: string;
  label: string;
  status: PlotStatus;
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Optional polygon outline in absolute SVG coordinates (perimeter order).
   * When present, the plot renders as a `<polygon>` instead of a `<rect>`,
   * which is how AI-imported plots preserve their true (non-rectangular) shape.
   * The bounding box (x,y,w,h) is kept in sync with these points so the
   * existing select / move / resize handles still work.
   */
  points?: [number, number][];
  /**
   * Optional polyline vertices in absolute SVG coordinates. When present
   * (≥ 2 points) the plot renders as a stroked open `<polyline>` — the
   * "Path" tool uses this for flexible paths/roads/bridges that can't be
   * expressed as a rectangle. Mutually exclusive with `points` (a plot is
   * either a closed polygon or an open polyline, not both). Bounding box
   * (x/y/w/h) is kept in sync with these points so move/select work.
   */
  pathPoints?: [number, number][];
  /** Stroke width (SVG units) for polyline plots. Defaults to DEFAULT_PATH_WIDTH. */
  pathWidth?: number;
  /**
   * Optional circle geometry. When present the plot renders as an SVG
   * `<circle>`. Mutually exclusive with `points` and `pathPoints` (a plot
   * is at most one of: path, circle, polygon, or plain rectangle). The
   * bounding box (x/y/w/h) is kept in sync with the circle so the existing
   * select / move handles still work.
   */
  circle?: { cx: number; cy: number; r: number };
  /**
   * When true, render this plot as an outline only (no fill) — used to mark
   * boundaries for family graves, sections, or other groupings that contain
   * smaller plots inside without obscuring them. Applies to rect and polygon
   * shapes; ignored for paths (already stroke-only) and circles.
   */
  outline?: boolean;
  /** Text extracted from inside the marker by AI vision (names, dates, inscriptions). */
  textInside?: string;
  birthYear?: string;
  deathYear?: string;
  gridRef?: string;
  accuracy?: number;
  sourceCsv?: string;
  sourceLayer?: string;
}

interface MapDoc {
  name: string;
  projectId?: string;
  cemeteryId: number | null;
  projectStatus: ProjectStatus;
  image: string | null;
  imgWidth: number;
  imgHeight: number;
  coordinateSystem?: CoordinateSystem;
  plots: Plot[];
  spots: BurialSpot[];
  importSource?: {
    gprCsv?: string;
    burialCsv?: string;
    headstoneFolder?: string;
  };
  updatedAt: number;
}

type CoordinateSystem = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  scale: number;
  pad: number;
  width: number;
  height: number;
};

type Selection = { kind: "plot"; id: string } | { kind: "spot"; id: string } | null;

const STORAGE_KEY = "memorialspace.map-maker";
const SAMPLE_MAP_URL = "/sample-cemetery-map.webp";
const DEFAULT_DOC: MapDoc = {
  name: "Untitled Cemetery Map",
  cemeteryId: null,
  projectStatus: "draft",
  image: null,
  imgWidth: 1200,
  imgHeight: 800,
  coordinateSystem: undefined,
  plots: [],
  spots: [],
  updatedAt: Date.now(),
};

// Migrate plots that used `type` (old) to `typeId` (new). Tolerant of unknown shapes.
type LegacyPlot = { id?: string; type?: string; typeId?: string; label?: string; status?: string; x?: number; y?: number; w?: number; h?: number; points?: unknown };
type LegacySpot = Partial<BurialSpot>;
type LegacyDoc = {
  name?: string;
  projectId?: string;
  cemeteryId?: number | null;
  projectStatus?: ProjectStatus;
  image?: string | null;
  imgWidth?: number;
  imgHeight?: number;
  coordinateSystem?: CoordinateSystem;
  plots?: LegacyPlot[];
  spots?: LegacySpot[];
  importSource?: MapDoc["importSource"];
  updatedAt?: number;
};

const VALID_STATUS = new Set<PlotStatus>(["available", "reserved", "occupied"]);
const safeStatus = (s: unknown): PlotStatus => (typeof s === "string" && VALID_STATUS.has(s as PlotStatus) ? (s as PlotStatus) : "available");
const safeNum = (n: unknown, fallback: number): number => (typeof n === "number" && Number.isFinite(n) ? n : fallback);
const safeOptNum = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) ? n : undefined);
const safeStr = (s: unknown, fallback = ""): string => (typeof s === "string" ? s : fallback);
const safeOptStr = (s: unknown): string | undefined => (typeof s === "string" && s.length > 0 ? s : undefined);

const WORKFLOW_TABS: Array<{ id: WorkflowTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "project", label: "Project", icon: Database },
  { id: "import", label: "Import CSVs", icon: FileSpreadsheet },
  { id: "headstones", label: "Headstones", icon: ImagePlus },
  { id: "publish", label: "Publish", icon: Send },
];

const IMPORT_FLAG_ORDER: NonNullable<BurialSpot["importFlags"]> = [
  "GPR Imported",
  "Burial Data Matched",
  "Image Attached",
  "AI Processed",
  "Needs Review",
  "Verified",
  "Published",
];

function withFlag(spot: BurialSpot, flag: NonNullable<BurialSpot["importFlags"]>[number]): BurialSpot {
  const next = new Set(spot.importFlags ?? []);
  next.add(flag);
  return { ...spot, importFlags: IMPORT_FLAG_ORDER.filter((item) => next.has(item)) };
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "\"" && quoted && next === "\"") {
      current += "\"";
      i++;
    } else if (ch === "\"") {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(current.trim());
      current = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += ch;
    }
  }
  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells) => {
    const out: CsvRow = {};
    headers.forEach((header, index) => {
      if (header) out[header] = cells[index]?.trim() ?? "";
    });
    return out;
  });
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pick(row: CsvRow, names: string[]) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value) return value;
  }
  return "";
}

function pickNumber(row: CsvRow, names: string[]) {
  const value = pick(row, names);
  if (!value) return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDateLike(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const mdy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${year}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  return trimmed;
}

function normalName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fileBaseName(value: string) {
  return value.split(/[\\/]/).pop()?.trim() ?? value.trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createCoordinateSystem(points: Array<{ x: number; y: number }>): CoordinateSystem {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const pad = 72;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const width = Math.max(900, Math.min(2200, spanX * 12 + pad * 2));
  const height = Math.max(650, Math.min(1800, spanY * 12 + pad * 2));
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  return { minX, minY, maxX, maxY, scale, pad, width, height };
}

function projectPoint(system: CoordinateSystem, x: number, y: number) {
  return {
    x: system.pad + (x - system.minX) * system.scale,
    y: system.pad + (y - system.minY) * system.scale,
  };
}

function parseWktPolygon(value: string): Array<{ x: number; y: number; z?: number }> {
  const matches = value.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) ?? [];
  const nums = matches.map(Number).filter(Number.isFinite);
  const points: Array<{ x: number; y: number; z?: number }> = [];
  const stride = /\bZ\b/i.test(value) ? 3 : 2;
  for (let i = 0; i + 1 < nums.length; i += stride) {
    points.push({ x: nums[i], y: nums[i + 1], z: stride === 3 ? nums[i + 2] : undefined });
  }
  return points;
}

function plotBounds(points: [number, number][]) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(8, maxX - minX), h: Math.max(8, maxY - minY) };
}

function fullNameFromRow(row: CsvRow) {
  return [
    pick(row, ["first name", "firstname", "first"]),
    pick(row, ["middle", "middle name", "middlename"]),
    pick(row, ["last name", "lastname", "family name", "familyname", "last"]),
  ].filter(Boolean).join(" ").trim() || pick(row, ["name", "deceased name", "deceased", "full name"]);
}

function burialRecordFromRow(row: CsvRow, index: number, sourceCsv: string): BurialCsvRecord {
  return {
    rowNumber: index + 2,
    name: fullNameFromRow(row),
    dob: normalizeDateLike(pick(row, ["dob", "date of birth", "birth date", "born"])),
    dod: normalizeDateLike(pick(row, ["dod", "date of death", "death date", "died"])),
    veteranStatus: pick(row, ["veteran", "veteran status", "veteranstatus", "military", "service"]),
    imagePath: pick(row, ["image", "image path", "image filename", "headstone image", "filename", "file name"]),
    x: pickNumber(row, ["x", "gpr x", "gpr_x", "map x", "longitude"]),
    y: pickNumber(row, ["y", "gpr y", "gpr_y", "map y", "latitude"]),
    z: pickNumber(row, ["z", "depth", "gpr z", "gpr_z"]),
    lat: pickNumber(row, ["lat", "latitude"]),
    lon: pickNumber(row, ["lon", "lng", "long", "longitude"]),
    sourceCsv,
  };
}

function spotTypeFromBurialRecord(record: BurialCsvRecord, fallback = "civilian") {
  const text = `${record.name} ${record.veteranStatus ?? ""}`.toLowerCase();
  if (/\b(navy|naval|usn)\b/.test(text)) return "veteran-navy";
  if (/\b(marine|marines|usmc)\b/.test(text)) return "veteran-marines";
  if (/\b(air force|airforce|usaf)\b/.test(text)) return "veteran-airforce";
  if (/\b(army|veteran|military|service|served)\b/.test(text)) return "veteran-army";
  if (/\b(child|infant|baby|son|daughter)\b/.test(text)) return "child";
  if (/\b(rev|reverend|pastor|father|priest|clergy)\b/.test(text)) return "clergy";
  return fallback;
}

function patchSpotFromBurialRecord(spot: BurialSpot, record: BurialCsvRecord): BurialSpot {
  let next: BurialSpot = {
    ...spot,
    name: record.name || spot.name,
    dob: record.dob ?? spot.dob,
    dod: record.dod ?? spot.dod,
    lat: record.lat ?? spot.lat,
    lon: record.lon ?? spot.lon,
    gprX: record.x ?? spot.gprX,
    gprY: record.y ?? spot.gprY,
    gprZ: record.z ?? spot.gprZ,
    sourceCsv: record.sourceCsv,
    imagePath: record.imagePath || spot.imagePath,
    imageFileName: record.imagePath ? fileBaseName(record.imagePath) : spot.imageFileName,
    veteranStatus: record.veteranStatus || spot.veteranStatus,
    spotTypeId: spotTypeFromBurialRecord(record, spot.spotTypeId),
    reviewStatus: record.name ? "burial_matched" : spot.reviewStatus,
  };
  if (record.name) next = withFlag(next, "Burial Data Matched");
  if (record.imagePath) next = withFlag(next, "Image Attached");
  return next;
}

function withBasePath(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${normalized}`;
}

function migrateDoc(raw: unknown): MapDoc {
  const d = (raw ?? {}) as LegacyDoc;
  return {
    name: safeStr(d.name, "Untitled Cemetery Map"),
    projectId: safeOptStr(d.projectId),
    cemeteryId: typeof d.cemeteryId === "number" ? d.cemeteryId : null,
    projectStatus: d.projectStatus === "published" ? "published" : "draft",
    image: typeof d.image === "string" ? d.image : null,
    imgWidth:  safeNum(d.imgWidth,  1200),
    imgHeight: safeNum(d.imgHeight, 800),
    coordinateSystem: d.coordinateSystem,
    plots: (Array.isArray(d.plots) ? d.plots : []).map((p) => {
      // Polygon outline (optional). Accept any array of [x,y] tuples and
      // coerce to finite numbers; drop the field entirely if fewer than 3
      // valid vertices remain so the rest of the editor stays in the
      // happy "rect-only" path.
      let points: [number, number][] | undefined;
      if (Array.isArray(p.points)) {
        const pts: [number, number][] = [];
        for (const pt of p.points.slice(0, 64)) {
          if (Array.isArray(pt) && pt.length >= 2) {
            const px = safeOptNum(pt[0]);
            const py = safeOptNum(pt[1]);
            if (px !== undefined && py !== undefined) pts.push([px, py]);
          }
        }
        if (pts.length >= 3) points = pts;
      }
      // Polyline / path vertices (optional). Coerce, clamp to MAX, drop
      // the field if fewer than 2 valid vertices remain so the rest of the
      // editor stays on the rect/polygon code paths.
      let pathPoints: [number, number][] | undefined;
      const rawPath = (p as LegacyPlot & { pathPoints?: unknown }).pathPoints;
      if (Array.isArray(rawPath)) {
        const pts: [number, number][] = [];
        for (const pt of rawPath.slice(0, MAX_PATH_VERTICES)) {
          if (Array.isArray(pt) && pt.length >= 2) {
            const px = safeOptNum(pt[0]);
            const py = safeOptNum(pt[1]);
            if (px !== undefined && py !== undefined) pts.push([px, py]);
          }
        }
        if (pts.length >= 2) pathPoints = pts;
      }
      // Clamp `pathWidth` to the same range exposed by the inspector slider
      // (2..60) so a poisoned saved doc can't load with a runaway / negative
      // stroke that paints over the rest of the map. Falls back to the
      // default when the field is missing or non-finite.
      const outline = (p as LegacyPlot & { outline?: unknown }).outline === true ? true : undefined;
      const pathWidth = pathPoints
        ? Math.max(2, Math.min(60, safeOptNum((p as LegacyPlot & { pathWidth?: unknown }).pathWidth) ?? DEFAULT_PATH_WIDTH))
        : undefined;
      // Circle geometry (optional). Coerce + validate cx/cy/r; clamp r so
      // a poisoned doc can't load with a giant circle that swamps the map.
      // Drop the field entirely if any required component is missing or
      // non-positive — the editor stays on the rect/polygon/polyline path.
      let circle: { cx: number; cy: number; r: number } | undefined;
      const rawCircle = (p as LegacyPlot & { circle?: unknown }).circle;
      if (rawCircle && typeof rawCircle === "object") {
        const rc = rawCircle as { cx?: unknown; cy?: unknown; r?: unknown };
        const cx = safeOptNum(rc.cx);
        const cy = safeOptNum(rc.cy);
        const r  = safeOptNum(rc.r);
        if (cx !== undefined && cy !== undefined && r !== undefined && r > 0) {
          circle = { cx, cy, r: Math.max(1, Math.min(2000, r)) };
        }
      }
      return {
        id: safeStr(p.id, newId("p")),
        typeId: safeStr(p.typeId ?? p.type, "_unknown"),
        label: safeStr(p.label, ""),
        status: safeStatus(p.status),
        x: safeNum(p.x, 0), y: safeNum(p.y, 0),
        w: safeNum(p.w, 40), h: safeNum(p.h, 25),
        points,
        pathPoints,
        pathWidth,
        circle,
        outline,
        textInside: safeOptStr((p as LegacyPlot & { textInside?: unknown }).textInside),
        birthYear: safeOptStr((p as LegacyPlot & { birthYear?: unknown }).birthYear),
        deathYear: safeOptStr((p as LegacyPlot & { deathYear?: unknown }).deathYear),
        gridRef: safeOptStr((p as LegacyPlot & { gridRef?: unknown }).gridRef),
        accuracy: safeOptNum((p as LegacyPlot & { accuracy?: unknown }).accuracy),
        sourceCsv: safeOptStr((p as LegacyPlot & { sourceCsv?: unknown }).sourceCsv),
        sourceLayer: safeOptStr((p as LegacyPlot & { sourceLayer?: unknown }).sourceLayer),
      };
    }),
    spots: (Array.isArray(d.spots) ? d.spots : []).map((s) => {
      // Headstone images: migrate from the legacy single `headstoneImage`
      // string into an array. Newer saves already store `headstoneImages`,
      // and we tolerate both being present (newer wins, legacy is folded in
      // only if the array is empty) so a downgraded client can't lose data.
      const legacyOne = safeOptStr((s as LegacySpot & { headstoneImage?: unknown }).headstoneImage);
      const fromArrayRaw = (s as LegacySpot & { headstoneImages?: unknown }).headstoneImages;
      const fromArray = Array.isArray(fromArrayRaw)
        ? fromArrayRaw
            .filter((v): v is string => typeof v === "string" && v.length > 0)
            .slice(0, MAX_HEADSTONE_IMAGES)
        : [];
      const headstoneImages = fromArray.length > 0
        ? fromArray
        : legacyOne
          ? [legacyOne]
          : undefined;
      return {
        id: safeStr(s.id, newId("s")),
        x: safeNum(s.x, 0), y: safeNum(s.y, 0),
        name: safeStr(s.name, ""),
        dob: safeOptStr(s.dob), dod: safeOptStr(s.dod),
        spotTypeId: safeStr(s.spotTypeId, "civilian"),
        headstoneImages,
        lat: safeOptNum(s.lat), lon: safeOptNum(s.lon),
        notes: safeOptStr(s.notes),
        symbolType: safeOptStr((s as LegacySpot & { symbolType?: unknown }).symbolType),
        temporaryId: safeOptStr((s as LegacySpot & { temporaryId?: unknown }).temporaryId),
        gprX: safeOptNum((s as LegacySpot & { gprX?: unknown }).gprX),
        gprY: safeOptNum((s as LegacySpot & { gprY?: unknown }).gprY),
        gprZ: safeOptNum((s as LegacySpot & { gprZ?: unknown }).gprZ),
        accuracy: safeOptNum((s as LegacySpot & { accuracy?: unknown }).accuracy),
        sourceCsv: safeOptStr((s as LegacySpot & { sourceCsv?: unknown }).sourceCsv),
        imageFileName: safeOptStr((s as LegacySpot & { imageFileName?: unknown }).imageFileName),
        imagePath: safeOptStr((s as LegacySpot & { imagePath?: unknown }).imagePath),
        veteranStatus: safeOptStr((s as LegacySpot & { veteranStatus?: unknown }).veteranStatus),
        aiConfidence: safeOptNum((s as LegacySpot & { aiConfidence?: unknown }).aiConfidence),
        reviewStatus: safeOptStr((s as LegacySpot & { reviewStatus?: unknown }).reviewStatus) as BurialSpot["reviewStatus"],
        importFlags: Array.isArray((s as LegacySpot & { importFlags?: unknown }).importFlags)
          ? ((s as LegacySpot & { importFlags?: unknown }).importFlags as string[]).filter(Boolean) as BurialSpot["importFlags"]
          : undefined,
        aiData: typeof (s as LegacySpot & { aiData?: unknown }).aiData === "object"
          ? (s as BurialSpot).aiData
          : undefined,
      };
    }),
    importSource: d.importSource,
    updatedAt: safeNum(d.updatedAt, Date.now()),
  };
}

export default function MapMaker() {
  const [location] = useLocation();
  const previewMatch = location.match(/^\/map-maker\/preview\/([^/?#]+)/);
  if (previewMatch) {
    return <PublishedMapPreview slug={decodeURIComponent(previewMatch[1])} />;
  }
  return <MapMakerEditor />;
}

function MapMakerEditor() {
  const [plotTypes] = usePlotTypes();
  const [spotTypes] = useSpotTypes();
  const [backgrounds, setBackgrounds, backgroundsErr] = useBackgrounds();

  const [doc, setDoc] = useState<MapDoc>(DEFAULT_DOC);
  const [tool, setTool] = useState<Tool>("select");
  const [activePlotTypeId, setActivePlotTypeId] = useState<string>(() => plotTypes[0]?.id ?? "");
  const [activeSpotTypeId, setActiveSpotTypeId] = useState<string>(() => spotTypes[0]?.id ?? "");
  const [selection, setSelection] = useState<Selection>(null);
  const [view, setView] = useState<View>("2d");
  const [tilt, setTilt] = useState(55);
  const [zoom, setZoom] = useState(1);
  const [showImage, setShowImage] = useState(true);
  // Labels are off by default — they crowd the canvas on dense imported maps
  // (e.g. a Gresham-style grid with 300+ plots). Hover any plot to see its
  // label; toggle the "Labels" button in the toolbar to pin them all on.
  const [showLabels, setShowLabels] = useState(false);
  const [showSpots, setShowSpots] = useState(true);
  // Tracks the plot the pointer is currently hovering over, so we can show
  // its label on hover even when the global "Labels" toggle is off.
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);
  const [draftRect, setDraftRect] = useState<Plot | null>(null);
  const [savedMaps, setSavedMaps] = useState<{ key: string; name: string; updatedAt: number }[]>([]);
  const [publishedMaps, setPublishedMaps] = useState<PublishedMapItem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [workflowTab, setWorkflowTab] = useState<WorkflowTab>("project");
  const [cemeteries, setCemeteries] = useState<CemeteryOption[]>([]);
  const [mergeReview, setMergeReview] = useState<MergeReview | null>(null);
  const [importLog, setImportLog] = useState<string[]>([]);

  // Refs / mode trackers
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gprInputRef = useRef<HTMLInputElement | null>(null);
  const burialInputRef = useRef<HTMLInputElement | null>(null);
  const datasetInputRef = useRef<HTMLInputElement | null>(null);
  const headstoneInputRef = useRef<HTMLInputElement | null>(null);
  const dragState = useRef<{ mode: "create" | "create-circle" | "move" | "resize" | "move-spot" | "pan"; id?: string; offsetX?: number; offsetY?: number; anchorX?: number; anchorY?: number; switchToSelectOnUp?: boolean; panStartClientX?: number; panStartClientY?: number; panStartScrollLeft?: number; panStartScrollTop?: number } | null>(null);
  const draftRectRef = useRef<Plot | null>(null);
  // ----- Path / Polygon tool draft state -----
  // Both the Path tool (open polyline) and the Polygon tool (closed filled
  // shape) build up a vertex list through discrete clicks (NOT a drag), so
  // they share this draft separate from `draftRect` / `dragState`. The
  // `closed` discriminator decides which kind of plot is committed and how
  // the live preview is rendered. The ref is the source of truth (committed
  // during synchronous handlers); the state mirror exists purely to trigger
  // re-renders so the live preview updates.
  type DraftPath = { typeId: string; pathWidth: number; points: [number, number][]; closed: boolean; outline?: boolean };
  const draftPathRef = useRef<DraftPath | null>(null);
  const [draftPath, setDraftPath] = useState<DraftPath | null>(null);
  // Latest pointer position (SVG units) while the Path / Polygon tool is
  // active — used to draw a "rubber band" segment from the last vertex to
  // the cursor (and, for polygons, back to the first vertex to preview the
  // closing edge).
  const [pathCursor, setPathCursor] = useState<{ x: number; y: number } | null>(null);
  const viewRef = useRef<View>("2d");

  useEffect(() => { viewRef.current = view; }, [view]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organizations", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setCemeteries(
          data
            .map((item) => ({
              id: Number(item.id),
              name: String(item.name ?? "Untitled cemetery"),
              slug: String(item.slug ?? item.id),
            }))
            .filter((item) => Number.isFinite(item.id)),
        );
      })
      .catch(() => {
        if (!cancelled) setCemeteries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Surface background-library persistence failures (e.g. quota) in the canvas toast.
  useEffect(() => {
    if (!backgroundsErr) return;
    setSaveError("Background library is full or storage is unavailable. Newest uploads may not be saved for reuse — remove old backgrounds in Cemetery Setup.");
    const t = setTimeout(() => setSaveError(null), 8000);
    return () => clearTimeout(t);
  }, [backgroundsErr]);

  // Status messages auto-dismiss
  const flashStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage((cur) => (cur === msg ? null : cur)), 3500);
  }, []);

  // ----- Browser fullscreen API -----
  const enterFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch (err) {
      flashStatus(`Couldn't toggle fullscreen: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }, [flashStatus]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Cancel any active drag when the view changes (mid-drag 3D toggle would
  // mutate the wrong things). We intentionally do NOT depend on `tool` here:
  // pointerdown handlers may set both `dragState` and `tool` in the same event,
  // and we want to keep the drag alive until pointerup commits or cancels it.
  useEffect(() => {
    if (dragState.current) {
      dragState.current = null;
      draftRectRef.current = null;
      setDraftRect(null);
    }
  }, [view]);

  // Clear stale hover state when the underlying plots change (e.g. after a
  // delete or after loading a new map) so we don't keep referencing an id
  // that no longer exists.
  useEffect(() => {
    if (hoveredPlotId && !doc.plots.some((p) => p.id === hoveredPlotId)) {
      setHoveredPlotId(null);
    }
  }, [doc.plots, hoveredPlotId]);

  // Maintain valid active type ids if registry changes
  useEffect(() => {
    if (!plotTypes.find((t) => t.id === activePlotTypeId)) setActivePlotTypeId(plotTypes[0]?.id ?? "");
  }, [plotTypes, activePlotTypeId]);
  useEffect(() => {
    if (!spotTypes.find((t) => t.id === activeSpotTypeId)) setActiveSpotTypeId(spotTypes[0]?.id ?? "");
  }, [spotTypes, activeSpotTypeId]);

  const getPlotType = useCallback((id: string): PlotType => plotTypes.find((t) => t.id === id) ?? FALLBACK_PLOT_TYPE, [plotTypes]);
  const getSpotType = useCallback((id: string): SpotType => spotTypes.find((t) => t.id === id) ?? FALLBACK_SPOT_TYPE, [spotTypes]);

  const selectedPlot = useMemo(() => selection?.kind === "plot" ? doc.plots.find((p) => p.id === selection.id) ?? null : null, [doc.plots, selection]);
  const selectedSpot = useMemo(() => selection?.kind === "spot" ? doc.spots.find((s) => s.id === selection.id) ?? null : null, [doc.spots, selection]);

  // Refresh saved maps list from localStorage
  const refreshSaved = useCallback(() => {
    const list: { key: string; name: string; updatedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${STORAGE_KEY}:`)) {
        try {
          const m = JSON.parse(localStorage.getItem(k)!) as MapDoc;
          if (m.projectStatus === "published") continue;
          list.push({ key: k, name: m.name ?? "(unnamed)", updatedAt: m.updatedAt ?? 0 });
        } catch {}
      }
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    setSavedMaps(list);
  }, []);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  const refreshPublishedMaps = useCallback(async (cemeteryId: number | null) => {
    if (!cemeteryId) {
      setPublishedMaps([]);
      return;
    }
    try {
      const res = await fetch(`/api/cemetery-maps/published?cemeteryId=${cemeteryId}&projectId=${encodeURIComponent(doc.projectId ?? "default")}`, {
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.published?.doc) {
        setPublishedMaps([]);
        return;
      }
      const item: PublishedMapItem = {
        projectId: String(body.projectId ?? doc.projectId ?? "default"),
        name: String(body?.published?.doc?.name ?? "Published map"),
        updatedAt: Number(body?.published?.doc?.updatedAt ?? body?.published?.publishedAt ?? Date.now()),
        url: String(body?.permanentUrl ?? ""),
      };
      setPublishedMaps([item]);
    } catch {
      setPublishedMaps([]);
    }
  }, [doc.projectId]);

  const syncGlobalBurialSpots = useCallback(async (cemeteryId: number) => {
    try {
      const res = await fetch(`/api/cemetery-maps/global-spots?cemeteryId=${cemeteryId}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(body?.spots)) return;
      const rows = body.spots as Array<Record<string, unknown>>;
      setDoc((prev) => {
        const mapped = rows.map((row, idx): BurialSpot => ({
          id: String(row.mapSpotId ?? `global-${idx + 1}`),
          temporaryId: String(row.plotNumber ?? `MAP-${idx + 1}`),
          x: typeof row.x === "number" ? row.x : (prev.spots[idx]?.x ?? 100 + idx * 8),
          y: typeof row.y === "number" ? row.y : (prev.spots[idx]?.y ?? 100 + idx * 8),
          name: String(row.deceasedName ?? ""),
          dob: typeof row.deceasedDob === "string" ? row.deceasedDob : undefined,
          dod: typeof row.deceasedDod === "string" ? row.deceasedDod : undefined,
          spotTypeId: typeof row.type === "string" && row.type ? row.type : "civilian",
          lat: typeof row.latitude === "number" ? row.latitude : undefined,
          lon: typeof row.longitude === "number" ? row.longitude : undefined,
          gprX: typeof row.gprX === "number" ? row.gprX : undefined,
          gprY: typeof row.gprY === "number" ? row.gprY : undefined,
          gprZ: typeof row.gprZ === "number" ? row.gprZ : undefined,
          imagePath: typeof row.headstonePath === "string" ? row.headstonePath : undefined,
          notes: typeof row.notes === "string" ? row.notes : undefined,
          reviewStatus: prev.projectStatus === "published" ? "published" : undefined,
        }));
        return {
          ...prev,
          spots: mapped,
          updatedAt: Date.now(),
        };
      });
    } catch {
      // keep current local state if sync fails
    }
  }, []);

  useEffect(() => {
    if (!doc.cemeteryId) return;
    void refreshPublishedMaps(doc.cemeteryId);
    void syncGlobalBurialSpots(doc.cemeteryId);
  }, [doc.cemeteryId, refreshPublishedMaps, syncGlobalBurialSpots]);

  // ----- AI Map Maker handoff -----
  // The /ai-map-maker page writes a "pending" MapDoc into localStorage just before
  // navigating here. Pick it up on mount, load it as the current doc, then clear
  // the pending key so a refresh doesn't re-load it indefinitely.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("memorialspace.map-maker:__pending__");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { doc?: unknown };
      const migrated = parsed?.doc ? migrateDoc(parsed.doc) : null;
      if (migrated) {
        // Defensive bounds: a poisoned payload could otherwise blow up the SVG
        // viewBox with an enormous or negative dimension. Clamp into a sane range.
        const safeW = Math.max(100, Math.min(20000, migrated.imgWidth));
        const safeH = Math.max(100, Math.min(20000, migrated.imgHeight));
        const safeDoc: MapDoc = {
          ...migrated,
          imgWidth: safeW,
          imgHeight: safeH,
          plots: migrated.plots.slice(0, 500),
          spots: migrated.spots.slice(0, 500),
        };
        setDoc(safeDoc);
        setSelection(null);
        flashStatus("Loaded AI-generated map — refine and save when ready");
      }
    } catch {
      // ignore — corrupt pending payload shouldn't break the editor
    } finally {
      try { localStorage.removeItem("memorialspace.map-maker:__pending__"); } catch {}
      refreshSaved();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Pointer math -----
  const toSvgPoint = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const p = pt.matrixTransform(inv);
    return { x: p.x, y: p.y };
  }, []);

  // ----- Canvas pointer handlers -----
  // Find the Radix ScrollArea viewport that wraps our SVG canvas. The hand
  // tool scrolls THIS element to pan; we look it up lazily because it's
  // mounted by ScrollArea and only exists at runtime.
  const findScrollViewport = useCallback((): HTMLElement | null => {
    return canvasWrapRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
  }, []);

  const onCanvasPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (view === "3d") return;
    const target = e.target as SVGElement;
    const isPlotEl = target.dataset.plot === "true";
    const isResizeEl = target.dataset.resize === "true";
    const isSpotEl = target.dataset.spot === "true" || target.closest?.('[data-spot="true"]') !== null;
    const spotIdFromEl = isSpotEl
      ? (target.dataset.spotId ?? (target.closest?.('[data-spot="true"]') as HTMLElement | null)?.dataset.spotId)
      : undefined;
    const { x, y } = toSvgPoint(e);

    // Hand / pan tool: drag to scroll the canvas viewport. Always wins —
    // even when the press lands on a plot — so the user can pan over busy
    // imported maps without accidentally selecting things.
    if (tool === "pan") {
      const vp = findScrollViewport();
      if (!vp) return;
      dragState.current = {
        mode: "pan",
        panStartClientX: e.clientX,
        panStartClientY: e.clientY,
        panStartScrollLeft: vp.scrollLeft,
        panStartScrollTop: vp.scrollTop,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (isRectTool(tool) && !isPlotEl && !isResizeEl && !isSpotEl) {
      if (!activePlotTypeId) return;
      const id = newId("p");
      const draft: Plot = {
        id, typeId: activePlotTypeId, label: "", status: "available",
        x, y, w: 0, h: 0,
        ...(tool === "rect-outline" ? { outline: true } : {}),
      };
      draftRectRef.current = draft;
      setDraftRect(draft);
      dragState.current = { mode: "create", id, anchorX: x, anchorY: y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    // Circle tool: drag from the press point (center) outward; the distance
    // to the cursor defines the radius. Bounding box is kept as a square
    // around the circle so the existing select/move handles still work.
    // Same draft refs as the rect tool — only one draft can be active at a time.
    if (tool === "circle" && !isPlotEl && !isResizeEl && !isSpotEl) {
      if (!activePlotTypeId) return;
      const id = newId("p");
      const draft: Plot = {
        id, typeId: activePlotTypeId, label: "", status: "available",
        x, y, w: 0, h: 0,
        circle: { cx: x, cy: y, r: 0 },
      };
      draftRectRef.current = draft;
      setDraftRect(draft);
      dragState.current = { mode: "create-circle", id, anchorX: x, anchorY: y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    // Path / Polygon tool: each click adds a vertex to the in-progress shape.
    // Double-click / Enter / Esc finishes; Backspace pops the last vertex.
    // We deliberately ignore plot/spot underlays so a road or polygon can
    // pass over a plot without flipping selection mid-draw. We also do NOT
    // capture the pointer — both tools rely on discrete clicks, not drags.
    // The `closed` flag picks polygon (filled) vs polyline (stroked).
    if (tool === "path" || isPolygonTool(tool)) {
      if (!activePlotTypeId) return;
      const closed = isPolygonTool(tool);
      const outline = tool === "polygon-outline";
      const cur = draftPathRef.current;
      if (!cur) {
        const next: DraftPath = { typeId: activePlotTypeId, pathWidth: DEFAULT_PATH_WIDTH, points: [[x, y] as [number, number]], closed, outline };
        draftPathRef.current = next;
        setDraftPath(next);
      } else if (cur.points.length < MAX_PATH_VERTICES) {
        // Skip duplicate vertices (the second pointerdown of a dblclick lands
        // on the same point as the first; the dblclick handler will commit).
        const [lx, ly] = cur.points[cur.points.length - 1];
        if (Math.hypot(x - lx, y - ly) < 0.5) return;
        const next: DraftPath = { ...cur, points: [...cur.points, [x, y] as [number, number]] };
        draftPathRef.current = next;
        setDraftPath(next);
      }
      setPathCursor({ x, y });
      return;
    }

    if (tool === "spot" && !isPlotEl && !isResizeEl && !isSpotEl) {
      if (!activeSpotTypeId) return;
      const id = newId("s");
      const newSpot: BurialSpot = {
        id, x, y, name: "", spotTypeId: activeSpotTypeId,
      };
      setDoc((d) => ({ ...d, spots: [...d.spots, newSpot], updatedAt: Date.now() }));
      setSelection({ kind: "spot", id });
      // Allow dragging into precise position immediately. Defer the tool
      // switch to pointerup so the drag isn't cancelled by a tool-change effect.
      dragState.current = { mode: "move-spot", id, offsetX: 0, offsetY: 0, switchToSelectOnUp: true };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "select") {
      if (isResizeEl && selection?.kind === "plot") {
        dragState.current = { mode: "resize", id: selection.id, anchorX: x, anchorY: y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
      if (isSpotEl && spotIdFromEl) {
        const spot = doc.spots.find((s) => s.id === spotIdFromEl);
        if (spot) {
          setSelection({ kind: "spot", id: spotIdFromEl });
          dragState.current = { mode: "move-spot", id: spotIdFromEl, offsetX: x - spot.x, offsetY: y - spot.y };
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          return;
        }
      }
      if (isPlotEl) {
        const id = target.dataset.plotId!;
        setSelection({ kind: "plot", id });
        const plot = doc.plots.find((p) => p.id === id);
        if (plot) {
          dragState.current = { mode: "move", id, offsetX: x - plot.x, offsetY: y - plot.y };
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        }
        return;
      }
      // empty area
      setSelection(null);
    }
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (viewRef.current === "3d") return;
    // Path / Polygon tools: track the cursor for the live "rubber band"
    // preview from the last placed vertex to the pointer (and, for polygons,
    // the closing edge back to the first vertex). Runs even when no drag is
    // active — both tools are click-based, not drag-based.
    if ((tool === "path" || isPolygonTool(tool)) && draftPathRef.current) {
      const { x, y } = toSvgPoint(e);
      setPathCursor({ x, y });
      return;
    }
    if (!dragState.current) return;
    const ds = dragState.current;

    // Hand / pan tool: scroll the viewport. Compute the delta in SCREEN
    // pixels (not SVG units) — we're moving the scroll container, which
    // is unaffected by the SVG viewBox transform.
    if (ds.mode === "pan") {
      const vp = findScrollViewport();
      if (vp) {
        vp.scrollLeft = ds.panStartScrollLeft! - (e.clientX - ds.panStartClientX!);
        vp.scrollTop  = ds.panStartScrollTop!  - (e.clientY - ds.panStartClientY!);
      }
      return;
    }

    const { x, y } = toSvgPoint(e);

    if (ds.mode === "create" && draftRectRef.current) {
      const ax = ds.anchorX!, ay = ds.anchorY!;
      const next: Plot = {
        ...draftRectRef.current,
        x: Math.min(ax, x), y: Math.min(ay, y),
        w: Math.abs(x - ax), h: Math.abs(y - ay),
      };
      draftRectRef.current = next;
      setDraftRect(next);
    }

    if (ds.mode === "create-circle" && draftRectRef.current) {
      const ax = ds.anchorX!, ay = ds.anchorY!;
      const r = Math.hypot(x - ax, y - ay);
      const next: Plot = {
        ...draftRectRef.current,
        x: ax - r, y: ay - r, w: r * 2, h: r * 2,
        circle: { cx: ax, cy: ay, r },
      };
      draftRectRef.current = next;
      setDraftRect(next);
    }

    if (ds.mode === "move" && ds.id) {
      setDoc((d) => ({
        ...d,
        plots: d.plots.map((p) => {
          if (p.id !== ds.id) return p;
          const nx = x - ds.offsetX!;
          const ny = y - ds.offsetY!;
          // Translate the polygon outline, polyline path, AND circle center
          // by the same delta so any rendered shape stays glued to the box.
          const dx = nx - p.x;
          const dy = ny - p.y;
          const points = p.points ? p.points.map(([px, py]) => [px + dx, py + dy] as [number, number]) : undefined;
          const pathPoints = p.pathPoints ? p.pathPoints.map(([px, py]) => [px + dx, py + dy] as [number, number]) : undefined;
          const circle = p.circle ? { cx: p.circle.cx + dx, cy: p.circle.cy + dy, r: p.circle.r } : undefined;
          return { ...p, x: nx, y: ny, points, pathPoints, circle };
        }),
      }));
    }

    if (ds.mode === "move-spot" && ds.id) {
      setDoc((d) => ({
        ...d,
        spots: d.spots.map((s) => s.id === ds.id ? { ...s, x: x - ds.offsetX!, y: y - ds.offsetY! } : s),
      }));
    }

    if (ds.mode === "resize" && ds.id) {
      setDoc((d) => ({
        ...d,
        plots: d.plots.map((p) => {
          if (p.id !== ds.id) return p;
          const nw = Math.max(8, x - p.x);
          const nh = Math.max(8, y - p.y);
          // Scale the polygon / polyline outline relative to the top-left so
          // the shape stays inside (and proportional to) the new bounding box.
          let points = p.points;
          if (points && p.w > 0 && p.h > 0) {
            const sx = nw / p.w;
            const sy = nh / p.h;
            points = points.map(([px, py]) => [
              p.x + (px - p.x) * sx,
              p.y + (py - p.y) * sy,
            ] as [number, number]);
          }
          let pathPoints = p.pathPoints;
          if (pathPoints && p.w > 0 && p.h > 0) {
            const sx = nw / p.w;
            const sy = nh / p.h;
            pathPoints = pathPoints.map(([px, py]) => [
              p.x + (px - p.x) * sx,
              p.y + (py - p.y) * sy,
            ] as [number, number]);
          }
          return { ...p, w: nw, h: nh, points, pathPoints };
        }),
      }));
    }
  };

  const onCanvasPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragState.current) {
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
      return;
    }
    const ds = dragState.current;
    if (ds.mode === "create" && viewRef.current === "2d") {
      const { x, y } = toSvgPoint(e);
      const ax = ds.anchorX!, ay = ds.anchorY!;
      const finalW = Math.abs(x - ax);
      const finalH = Math.abs(y - ay);
      if (draftRectRef.current && finalW > 6 && finalH > 6) {
        const finalPlot: Plot = {
          ...draftRectRef.current,
          x: Math.min(ax, x), y: Math.min(ay, y),
          w: finalW, h: finalH,
        };
        setDoc((d) => ({ ...d, plots: [...d.plots, finalPlot], updatedAt: Date.now() }));
        setSelection({ kind: "plot", id: finalPlot.id });
        setTool("select");
      }
    }
    if (ds.mode === "create-circle" && viewRef.current === "2d") {
      const { x, y } = toSvgPoint(e);
      const ax = ds.anchorX!, ay = ds.anchorY!;
      const r = Math.hypot(x - ax, y - ay);
      // Same minimum size threshold as the rect tool — guards against
      // accidental zero-radius circles from a stray click.
      if (draftRectRef.current && r > 4) {
        const finalPlot: Plot = {
          ...draftRectRef.current,
          x: ax - r, y: ay - r, w: r * 2, h: r * 2,
          circle: { cx: ax, cy: ay, r },
        };
        setDoc((d) => ({ ...d, plots: [...d.plots, finalPlot], updatedAt: Date.now() }));
        setSelection({ kind: "plot", id: finalPlot.id });
        setTool("select");
      }
    }
    if (ds.mode === "move" || ds.mode === "move-spot" || ds.mode === "resize") {
      // bump updatedAt on any geometry change
      setDoc((d) => ({ ...d, updatedAt: Date.now() }));
    }
    if (ds.switchToSelectOnUp) {
      setTool("select");
    }
    draftRectRef.current = null;
    setDraftRect(null);
    dragState.current = null;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
  };

  const onCanvasPointerCancel = (e: ReactPointerEvent<SVGSVGElement>) => {
    draftRectRef.current = null;
    setDraftRect(null);
    dragState.current = null;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
  };

  // Commit the in-progress polyline as a real Plot. Trims trailing
  // near-duplicate vertices (the dblclick gesture leaves one behind), drops
  // the draft if too few real vertices remain. By default switches back to
  // Select; pass `switchToSelect: false` when an outer caller is itself
  // switching the user to a different tool (e.g. tool-change auto-commit)
  // so we don't clobber their target.
  // Returns true if a plot was committed, false otherwise.
  const commitDraftPath = useCallback((opts?: { switchToSelect?: boolean }): boolean => {
    const switchToSelect = opts?.switchToSelect ?? true;
    const cur = draftPathRef.current;
    draftPathRef.current = null;
    setDraftPath(null);
    setPathCursor(null);
    if (!cur) return false;
    // Trim trailing near-duplicates so a dblclick that places the second
    // pointerdown ~on top of the previous vertex doesn't create a zero-length
    // tail segment. 4 SVG units ≈ what the browser treats as the same point.
    const pts: [number, number][] = [];
    for (const pt of cur.points) {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) > 4) pts.push(pt);
    }
    // Polygons need ≥3 vertices (a triangle is the smallest valid polygon);
    // open paths need ≥2 (a single segment is a valid road).
    const minVertices = cur.closed ? 3 : 2;
    if (pts.length < minVertices) return false;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    let finalPlot: Plot;
    if (cur.closed) {
      // Closed polygon — bbox is the tight min/max of the vertices (no
      // half-stroke padding; the fill stays inside the geometry).
      const bx = Math.min(...xs);
      const by = Math.min(...ys);
      const bw = Math.max(8, Math.max(...xs) - bx);
      const bh = Math.max(8, Math.max(...ys) - by);
      finalPlot = {
        id: newId("p"),
        typeId: cur.typeId,
        label: "",
        status: "available",
        x: bx, y: by, w: bw, h: bh,
        points: pts,
        ...(cur.outline ? { outline: true } : {}),
      };
    } else {
      // Open polyline — bbox includes a half-stroke padding so the visible
      // stroked line never spills outside the bounding rect.
      const pad = cur.pathWidth / 2;
      const bx = Math.min(...xs) - pad;
      const by = Math.min(...ys) - pad;
      const bw = Math.max(8, Math.max(...xs) - Math.min(...xs) + cur.pathWidth);
      const bh = Math.max(8, Math.max(...ys) - Math.min(...ys) + cur.pathWidth);
      finalPlot = {
        id: newId("p"),
        typeId: cur.typeId,
        label: "",
        status: "available",
        x: bx, y: by, w: bw, h: bh,
        pathPoints: pts,
        pathWidth: cur.pathWidth,
      };
    }
    setDoc((d) => ({ ...d, plots: [...d.plots, finalPlot], updatedAt: Date.now() }));
    setSelection({ kind: "plot", id: finalPlot.id });
    if (switchToSelect) setTool("select");
    return true;
  }, []);

  // Cancel the current path draft without committing (used by Esc when the
  // user wants to throw away the in-progress shape, or by tool changes).
  const cancelDraftPath = useCallback(() => {
    draftPathRef.current = null;
    setDraftPath(null);
    setPathCursor(null);
  }, []);

  // Switching tools mid-draw should not strand a partial polyline / polygon
  // (and must not silently commit one shape as the other). Commit-or-discard
  // whenever the active tool no longer matches the in-progress draft's mode:
  // either the user left the click-based tools entirely, or they swapped
  // between Path and Polygon (which have different `closed` semantics, so
  // continuing the same draft would yield the wrong stored shape and
  // vertex-min enforcement). Pass switchToSelect=false so we honour whichever
  // tool the user actually picked instead of forcing them into Select.
  useEffect(() => {
    const cur = draftPathRef.current;
    if (!cur) return;
    // Switching between fill ↔ outline variants of the same closed-polygon
    // family is fine — the outline flag is a render-time decision, not a
    // geometry one — so we only force a commit when the user crosses the
    // open/closed boundary (path ↔ polygon).
    const stillSameMode =
      (tool === "path"            && !cur.closed) ||
      (isPolygonTool(tool)        &&  cur.closed);
    if (!stillSameMode) {
      commitDraftPath({ switchToSelect: false });
      return;
    }
    // Sync the active draft's outline flag when toggling between
    // `polygon` and `polygon-outline` mid-draw, so the live preview and
    // eventual commit honour whichever variant the user has selected
    // *now*, not whichever one started the draft.
    if (cur.closed) {
      const wantOutline = tool === "polygon-outline";
      if ((cur.outline ?? false) !== wantOutline) {
        const next: DraftPath = { ...cur, outline: wantOutline };
        draftPathRef.current = next;
        setDraftPath(next);
      }
    }
  }, [tool, commitDraftPath]);

  // Double-click on the canvas finishes the in-progress path or polygon.
  // Wired on the SVG element so the user can dblclick anywhere — including
  // on the last vertex they just placed — to signal "done".
  const onCanvasDoubleClick = () => {
    if ((tool === "path" || isPolygonTool(tool)) && draftPathRef.current) commitDraftPath();
  };

  // ----- Keyboard shortcuts -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Path-drawing keys take priority — Backspace pops the last vertex,
      // Enter commits, Escape discards the in-progress draft. We branch
      // first so they don't fall through to the global Backspace=delete
      // selection / Esc=clear selection behaviour.
      if (draftPathRef.current) {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          const cur = draftPathRef.current;
          if (cur.points.length <= 1) {
            cancelDraftPath();
          } else {
            const next = { ...cur, points: cur.points.slice(0, -1) };
            draftPathRef.current = next;
            setDraftPath(next);
          }
          return;
        }
        if (e.key === "Enter") { e.preventDefault(); commitDraftPath(); return; }
        if (e.key === "Escape") { e.preventDefault(); cancelDraftPath(); return; }
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        if (selection.kind === "plot") {
          setDoc((d) => ({ ...d, plots: d.plots.filter((p) => p.id !== selection.id), updatedAt: Date.now() }));
        } else {
          setDoc((d) => ({ ...d, spots: d.spots.filter((s) => s.id !== selection.id), updatedAt: Date.now() }));
        }
        setSelection(null);
      }
      if (e.key === "Escape") setSelection(null);
      const k = e.key.toLowerCase();
      if (k === "v") setTool("select");
      if (k === "r") setTool(e.shiftKey ? "rect-outline" : "draw");
      if (k === "c") setTool("circle");
      if (k === "g") setTool(e.shiftKey ? "polygon-outline" : "polygon");
      if (k === "p") setTool("path");
      if (k === "s") setTool("spot");
      if (k === "h") setTool("pan");
      if (k === "f") {
        e.preventDefault();
        void enterFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, enterFullscreen, commitDraftPath, cancelDraftPath]);

  // ----- Background image management -----
  // Returns true on success, false on failure. Caller should only show
  // success feedback (e.g. "Loaded background…") when the result is true.
  const setBackgroundFromDataUrl = async (dataUrl: string, sourceName: string): Promise<boolean> => {
    try {
      // Use a downscaled version for both rendering AND library storage to keep quota in check.
      const scaled = await downscaleImage(dataUrl, 1600);
      setDoc((d) => ({ ...d, image: scaled.data, imgWidth: scaled.width, imgHeight: scaled.height }));
      // Add to library (dedupe + cap). useStored will surface a quota error
      // via `backgroundsErr` (handled above) — the current map's background
      // already loaded successfully and is independent of library persistence.
      setBackgrounds((prev) => {
        const filtered = prev.filter((b) => b.image !== scaled.data);
        const entry: BackgroundEntry = {
          id: newId("bg"), name: sourceName,
          image: scaled.data, imgWidth: scaled.width, imgHeight: scaled.height,
          addedAt: Date.now(),
        };
        return [entry, ...filtered].slice(0, BACKGROUND_LIBRARY_LIMIT);
      });
      return true;
    } catch {
      setSaveError("Couldn't process that image. Try a smaller file or a different format.");
      setTimeout(() => setSaveError(null), 6000);
      return false;
    }
  };

  const onUploadImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let dataUrl: string;
    try {
      dataUrl = await fileToDataUrl(file);
    } catch {
      setSaveError("Couldn't read that file.");
      setTimeout(() => setSaveError(null), 4000);
      return;
    }
    const ok = await setBackgroundFromDataUrl(dataUrl, file.name.replace(/\.[^.]+$/, ""));
    if (ok) flashStatus(`Loaded background: ${file.name}`);
  };

  // Drag & drop image onto canvas
  const onCanvasDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!isDragOver) setIsDragOver(true);
    }
  };
  const onCanvasDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setIsDragOver(false);
  };
  const onCanvasDrop = async (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Only image files (PNG/JPG/WebP) can be used as backgrounds.");
      setTimeout(() => setSaveError(null), 4000);
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await fileToDataUrl(file);
    } catch {
      setSaveError("Couldn't read the dropped file.");
      setTimeout(() => setSaveError(null), 4000);
      return;
    }
    const ok = await setBackgroundFromDataUrl(dataUrl, file.name.replace(/\.[^.]+$/, ""));
    if (ok) flashStatus(`Loaded background: ${file.name}`);
  };

  // Belt-and-braces: if a drag ends outside the canvas (e.g. the user lets go
  // over the OS desktop), the canvas's `dragleave` may not fire. Listen on
  // window so the visual drop overlay can't get stuck.
  useEffect(() => {
    const clear = () => setIsDragOver(false);
    window.addEventListener("drop", clear);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("drop", clear);
      window.removeEventListener("dragend", clear);
    };
  }, []);

  const loadSample = async () => {
    try {
      const res = await fetch(SAMPLE_MAP_URL);
      if (!res.ok) {
        setSaveError(`Couldn't load the sample map (HTTP ${res.status}). Try uploading your own image instead.`);
        setTimeout(() => setSaveError(null), 6000);
        return;
      }
      const blob = await res.blob();
      const dataUrl = await fileToDataUrl(new File([blob], "sample-cemetery.webp", { type: blob.type || "image/webp" }));
      const ok = await setBackgroundFromDataUrl(dataUrl, "St. Woolos Cemetery (sample)");
      if (!ok) return;
      // Seed sample plots/spots if blank
      setDoc((d) => d.plots.length === 0 && d.spots.length === 0
        ? { ...d, name: "St. Woolos Cemetery — Sample", plots: SAMPLE_PLOTS(), spots: SAMPLE_SPOTS(), updatedAt: Date.now() }
        : d);
      flashStatus("Loaded sample cemetery map");
    } catch (err) {
      console.error("Failed to load sample", err);
      setSaveError("Couldn't load the sample map. Check your connection or upload your own image.");
      setTimeout(() => setSaveError(null), 6000);
    }
  };

  const applyBackgroundFromLibrary = (bg: BackgroundEntry) => {
    setDoc((d) => ({ ...d, image: bg.image, imgWidth: bg.imgWidth, imgHeight: bg.imgHeight, updatedAt: Date.now() }));
  };

  // ----- Save / load -----
  const persistedPayload = useCallback((nextDoc: MapDoc) => ({
    doc: nextDoc,
    plotTypes,
    spotTypes,
  }), [plotTypes, spotTypes]);

  const mapPreviewUrl = useMemo(() => {
    const cemetery = cemeteries.find((item) => item.id === doc.cemeteryId);
    if (!cemetery) return null;
    const suffix = doc.projectId ? `?project=${encodeURIComponent(doc.projectId)}` : "";
    return `/map-maker/preview/${encodeURIComponent(cemetery.slug)}${suffix}`;
  }, [cemeteries, doc.cemeteryId, doc.projectId]);

  const openPreviewUrl = useCallback(async () => {
    if (!mapPreviewUrl) {
      setSaveError("Select a cemetery before opening the permanent map URL.");
      setTimeout(() => setSaveError(null), 5000);
      return;
    }
    if (!doc.cemeteryId) return;
    const previewWindow = window.open("about:blank", "_blank");
    const toSave = { ...doc, updatedAt: Date.now() };
    try {
      localStorage.setItem(`${STORAGE_KEY}:${(toSave.name || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "untitled"}`, JSON.stringify(toSave));
      const res = await fetch(`/api/cemetery-maps?cemeteryId=${toSave.cemeteryId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(persistedPayload(toSave)),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setDoc(toSave);
      refreshSaved();
      const url = typeof body?.permanentUrl === "string" ? body.permanentUrl : mapPreviewUrl;
      if (previewWindow) previewWindow.location.href = withBasePath(url);
      else window.open(withBasePath(url), "_blank", "noopener,noreferrer");
    } catch (err) {
      previewWindow?.close();
      setSaveError(err instanceof Error ? err.message : "Could not open preview URL.");
      setTimeout(() => setSaveError(null), 6000);
    }
  }, [doc, mapPreviewUrl, persistedPayload, refreshSaved]);

  const save = async () => {
    const safeName = doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "untitled";
    const key = `${STORAGE_KEY}:${safeName}`;
    const toSave = { ...doc, updatedAt: Date.now() };
    try {
      localStorage.setItem(key, JSON.stringify(toSave));
      if (toSave.cemeteryId) {
        const res = await fetch(`/api/cemetery-maps?cemeteryId=${toSave.cemeteryId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(persistedPayload(toSave)),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
      }
      setDoc(toSave);
      setSaveError(null);
      refreshSaved();
      flashStatus(toSave.cemeteryId ? "Saved map and updated permanent draft URL" : "Saved map locally");
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "QuotaExceededError"
        ? "Storage full — try removing the background image, removing headstone photos, or deleting older saved maps."
        : err instanceof Error
          ? err.message
          : "Failed to save map. Try removing the background image and saving again.";
      setSaveError(msg);
      setTimeout(() => setSaveError(null), 8000);
    }
  };

  const load = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      setDoc(migrateDoc(JSON.parse(raw)));
      setSelection(null);
    } catch {}
  };

  const removeMap = (key: string) => {
    localStorage.removeItem(key);
    refreshSaved();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const cemetery = cemeteries.find((item) => item.id === doc.cemeteryId);
    const spotTypeMap = new Map(spotTypes.map((type) => [type.id, type]));
    const plotTypeMap = new Map(plotTypes.map((type) => [type.id, type]));
    const plotsSvg = doc.plots.map((plot) => {
      const meta = plotTypeMap.get(plot.typeId) ?? FALLBACK_PLOT_TYPE;
      if (plot.points && plot.points.length >= 3) {
        return `<polygon points="${plot.points.map(([x, y]) => `${x},${y}`).join(" ")}" fill="${plot.outline ? "rgba(0,0,0,0.02)" : meta.fill}" stroke="${meta.stroke}" stroke-width="${plot.outline ? 2 : 1}" ${plot.outline ? 'stroke-dasharray="7 5"' : ""} opacity="0.7" />`;
      }
      return `<rect x="${plot.x}" y="${plot.y}" width="${plot.w}" height="${plot.h}" fill="${plot.outline ? "rgba(0,0,0,0.02)" : meta.fill}" stroke="${meta.stroke}" stroke-width="${plot.outline ? 2 : 1}" ${plot.outline ? 'stroke-dasharray="7 5"' : ""} opacity="0.7" />`;
    }).join("");
    const spotsSvg = doc.spots.map((spot) => {
      const meta = spotTypeMap.get(spot.spotTypeId) ?? FALLBACK_SPOT_TYPE;
      const label = escapeHtml(spot.name || spot.temporaryId || "");
      return `<g><rect x="${spot.x - 3}" y="${spot.y - 3}" width="6" height="6" fill="${meta.color}" stroke="#fff" stroke-width="1" /><text x="${spot.x + 5}" y="${spot.y - 3}" font-size="7" font-family="Arial, sans-serif" fill="#1f2a22">${label}</text></g>`;
    }).join("");
    const legend = spotTypes.map((type) => `<span><i style="background:${type.color}"></i>${escapeHtml(type.name)}</span>`).join("");
    const win = window.open("", "_blank");
    if (!win) {
      setSaveError("Browser blocked the PDF window. Allow popups and try again.");
      setTimeout(() => setSaveError(null), 5000);
      return;
    }
    win.document.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(doc.name)} PDF</title>
  <style>
    @page { size: 11in 11in; margin: 0.35in; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f4f0e5; color: #1d2a22; font-family: "Times New Roman", Georgia, serif; }
    .sheet {
      min-height: calc(100vh - 2px);
      border: 1px solid #2a3d31;
      background: #fffdf6;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 10px;
      padding: 12px;
    }
    .title-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      gap: 10px;
      border-bottom: 1px solid #2a3d31;
      padding-bottom: 8px;
    }
    .title-lg { margin: 0; font-size: 22px; letter-spacing: 0.02em; font-weight: 600; }
    .title-sm { margin-top: 4px; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #50604f; font-family: Arial, sans-serif; }
    .meta { text-align: right; font-size: 10px; color: #50604f; font-family: Arial, sans-serif; line-height: 1.45; }
    .map-grid {
      display: grid;
      grid-template-columns: 1fr 170px;
      gap: 10px;
      min-height: 0;
    }
    .map-wrap {
      border: 1px solid #2a3d31;
      background: #fffdf6;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .map-wrap svg { width: 100%; height: 100%; }
    .side {
      border: 1px solid #2a3d31;
      background: #faf7ef;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: Arial, sans-serif;
    }
    .panel-title { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #50604f; font-weight: 600; }
    .legend { display: grid; gap: 4px; }
    .legend span { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; color: #263426; }
    .legend i { width: 9px; height: 9px; border: 1px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.25); }
    .scale {
      margin-top: auto;
      border-top: 1px solid #d5d0c3;
      padding-top: 8px;
      font-size: 9px;
      color: #50604f;
    }
    .bar { width: 132px; max-width: 100%; height: 4px; background: #253524; margin-bottom: 4px; }
    .ticks { display: flex; justify-content: space-between; width: 132px; max-width: 100%; }
    .foot {
      border-top: 1px solid #2a3d31;
      padding-top: 7px;
      font-size: 9px;
      color: #50604f;
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="title-row">
      <div>
        <h1 class="title-lg">${escapeHtml(cemetery?.name ?? doc.name)}</h1>
        <div class="title-sm">${escapeHtml(doc.name)} · Cemetery Overview · Spring ${new Date().getFullYear()}</div>
      </div>
      <div class="meta">
        Interactive Cemetery Grid Map<br/>
        Exported ${new Date().toLocaleDateString()}<br/>
        All dimensions in feet
      </div>
    </header>
    <main class="map-grid">
      <section class="map-wrap">
        <svg viewBox="0 0 ${doc.imgWidth} ${doc.imgHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${doc.imgWidth}" height="${doc.imgHeight}" fill="#fffdf6" />
          <defs>
            <pattern id="gridPdf" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(74,86,70,0.14)" stroke-width="1" />
            </pattern>
          </defs>
          <rect width="${doc.imgWidth}" height="${doc.imgHeight}" fill="url(#gridPdf)" />
          ${plotsSvg}
          ${spotsSvg}
        </svg>
      </section>
      <aside class="side">
        <div class="panel-title">Legend</div>
        <div class="legend">${legend}</div>
        <div class="scale">
          <div class="panel-title">Scale</div>
          <div class="bar"></div>
          <div class="ticks"><span>0</span><span>10</span><span>20</span><span>40 ft</span></div>
        </div>
      </aside>
    </main>
    <footer class="foot">
      <div>Reference style: Cemetery grid map export</div>
      <div>Locations are generated from imported cemetery data and should be verified before public release.</div>
    </footer>
  </div>
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>
</body>
</html>`);
    win.document.close();
  };

  const updatePlot = (patch: Partial<Plot>) => {
    if (!selectedPlot) return;
    setDoc((d) => ({ ...d, plots: d.plots.map((p) => p.id === selectedPlot.id ? { ...p, ...patch } : p), updatedAt: Date.now() }));
  };
  const updateSpot = (patch: Partial<BurialSpot>) => {
    if (!selectedSpot) return;
    setDoc((d) => ({ ...d, spots: d.spots.map((s) => s.id === selectedSpot.id ? { ...s, ...patch } : s), updatedAt: Date.now() }));
  };

  // Append one or more headstone photos to the selected spot. Each file is
  // downscaled in parallel and only the surviving ones are committed (one
  // bad file shouldn't block the rest). Excess uploads beyond
  // MAX_HEADSTONE_IMAGES are silently dropped with a status message.
  //
  // The merge runs inside a functional setDoc so two batches uploaded back
  // to back can't clobber each other — each batch sees the latest array
  // and re-clamps to the cap. We capture the spot id (not the spot object)
  // before awaiting, so a selection change mid-upload still targets the
  // right spot.
  const onUploadHeadstone = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !selectedSpot) return;
    const spotId = selectedSpot.id;

    const existingAtStart = selectedSpot.headstoneImages ?? [];
    const room = Math.max(0, MAX_HEADSTONE_IMAGES - existingAtStart.length);
    if (room === 0) {
      setSaveError(`This spot already has the maximum of ${MAX_HEADSTONE_IMAGES} headstone photos. Remove one before adding more.`);
      setTimeout(() => setSaveError(null), 4000);
      return;
    }
    const accepted = files.slice(0, room);
    const droppedUpFront = files.length - accepted.length;

    const results = await Promise.allSettled(
      accepted.map(async (file) => {
        const dataUrl = await fileToDataUrl(file);
        const scaled = await downscaleImage(dataUrl, 400);
        return scaled.data;
      }),
    );
    const newImages = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failed = results.length - newImages.length;

    let droppedAtCommit = 0;
    if (newImages.length > 0) {
      setDoc((d) => ({
        ...d,
        spots: d.spots.map((s) => {
          if (s.id !== spotId) return s;
          const current = s.headstoneImages ?? [];
          const slots = Math.max(0, MAX_HEADSTONE_IMAGES - current.length);
          const fit = newImages.slice(0, slots);
          droppedAtCommit = newImages.length - fit.length;
          if (fit.length === 0) return s;
          return { ...s, headstoneImages: [...current, ...fit] };
        }),
        updatedAt: Date.now(),
      }));
    }

    const totalDropped = droppedUpFront + droppedAtCommit;
    if (failed > 0 || totalDropped > 0) {
      const parts: string[] = [];
      if (failed > 0) parts.push(`${failed} photo${failed === 1 ? "" : "s"} couldn't be processed`);
      if (totalDropped > 0) parts.push(`${totalDropped} skipped (max ${MAX_HEADSTONE_IMAGES} per spot)`);
      setSaveError(parts.join(" · "));
      setTimeout(() => setSaveError(null), 4000);
    }
  };

  // Remove a single headstone image by index from the selected spot. Uses a
  // functional setDoc so a remove racing with a concurrent upload always
  // operates on the latest array.
  const onRemoveHeadstone = (index: number) => {
    if (!selectedSpot) return;
    const spotId = selectedSpot.id;
    setDoc((d) => ({
      ...d,
      spots: d.spots.map((s) => {
        if (s.id !== spotId) return s;
        const current = s.headstoneImages ?? [];
        if (index < 0 || index >= current.length) return s;
        const next = current.filter((_, i) => i !== index);
        return { ...s, headstoneImages: next.length > 0 ? next : undefined };
      }),
      updatedAt: Date.now(),
    }));
  };

  const addImportLog = useCallback((message: string) => {
    setImportLog((items) => [message, ...items].slice(0, 6));
    flashStatus(message);
  }, [flashStatus]);

  const createDraftProject = () => {
    if (!doc.cemeteryId) {
      setSaveError("Select or create a cemetery before creating a map project.");
      setTimeout(() => setSaveError(null), 5000);
      return;
    }
    if (!doc.name.trim() || doc.name === DEFAULT_DOC.name) {
      setSaveError("Enter a project name before creating the draft.");
      setTimeout(() => setSaveError(null), 5000);
      return;
    }
    setDoc((d) => ({
      ...d,
      name: d.name.trim(),
      projectId: newId("project"),
      projectStatus: "draft",
      updatedAt: Date.now(),
    }));
    addImportLog("Map project is ready as a draft");
    setWorkflowTab("import");
  };

  const onUploadGprCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const points = rows
        .map((row, index) => ({
          row,
          index,
          x: pickNumber(row, ["x", "gpr x", "gpr_x", "easting", "map x", "longitude"]),
          y: pickNumber(row, ["y", "gpr y", "gpr_y", "northing", "map y", "latitude"]),
          z: pickNumber(row, ["z", "depth", "gpr z", "gpr_z"]),
          accuracy: pickNumber(row, ["accuracy", "confidence", "quality"]),
        }))
        .filter((point): point is typeof point & { x: number; y: number } => point.x !== undefined && point.y !== undefined);

      if (points.length === 0) {
        setSaveError("GPR CSV needs valid X and Y coordinate columns.");
        setTimeout(() => setSaveError(null), 6000);
        return;
      }

      const coordinateSystem = createCoordinateSystem(points);
      const existingIds = new Set(doc.spots.map((spot) => spot.temporaryId ?? spot.id));

      const spots: BurialSpot[] = points.map((point, index) => {
        const temp = `GPR-${String(index + 1).padStart(3, "0")}`;
        const projected = projectPoint(coordinateSystem, point.x, point.y);
        return {
          id: existingIds.has(temp) ? newId("s") : temp,
          temporaryId: temp,
          x: projected.x,
          y: projected.y,
          name: "",
          spotTypeId: activeSpotTypeId || "civilian",
          lat: pickNumber(point.row, ["lat", "latitude"]),
          lon: pickNumber(point.row, ["lon", "lng", "long", "longitude"]),
          gprX: point.x,
          gprY: point.y,
          gprZ: point.z,
          accuracy: point.accuracy,
          sourceCsv: file.name,
          reviewStatus: "gpr_imported",
          importFlags: ["GPR Imported"],
        };
      });

      setDoc((d) => ({
        ...d,
        name: d.name === DEFAULT_DOC.name ? `${file.name.replace(/\.[^.]+$/, "")} Map Project` : d.name,
        projectStatus: "draft",
        imgWidth: coordinateSystem.width,
        imgHeight: coordinateSystem.height,
        coordinateSystem,
        spots,
        importSource: { ...d.importSource, gprCsv: file.name },
        updatedAt: Date.now(),
      }));
      setSelection(null);
      setMergeReview(null);
      setShowSpots(true);
      setWorkflowTab("import");
      addImportLog(`Imported ${spots.length} unnamed GPR spots from ${file.name}`);
    } catch {
      setSaveError("Couldn't read the GPR CSV.");
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const buildMergeReview = (records: BurialCsvRecord[], sourceCsv: string, baseSpots = doc.spots): MergeReview => {
    const usedSpots = new Set<string>();
    const seenNameDate = new Map<string, BurialCsvRecord>();
    const review: MergeReview = {
      sourceCsv,
      createdAt: Date.now(),
      exact: [],
      nearby: [],
      newRecords: [],
      duplicates: [],
      conflicts: [],
      unmatchedGpr: [],
    };

    records.forEach((record) => {
      const duplicateKey = `${normalName(record.name)}|${record.dob ?? ""}|${record.dod ?? ""}`;
      const existingRecord = seenNameDate.get(duplicateKey);
      if (existingRecord && record.name) {
        review.duplicates.push({
          id: `duplicate-${record.rowNumber}`,
          bucket: "duplicate",
          burial: record,
          reason: `Possible duplicate of row ${existingRecord.rowNumber}`,
          apply: false,
        });
        return;
      }
      if (record.name) seenNameDate.set(duplicateKey, record);

      const hasCoordinates = record.x !== undefined && record.y !== undefined;
      const candidates = hasCoordinates
        ? baseSpots
            .filter((spot) => !usedSpots.has(spot.id) && spot.gprX !== undefined && spot.gprY !== undefined)
            .map((spot) => ({
              spot,
              rawDistance: distance({ x: record.x!, y: record.y! }, { x: spot.gprX!, y: spot.gprY! }),
              canvasDistance: distance({ x: record.x!, y: record.y! }, { x: spot.x, y: spot.y }),
            }))
            .sort((a, b) => Math.min(a.rawDistance, a.canvasDistance) - Math.min(b.rawDistance, b.canvasDistance))
        : [];
      const best = candidates[0];

      if (best && Math.min(best.rawDistance, best.canvasDistance) <= 0.01) {
        const hasConflict = Boolean(best.spot.name && record.name && normalName(best.spot.name) !== normalName(record.name));
        const target = hasConflict ? review.conflicts : review.exact;
        target.push({
          id: `${hasConflict ? "conflict" : "exact"}-${record.rowNumber}`,
          bucket: hasConflict ? "conflict" : "exact",
          burial: record,
          spotId: best.spot.id,
          distance: best.rawDistance,
          reason: hasConflict ? "Existing saved name differs from Burial.csv" : "Exact coordinate match",
          apply: !hasConflict,
        });
        if (!hasConflict) usedSpots.add(best.spot.id);
        return;
      }

      if (best && Math.min(best.rawDistance, best.canvasDistance) <= 25) {
        review.nearby.push({
          id: `nearby-${record.rowNumber}`,
          bucket: "nearby",
          burial: record,
          spotId: best.spot.id,
          distance: Math.min(best.rawDistance, best.canvasDistance),
          reason: "Nearby coordinate match. Confirm before merge.",
          apply: true,
        });
        usedSpots.add(best.spot.id);
        return;
      }

      review.newRecords.push({
        id: `new-${record.rowNumber}`,
        bucket: "new",
        burial: record,
        reason: hasCoordinates ? "No matching GPR spot" : "No coordinates supplied",
        apply: false,
      });
    });

    review.unmatchedGpr = baseSpots.filter(
      (spot) => (spot.importFlags ?? []).includes("GPR Imported") && !usedSpots.has(spot.id),
    );
    return review;
  };

  const onUploadBurialCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const records = rows
        .map((row, index) => burialRecordFromRow(row, index, file.name))
        .filter((record) => record.name || record.x !== undefined || record.y !== undefined || record.imagePath);

      if (records.length === 0) {
        setSaveError("Burial.csv needs at least names, image filenames, or coordinates.");
        setTimeout(() => setSaveError(null), 6000);
        return;
      }
      const coordinateRecords = records.filter((record) => record.x !== undefined && record.y !== undefined);
      if (doc.spots.length === 0 && coordinateRecords.length > 0) {
        const coordinateSystem = createCoordinateSystem(coordinateRecords.map((record) => ({ x: record.x!, y: record.y! })));
        const spots: BurialSpot[] = coordinateRecords.map((record, index) => {
          const projected = projectPoint(coordinateSystem, record.x!, record.y!);
          let spot: BurialSpot = {
            id: `CSV-${String(index + 1).padStart(3, "0")}`,
            temporaryId: `CSV-${String(index + 1).padStart(3, "0")}`,
            x: projected.x,
            y: projected.y,
            name: record.name,
            dob: record.dob,
            dod: record.dod,
            lat: record.lat,
            lon: record.lon,
            gprX: record.x,
            gprY: record.y,
            gprZ: record.z,
            sourceCsv: record.sourceCsv,
            imagePath: record.imagePath,
            imageFileName: record.imagePath ? fileBaseName(record.imagePath) : undefined,
            veteranStatus: record.veteranStatus,
            spotTypeId: spotTypeFromBurialRecord(record, activeSpotTypeId || "civilian"),
            reviewStatus: record.name ? "burial_matched" : "needs_review",
            importFlags: record.name ? ["Burial Data Matched"] : ["Needs Review"],
          };
          if (record.imagePath) spot = withFlag(spot, "Image Attached");
          return spot;
        });
        setDoc((d) => ({
          ...d,
          name: d.name === DEFAULT_DOC.name ? `${file.name.replace(/\.[^.]+$/, "")} Map Project` : d.name,
          projectStatus: "draft",
          imgWidth: coordinateSystem.width,
          imgHeight: coordinateSystem.height,
          coordinateSystem,
          spots,
          importSource: { ...d.importSource, burialCsv: file.name },
          updatedAt: Date.now(),
        }));
        setSelection(null);
        setMergeReview(null);
        setShowSpots(true);
        setView("preview");
        setZoom(1);
        setWorkflowTab("headstones");
        addImportLog(`Generated ${spots.length} burial spots directly from ${file.name}`);
        return;
      }
      const review = buildMergeReview(records, file.name);
      setMergeReview(review);
      setDoc((d) => ({ ...d, importSource: { ...d.importSource, burialCsv: file.name }, updatedAt: Date.now() }));
        setWorkflowTab("import");
      addImportLog(`Prepared merge review for ${records.length} Burial.csv rows`);
    } catch {
      setSaveError("Couldn't read Burial.csv.");
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const onImportDatasetFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      const parsed = await Promise.all(
        files
          .filter((file) => file.name.toLowerCase().endsWith(".csv"))
          .map(async (file) => ({ file, rows: parseCsv(await file.text()) })),
      );
      const coordinateInputs: Array<{ x: number; y: number }> = [];
      for (const { file, rows } of parsed) {
        const lower = file.name.toLowerCase();
        if (lower.includes("coping")) {
          rows.forEach((row) => parseWktPolygon(pick(row, ["wkt", "geometry"])).forEach((point) => coordinateInputs.push(point)));
        } else {
          rows.forEach((row) => {
            const x = pickNumber(row, ["x", "gpr x", "gpr_x", "map x", "longitude"]);
            const y = pickNumber(row, ["y", "gpr y", "gpr_y", "map y", "latitude"]);
            if (x !== undefined && y !== undefined) coordinateInputs.push({ x, y });
          });
        }
      }

      if (coordinateInputs.length === 0) {
        setSaveError("Dataset CSV files need valid X/Y coordinates or WKT polygons.");
        setTimeout(() => setSaveError(null), 7000);
        return;
      }

      const coordinateSystem = createCoordinateSystem(coordinateInputs);
      const importedSpots: BurialSpot[] = [];
      const importedPlots: Plot[] = [];
      const burialRecords: BurialCsvRecord[] = [];
      const sourceNames: string[] = [];
      let gprCount = 0;
      let cremationCount = 0;
      let miscCount = 0;
      let copingCount = 0;
      let createdDirectBurials = false;
      let autoMatchedBurials = 0;

      for (const { file, rows } of parsed) {
        const lower = file.name.toLowerCase();
        sourceNames.push(file.name);

        if (lower.includes("gpr")) {
          rows.forEach((row) => {
            const x = pickNumber(row, ["x", "gpr x", "gpr_x", "easting", "map x"]);
            const y = pickNumber(row, ["y", "gpr y", "gpr_y", "northing", "map y"]);
            if (x === undefined || y === undefined) return;
            gprCount++;
            const projected = projectPoint(coordinateSystem, x, y);
            importedSpots.push({
              id: `GPR-${String(gprCount).padStart(3, "0")}`,
              temporaryId: `GPR-${String(gprCount).padStart(3, "0")}`,
              x: projected.x,
              y: projected.y,
              name: "",
              spotTypeId: pick(row, ["choice", "type"]).toLowerCase().includes("child") ? "child" : "civilian",
              gprX: x,
              gprY: y,
              gprZ: pickNumber(row, ["z", "depth"]),
              accuracy: pickNumber(row, ["estimatedaccuracy", "estimated accuracy", "accuracy"]),
              sourceCsv: file.name,
              notes: pick(row, ["comments", "comment"]),
              reviewStatus: "gpr_imported",
              importFlags: ["GPR Imported"],
            });
          });
          continue;
        }

        if (lower.includes("burial")) {
          rows
            .map((row, index) => burialRecordFromRow(row, index, file.name))
            .filter((record) => record.name || record.x !== undefined || record.y !== undefined || record.imagePath)
            .forEach((record) => burialRecords.push(record));
          continue;
        }

        if (lower.includes("cremation")) {
          rows.forEach((row) => {
            const x = pickNumber(row, ["x"]);
            const y = pickNumber(row, ["y"]);
            if (x === undefined || y === undefined) return;
            cremationCount++;
            const projected = projectPoint(coordinateSystem, x, y);
            const name = fullNameFromRow(row);
            importedSpots.push({
              id: `CREM-${String(cremationCount).padStart(3, "0")}`,
              temporaryId: `CREM-${String(cremationCount).padStart(3, "0")}`,
              x: projected.x,
              y: projected.y,
              name,
              dob: normalizeDateLike(pick(row, ["dob"])),
              dod: normalizeDateLike(pick(row, ["dod"])),
              spotTypeId: "civilian",
              gprX: x,
              gprY: y,
              gprZ: pickNumber(row, ["z"]),
              accuracy: pickNumber(row, ["estimatedaccuracy", "estimated accuracy", "accuracy"]),
              sourceCsv: file.name,
              imagePath: pick(row, ["image"]),
              imageFileName: fileBaseName(pick(row, ["image"])),
              notes: pick(row, ["comment"]),
              reviewStatus: name ? "burial_matched" : "needs_review",
              importFlags: name ? ["Burial Data Matched"] : ["Needs Review"],
            });
          });
          continue;
        }

        if (lower.includes("misc")) {
          rows.forEach((row) => {
            const x = pickNumber(row, ["x"]);
            const y = pickNumber(row, ["y"]);
            if (x === undefined || y === undefined) return;
            miscCount++;
            const projected = projectPoint(coordinateSystem, x, y);
            const label = pick(row, ["comment", "name", "type"]) || `Misc ${miscCount}`;
            importedSpots.push({
              id: `MISC-${String(miscCount).padStart(3, "0")}`,
              temporaryId: `MISC-${String(miscCount).padStart(3, "0")}`,
              x: projected.x,
              y: projected.y,
              name: label,
              spotTypeId: "civilian",
              gprX: x,
              gprY: y,
              gprZ: pickNumber(row, ["z"]),
              accuracy: pickNumber(row, ["estimatedaccuracy", "estimated accuracy", "accuracy"]),
              sourceCsv: file.name,
              notes: label,
              symbolType: label.toLowerCase(),
              reviewStatus: "verified",
              importFlags: ["Verified"],
            });
          });
          continue;
        }

        if (lower.includes("coping")) {
          rows.forEach((row) => {
            const raw = parseWktPolygon(pick(row, ["wkt", "geometry"]));
            if (raw.length < 3) return;
            copingCount++;
            const points = raw.map((point) => {
              const projected = projectPoint(coordinateSystem, point.x, point.y);
              return [projected.x, projected.y] as [number, number];
            });
            const bounds = plotBounds(points);
            importedPlots.push({
              id: `COPING-${String(copingCount).padStart(3, "0")}`,
              typeId: "CON",
              label: pick(row, ["comment"]) || `Coping Area ${copingCount}`,
              status: "available",
              ...bounds,
              points,
              outline: true,
              accuracy: pickNumber(row, ["estimatedaccuracy", "estimated accuracy", "accuracy"]),
              sourceCsv: file.name,
              sourceLayer: "Coping Area",
            });
          });
        }
      }

      if (importedSpots.length === 0 && burialRecords.length > 0) {
        burialRecords.forEach((record) => {
          if (record.x === undefined || record.y === undefined) return;
          const projected = projectPoint(coordinateSystem, record.x, record.y);
          importedSpots.push({
            id: `CSV-${String(importedSpots.length + 1).padStart(3, "0")}`,
            temporaryId: `CSV-${String(importedSpots.length + 1).padStart(3, "0")}`,
            x: projected.x,
            y: projected.y,
            name: record.name,
            dob: record.dob,
            dod: record.dod,
            spotTypeId: spotTypeFromBurialRecord(record, activeSpotTypeId || "civilian"),
            lat: record.lat,
            lon: record.lon,
            gprX: record.x,
            gprY: record.y,
            gprZ: record.z,
            sourceCsv: record.sourceCsv,
            imagePath: record.imagePath,
            imageFileName: record.imagePath ? fileBaseName(record.imagePath) : undefined,
            veteranStatus: record.veteranStatus,
            reviewStatus: record.name ? "burial_matched" : "needs_review",
            importFlags: record.name ? ["Burial Data Matched"] : ["Needs Review"],
          });
        });
        createdDirectBurials = importedSpots.length > 0;
      }

      if (!createdDirectBurials && importedSpots.length > 0 && burialRecords.length > 0) {
        const usedSpots = new Set<string>();
        burialRecords.forEach((record) => {
          if (record.x === undefined || record.y === undefined) return;
          const candidates = importedSpots
            .map((spot, index) => ({
              spot,
              index,
              rawDistance: spot.gprX !== undefined && spot.gprY !== undefined
                ? distance({ x: record.x!, y: record.y! }, { x: spot.gprX, y: spot.gprY })
                : Number.POSITIVE_INFINITY,
              canvasDistance: distance(projectPoint(coordinateSystem, record.x!, record.y!), { x: spot.x, y: spot.y }),
            }))
            .filter((candidate) => !usedSpots.has(candidate.spot.id))
            .sort((a, b) => Math.min(a.rawDistance, a.canvasDistance) - Math.min(b.rawDistance, b.canvasDistance));
          const best = candidates[0];
          if (best && Math.min(best.rawDistance, best.canvasDistance) <= 25) {
            importedSpots[best.index] = patchSpotFromBurialRecord(best.spot, record);
            usedSpots.add(best.spot.id);
            autoMatchedBurials++;
            return;
          }
          const projected = projectPoint(coordinateSystem, record.x!, record.y!);
          importedSpots.push(patchSpotFromBurialRecord({
            id: `CSV-${String(importedSpots.length + 1).padStart(3, "0")}`,
            temporaryId: `CSV-${String(importedSpots.length + 1).padStart(3, "0")}`,
            x: projected.x,
            y: projected.y,
            name: "",
            spotTypeId: spotTypeFromBurialRecord(record, activeSpotTypeId || "civilian"),
            reviewStatus: "needs_review",
            importFlags: ["Needs Review"],
          }, record));
        });
      }

      const review = null;

      setDoc((d) => ({
        ...d,
        name: d.name === DEFAULT_DOC.name ? "Imported Cemetery Map Project" : d.name,
        projectStatus: "draft",
        imgWidth: coordinateSystem.width,
        imgHeight: coordinateSystem.height,
        coordinateSystem,
        plots: importedPlots,
        spots: importedSpots,
        importSource: {
          ...d.importSource,
          gprCsv: sourceNames.find((name) => name.toLowerCase().includes("gpr")),
          burialCsv: sourceNames.find((name) => name.toLowerCase().includes("burial")),
        },
        updatedAt: Date.now(),
      }));
      setSelection(null);
      setShowSpots(true);
      setView("preview");
      setZoom(1);
      setMergeReview(review);
      setWorkflowTab("headstones");
      addImportLog(`Generated map: ${gprCount} GPR, ${burialRecords.length} burial rows${autoMatchedBurials ? ` (${autoMatchedBurials} matched)` : ""}, ${cremationCount} cremations, ${copingCount} areas, ${miscCount} misc`);
    } catch {
      setSaveError("Couldn't import the cemetery dataset.");
      setTimeout(() => setSaveError(null), 7000);
    }
  };

  const updateMergeCandidate = (bucket: keyof Pick<MergeReview, "exact" | "nearby" | "newRecords" | "duplicates" | "conflicts">, id: string, apply: boolean) => {
    setMergeReview((review) => review
      ? { ...review, [bucket]: review[bucket].map((candidate) => candidate.id === id ? { ...candidate, apply } : candidate) }
      : review);
  };

  const applyMergeReview = () => {
    if (!mergeReview) return;
    const candidates = [
      ...mergeReview.exact,
      ...mergeReview.nearby,
      ...mergeReview.newRecords,
      ...mergeReview.conflicts,
      ...mergeReview.duplicates,
    ].filter((candidate) => candidate.apply);

    setDoc((d) => {
      const spots = [...d.spots];
      candidates.forEach((candidate) => {
        const record = candidate.burial;
        const patch = (spot: BurialSpot): BurialSpot => {
          return patchSpotFromBurialRecord(spot, record);
        };
        if (candidate.spotId) {
          const index = spots.findIndex((spot) => spot.id === candidate.spotId);
          if (index >= 0) spots[index] = patch(spots[index]);
        } else if (record.x !== undefined && record.y !== undefined) {
          const projected = d.coordinateSystem
            ? projectPoint(d.coordinateSystem, record.x, record.y)
            : { x: record.x, y: record.y };
          spots.push(patch({
            id: newId("s"),
            temporaryId: `CSV-${String(spots.length + 1).padStart(3, "0")}`,
            x: projected.x,
            y: projected.y,
            name: "",
            spotTypeId: spotTypeFromBurialRecord(record, activeSpotTypeId || "civilian"),
            reviewStatus: "needs_review",
            importFlags: ["Needs Review"],
          }));
        }
      });
      return { ...d, spots, updatedAt: Date.now() };
    });
    setMergeReview(null);
    setWorkflowTab("headstones");
    setView("preview");
    addImportLog(`Applied ${candidates.length} reviewed Burial.csv updates`);
  };

  const markSelectedSpot = (flag: NonNullable<BurialSpot["importFlags"]>[number], reviewStatus: BurialSpot["reviewStatus"]) => {
    if (!selectedSpot) return;
    setDoc((d) => ({
      ...d,
      spots: d.spots.map((spot) => spot.id === selectedSpot.id ? { ...withFlag(spot, flag), reviewStatus } : spot),
      updatedAt: Date.now(),
    }));
  };

  const syncHeadstoneLibrary = async () => {
    try {
      if (!doc.cemeteryId) throw new Error("Select a cemetery before syncing headstones.");
      const libraryRes = await fetch(`/api/headstone-import/library?cemeteryId=${doc.cemeteryId}`, { credentials: "include" });
      if (!libraryRes.ok) throw new Error("Headstone library is not available.");
      const library = await libraryRes.json() as { manifestPath?: string; folder?: string };
      if (!library.manifestPath) throw new Error("No headstone manifest has been saved yet.");
      const manifestRes = await fetch(library.manifestPath, { credentials: "include" });
      if (!manifestRes.ok) throw new Error("Headstone manifest has not been created yet.");
      const manifest = await manifestRes.json() as HeadstoneManifest;
      const byFile = new Map<string, NonNullable<HeadstoneManifest["images"]>[number]>();
      for (const image of manifest.images ?? []) {
        const key = fileBaseName(image.imageFileName || image.storedPath || "").toLowerCase();
        if (key) byFile.set(key, image);
      }

      let matched = 0;
      let missing = 0;
      setDoc((d) => ({
        ...d,
        spots: d.spots.map((spot) => {
          const file = fileBaseName(spot.imageFileName || spot.imagePath || "").toLowerCase();
          if (!file) return spot;
          const image = byFile.get(file);
          if (!image) {
            missing++;
            return { ...withFlag(spot, "Needs Review"), reviewStatus: "needs_review" };
          }
          matched++;
          let next: BurialSpot = {
            ...spot,
            imagePath: image.storedPath ?? spot.imagePath,
            imageFileName: image.imageFileName ?? spot.imageFileName,
            aiConfidence: image.confidence ?? spot.aiConfidence,
            aiData: {
              name: image.people?.[0]?.name,
              dob: image.people?.[0]?.dateOfBirth ?? undefined,
              dod: image.people?.[0]?.dateOfDeath ?? undefined,
              inscription: image.inscriptionText,
            },
            reviewStatus: image.status === "verified" ? "ai_processed" : "needs_review",
          };
          next = withFlag(next, "Image Attached");
          if (image.people?.length || image.inscriptionText) next = withFlag(next, "AI Processed");
          if (next.reviewStatus === "needs_review") next = withFlag(next, "Needs Review");
          return next;
        }),
        importSource: { ...d.importSource, headstoneFolder: manifest.folder ?? library.folder },
        updatedAt: Date.now(),
      }));
      addImportLog(`Matched ${matched} headstone images${missing ? ` · ${missing} missing` : ""}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not sync headstone library.");
      setTimeout(() => setSaveError(null), 6000);
    }
  };

  const publishMap = async () => {
    if (!doc.cemeteryId) {
      setSaveError("Select a cemetery before publishing this map.");
      setTimeout(() => setSaveError(null), 7000);
      return;
    }
    const publishedDoc: MapDoc = {
      ...doc,
      projectStatus: "published",
      spots: doc.spots.map((spot) => ({
        ...withFlag(spot, "Published"),
        reviewStatus: spot.reviewStatus === "needs_review" ? "needs_review" : "published",
      })),
      updatedAt: Date.now(),
    };
    const previewWindow = window.open("about:blank", "_blank");
    try {
      const res = await fetch(`/api/cemetery-maps/publish?cemeteryId=${doc.cemeteryId}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(persistedPayload(publishedDoc)),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setDoc(publishedDoc);
      setView("preview");
      void refreshPublishedMaps(doc.cemeteryId);
      addImportLog("Map published. Permanent preview URL is ready.");
      const url = typeof body?.permanentUrl === "string" ? body.permanentUrl : mapPreviewUrl;
      if (url && previewWindow) {
        previewWindow.location.href = withBasePath(url);
      } else if (url) {
        window.open(withBasePath(url), "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      previewWindow?.close();
      setSaveError(err instanceof Error ? err.message : "Could not publish map.");
      setTimeout(() => setSaveError(null), 7000);
    }
  };

  // ----- Stats -----
  const counts = useMemo(() => {
    const byPlotType: Record<string, number> = {};
    let available = 0, reserved = 0, occupied = 0;
    for (const p of doc.plots) {
      byPlotType[p.typeId] = (byPlotType[p.typeId] ?? 0) + 1;
      if (p.status === "available") available++;
      else if (p.status === "reserved") reserved++;
      else if (p.status === "occupied") occupied++;
    }
    return { totalPlots: doc.plots.length, totalSpots: doc.spots.length, byPlotType, available, reserved, occupied };
  }, [doc.plots, doc.spots]);

  const workflowStats = useMemo(() => {
    const countFlag = (flag: NonNullable<BurialSpot["importFlags"]>[number]) =>
      doc.spots.filter((spot) => (spot.importFlags ?? []).includes(flag)).length;
    return {
      gpr: countFlag("GPR Imported"),
      burial: countFlag("Burial Data Matched"),
      images: countFlag("Image Attached"),
      ai: countFlag("AI Processed"),
      needsReview: countFlag("Needs Review") + doc.spots.filter((spot) => spot.reviewStatus === "needs_review").length,
      verified: countFlag("Verified"),
      published: countFlag("Published"),
    };
  }, [doc.spots]);

  const cursorClass =
    isRectTool(tool)   ? "cursor-crosshair" :
    tool === "circle"  ? "cursor-crosshair" :
    isPolygonTool(tool) ? "cursor-crosshair" :
    tool === "path"    ? "cursor-crosshair" :
    tool === "spot"    ? "cursor-cell" :
    tool === "pan"     ? "cursor-grab active:cursor-grabbing" :
    "cursor-default";

  // Fit-to-screen: compute zoom that fits the canvas inside the viewport.
  const fitToScreen = useCallback(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap || !doc.imgWidth || !doc.imgHeight) { setZoom(1); return; }
    const padding = 64;
    const availW = Math.max(100, wrap.clientWidth - padding);
    const availH = Math.max(100, wrap.clientHeight - padding);
    const z = Math.min(availW / doc.imgWidth, availH / doc.imgHeight);
    setZoom(Math.max(0.1, Math.min(3, z)));
  }, [doc.imgWidth, doc.imgHeight]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-40 flex flex-col bg-background"
      data-testid="map-maker-root"
    >
      {/* ============ Top toolbar ============ */}
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 gap-y-2 border-b border-border bg-card px-2 py-2 sm:px-3">
        {/* Back to dashboard */}
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="h-9 px-2" data-testid="btn-back-app" title="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden md:inline ml-1.5 text-xs">Back</span>
          </Button>
        </Link>

        <Separator orientation="vertical" className="h-7" />

        {/* Toggle left panel */}
        <Button
          variant="ghost" size="sm"
          className="h-9 w-9 p-0"
          onClick={() => setLeftCollapsed((v) => !v)}
          data-testid="btn-toggle-left"
          title={leftCollapsed ? "Show tools panel" : "Hide tools panel"}
        >
          {leftCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <Input
              value={doc.name === DEFAULT_DOC.name ? "" : doc.name}
              onChange={(e) => setDoc((d) => ({ ...d, name: e.target.value }))}
              placeholder="Project name"
              className="h-7 w-32 sm:w-44 lg:w-56 text-sm font-semibold border-transparent bg-transparent focus:bg-background focus:border-input px-2"
              data-testid="input-map-name"
            />
            <div className="text-[10px] text-muted-foreground px-2 hidden sm:block">
              {counts.totalPlots} plots · {counts.totalSpots} spots · saved {timeAgo(doc.updatedAt)}
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-7 hidden md:block" />

        <div className="hidden min-w-[220px] max-w-[300px] flex-col gap-1 lg:flex">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cemetery
            </span>
            <Link href="/organizations" className="text-[10px] font-medium text-primary hover:underline">
              Create
            </Link>
          </div>
          <Select
            value={doc.cemeteryId ? String(doc.cemeteryId) : "none"}
            onValueChange={(value) =>
              setDoc((d) => ({
                ...d,
                cemeteryId: value === "none" ? null : Number(value),
                updatedAt: Date.now(),
              }))
            }
          >
            <SelectTrigger className="h-7 text-xs" data-testid="top-select-map-cemetery">
              <SelectValue placeholder="Select cemetery" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select cemetery</SelectItem>
              {cemeteries.map((cemetery) => (
                <SelectItem key={cemetery.id} value={String(cemetery.id)}>
                  {cemetery.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Link href="/organizations" className="lg:hidden">
          <Button variant={doc.cemeteryId ? "ghost" : "outline"} size="sm" className="h-8 px-2" title="Select or create cemetery">
            <Database className="h-3.5 w-3.5" />
            <span className="ml-1.5 hidden sm:inline text-xs">
              {doc.cemeteryId ? "Cemetery" : "Select cemetery"}
            </span>
          </Button>
        </Link>

        <Separator orientation="vertical" className="h-7 hidden md:block" />

        {/* View 2D/3D */}
        <div className="hidden md:flex items-center gap-1">
          <Button size="sm" variant={view === "2d" ? "default" : "outline"} onClick={() => setView("2d")} data-testid="view-2d" className="h-8">
            <Square className="h-3.5 w-3.5 mr-1.5" /> 2D
          </Button>
          <Button size="sm" variant={view === "3d" ? "default" : "outline"} onClick={() => setView("3d")} data-testid="view-3d" className="h-8">
            <Box className="h-3.5 w-3.5 mr-1.5" /> 3D
          </Button>
          <Button size="sm" variant="outline" onClick={openPreviewUrl} data-testid="view-preview" className="h-8">
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
          </Button>
        </div>

        {view === "3d" && (
          <div className="hidden lg:flex items-center gap-2 px-2 py-1 rounded-md bg-muted">
            <Label className="text-xs text-muted-foreground">Tilt</Label>
            <Slider value={[tilt]} onValueChange={([v]) => setTilt(v)} min={20} max={75} step={1} className="w-24" />
            <span className="text-xs tabular-nums text-muted-foreground w-8">{tilt}°</span>
          </div>
        )}

        <Separator orientation="vertical" className="h-7 hidden md:block" />

        {/* Zoom controls */}
        <div className="hidden md:flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))} data-testid="zoom-out" title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="text-xs tabular-nums text-muted-foreground w-12 text-center hover:text-foreground"
            title="Reset to 100%"
            data-testid="zoom-reset"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} data-testid="zoom-in" title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={fitToScreen} data-testid="zoom-fit" title="Fit to screen">
            <Maximize className="h-3.5 w-3.5 mr-1" />
            <span className="hidden lg:inline text-xs">Fit</span>
          </Button>
        </div>

        <div className="flex-1" />

        {/* Visibility toggles (compact) */}
        <div className="hidden lg:flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowImage((v) => !v)} data-testid="toggle-image" title="Toggle background image">
            {showImage ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
            <span className="text-xs">Image</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowLabels((v) => !v)} title="Toggle labels">
            {showLabels ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
            <span className="text-xs">Labels</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowSpots((v) => !v)} data-testid="toggle-spots" title="Toggle burial spots">
            {showSpots ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
            <span className="text-xs">Spots</span>
          </Button>
        </div>

        <Separator orientation="vertical" className="h-7" />

        <Button size="sm" variant="outline" onClick={exportJson} data-testid="export-json" className="h-8 hidden md:inline-flex">
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export
        </Button>
        <Button size="sm" variant="outline" onClick={exportPdf} data-testid="export-pdf" className="h-8 hidden md:inline-flex">
          <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
        </Button>
        <Button size="sm" onClick={save} data-testid="save-map" className="h-8">
          <Save className="h-3.5 w-3.5 mr-1.5" /> Save
        </Button>

        <Separator orientation="vertical" className="h-7" />

        {/* Browser fullscreen toggle */}
        <Button
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0"
          onClick={enterFullscreen}
          data-testid="btn-fullscreen"
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>

        {/* Toggle right panel */}
        <Button
          variant="ghost" size="sm"
          className="h-9 w-9 p-0"
          onClick={() => setRightCollapsed((v) => !v)}
          data-testid="btn-toggle-right"
          title={rightCollapsed ? "Show inspector" : "Hide inspector"}
        >
          {rightCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* ============ Left: Tools, plot palette, spot palette, backgrounds ============ */}
        {leftCollapsed ? (
          <aside className="w-12 shrink-0 border-r border-border bg-card flex flex-col items-center py-2 gap-1">
            <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Select" testId="tool-select-mini" iconOnly />
            <ToolButton active={tool === "draw"}   onClick={() => setTool("draw")}   icon={Square}        label="Plot"   testId="tool-draw-mini" iconOnly />
            <ToolButton active={tool === "rect-outline"} onClick={() => setTool("rect-outline")} icon={SquareDashed} label="Rect outline" testId="tool-rect-outline-mini" iconOnly />
            <ToolButton active={tool === "circle"} onClick={() => setTool("circle")} icon={CircleIcon}    label="Circle"  testId="tool-circle-mini" iconOnly />
            <ToolButton active={tool === "polygon"}onClick={() => setTool("polygon")}icon={Hexagon}       label="Polygon" testId="tool-polygon-mini" iconOnly />
            <ToolButton active={tool === "polygon-outline"} onClick={() => setTool("polygon-outline")} icon={Hexagon} label="Polygon outline" testId="tool-polygon-outline-mini" iconOnly />
            <ToolButton active={tool === "path"}   onClick={() => setTool("path")}   icon={Spline}        label="Path"   testId="tool-path-mini" iconOnly />
            <ToolButton active={tool === "spot"}   onClick={() => setTool("spot")}   icon={MapPinIcon}    label="Spot"   testId="tool-spot-mini" iconOnly />
            <ToolButton active={tool === "pan"}    onClick={() => setTool("pan")}    icon={Hand}          label="Pan"    testId="tool-pan-mini"  iconOnly />
            <Separator className="my-1 w-8" />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => datasetInputRef.current?.click()} title="Import cemetery dataset">
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Link href="/cemetery-setup">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" title="Cemetery setup (types &amp; backgrounds)">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onUploadImage} className="hidden" data-testid="image-input" />
            <input ref={gprInputRef} type="file" accept=".csv,text/csv" onChange={onUploadGprCsv} className="hidden" data-testid="gpr-input-mini" />
            <input ref={burialInputRef} type="file" accept=".csv,text/csv" onChange={onUploadBurialCsv} className="hidden" data-testid="burial-input-mini" />
            <input ref={datasetInputRef} type="file" accept=".csv,text/csv" multiple onChange={onImportDatasetFiles} className="hidden" data-testid="dataset-input-mini" />
          </aside>
        ) : (
        <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 border-b border-border bg-muted/20">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Workflow</div>
                  <div className="mt-0.5 text-xs font-medium">
                    {doc.projectStatus === "published" ? "Published map" : "Draft map project"}
                  </div>
                </div>
                <Badge variant={doc.projectStatus === "published" ? "default" : "outline"}>{doc.projectStatus}</Badge>
              </div>

              <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-primary">Cemetery</span>
                  <Link href="/organizations" className="text-[10px] font-medium text-primary hover:underline">
                    Create new
                  </Link>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Select the global cemetery before importing or publishing map data.
                </p>
              </div>

              <Select
                value={doc.cemeteryId ? String(doc.cemeteryId) : "none"}
                onValueChange={(value) =>
                  setDoc((d) => ({
                    ...d,
                    cemeteryId: value === "none" ? null : Number(value),
                    updatedAt: Date.now(),
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs" data-testid="select-map-cemetery">
                  <SelectValue placeholder="Select cemetery" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select cemetery</SelectItem>
                  {cemeteries.map((cemetery) => (
                    <SelectItem key={cemetery.id} value={String(cemetery.id)}>
                      {cemetery.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-2 grid grid-cols-2 gap-1">
                {WORKFLOW_TABS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setWorkflowTab(item.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition-colors",
                        workflowTab === item.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <WorkflowPanel
                tab={workflowTab}
                doc={doc}
                cemeteries={cemeteries}
                workflowStats={workflowStats}
                mergeReview={mergeReview}
                importLog={importLog}
                selectedSpot={selectedSpot}
                onCreateDraft={createDraftProject}
                onImportDataset={() => datasetInputRef.current?.click()}
                onUploadGpr={() => gprInputRef.current?.click()}
                onUploadBurial={() => burialInputRef.current?.click()}
                onRenameProject={(name) => setDoc((d) => ({ ...d, name, updatedAt: Date.now() }))}
                onMergeToggle={updateMergeCandidate}
                onApplyMerge={applyMergeReview}
                onSyncHeadstones={syncHeadstoneLibrary}
                onMarkAiProcessed={() => markSelectedSpot("AI Processed", "ai_processed")}
                onMarkVerified={() => markSelectedSpot("Verified", "verified")}
                onPublish={publishMap}
              />

              <input ref={gprInputRef} type="file" accept=".csv,text/csv" onChange={onUploadGprCsv} className="hidden" data-testid="gpr-input" />
              <input ref={burialInputRef} type="file" accept=".csv,text/csv" onChange={onUploadBurialCsv} className="hidden" data-testid="burial-input" />
              <input ref={datasetInputRef} type="file" accept=".csv,text/csv" multiple onChange={onImportDatasetFiles} className="hidden" data-testid="dataset-input" />
            </div>

            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Tool</div>
              <div className="grid grid-cols-2 gap-1">
                <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Select" testId="tool-select" />
                <ToolButton active={tool === "draw"}   onClick={() => setTool("draw")}   icon={Square}        label="Plot"   testId="tool-draw" />
                <ToolButton active={tool === "rect-outline"} onClick={() => setTool("rect-outline")} icon={SquareDashed} label="Rect outline" testId="tool-rect-outline" />
                <ToolButton active={tool === "circle"} onClick={() => setTool("circle")} icon={CircleIcon}    label="Circle"  testId="tool-circle" />
                <ToolButton active={tool === "polygon"}onClick={() => setTool("polygon")}icon={Hexagon}       label="Polygon" testId="tool-polygon" />
                <ToolButton active={tool === "polygon-outline"} onClick={() => setTool("polygon-outline")} icon={Hexagon} label="Polygon outline" testId="tool-polygon-outline" />
                <ToolButton active={tool === "path"}   onClick={() => setTool("path")}   icon={Spline}        label="Path"   testId="tool-path" />
                <ToolButton active={tool === "spot"}   onClick={() => setTool("spot")}   icon={MapPinIcon}    label="Spot"   testId="tool-spot" />
                <ToolButton active={tool === "pan"}    onClick={() => setTool("pan")}    icon={Hand}          label="Pan"    testId="tool-pan" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {tool === "draw"   && "Drag on the canvas to place a plot."}
                {tool === "rect-outline" && "Drag to draw an outline-only rectangle (e.g. a family-grave boundary that contains plots inside)."}
                {tool === "polygon-outline" && "Click to place vertices for an outline-only polygon (e.g. a family-grave boundary or section). Double-click to finish."}
                {tool === "circle" && "Drag from the center outward to define the radius."}
                {tool === "polygon"&& "Click to place vertices for a closed shape (need at least 3). Double-click (or press Enter) to finish, Backspace to undo last point, Esc to cancel."}
                {tool === "path"   && "Click to place points along a path or road. Double-click (or press Enter) to finish, Backspace to undo last point, Esc to cancel."}
                {tool === "spot"   && "Click on the canvas to drop a burial spot."}
                {tool === "select" && "Click an item to edit. Drag to move."}
                {tool === "pan"    && "Drag the canvas to pan around the map."}
              </p>
            </div>

            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center justify-between">
                <span>Plot Type</span>
                <Link href="/cemetery-setup" className="text-[9px] text-primary hover:underline normal-case tracking-normal">Manage →</Link>
              </div>
              {plotTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No plot types configured. <Link className="text-primary underline" href="/cemetery-setup">Add some →</Link></p>
              ) : (
                <div className="space-y-1">
                  {plotTypes.map((t) => {
                    const isActive = activePlotTypeId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setActivePlotTypeId(t.id); setTool(shapeToTool(t.defaultShape)); }}
                        data-testid={`palette-plot-${t.code}`}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                          isActive ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
                        )}
                      >
                        <div className="h-5 w-5 shrink-0 rounded border" style={{ background: t.fill, borderColor: t.stroke }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold leading-tight">{t.code}</div>
                          <div className="text-[10px] text-muted-foreground leading-tight truncate">{t.name}</div>
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{counts.byPlotType[t.id] ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center justify-between">
                <span>Spot Type</span>
                <Link href="/cemetery-setup" className="text-[9px] text-primary hover:underline normal-case tracking-normal">Manage →</Link>
              </div>
              {spotTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No spot types configured.</p>
              ) : (
                <div className="space-y-1">
                  {spotTypes.map((t) => {
                    const isActive = activeSpotTypeId === t.id;
                    const Icon = SPOT_ICONS[t.icon] ?? SPOT_ICONS.circle;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setActiveSpotTypeId(t.id); setTool("spot"); }}
                        data-testid={`palette-spot-${t.id}`}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                          isActive ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
                        )}
                      >
                        <div
                          className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center border border-white shadow-sm"
                          style={{ background: t.color }}
                        >
                          <Icon className="h-3 w-3 text-white" strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0 flex-1 text-xs font-medium leading-tight truncate">{t.name}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={onUploadImage} className="hidden" data-testid="image-input" />

            {backgrounds.length > 0 && (
              <div className="p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center justify-between">
                  <span>Recent Backgrounds</span>
                  <Badge variant="outline" className="h-4 text-[9px] tabular-nums">{backgrounds.length}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {backgrounds.map((bg) => {
                    const isActive = doc.image === bg.image;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => applyBackgroundFromLibrary(bg)}
                        title={bg.name}
                        data-testid={`bg-thumb-${bg.id}`}
                        className={cn(
                          "group relative rounded-md border overflow-hidden bg-muted aspect-[4/3]",
                          isActive ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50",
                        )}
                      >
                        <img src={bg.image} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[9px] px-1 py-0.5 truncate text-left">
                          {bg.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Click a thumbnail to use it as the current map background.</p>
              </div>
            )}
          </ScrollArea>
        </aside>
        )}

        {/* ============ Center: Canvas ============ */}
        <div
          ref={canvasWrapRef}
          className={cn(
            "flex-1 min-w-0 relative bg-[radial-gradient(circle_at_50%_50%,hsl(var(--muted))_0,hsl(var(--background))_70%)] overflow-hidden",
            isDragOver && "ring-4 ring-inset ring-primary/60",
          )}
          onDragOver={onCanvasDragOver}
          onDragLeave={onCanvasDragLeave}
          onDrop={onCanvasDrop}
        >
          {/* Empty state — hidden once the user starts using a creation tool so it can't intercept canvas clicks. */}
          {tool === "select" && !doc.image && doc.plots.length === 0 && doc.spots.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-6">
              <div className="text-center max-w-md pointer-events-auto bg-card/85 backdrop-blur border-2 border-dashed border-primary/40 rounded-xl px-8 py-10 shadow-xl">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                  <FileImage className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-1">Start your cemetery map</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Select a cemetery, enter a project name, then create a draft. Import all CSV files together to generate the interactive map.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={createDraftProject} data-testid="empty-create-project">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Create map project
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-4">
                  Tip: press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">F</kbd> for browser fullscreen.
                </p>
              </div>
            </div>
          )}

          {/* Drop-zone overlay during drag */}
          {isDragOver && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/15 backdrop-blur-sm pointer-events-none">
              <div className="bg-card border-2 border-dashed border-primary rounded-xl px-8 py-6 shadow-2xl">
                <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
                <div className="text-base font-semibold text-center">Drop image to set as background</div>
                <div className="text-xs text-muted-foreground text-center mt-1">PNG, JPG, or WebP</div>
              </div>
            </div>
          )}

          <ScrollArea className="h-full w-full">
            <div className="min-h-full min-w-full flex items-center justify-center p-8" style={{ perspective: "1500px" }}>
              {view === "preview" ? (
                <InteractiveMapPreview
                  doc={doc}
                  plotTypes={plotTypes}
                  spotTypes={spotTypes}
                  cemeteries={cemeteries}
                  onSelectSpot={(id) => {
                    setSelection({ kind: "spot", id });
                    setRightCollapsed(false);
                  }}
                />
              ) : (
              <div
                style={{
                  transform: view === "3d"
                    ? `rotateX(${tilt}deg) scale(${zoom * 0.85})`
                    : `scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  transformStyle: "preserve-3d",
                }}
              >
                <svg
                  ref={svgRef}
                  width={doc.imgWidth}
                  height={doc.imgHeight}
                  viewBox={`0 0 ${doc.imgWidth} ${doc.imgHeight}`}
                  className={cn("block bg-white shadow-2xl shadow-black/30 rounded-sm select-none", cursorClass)}
                  onPointerDown={onCanvasPointerDown}
                  onPointerMove={onCanvasPointerMove}
                  onPointerUp={onCanvasPointerUp}
                  onPointerCancel={onCanvasPointerCancel}
                  onDoubleClick={onCanvasDoubleClick}
                  data-testid="map-canvas"
                >
                  {!doc.image && (
                    <>
                      <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </>
                  )}

                  {showImage && doc.image && (
                    <image href={doc.image} width={doc.imgWidth} height={doc.imgHeight} preserveAspectRatio="xMidYMid slice" />
                  )}

                  {/* 3D plot shadows */}
                  {view === "3d" && doc.plots.map((p) => {
                    // Outline-only boundaries don't have a body to cast a
                    // shadow — skip them so the 3D view doesn't paint a
                    // filled silhouette underneath what should look hollow.
                    if (p.outline) return null;
                    if (p.pathPoints && p.pathPoints.length >= 2) {
                      return (
                        <polyline
                          key={`shadow-${p.id}`}
                          points={p.pathPoints.map(([px, py]) => `${px + 4},${py + 4}`).join(" ")}
                          fill="none"
                          stroke="rgba(0,0,0,0.35)"
                          strokeWidth={p.pathWidth ?? DEFAULT_PATH_WIDTH}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />
                      );
                    }
                    if (p.circle) {
                      return (
                        <circle
                          key={`shadow-${p.id}`}
                          cx={p.circle.cx + 4} cy={p.circle.cy + 4} r={p.circle.r}
                          fill="rgba(0,0,0,0.35)" pointerEvents="none"
                        />
                      );
                    }
                    if (p.points && p.points.length >= 3) {
                      return (
                        <polygon
                          key={`shadow-${p.id}`}
                          points={p.points.map(([px, py]) => `${px + 4},${py + 4}`).join(" ")}
                          fill="rgba(0,0,0,0.35)" pointerEvents="none"
                        />
                      );
                    }
                    return <rect key={`shadow-${p.id}`} x={p.x + 4} y={p.y + 4} width={p.w} height={p.h} fill="rgba(0,0,0,0.35)" pointerEvents="none" />;
                  })}

                  {/* Plots */}
                  {doc.plots.map((p) => {
                    const meta = getPlotType(p.typeId);
                    const isSel = selection?.kind === "plot" && selection.id === p.id;
                    const isHov = hoveredPlotId === p.id;
                    // Show this plot's label when the global toggle is on,
                    // OR the user is hovering it, OR it's currently selected.
                    const showThisLabel = (showLabels || isHov || isSel) && p.w > 24 && p.h > 14;
                    // Four render shapes, in priority order:
                    //   1. Polyline (path/road) — `pathPoints` defines an open
                    //      stroked line; we render two stacked polylines so a
                    //      thin road still has a generously thick hit area.
                    //   2. Circle — `circle` defines cx/cy/r.
                    //   3. Polygon (typically AI-imported, non-rectangular).
                    //   4. Plain axis-aligned rectangle.
                    const hasPath = p.pathPoints && p.pathPoints.length >= 2;
                    const hasCircle = !hasPath && !!p.circle;
                    const hasPolygon = !hasPath && !hasCircle && p.points && p.points.length >= 3;
                    const onPlotEnter = () => setHoveredPlotId(p.id);
                    const onPlotLeave = () => setHoveredPlotId((cur) => (cur === p.id ? null : cur));
                    return (
                      <g key={p.id}>
                        {hasPath ? (
                          <>
                            {/* Wide invisible hit-strip so narrow roads are easy to click. */}
                            <polyline
                              data-plot="true"
                              data-plot-id={p.id}
                              data-testid={`plot-${p.id}-hit`}
                              points={p.pathPoints!.map(([px, py]) => `${px},${py}`).join(" ")}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={Math.max((p.pathWidth ?? DEFAULT_PATH_WIDTH) + 8, 18)}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={tool === "select" ? "cursor-move" : "cursor-pointer"}
                              onPointerEnter={onPlotEnter}
                              onPointerLeave={onPlotLeave}
                            />
                            {/* Visible stroke. When selected, draw a thicker
                                halo underneath the visible body using paintOrder. */}
                            <polyline
                              data-testid={`plot-${p.id}`}
                              points={p.pathPoints!.map(([px, py]) => `${px},${py}`).join(" ")}
                              fill="none"
                              stroke={meta.fill}
                              strokeOpacity={doc.image ? 0.92 : 1}
                              strokeWidth={p.pathWidth ?? DEFAULT_PATH_WIDTH}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              pointerEvents="none"
                            />
                            {isSel && (
                              <polyline
                                points={p.pathPoints!.map(([px, py]) => `${px},${py}`).join(" ")}
                                fill="none"
                                stroke="#0ea5e9"
                                strokeWidth={(p.pathWidth ?? DEFAULT_PATH_WIDTH) + 3}
                                strokeOpacity={0.55}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray="6 4"
                                pointerEvents="none"
                              />
                            )}
                          </>
                        ) : hasCircle ? (
                          <circle
                            data-plot="true"
                            data-plot-id={p.id}
                            data-testid={`plot-${p.id}`}
                            cx={p.circle!.cx} cy={p.circle!.cy} r={p.circle!.r}
                            fill={meta.fill}
                            fillOpacity={doc.image ? 0.85 : 1}
                            stroke={isSel ? "#0ea5e9" : meta.stroke}
                            strokeWidth={isSel ? 2.5 : 1}
                            className={tool === "select" ? "cursor-move" : "cursor-pointer"}
                            onPointerEnter={onPlotEnter}
                            onPointerLeave={onPlotLeave}
                          />
                        ) : hasPolygon ? (
                          <polygon
                            data-plot="true"
                            data-plot-id={p.id}
                            data-testid={`plot-${p.id}`}
                            points={p.points!.map(([px, py]) => `${px},${py}`).join(" ")}
                            fill={p.outline ? "none" : meta.fill}
                            fillOpacity={p.outline ? undefined : (doc.image ? 0.85 : 1)}
                            stroke={isSel ? "#0ea5e9" : (p.outline ? meta.fill : meta.stroke)}
                            strokeWidth={isSel ? 2.5 : (p.outline ? 2.5 : 1)}
                            strokeDasharray={p.outline && !isSel ? "8 4" : undefined}
                            className={tool === "select" ? "cursor-move" : "cursor-pointer"}
                            onPointerEnter={onPlotEnter}
                            onPointerLeave={onPlotLeave}
                          />
                        ) : (
                          <rect
                            data-plot="true"
                            data-plot-id={p.id}
                            data-testid={`plot-${p.id}`}
                            x={p.x} y={p.y}
                            width={p.w} height={p.h}
                            fill={p.outline ? "none" : meta.fill}
                            fillOpacity={p.outline ? undefined : (doc.image ? 0.85 : 1)}
                            stroke={isSel ? "#0ea5e9" : (p.outline ? meta.fill : meta.stroke)}
                            strokeWidth={isSel ? 2.5 : (p.outline ? 2.5 : 1)}
                            strokeDasharray={p.outline && !isSel ? "8 4" : undefined}
                            className={tool === "select" ? "cursor-move" : "cursor-pointer"}
                            rx={2}
                            onPointerEnter={onPlotEnter}
                            onPointerLeave={onPlotLeave}
                          />
                        )}
                        {/* Status dot — skip on path plots (no obvious anchor). */}
                        {!hasPath && p.w > 12 && p.h > 12 && (
                          <circle cx={p.x + p.w - 6} cy={p.y + 6} r={3} fill={STATUS_COLORS[p.status]} pointerEvents="none" />
                        )}
                        {/* Label — paths get the label centred on their middle vertex. */}
                        {showThisLabel && !hasPath && (
                          <text
                            x={p.x + p.w / 2}
                            y={p.y + p.h / 2 + 3}
                            textAnchor="middle"
                            fontSize={Math.min(11, p.h * 0.45)}
                            fontWeight={600}
                            fill={isLightFill(meta.fill) ? "#1f2937" : "#ffffff"}
                            stroke="#ffffff"
                            strokeWidth={isHov && !showLabels ? 3 : 0}
                            paintOrder="stroke"
                            pointerEvents="none"
                          >
                            {p.label || meta.code}
                          </text>
                        )}
                        {hasPath && (showLabels || isHov || isSel) && (() => {
                          const mid = p.pathPoints![Math.floor(p.pathPoints!.length / 2)];
                          return (
                            <text
                              x={mid[0]} y={mid[1] - (p.pathWidth ?? DEFAULT_PATH_WIDTH) / 2 - 4}
                              textAnchor="middle" fontSize={11} fontWeight={600}
                              fill={isLightFill(meta.fill) ? "#1f2937" : "#ffffff"}
                              stroke="#ffffff" strokeWidth={3} paintOrder="stroke"
                              pointerEvents="none"
                            >
                              {p.label || meta.code}
                            </text>
                          );
                        })()}
                        {/* Resize handle — only meaningful for rect/polygon plots.
                            Path plots edit thickness via the inspector slider,
                            circles edit radius via the inspector slider. */}
                        {isSel && !hasPath && !hasCircle && (
                          <rect
                            data-resize="true"
                            x={p.x + p.w - 5} y={p.y + p.h - 5}
                            width={10} height={10}
                            fill="#0ea5e9" stroke="#fff" strokeWidth={1.5}
                            className="cursor-nwse-resize"
                          />
                        )}
                        {/* Path vertex handles when selected — visual only,
                            help the user understand the shape they drew. */}
                        {isSel && hasPath && p.pathPoints!.map(([vx, vy], i) => (
                          <circle
                            key={`v-${i}`}
                            cx={vx} cy={vy} r={3.5}
                            fill="#0ea5e9" stroke="#fff" strokeWidth={1.5}
                            pointerEvents="none"
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Spots */}
                  {showSpots && doc.spots.map((s) => {
                    const meta = getSpotType(s.spotTypeId);
                    const isSel = selection?.kind === "spot" && selection.id === s.id;
                    const Icon = SPOT_ICONS[meta.icon] ?? SPOT_ICONS.circle;
                    const r = isSel ? 13 : 11;
                    return (
                      <g
                        key={s.id}
                        data-spot="true"
                        data-spot-id={s.id}
                        data-testid={`spot-${s.id}`}
                        className={tool === "select" ? "cursor-move" : "cursor-pointer"}
                      >
                        {/* halo on selection */}
                        {isSel && (
                          <circle cx={s.x} cy={s.y} r={r + 5} fill="none" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="3 2" />
                        )}
                        {/* drop shadow */}
                        <circle cx={s.x + 1} cy={s.y + 2} r={r} fill="rgba(0,0,0,0.35)" />
                        {/* pin body */}
                        <circle cx={s.x} cy={s.y} r={r} fill={meta.color} stroke="#ffffff" strokeWidth={2} />
                        {/* icon */}
                        <Icon
                          x={s.x - r * 0.55} y={s.y - r * 0.55}
                          width={r * 1.1} height={r * 1.1}
                          stroke="#ffffff" strokeWidth={2.5}
                          pointerEvents="none"
                        />
                        {showLabels && (s.name || s.temporaryId) && (
                          <text
                            x={s.x} y={s.y + r + 12}
                            textAnchor="middle" fontSize={11} fontWeight={600}
                            fill="#1f2937"
                            stroke="#ffffff" strokeWidth={3} paintOrder="stroke"
                            pointerEvents="none"
                          >
                            {s.name || s.temporaryId}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Draft rectangle / circle preview. The same draft ref is
                      reused by both tools — branch on whether a circle is
                      present so the preview matches the in-progress shape. */}
                  {draftRect && (draftRect.circle ? (
                    <circle
                      cx={draftRect.circle.cx} cy={draftRect.circle.cy} r={draftRect.circle.r}
                      fill={getPlotType(draftRect.typeId).fill}
                      fillOpacity={0.5}
                      stroke={getPlotType(draftRect.typeId).stroke}
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />
                  ) : (
                    <rect
                      x={draftRect.x} y={draftRect.y}
                      width={draftRect.w} height={draftRect.h}
                      fill={draftRect.outline ? "none" : getPlotType(draftRect.typeId).fill}
                      fillOpacity={draftRect.outline ? undefined : 0.5}
                      stroke={draftRect.outline ? getPlotType(draftRect.typeId).fill : getPlotType(draftRect.typeId).stroke}
                      strokeDasharray={draftRect.outline ? "8 4" : "4 3"}
                      strokeWidth={draftRect.outline ? 2.5 : 1.5}
                      pointerEvents="none"
                    />
                  ))}

                  {/* Draft path / polygon preview — committed segments solid;
                      the "rubber band" segment from the last vertex to the
                      cursor is dashed so the user knows it's not placed yet.
                      Polygons additionally render a translucent fill once at
                      least 2 vertices exist plus the closing edge from the
                      cursor back to the first vertex, giving a live preview
                      of the closed shape. */}
                  {draftPath && (() => {
                    const meta = getPlotType(draftPath.typeId);
                    const placed = draftPath.points;
                    const placedStr = placed.map(([px, py]) => `${px},${py}`).join(" ");
                    const last = placed[placed.length - 1];
                    const first = placed[0];
                    if (draftPath.closed) {
                      // Polygon preview — fill the area defined by the placed
                      // vertices (plus the cursor when we have one) so the
                      // user sees the shape, not just an outline. For the
                      // outline-only variant we skip the fill entirely so the
                      // boundary preview matches the committed render.
                      const previewPoints = pathCursor ? [...placed, [pathCursor.x, pathCursor.y] as [number, number]] : placed;
                      const previewStr = previewPoints.map(([px, py]) => `${px},${py}`).join(" ");
                      return (
                        <g pointerEvents="none">
                          {previewPoints.length >= 3 && !draftPath.outline && (
                            <polygon
                              points={previewStr}
                              fill={meta.fill}
                              fillOpacity={0.35}
                              stroke="none"
                            />
                          )}
                          {placed.length >= 2 && (
                            <polyline
                              points={placedStr}
                              fill="none"
                              stroke={meta.fill}
                              strokeOpacity={0.9}
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                          {pathCursor && (
                            <>
                              <line
                                x1={last[0]} y1={last[1]}
                                x2={pathCursor.x} y2={pathCursor.y}
                                stroke={meta.fill}
                                strokeOpacity={0.55}
                                strokeWidth={2}
                                strokeDasharray="6 5"
                                strokeLinecap="round"
                              />
                              {placed.length >= 2 && (
                                <line
                                  x1={pathCursor.x} y1={pathCursor.y}
                                  x2={first[0]} y2={first[1]}
                                  stroke={meta.stroke}
                                  strokeOpacity={0.45}
                                  strokeWidth={1.5}
                                  strokeDasharray="3 3"
                                  strokeLinecap="round"
                                />
                              )}
                            </>
                          )}
                          {placed.map(([vx, vy], i) => (
                            <circle
                              key={`dv-${i}`} cx={vx} cy={vy} r={4}
                              fill={i === 0 ? meta.fill : "#ffffff"}
                              stroke={meta.stroke} strokeWidth={1.5}
                            />
                          ))}
                        </g>
                      );
                    }
                    return (
                      <g pointerEvents="none">
                        {placed.length >= 2 && (
                          <polyline
                            points={placedStr}
                            fill="none"
                            stroke={meta.fill}
                            strokeOpacity={0.9}
                            strokeWidth={draftPath.pathWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {pathCursor && (
                          <line
                            x1={last[0]} y1={last[1]}
                            x2={pathCursor.x} y2={pathCursor.y}
                            stroke={meta.fill}
                            strokeOpacity={0.55}
                            strokeWidth={draftPath.pathWidth}
                            strokeDasharray="6 5"
                            strokeLinecap="round"
                          />
                        )}
                        {placed.map(([vx, vy], i) => (
                          <circle
                            key={`dv-${i}`} cx={vx} cy={vy} r={4}
                            fill="#ffffff" stroke={meta.stroke} strokeWidth={1.5}
                          />
                        ))}
                      </g>
                    );
                  })()}
                </svg>
              </div>
              )}
            </div>
          </ScrollArea>

          <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-muted-foreground bg-background/90 backdrop-blur border border-border rounded px-2 py-1 pointer-events-none">
            <Hand className="h-3 w-3" />
            <span>Hotkeys: <kbd className="px-1 bg-muted rounded">V</kbd> Select · <kbd className="px-1 bg-muted rounded">R</kbd> Plot · <kbd className="px-1 bg-muted rounded">C</kbd> Circle · <kbd className="px-1 bg-muted rounded">G</kbd> Polygon · <kbd className="px-1 bg-muted rounded">P</kbd> Path · <kbd className="px-1 bg-muted rounded">S</kbd> Spot · <kbd className="px-1 bg-muted rounded">H</kbd> Pan · <kbd className="px-1 bg-muted rounded">⌫</kbd> Delete</span>
          </div>

          {saveError && (
            <div role="alert" data-testid="save-error" className="absolute top-3 right-3 max-w-sm flex items-start gap-2 bg-destructive text-destructive-foreground border border-destructive rounded-md px-3 py-2 shadow-lg">
              <Trash2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-snug">{saveError}</div>
              <button type="button" onClick={() => setSaveError(null)} className="text-destructive-foreground/80 hover:text-destructive-foreground text-xs ml-1 -mr-1" aria-label="Dismiss">×</button>
            </div>
          )}
        </div>

        {/* ============ Right: Properties + saved maps ============ */}
        {rightCollapsed ? (
          <aside className="w-12 shrink-0 border-l border-border bg-card flex flex-col items-center py-2 gap-1">
            <Button
              variant="ghost" size="sm" className="h-9 w-9 p-0"
              onClick={() => setRightCollapsed(false)}
              title="Show inspector"
              data-testid="btn-expand-right"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {selection && (
              <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center" title="Selection active">
                {selectedSpot ? <MapPinIcon className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-primary" />}
              </div>
            )}
            <Separator className="my-1 w-8" />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={save} title="Save map" data-testid="save-map-mini">
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={exportJson} title="Export map">
              <Download className="h-4 w-4" />
            </Button>
          </aside>
        ) : (
        <aside className="w-72 lg:w-80 shrink-0 border-l border-border bg-card flex flex-col">
          <ScrollArea className="flex-1">
            {/* SELECTED ITEM */}
            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center justify-between">
                <span>{selectedSpot ? "Burial Spot" : selectedPlot ? "Selected Plot" : "Inspector"}</span>
                {selection && (
                  <button onClick={() => setSelection(null)} className="text-muted-foreground hover:text-foreground" aria-label="Deselect">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {selectedPlot && (
                <PlotEditor
                  plot={selectedPlot}
                  plotTypes={plotTypes}
                  onChange={updatePlot}
                  onDelete={() => {
                    setDoc((d) => ({ ...d, plots: d.plots.filter((p) => p.id !== selectedPlot.id), updatedAt: Date.now() }));
                    setSelection(null);
                  }}
                />
              )}
              {selectedSpot && (
                <SpotEditor
                  spot={selectedSpot}
                  spotTypes={spotTypes}
                  onChange={updateSpot}
                  onUploadHeadstone={() => headstoneInputRef.current?.click()}
                  onRemoveHeadstone={onRemoveHeadstone}
                  onDelete={() => {
                    setDoc((d) => ({ ...d, spots: d.spots.filter((s) => s.id !== selectedSpot.id), updatedAt: Date.now() }));
                    setSelection(null);
                  }}
                />
              )}
              {!selection && (
                <p className="text-xs text-muted-foreground">
                  Click a plot or burial spot on the canvas to edit it. Use the <strong>Plot</strong> tool to draw sections and the <strong>Spot</strong> tool to drop individual burial markers with full details.
                </p>
              )}
              <input ref={headstoneInputRef} type="file" accept="image/*" multiple onChange={onUploadHeadstone} className="hidden" data-testid="headstone-input" />
            </div>

            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Map Stats</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Plots" value={counts.totalPlots} />
                <Stat label="Spots" value={counts.totalSpots} />
                <Stat label="Available" value={counts.available} color={STATUS_COLORS.available} />
                <Stat label="Reserved" value={counts.reserved} color={STATUS_COLORS.reserved} />
                <Stat label="Occupied" value={counts.occupied} color={STATUS_COLORS.occupied} />
              </div>
            </div>

            <div className="p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center justify-between">
                <span>Published Maps</span>
                <Badge variant="outline" className="h-4 text-[9px] tabular-nums">{publishedMaps.length}</Badge>
              </div>
              {publishedMaps.length === 0 ? (
                <p className="text-xs text-muted-foreground mb-3">Publish a map to list it here as a permanent live map.</p>
              ) : (
                <div className="space-y-1 mb-3">
                  {publishedMaps.map((m) => (
                    <div key={`${m.projectId}-${m.updatedAt}`} className="flex items-center gap-1 rounded-md border border-border bg-background p-2">
                      <button
                        type="button"
                        onClick={() => window.open(withBasePath(m.url), "_blank", "noopener,noreferrer")}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-xs font-medium truncate">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">{timeAgo(m.updatedAt)}</div>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => window.open(withBasePath(m.url), "_blank", "noopener,noreferrer")}
                        title="Open published map"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center justify-between">
                <span>Saved Maps</span>
                <Badge variant="outline" className="h-4 text-[9px] tabular-nums">{savedMaps.length}</Badge>
              </div>
              {savedMaps.length === 0 ? (
                <p className="text-xs text-muted-foreground">Click <strong>Save</strong> to keep this map. Saved maps appear here.</p>
              ) : (
                <div className="space-y-1">
                  {savedMaps.map((m) => (
                    <div key={m.key} className="flex items-center gap-1 rounded-md border border-border bg-background p-2">
                      <button type="button" onClick={() => load(m.key)} data-testid={`load-${m.key}`} className="flex-1 min-w-0 text-left">
                        <div className="text-xs font-medium truncate">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">{timeAgo(m.updatedAt)}</div>
                      </button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => load(m.key)}>
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeMap(m.key)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => { setDoc(DEFAULT_DOC); setSelection(null); }} data-testid="new-map">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New empty map
              </Button>
            </div>
          </ScrollArea>
        </aside>
        )}
      </div>

      {/* Status toast (centred bottom) */}
      {statusMessage && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-3 py-2 rounded-md shadow-lg z-50 pointer-events-none" role="status">
          {statusMessage}
        </div>
      )}
    </div>
  );
}

// ===== Subcomponents =====

function PublishedMapPreview({ slug }: { slug: string }) {
  const [plotTypes] = usePlotTypes();
  const [spotTypes] = useSpotTypes();
  const [payload, setPayload] = useState<PersistedMapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const project = new URLSearchParams(window.location.search).get("project");
    const suffix = project ? `?project=${encodeURIComponent(project)}` : "";
    fetch(`/api/cemetery-maps/public/${encodeURIComponent(slug)}${suffix}`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
        return body as PersistedMapPayload;
      })
      .then((body) => {
        if (!cancelled) {
          setPayload({ ...body, doc: migrateDoc(body.doc) });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Published map could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const doc = payload?.doc ?? null;
  const effectivePlotTypes = payload?.plotTypes?.length ? payload.plotTypes : plotTypes;
  const effectiveSpotTypes = payload?.spotTypes?.length ? payload.spotTypes : spotTypes;
  const cemetery = payload?.cemetery ? [payload.cemetery] : [];

  return (
    <div className="min-h-screen bg-[#ebe7da] text-[#1d2a22]">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-black/10 bg-[#fffdf6]/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#576657]">Published map</div>
          <h1 className="truncate text-lg font-semibold">{payload?.cemetery?.name ?? slug}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-2 bg-white/70">
            <Link href="/map-maker">
              <ArrowLeft className="h-4 w-4" />
              Map Maker
            </Link>
          </Button>
        </div>
      </header>

      <main className="min-h-[calc(100vh-65px)] overflow-auto p-6">
        {error ? (
          <div className="mx-auto mt-16 max-w-lg rounded border border-destructive/30 bg-white p-6 text-center shadow">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <h2 className="mt-3 text-lg font-semibold">Map is not published yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button asChild className="mt-4">
              <Link href="/map-maker">Open Map Maker</Link>
            </Button>
          </div>
        ) : !doc ? (
          <div className="mx-auto mt-16 max-w-sm rounded border bg-white p-6 text-center shadow">
            <LoaderDot />
            <p className="mt-3 text-sm text-muted-foreground">Loading published cemetery map...</p>
          </div>
        ) : (
          <div className="inline-block min-w-full">
            <InteractiveMapPreview
              doc={doc}
              plotTypes={effectivePlotTypes}
              spotTypes={effectiveSpotTypes}
              cemeteries={cemetery}
              onSelectSpot={() => undefined}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function LoaderDot() {
  return <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#576657]/20 border-t-[#576657]" />;
}

function InteractiveMapPreview({
  doc,
  plotTypes,
  spotTypes,
  cemeteries,
  onSelectSpot,
}: {
  doc: MapDoc;
  plotTypes: PlotType[];
  spotTypes: SpotType[];
  cemeteries: CemeteryOption[];
  onSelectSpot: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [dobFrom, setDobFrom] = useState("");
  const [dobTo, setDobTo] = useState("");
  const [dodFrom, setDodFrom] = useState("");
  const [dodTo, setDodTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const cemetery = cemeteries.find((item) => item.id === doc.cemeteryId);
  const spotTypeMap = useMemo(
    () => new Map(spotTypes.map((type) => [type.id, type])),
    [spotTypes],
  );
  const plotTypeMap = useMemo(
    () => new Map(plotTypes.map((type) => [type.id, type])),
    [plotTypes],
  );

  const visibleSpots = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return doc.spots.filter((spot) => {
      if (category !== "all" && spot.spotTypeId !== category) return false;
      const haystack = [
        spot.name,
        spot.temporaryId,
        spot.dob,
        spot.dod,
        spot.veteranStatus,
        spot.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (!yearInRange(spot.dob, dobFrom, dobTo)) return false;
      if (!yearInRange(spot.dod, dodFrom, dodTo)) return false;
      return true;
    });
  }, [category, dobFrom, dobTo, dodFrom, dodTo, doc.spots, query]);

  const selectedSpot = selectedId
    ? doc.spots.find((spot) => spot.id === selectedId) ?? null
    : null;
  const matchedIds = new Set(visibleSpots.map((spot) => spot.id));

  const onPreviewPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panMode) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-spot-button='true']")) return;
    panDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPreviewPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panMode || !panDragRef.current) return;
    if (panDragRef.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - panDragRef.current.startX;
    const dy = event.clientY - panDragRef.current.startY;
    setPan({
      x: panDragRef.current.startPanX + dx,
      y: panDragRef.current.startPanY + dy,
    });
  };

  const onPreviewPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panDragRef.current || panDragRef.current.pointerId !== event.pointerId) return;
    panDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-sm bg-[#f8f5ea] text-[#1d2a22] shadow-2xl shadow-black/25 ring-1 ring-black/10"
      style={{ width: doc.imgWidth, height: doc.imgHeight }}
      data-testid="interactive-map-preview"
      onPointerDown={onPreviewPointerDown}
      onPointerMove={onPreviewPointerMove}
      onPointerUp={onPreviewPointerUp}
      onPointerCancel={onPreviewPointerUp}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: panMode ? "none" : "transform 120ms ease-out",
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(74,86,70,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(74,86,70,0.12)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <svg className="absolute inset-0 z-0 h-full w-full" viewBox={`0 0 ${doc.imgWidth} ${doc.imgHeight}`} aria-hidden="true">
          {doc.plots.map((plot) => {
            const meta = plotTypeMap.get(plot.typeId) ?? FALLBACK_PLOT_TYPE;
            if (plot.points && plot.points.length >= 3) {
              return (
                <polygon
                  key={plot.id}
                  points={plot.points.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill={plot.outline ? "rgba(0,0,0,0.02)" : meta.fill}
                  stroke={meta.stroke}
                  strokeWidth={plot.outline ? 2 : 1}
                  strokeDasharray={plot.outline ? "7 5" : undefined}
                  opacity={0.65}
                />
              );
            }
            return (
              <rect
                key={plot.id}
                x={plot.x}
                y={plot.y}
                width={plot.w}
                height={plot.h}
                fill={plot.outline ? "rgba(0,0,0,0.02)" : meta.fill}
                stroke={meta.stroke}
                strokeWidth={plot.outline ? 2 : 1}
                strokeDasharray={plot.outline ? "7 5" : undefined}
                opacity={0.65}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 z-10">
          {doc.spots.map((spot) => {
            const meta = spotTypeMap.get(spot.spotTypeId) ?? FALLBACK_SPOT_TYPE;
            const visible = matchedIds.has(spot.id);
            const active = selectedSpot?.id === spot.id;
            const label = spot.name || spot.temporaryId || "Unknown";
            return (
              <button
                key={spot.id}
                type="button"
                data-spot-button="true"
                onClick={() => {
                  setSelectedId(spot.id);
                  onSelectSpot(spot.id);
                }}
                className={cn(
                  "group absolute -translate-x-1/2 -translate-y-1/2 text-left transition",
                  visible ? "opacity-100" : "opacity-15 grayscale",
                )}
                style={{ left: spot.x, top: spot.y }}
                title={`${label}${spot.dob || spot.dod ? ` (${spot.dob ?? "?"}-${spot.dod ?? "?"})` : ""}`}
              >
                <span
                  className={cn(
                    "block h-2.5 w-2.5 border border-white shadow-sm",
                    active && "ring-2 ring-[#0f766e] ring-offset-1 ring-offset-[#f8f5ea]",
                  )}
                  style={{ backgroundColor: meta.color }}
                />
                {(visible && label) && (
                  <span className="pointer-events-none absolute left-3 top-[-3px] hidden max-w-28 whitespace-normal rounded bg-[#fffdf6]/95 px-1 py-0.5 text-[8px] font-semibold leading-tight text-[#243225] shadow-sm group-hover:block">
                    {label}
                    {(spot.dob || spot.dod) && (
                      <span className="block font-normal text-[#576657]">{spot.dob ?? "?"}-{spot.dod ?? "?"}</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="absolute left-6 top-6 z-20 max-w-[560px] rounded border border-[#27382d]/25 bg-[#fffdf6]/95 p-4 shadow-lg">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#576657]">Cemetery Overview</div>
        <div className="mt-1 text-xl font-semibold leading-tight">
          {cemetery?.name ?? doc.name}
        </div>
        <div className="mt-1 text-xs text-[#576657]">
          Interactive HTML5 preview · {visibleSpots.length} of {doc.spots.length} burial spots visible
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1.5fr_1fr_0.8fr_0.8fr]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, ID, notes"
            className="h-8 bg-white/90 text-xs"
            data-testid="preview-search"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 bg-white/90 text-xs" data-testid="preview-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {spotTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={dobFrom} onChange={(event) => setDobFrom(event.target.value)} placeholder="DOB from" className="h-8 bg-white/90 text-xs" />
          <Input value={dodTo} onChange={(event) => setDodTo(event.target.value)} placeholder="DOD to" className="h-8 bg-white/90 text-xs" />
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <Input value={dobTo} onChange={(event) => setDobTo(event.target.value)} placeholder="DOB to" className="h-8 bg-white/90 text-xs" />
          <Input value={dodFrom} onChange={(event) => setDodFrom(event.target.value)} placeholder="DOD from" className="h-8 bg-white/90 text-xs" />
        </div>
      </div>

      <div className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1 rounded border border-[#27382d]/20 bg-[#fffdf6]/95 p-1.5 shadow">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.55, z - 0.1))} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant={panMode ? "default" : "ghost"}
          className="h-7 w-7"
          onClick={() => setPanMode((v) => !v)}
          title="Pan mode"
        >
          <Hand className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="absolute bottom-5 left-6 z-20 flex items-end gap-4 rounded border border-[#27382d]/20 bg-[#fffdf6]/95 p-3 text-xs shadow">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-[#576657]">Legend</div>
          <div className="grid max-w-[520px] grid-cols-2 gap-x-4 gap-y-1">
            {spotTypes.map((type) => (
              <div key={type.id} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 border border-white shadow-sm" style={{ backgroundColor: type.color }} />
                <span className="truncate">{type.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-28">
          <div className="h-1 w-24 bg-[#243225]" />
          <div className="mt-1 flex justify-between text-[10px] text-[#576657]">
            <span>0</span>
            <span>20</span>
            <span>40 ft</span>
          </div>
        </div>
      </div>

      {selectedSpot && (
        <div className="fixed right-6 top-24 z-[70] w-72 rounded border border-[#27382d]/25 bg-[#fffdf6]/95 p-4 shadow-xl">
          <div className="text-[10px] uppercase tracking-wider text-[#576657]">Burial details</div>
          <div className="mt-1 text-base font-semibold">{selectedSpot.name || selectedSpot.temporaryId || "Unknown burial"}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <FieldMini label="DOB" value={selectedSpot.dob} />
            <FieldMini label="DOD" value={selectedSpot.dod} />
            <FieldMini label="Category" value={(spotTypeMap.get(selectedSpot.spotTypeId) ?? FALLBACK_SPOT_TYPE).name} />
            <FieldMini label="Image" value={selectedSpot.imageFileName || fileBaseName(selectedSpot.imagePath ?? "")} />
          </div>
          {selectedSpot.notes && <p className="mt-2 text-xs text-[#576657]">{selectedSpot.notes}</p>}
        </div>
      )}
    </div>
  );
}

function yearInRange(value: string | undefined, from: string, to: string) {
  if (!from.trim() && !to.trim()) return true;
  const year = extractYear(value);
  if (year == null) return false;
  const min = extractYear(from);
  const max = extractYear(to);
  if (min != null && year < min) return false;
  if (max != null && year > max) return false;
  return true;
}

function extractYear(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function FieldMini({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[#576657]">{label}</div>
      <div className="truncate font-medium">{value || "-"}</div>
    </div>
  );
}

function WorkflowPanel({
  tab,
  doc,
  cemeteries,
  workflowStats,
  mergeReview,
  importLog,
  selectedSpot,
  onCreateDraft,
  onImportDataset,
  onUploadGpr,
  onUploadBurial,
  onRenameProject,
  onMergeToggle,
  onApplyMerge,
  onSyncHeadstones,
  onMarkAiProcessed,
  onMarkVerified,
  onPublish,
}: {
  tab: WorkflowTab;
  doc: MapDoc;
  cemeteries: CemeteryOption[];
  workflowStats: ReturnType<typeof useWorkflowStatsShape>;
  mergeReview: MergeReview | null;
  importLog: string[];
  selectedSpot: BurialSpot | null;
  onCreateDraft: () => void;
  onImportDataset: () => void;
  onUploadGpr: () => void;
  onUploadBurial: () => void;
  onRenameProject: (name: string) => void;
  onMergeToggle: (bucket: keyof Pick<MergeReview, "exact" | "nearby" | "newRecords" | "duplicates" | "conflicts">, id: string, apply: boolean) => void;
  onApplyMerge: () => void;
  onSyncHeadstones: () => void;
  onMarkAiProcessed: () => void;
  onMarkVerified: () => void;
  onPublish: () => void;
}) {
  const selectedCemetery = cemeteries.find((cemetery) => cemetery.id === doc.cemeteryId);
  return (
    <div className="mt-3 rounded-md border border-border bg-background p-2">
      {tab === "project" && (
        <div className="space-y-2">
          <WorkflowLine done={Boolean(doc.cemeteryId)} label={selectedCemetery ? selectedCemetery.name : "Select cemetery"} />
          <WorkflowLine done={doc.projectStatus === "draft" || doc.projectStatus === "published"} label="Project starts as Draft" />
          <div className="space-y-1">
            <Label className="text-[11px]">Project name</Label>
            <Input
              value={doc.name === DEFAULT_DOC.name ? "" : doc.name}
              onChange={(event) => onRenameProject(event.target.value)}
              placeholder="Section A spring import"
              className="h-8 text-xs"
              data-testid="input-map-project-name"
            />
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 w-full gap-1.5">
            <Link href="/organizations">
              <Plus className="h-3.5 w-3.5" />
              Create cemetery
            </Link>
          </Button>
          <Button size="sm" className="h-8 w-full gap-1.5" onClick={onCreateDraft}>
            <Plus className="h-3.5 w-3.5" />
            Create map project
          </Button>
        </div>
      )}

      {tab === "import" && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Upload all cemetery CSV files in one action. The importer reads GPR, Burial, Cremations, Misc Points, Coping Area, and other coordinate layers together.
          </p>
          <Button size="sm" className="h-8 w-full gap-1.5" onClick={onImportDataset}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Import all CSV files
          </Button>
          <MiniStat label="GPR spots" value={workflowStats.gpr} />
          <MiniStat label="Burial matched" value={workflowStats.burial} />
          <MiniStat label="Total spots" value={doc.spots.length} />
        </div>
      )}

      {tab === "headstones" && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Bulk images live in Headstone Import. This workspace syncs the selected cemetery folder by filename; missing or unmatched images remain review work.
          </p>
          {doc.cemeteryId && (
            <div className="rounded border border-border bg-muted/30 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Headstone folder</div>
              <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                /uploads/cemeteries/{doc.cemeteryId}/headstones
              </div>
            </div>
          )}
          <Button asChild size="sm" variant="outline" className="h-8 w-full gap-1.5">
            <Link href="/import-data/headstones">
              <ImagePlus className="h-3.5 w-3.5" />
              Open Headstone Import
            </Link>
          </Button>
          <Button size="sm" className="h-8 w-full gap-1.5" onClick={onSyncHeadstones}>
            <GitMerge className="h-3.5 w-3.5" />
            Sync headstone library
          </Button>
          <MiniStat label="Image attached" value={workflowStats.images} />
          <MiniStat label="AI processed" value={workflowStats.ai} />
          {selectedSpot ? (
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={onMarkAiProcessed}>AI done</Button>
              <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={onMarkVerified}>Verify spot</Button>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Select a burial spot to mark AI processed or verified.</p>
          )}
        </div>
      )}

      {tab === "publish" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1">
            <MiniStat label="Needs review" value={workflowStats.needsReview} />
            <MiniStat label="Verified" value={workflowStats.verified} />
            <MiniStat label="Published" value={workflowStats.published} />
            <MiniStat label="Total spots" value={doc.spots.length} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Public map exposes name, dates, headstone image, and burial location. Admin map keeps GPR coordinates, source CSV, confidence, and review data.
          </p>
          <div className="rounded border border-primary/20 bg-primary/5 p-2">
            <p className="text-[11px] text-primary">
              Workflow: Save Draft keeps work private. Publish Live Map makes it permanent and syncs Burial Spots + Map View.
            </p>
          </div>
          <Button size="sm" className="h-8 w-full gap-1.5" onClick={onPublish}>
            <Send className="h-3.5 w-3.5" />
            Publish map
          </Button>
        </div>
      )}

      {importLog.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <ListChecks className="h-3 w-3" />
            Activity
          </div>
          <div className="space-y-1">
            {importLog.slice(0, 3).map((item) => (
              <div key={item} className="text-[10px] text-muted-foreground">{item}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function useWorkflowStatsShape() {
  return {
    gpr: 0,
    burial: 0,
    images: 0,
    ai: 0,
    needsReview: 0,
    verified: 0,
    published: 0,
  };
}

function WorkflowLine({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-muted/20 px-2 py-1">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MergeBucketList({
  title,
  bucket,
  items,
  onToggle,
}: {
  title: string;
  bucket: keyof Pick<MergeReview, "exact" | "nearby" | "newRecords" | "duplicates" | "conflicts">;
  items: MergeCandidate[];
  onToggle: (bucket: keyof Pick<MergeReview, "exact" | "nearby" | "newRecords" | "duplicates" | "conflicts">, id: string, apply: boolean) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded border border-border">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-[11px] font-medium">{title}</span>
        <Badge variant="outline" className="h-4 text-[9px]">{items.length}</Badge>
      </div>
      <div className="max-h-28 overflow-y-auto">
        {items.slice(0, 12).map((item) => (
          <label key={item.id} className="flex gap-2 border-b border-border/60 px-2 py-1.5 last:border-0">
            <input
              type="checkbox"
              checked={item.apply}
              onChange={(event) => onToggle(bucket, item.id, event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium">{item.burial.name || `Row ${item.burial.rowNumber}`}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{item.reason}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PlotEditor({ plot, plotTypes, onChange, onDelete }: {
  plot: Plot; plotTypes: PlotType[];
  onChange: (patch: Partial<Plot>) => void; onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Label</Label>
        <Input value={plot.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. RC-A1" className="h-8" data-testid="input-plot-label" />
      </div>
      <div>
        <Label className="text-xs">Type</Label>
        <Select value={plot.typeId} onValueChange={(v) => onChange({ typeId: v })}>
          <SelectTrigger className="h-8" data-testid="select-plot-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {plotTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm" style={{ background: t.fill }} />
                  <span>{t.code} · {t.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Status</Label>
        <Select value={plot.status} onValueChange={(v) => onChange({ status: v as PlotStatus })}>
          <SelectTrigger className="h-8" data-testid="select-plot-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_COLORS) as PlotStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                  <span className="capitalize">{s}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Path plots edit their thickness via a slider, circles edit radius
          via a slider, rect/polygon plots keep the legacy bbox numeric inputs.
          Sliders auto-recompute the bounding box so move/select stay accurate. */}
      {plot.pathPoints && plot.pathPoints.length >= 2 ? (
        <div>
          <Label className="text-xs flex items-center justify-between">
            <span>Path width</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(plot.pathWidth ?? DEFAULT_PATH_WIDTH)} px</span>
          </Label>
          <Input
            type="range"
            min={2} max={60} step={1}
            value={Math.round(plot.pathWidth ?? DEFAULT_PATH_WIDTH)}
            onChange={(e) => {
              const w = Math.max(2, Math.min(60, +e.target.value));
              const xs = plot.pathPoints!.map((p) => p[0]);
              const ys = plot.pathPoints!.map((p) => p[1]);
              const pad = w / 2;
              onChange({
                pathWidth: w,
                x: Math.min(...xs) - pad,
                y: Math.min(...ys) - pad,
                w: Math.max(8, Math.max(...xs) - Math.min(...xs) + w),
                h: Math.max(8, Math.max(...ys) - Math.min(...ys) + w),
              });
            }}
            className="h-8 cursor-ew-resize"
            data-testid="input-path-width"
          />
          <p className="text-[10px] text-muted-foreground mt-1">{plot.pathPoints.length} vertices · drag the path on the canvas to reposition it</p>
        </div>
      ) : plot.circle ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs flex items-center justify-between">
              <span>Radius</span>
              <span className="tabular-nums text-muted-foreground">{Math.round(plot.circle.r)} px</span>
            </Label>
            <Input
              type="range"
              min={4} max={2000} step={1}
              value={Math.round(plot.circle.r)}
              onChange={(e) => {
                const r = Math.max(4, Math.min(2000, +e.target.value));
                const c = plot.circle!;
                onChange({
                  circle: { cx: c.cx, cy: c.cy, r },
                  x: c.cx - r, y: c.cy - r, w: r * 2, h: r * 2,
                });
              }}
              className="h-8 cursor-ew-resize"
              data-testid="input-circle-radius"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Center X</Label>
              <Input
                type="number"
                value={Math.round(plot.circle.cx)}
                onChange={(e) => {
                  const cx = +e.target.value;
                  const c = plot.circle!;
                  onChange({ circle: { cx, cy: c.cy, r: c.r }, x: cx - c.r, y: c.cy - c.r, w: c.r * 2, h: c.r * 2 });
                }}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Center Y</Label>
              <Input
                type="number"
                value={Math.round(plot.circle.cy)}
                onChange={(e) => {
                  const cy = +e.target.value;
                  const c = plot.circle!;
                  onChange({ circle: { cx: c.cx, cy, r: c.r }, x: c.cx - c.r, y: cy - c.r, w: c.r * 2, h: c.r * 2 });
                }}
                className="h-8"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Width</Label><Input type="number" value={Math.round(plot.w)} onChange={(e) => onChange({ w: Math.max(8, +e.target.value) })} className="h-8" /></div>
          <div><Label className="text-xs">Height</Label><Input type="number" value={Math.round(plot.h)} onChange={(e) => onChange({ h: Math.max(8, +e.target.value) })} className="h-8" /></div>
          <div><Label className="text-xs">X</Label><Input type="number" value={Math.round(plot.x)} onChange={(e) => onChange({ x: +e.target.value })} className="h-8" /></div>
          <div><Label className="text-xs">Y</Label><Input type="number" value={Math.round(plot.y)} onChange={(e) => onChange({ y: +e.target.value })} className="h-8" /></div>
        </div>
      )}
      {(plot.sourceCsv || plot.sourceLayer || plot.accuracy !== undefined) && (
        <div className="rounded-md border border-border bg-muted/20 p-2 text-[10px] text-muted-foreground">
          <div className="mb-1 font-semibold uppercase tracking-wider text-foreground">Admin import data</div>
          {plot.sourceLayer && <div>Layer: {plot.sourceLayer}</div>}
          {plot.sourceCsv && <div>Source CSV: {plot.sourceCsv}</div>}
          {plot.accuracy !== undefined && <div>Accuracy: {plot.accuracy}</div>}
        </div>
      )}
      <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive border-destructive/30" onClick={onDelete} data-testid="delete-plot">
        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete plot
      </Button>
    </div>
  );
}

function SpotEditor({ spot, spotTypes, onChange, onUploadHeadstone, onRemoveHeadstone, onDelete }: {
  spot: BurialSpot; spotTypes: SpotType[];
  onChange: (patch: Partial<BurialSpot>) => void;
  onUploadHeadstone: () => void;
  onRemoveHeadstone: (index: number) => void;
  onDelete: () => void;
}) {
  const images = spot.headstoneImages ?? [];
  const canAddMore = images.length < MAX_HEADSTONE_IMAGES;
  const age = calcAge(spot.dob, spot.dod);
  const meta = spotTypes.find((t) => t.id === spot.spotTypeId) ?? FALLBACK_SPOT_TYPE;
  const Icon = SPOT_ICONS[meta.icon] ?? SPOT_ICONS.circle;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
        <div className="h-9 w-9 rounded-full flex items-center justify-center border-2 border-white shadow-sm" style={{ background: meta.color }}>
          <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{spot.name || "Unnamed burial"}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {spot.temporaryId ? `${spot.temporaryId} · ` : ""}{meta.name}{age != null ? ` · age ${age}` : ""}
          </div>
        </div>
      </div>

      {(spot.importFlags?.length || spot.reviewStatus) && (
        <div className="flex flex-wrap gap-1">
          {(spot.importFlags ?? []).map((flag) => (
            <Badge key={flag} variant="outline" className="h-5 text-[10px]">{flag}</Badge>
          ))}
          {spot.reviewStatus && (
            <Badge variant="secondary" className="h-5 text-[10px] capitalize">
              {spot.reviewStatus.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
      )}

      <div>
        <Label className="text-xs">Spot Type</Label>
        <Select value={spot.spotTypeId} onValueChange={(v) => onChange({ spotTypeId: v })}>
          <SelectTrigger className="h-8" data-testid="select-spot-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {spotTypes.map((t) => {
              const I = SPOT_ICONS[t.icon] ?? SPOT_ICONS.circle;
              return (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full flex items-center justify-center" style={{ background: t.color }}>
                      <I className="h-2 w-2 text-white" strokeWidth={3} />
                    </div>
                    <span>{t.name}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Full name</Label>
        <Input value={spot.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Eleanor R. Thompson" className="h-8" data-testid="input-spot-name" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Date of birth</Label>
          <Input type="date" value={spot.dob ?? ""} onChange={(e) => onChange({ dob: e.target.value || undefined })} className="h-8" data-testid="input-spot-dob" />
        </div>
        <div>
          <Label className="text-xs">Date of death</Label>
          <Input type="date" value={spot.dod ?? ""} onChange={(e) => onChange({ dod: e.target.value || undefined })} className="h-8" data-testid="input-spot-dod" />
        </div>
      </div>
      {age != null && (
        <p className="text-[10px] text-muted-foreground -mt-2">
          Age at passing: <strong className="text-foreground">{age}</strong>
        </p>
      )}

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Headstone photos</Label>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {images.length} / {MAX_HEADSTONE_IMAGES}
          </span>
        </div>
        {images.length > 0 && (
          <div className="mt-1 grid grid-cols-3 gap-1.5" data-testid="headstone-gallery">
            {images.map((src, i) => (
              <div
                key={`${i}-${src.length}`}
                className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted group"
              >
                <img src={src} alt={`Headstone ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveHeadstone(i)}
                  aria-label={`Remove headstone photo ${i + 1}`}
                  data-testid={`remove-headstone-${i}`}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shadow-sm hover:bg-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] text-center py-0.5 leading-none">
                  {i === 0 ? "Primary" : `Photo ${i + 1}`}
                </div>
              </div>
            ))}
          </div>
        )}
        <Button
          size="sm" variant="outline"
          className="w-full mt-1.5"
          onClick={onUploadHeadstone}
          disabled={!canAddMore}
          data-testid="upload-headstone"
        >
          <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
          {images.length === 0 ? "Upload headstone photos" : canAddMore ? "Add more photos" : "Maximum reached"}
        </Button>
        {images.length === 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            You can upload several photos at once — front, back, inscription close-up, etc.
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1.5"><MapPinIcon className="h-3 w-3" /> Location coordinates</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Latitude</Label>
            <Input
              type="number" step="any"
              value={spot.lat ?? ""}
              onChange={(e) => onChange({ lat: e.target.value === "" ? undefined : +e.target.value })}
              placeholder="51.5874"
              className="h-8 text-xs" data-testid="input-spot-lat"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Longitude</Label>
            <Input
              type="number" step="any"
              value={spot.lon ?? ""}
              onChange={(e) => onChange({ lon: e.target.value === "" ? undefined : +e.target.value })}
              placeholder="-2.9984"
              className="h-8 text-xs" data-testid="input-spot-lon"
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">Map position: {Math.round(spot.x)}, {Math.round(spot.y)} (auto)</p>
      </div>

      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={spot.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Service unit, ceremony notes, etc."
          rows={3}
          className="text-xs"
          data-testid="input-spot-notes"
        />
      </div>

      {(spot.gprX !== undefined || spot.sourceCsv || spot.imageFileName || spot.aiConfidence !== undefined) && (
        <div className="rounded-md border border-border bg-muted/20 p-2 text-[10px] text-muted-foreground">
          <div className="mb-1 font-semibold uppercase tracking-wider text-foreground">Admin import data</div>
          {spot.gprX !== undefined && spot.gprY !== undefined && (
            <div>GPR X/Y/Z: {spot.gprX}, {spot.gprY}{spot.gprZ !== undefined ? `, ${spot.gprZ}` : ""}</div>
          )}
          {spot.accuracy !== undefined && <div>Accuracy: {spot.accuracy}</div>}
          {spot.sourceCsv && <div>Source CSV: {spot.sourceCsv}</div>}
          {spot.imageFileName && <div>Image file: {spot.imageFileName}</div>}
          {spot.veteranStatus && <div>Veteran: {spot.veteranStatus}</div>}
          {spot.aiConfidence !== undefined && <div>AI confidence: {Math.round(spot.aiConfidence * 100)}%</div>}
        </div>
      )}

      <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive border-destructive/30" onClick={onDelete} data-testid="delete-spot">
        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete spot
      </Button>
    </div>
  );
}

function ToolButton({ active, onClick, icon: Icon, label, testId, iconOnly }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; testId?: string; iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        title={label}
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-md border transition-colors",
          active ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-background hover:bg-muted",
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-md border p-2 text-[10px] font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <div className="flex items-center gap-1.5">
        {color && <div className="h-2 w-2 rounded-full" style={{ background: color }} />}
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function isLightFill(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

// Sample seeds (positions tuned for the St. Woolos sample map)
const SAMPLE_PLOTS = (): Plot[] => ([
  { id: newId("p"), typeId: "RC", label: "RC-A1", status: "available", x: 220, y: 230, w: 60, h: 30 },
  { id: newId("p"), typeId: "RC", label: "RC-A2", status: "occupied",  x: 285, y: 230, w: 60, h: 30 },
  { id: newId("p"), typeId: "RC", label: "RC-A3", status: "reserved",  x: 350, y: 230, w: 60, h: 30 },
  { id: newId("p"), typeId: "CON",label: "C-12",  status: "available", x: 480, y: 305, w: 55, h: 28 },
  { id: newId("p"), typeId: "CON",label: "C-13",  status: "occupied",  x: 540, y: 305, w: 55, h: 28 },
  { id: newId("p"), typeId: "FC", label: "FC-7",  status: "available", x: 600, y: 380, w: 50, h: 28 },
  { id: newId("p"), typeId: "MU", label: "MU-1",  status: "reserved",  x: 145, y: 340, w: 45, h: 28 },
  { id: newId("p"), typeId: "BUILDING", label: "Office", status: "occupied", x: 800, y: 365, w: 45, h: 22 },
]);

const SAMPLE_SPOTS = (): BurialSpot[] => ([
  { id: newId("s"), x: 250, y: 245, name: "John A. Phillips",      dob: "1942-03-12", dod: "2018-11-04", spotTypeId: "veteran-army" },
  { id: newId("s"), x: 510, y: 320, name: "Mary E. O'Connor",      dob: "1935-06-21", dod: "2021-02-18", spotTypeId: "civilian", notes: "Plot purchased 1990." },
  { id: newId("s"), x: 568, y: 320, name: "Father Daniel McKenna", dob: "1928-09-03", dod: "2009-12-10", spotTypeId: "clergy" },
  { id: newId("s"), x: 625, y: 393, name: "Lt. Sarah Greene",      dob: "1981-07-30", dod: "2014-08-22", spotTypeId: "veteran-navy" },
]);
