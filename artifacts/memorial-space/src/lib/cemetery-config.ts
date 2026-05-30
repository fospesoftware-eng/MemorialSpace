import { useCallback, useEffect, useState } from "react";
import { Cross, Star, Heart, Shield, Flower2, Flag, Award, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The geometry a plot type is drawn with by default. Users pick a shape
 * per plot type in Cemetery Setup; clicking that type in the Map Maker's
 * palette auto-switches the canvas tool to match.
 *
 *   - "rect"    — drag-to-create axis-aligned rectangle (the original behaviour)
 *   - "circle"  — drag-from-center to define radius
 *   - "polygon" — click-to-place vertices forming a closed filled shape
 *   - "path"    — click-to-place flexible polyline (roads, paths, bridges)
 *
 * The user can still pick any tool manually from the toolbar; the default
 * is purely a convenience for the most common shape per type.
 */
export type PlotShape = "rect" | "circle" | "polygon" | "path";

export interface PlotType {
  id: string;
  code: string;
  name: string;
  fill: string;
  stroke: string;
  description?: string;
  /**
   * Default drawing shape used when the user picks this type from the
   * palette. Optional so older saved configs (which predate this field)
   * keep working — the Map Maker treats `undefined` as "rect".
   */
  defaultShape?: PlotShape;
}

export type SpotIconKey = "cross" | "star" | "heart" | "shield" | "flower" | "flag" | "award" | "circle";

export const SPOT_ICONS: Record<SpotIconKey, LucideIcon> = {
  cross:  Cross,
  star:   Star,
  heart:  Heart,
  shield: Shield,
  flower: Flower2,
  flag:   Flag,
  award:  Award,
  circle: Circle,
};

export const SPOT_ICON_KEYS: SpotIconKey[] = ["cross", "star", "heart", "shield", "flower", "flag", "award", "circle"];

export interface SpotType {
  id: string;
  name: string;
  color: string;
  icon: SpotIconKey;
}

export interface BackgroundEntry {
  id: string;
  name: string;
  image: string;
  imgWidth: number;
  imgHeight: number;
  addedAt: number;
}

export interface BurialSpot {
  id: string;
  x: number;
  y: number;
  name: string;
  dob?: string;
  dod?: string;
  spotTypeId: string;
  /**
   * Headstone photographs (front, back, inscription close-up, surrounding
   * area, etc.). Stored as downscaled data URLs. The legacy single-image
   * field `headstoneImage` is migrated into the first slot of this array
   * by `migrateDoc()` so older saved maps continue to work.
   */
  headstoneImages?: string[];
  lat?: number;
  lon?: number;
  notes?: string;
  /** AI-detected symbol category (e.g. sign, handicap, manhole, utility, legend, tree, bench). */
  symbolType?: string;
  temporaryId?: string;
  gprX?: number;
  gprY?: number;
  gprZ?: number;
  accuracy?: number;
  sourceCsv?: string;
  imageFileName?: string;
  imagePath?: string;
  veteranStatus?: string;
  aiConfidence?: number;
  reviewStatus?: "gpr_imported" | "burial_matched" | "image_attached" | "ai_processed" | "needs_review" | "verified" | "published";
  importFlags?: Array<
    | "GPR Imported"
    | "Burial Data Matched"
    | "Image Attached"
    | "AI Processed"
    | "Needs Review"
    | "Verified"
    | "Published"
  >;
  aiData?: {
    name?: string;
    dob?: string;
    dod?: string;
    inscription?: string;
    veteranMarker?: string;
  };
}

/** Hard cap so a single spot can't grow without bound and bust localStorage. */
export const MAX_HEADSTONE_IMAGES = 8;

export const DEFAULT_PLOT_TYPES: PlotType[] = [
  // ---- Burial sections ---- (rectangular by default)
  { id: "RC",         code: "RC",   name: "Roman Catholic",  fill: "#a8d5d2", stroke: "#5a9290", description: "Catholic section",                              defaultShape: "rect" },
  { id: "CON",        code: "CON",  name: "Consecrated",     fill: "#6ba5a3", stroke: "#3d7572", description: "Consecrated ground",                            defaultShape: "rect" },
  { id: "FC",         code: "FC",   name: "Free Church",     fill: "#3d6b6a", stroke: "#244442", description: "Non-denominational",                            defaultShape: "rect" },
  { id: "MU",         code: "MU",   name: "Muslim",          fill: "#8b9bbf", stroke: "#5a6a8c", description: "Muslim section",                                defaultShape: "rect" },
  // ---- Infrastructure / map features ----
  // Sensible per-type shape defaults — paths/bridges are flexible polylines,
  // water bodies and gardens are circles, the rest are rectangles. Users
  // can override every one of these in Cemetery Setup.
  { id: "PATH",       code: "PATH", name: "Path / Road",     fill: "#d1d5db", stroke: "#9ca3af", description: "Walkway or vehicle road",                       defaultShape: "path" },
  { id: "BUILDING",   code: "BLD",  name: "Building",        fill: "#475569", stroke: "#1e293b", description: "Office, chapel, admin",                         defaultShape: "rect" },
  { id: "COLUMBARIUM",code: "COL",  name: "Columbarium",     fill: "#c4b5fd", stroke: "#6d28d9", description: "Cremation niche structure",                     defaultShape: "rect" },
  { id: "MAUSOLEUM",  code: "MAU",  name: "Mausoleum",       fill: "#94a3b8", stroke: "#334155", description: "Above-ground tomb structure",                   defaultShape: "rect" },
  { id: "WATER",      code: "WTR",  name: "Lake / Water",    fill: "#93c5fd", stroke: "#1d4ed8", description: "Pond, lake, stream or other water body",        defaultShape: "circle" },
  { id: "BRIDGE",     code: "BR",   name: "Bridge",          fill: "#c8a97e", stroke: "#8a6d3b", description: "Pedestrian or vehicle bridge",                  defaultShape: "path" },
  { id: "GARDEN",     code: "GDN",  name: "Garden / Trees",  fill: "#86efac", stroke: "#15803d", description: "Landscaping, lawn, tree area",                  defaultShape: "circle" },
  { id: "PARKING",    code: "PRK",  name: "Parking",         fill: "#d6d3d1", stroke: "#78716c", description: "Visitor parking area",                          defaultShape: "rect" },
  { id: "GATE",       code: "GT",   name: "Gate / Entrance", fill: "#fde68a", stroke: "#a16207", description: "Cemetery entrance or gate",                     defaultShape: "rect" },
];

export const DEFAULT_SPOT_TYPES: SpotType[] = [
  { id: "civilian",         name: "Civilian",                color: "#64748b", icon: "cross" },
  { id: "veteran-army",     name: "Veteran — US Army",       color: "#4d7c0f", icon: "star" },
  { id: "veteran-navy",     name: "Veteran — US Navy",       color: "#1e40af", icon: "star" },
  { id: "veteran-marines",  name: "Veteran — US Marines",    color: "#b91c1c", icon: "star" },
  { id: "veteran-airforce", name: "Veteran — US Air Force",  color: "#0284c7", icon: "star" },
  { id: "child",            name: "Child",                   color: "#db2777", icon: "heart" },
  { id: "clergy",           name: "Clergy",                  color: "#7c3aed", icon: "cross" },
  { id: "first-responder",  name: "First Responder",         color: "#ea580c", icon: "shield" },
];

export const FALLBACK_PLOT_TYPE: PlotType = {
  id: "_unknown", code: "?", name: "Unknown", fill: "#9ca3af", stroke: "#4b5563",
};
export const FALLBACK_SPOT_TYPE: SpotType = {
  id: "_unknown", name: "Unknown", color: "#6b7280", icon: "circle",
};

export const STATUS_COLORS = {
  available: "#22c55e",
  reserved:  "#eab308",
  occupied:  "#ef4444",
} as const;

export type PlotStatus = keyof typeof STATUS_COLORS;

export const PLOT_TYPES_KEY = "memorialspace.plot-types";
export const SPOT_TYPES_KEY = "memorialspace.spot-types";
export const BACKGROUNDS_KEY = "memorialspace.bg-library";
export const BACKGROUND_LIBRARY_LIMIT = 6;

// One-shot merge marker for plot-type defaults. When we ship NEW default
// plot types, add a new entry to PLOT_TYPE_MIGRATIONS keyed by the next
// integer version, and bump PLOT_TYPES_SEED_VERSION to match. On first
// load after the bump, only the ids introduced in versions
// (storedSeed, PLOT_TYPES_SEED_VERSION] get merged into the user's stored
// list — so we never resurrect a default the user deleted in an earlier
// release, and we never clobber customisations to existing entries.
export const PLOT_TYPES_SEED_KEY = "memorialspace.plot-types.seed-version";
export const PLOT_TYPES_SEED_VERSION = 2;

// Ids introduced at each seed version. v1 is the original 6 (RC, CON, FC,
// MU, PATH, BUILDING) and is intentionally absent: a brand-new install
// already gets all defaults via the useStored fallback, and an existing
// install at seed=1 that's missing one of these legacy ids deleted it on
// purpose.
export const PLOT_TYPE_MIGRATIONS: Record<number, readonly string[]> = {
  2: ["COLUMBARIUM", "MAUSOLEUM", "WATER", "BRIDGE", "GARDEN", "PARKING", "GATE"],
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(`stored:${key}`));
}

export function useStored<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void, Error | null] {
  const [value, setValue] = useState<T>(() => readJSON(key, fallback));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const onChange = () => setValue(readJSON(key, fallback));
    window.addEventListener("storage", onChange);
    window.addEventListener(`stored:${key}`, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(`stored:${key}`, onChange);
    };
    // fallback intentionally excluded: callers must pass a stable ref (module-level constant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStored = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        writeJSON(key, v);
        setError(null);
        return v;
      } catch (err) {
        // Persistence failed (most often QuotaExceededError). Keep in-memory
        // state in sync with disk so the UI doesn't claim a save succeeded.
        setError(err instanceof Error ? err : new Error(String(err)));
        return prev;
      }
    });
  }, [key]);

  return [value, setStored, error];
}

export function usePlotTypes() {
  const result = useStored<PlotType[]>(PLOT_TYPES_KEY, DEFAULT_PLOT_TYPES);
  const [, setStored] = result;

  // Merge ONLY the ids introduced in each version > storedSeed, exactly
  // once per release that bumps PLOT_TYPES_SEED_VERSION. Uses a functional
  // setter so concurrent mounts (map-maker + ai-map-maker + cemetery setup
  // page can all mount this hook) can't clobber each other's updates with
  // stale captured state.
  useEffect(() => {
    let storedSeed = 1;
    try {
      const raw = localStorage.getItem(PLOT_TYPES_SEED_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed)) storedSeed = parsed;
      }
    } catch {
      /* localStorage unavailable — skip migration */
      return;
    }
    if (storedSeed >= PLOT_TYPES_SEED_VERSION) return;

    // Collect all ids added in versions (storedSeed, PLOT_TYPES_SEED_VERSION].
    // Defaults removed from DEFAULT_PLOT_TYPES are NOT resurrected because
    // the migration uses an explicit id list per version, not the full
    // default catalogue.
    const idsToAdd: string[] = [];
    for (let v = storedSeed + 1; v <= PLOT_TYPES_SEED_VERSION; v++) {
      const ids = PLOT_TYPE_MIGRATIONS[v];
      if (ids) idsToAdd.push(...ids);
    }
    if (idsToAdd.length === 0) {
      try { localStorage.setItem(PLOT_TYPES_SEED_KEY, String(PLOT_TYPES_SEED_VERSION)); } catch { /* ignore */ }
      return;
    }

    setStored((prev) => {
      const have = new Set(prev.map((t) => t.id));
      const additions: PlotType[] = [];
      for (const id of idsToAdd) {
        if (have.has(id)) continue;
        const def = DEFAULT_PLOT_TYPES.find((t) => t.id === id);
        if (def) additions.push(def);
      }
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
    // Bump the seed marker only after we've issued the merge. The setter
    // above is async; if persistence later fails, the worst case is we
    // re-run an idempotent no-op merge on the next load.
    try {
      localStorage.setItem(PLOT_TYPES_SEED_KEY, String(PLOT_TYPES_SEED_VERSION));
    } catch {
      /* ignore */
    }
    // Run once on mount; merging is a one-shot per seed version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return result;
}
export function useSpotTypes() {
  return useStored<SpotType[]>(SPOT_TYPES_KEY, DEFAULT_SPOT_TYPES);
}
export function useBackgrounds() {
  return useStored<BackgroundEntry[]>(BACKGROUNDS_KEY, []);
}

export function newId(prefix = "x"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export interface DownscaledImage { data: string; width: number; height: number }

export function downscaleImage(dataUrl: string, maxWidth: number, quality = 0.82): Promise<DownscaledImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
      const w = Math.max(1, Math.round(img.naturalWidth * ratio));
      const h = Math.max(1, Math.round(img.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D context unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      let out: string;
      try {
        out = canvas.toDataURL("image/webp", quality);
        // Some browsers fall back to PNG silently if webp not supported
        if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", quality);
      } catch {
        out = canvas.toDataURL("image/jpeg", quality);
      }
      resolve({ data: out, width: w, height: h });
    };
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = dataUrl;
  });
}

export function calcAge(dob?: string, dod?: string): number | null {
  if (!dob) return null;
  const start = new Date(dob);
  const end = dod ? new Date(dod) : new Date();
  if (isNaN(start.valueOf()) || isNaN(end.valueOf())) return null;
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}
