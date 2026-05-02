import { useState, useRef, useEffect, useMemo, useCallback, type PointerEvent as ReactPointerEvent, type ChangeEvent, type DragEvent as ReactDragEvent } from "react";
import { Link } from "wouter";
import {
  Upload, MousePointer2, Square, Trash2, Save, Download, Image as ImageIcon,
  Box, Layers, Eye, EyeOff, FolderOpen, FileImage, Plus, Hand,
  ZoomIn, ZoomOut, RotateCcw, Sparkles, MapPin as MapPinIcon, X,
  Maximize2, Minimize2, ChevronLeft, ChevronRight, ArrowLeft, Maximize, Settings as SettingsIcon,
  Spline, Circle as CircleIcon, Hexagon,
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

type Tool = "select" | "draw" | "circle" | "polygon" | "path" | "spot" | "pan";

/** Map a plot type's `defaultShape` to the canvas tool that draws it. */
function shapeToTool(shape: PlotShape | undefined): Extract<Tool, "draw" | "circle" | "polygon" | "path"> {
  if (shape === "circle") return "circle";
  if (shape === "polygon") return "polygon";
  if (shape === "path") return "path";
  return "draw";
}
type View = "2d" | "3d";

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
}

interface MapDoc {
  name: string;
  image: string | null;
  imgWidth: number;
  imgHeight: number;
  plots: Plot[];
  spots: BurialSpot[];
  updatedAt: number;
}

type Selection = { kind: "plot"; id: string } | { kind: "spot"; id: string } | null;

const STORAGE_KEY = "memorialspace.map-maker";
const SAMPLE_MAP_URL = "/sample-cemetery-map.webp";
const DEFAULT_DOC: MapDoc = {
  name: "Untitled Cemetery Map",
  image: null,
  imgWidth: 1200,
  imgHeight: 800,
  plots: [],
  spots: [],
  updatedAt: Date.now(),
};

// Migrate plots that used `type` (old) to `typeId` (new). Tolerant of unknown shapes.
type LegacyPlot = { id?: string; type?: string; typeId?: string; label?: string; status?: string; x?: number; y?: number; w?: number; h?: number; points?: unknown };
type LegacySpot = Partial<BurialSpot>;
type LegacyDoc = { name?: string; image?: string | null; imgWidth?: number; imgHeight?: number; plots?: LegacyPlot[]; spots?: LegacySpot[]; updatedAt?: number };

const VALID_STATUS = new Set<PlotStatus>(["available", "reserved", "occupied"]);
const safeStatus = (s: unknown): PlotStatus => (typeof s === "string" && VALID_STATUS.has(s as PlotStatus) ? (s as PlotStatus) : "available");
const safeNum = (n: unknown, fallback: number): number => (typeof n === "number" && Number.isFinite(n) ? n : fallback);
const safeOptNum = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) ? n : undefined);
const safeStr = (s: unknown, fallback = ""): string => (typeof s === "string" ? s : fallback);
const safeOptStr = (s: unknown): string | undefined => (typeof s === "string" && s.length > 0 ? s : undefined);

function migrateDoc(raw: unknown): MapDoc {
  const d = (raw ?? {}) as LegacyDoc;
  return {
    name: safeStr(d.name, "Untitled Cemetery Map"),
    image: typeof d.image === "string" ? d.image : null,
    imgWidth:  safeNum(d.imgWidth,  1200),
    imgHeight: safeNum(d.imgHeight, 800),
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
      };
    }),
    updatedAt: safeNum(d.updatedAt, Date.now()),
  };
}

export default function MapMaker() {
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs / mode trackers
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  type DraftPath = { typeId: string; pathWidth: number; points: [number, number][]; closed: boolean };
  const draftPathRef = useRef<DraftPath | null>(null);
  const [draftPath, setDraftPath] = useState<DraftPath | null>(null);
  // Latest pointer position (SVG units) while the Path / Polygon tool is
  // active — used to draw a "rubber band" segment from the last vertex to
  // the cursor (and, for polygons, back to the first vertex to preview the
  // closing edge).
  const [pathCursor, setPathCursor] = useState<{ x: number; y: number } | null>(null);
  const viewRef = useRef<View>("2d");

  useEffect(() => { viewRef.current = view; }, [view]);

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
          list.push({ key: k, name: m.name ?? "(unnamed)", updatedAt: m.updatedAt ?? 0 });
        } catch {}
      }
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    setSavedMaps(list);
  }, []);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

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

    if (tool === "draw" && !isPlotEl && !isResizeEl && !isSpotEl) {
      if (!activePlotTypeId) return;
      const id = newId("p");
      const draft: Plot = {
        id, typeId: activePlotTypeId, label: "", status: "available",
        x, y, w: 0, h: 0,
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
    if (tool === "path" || tool === "polygon") {
      if (!activePlotTypeId) return;
      const closed = tool === "polygon";
      const cur = draftPathRef.current;
      if (!cur) {
        const next: DraftPath = { typeId: activePlotTypeId, pathWidth: DEFAULT_PATH_WIDTH, points: [[x, y] as [number, number]], closed };
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
    if ((tool === "path" || tool === "polygon") && draftPathRef.current) {
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
    const stillSameMode =
      (tool === "path"    && !cur.closed) ||
      (tool === "polygon" &&  cur.closed);
    if (!stillSameMode) {
      commitDraftPath({ switchToSelect: false });
    }
  }, [tool, commitDraftPath]);

  // Double-click on the canvas finishes the in-progress path or polygon.
  // Wired on the SVG element so the user can dblclick anywhere — including
  // on the last vertex they just placed — to signal "done".
  const onCanvasDoubleClick = () => {
    if ((tool === "path" || tool === "polygon") && draftPathRef.current) commitDraftPath();
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
      if (k === "r") setTool("draw");
      if (k === "c") setTool("circle");
      if (k === "g") setTool("polygon");
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
  const save = () => {
    const safeName = doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "untitled";
    const key = `${STORAGE_KEY}:${safeName}`;
    const toSave = { ...doc, updatedAt: Date.now() };
    try {
      localStorage.setItem(key, JSON.stringify(toSave));
      setDoc(toSave);
      setSaveError(null);
      refreshSaved();
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "QuotaExceededError"
        ? "Storage full — try removing the background image, removing headstone photos, or deleting older saved maps."
        : "Failed to save map locally. Try removing the background image and saving again.";
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

  const cursorClass =
    tool === "draw"    ? "cursor-crosshair" :
    tool === "circle"  ? "cursor-crosshair" :
    tool === "polygon" ? "cursor-crosshair" :
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
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 sm:px-3 h-14 shrink-0">
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
              value={doc.name}
              onChange={(e) => setDoc((d) => ({ ...d, name: e.target.value }))}
              className="h-7 w-40 sm:w-56 text-sm font-semibold border-transparent bg-transparent focus:bg-background focus:border-input px-2"
              data-testid="input-map-name"
            />
            <div className="text-[10px] text-muted-foreground px-2 hidden sm:block">
              {counts.totalPlots} plots · {counts.totalSpots} spots · saved {timeAgo(doc.updatedAt)}
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-7 hidden md:block" />

        {/* View 2D/3D */}
        <div className="hidden md:flex items-center gap-1">
          <Button size="sm" variant={view === "2d" ? "default" : "outline"} onClick={() => setView("2d")} data-testid="view-2d" className="h-8">
            <Square className="h-3.5 w-3.5 mr-1.5" /> 2D
          </Button>
          <Button size="sm" variant={view === "3d" ? "default" : "outline"} onClick={() => setView("3d")} data-testid="view-3d" className="h-8">
            <Box className="h-3.5 w-3.5 mr-1.5" /> 3D
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
            <ToolButton active={tool === "circle"} onClick={() => setTool("circle")} icon={CircleIcon}    label="Circle"  testId="tool-circle-mini" iconOnly />
            <ToolButton active={tool === "polygon"}onClick={() => setTool("polygon")}icon={Hexagon}       label="Polygon" testId="tool-polygon-mini" iconOnly />
            <ToolButton active={tool === "path"}   onClick={() => setTool("path")}   icon={Spline}        label="Path"   testId="tool-path-mini" iconOnly />
            <ToolButton active={tool === "spot"}   onClick={() => setTool("spot")}   icon={MapPinIcon}    label="Spot"   testId="tool-spot-mini" iconOnly />
            <ToolButton active={tool === "pan"}    onClick={() => setTool("pan")}    icon={Hand}          label="Pan"    testId="tool-pan-mini"  iconOnly />
            <Separator className="my-1 w-8" />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => fileInputRef.current?.click()} title="Upload background image">
              <Upload className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={loadSample} title="Load sample map">
              <Sparkles className="h-4 w-4" />
            </Button>
            <Link href="/cemetery-setup">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" title="Cemetery setup (types &amp; backgrounds)">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onUploadImage} className="hidden" data-testid="image-input" />
          </aside>
        ) : (
        <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Tool</div>
              <div className="grid grid-cols-2 gap-1">
                <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Select" testId="tool-select" />
                <ToolButton active={tool === "draw"}   onClick={() => setTool("draw")}   icon={Square}        label="Plot"   testId="tool-draw" />
                <ToolButton active={tool === "circle"} onClick={() => setTool("circle")} icon={CircleIcon}    label="Circle"  testId="tool-circle" />
                <ToolButton active={tool === "polygon"}onClick={() => setTool("polygon")}icon={Hexagon}       label="Polygon" testId="tool-polygon" />
                <ToolButton active={tool === "path"}   onClick={() => setTool("path")}   icon={Spline}        label="Path"   testId="tool-path" />
                <ToolButton active={tool === "spot"}   onClick={() => setTool("spot")}   icon={MapPinIcon}    label="Spot"   testId="tool-spot" />
                <ToolButton active={tool === "pan"}    onClick={() => setTool("pan")}    icon={Hand}          label="Pan"    testId="tool-pan" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {tool === "draw"   && "Drag on the canvas to place a plot."}
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

            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Background</div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onUploadImage} className="hidden" data-testid="image-input" />
              <Button size="sm" variant="outline" className="w-full mb-2" onClick={() => fileInputRef.current?.click()} data-testid="upload-image">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload map image
              </Button>
              <Button size="sm" variant="ghost" className="w-full" onClick={loadSample} data-testid="load-sample">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Load sample map
              </Button>
              {doc.image && (
                <Button size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive mt-1" onClick={() => setDoc((d) => ({ ...d, image: null }))}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove image
                </Button>
              )}
            </div>

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
                  Drag &amp; drop a map image here, or upload one as a base layer. Then draw plot sections and drop burial spots on top.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} data-testid="empty-upload-image">
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload image
                  </Button>
                  <Button size="sm" variant="outline" onClick={loadSample} data-testid="empty-load-sample">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Try sample
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
                            fill={meta.fill}
                            fillOpacity={doc.image ? 0.85 : 1}
                            stroke={isSel ? "#0ea5e9" : meta.stroke}
                            strokeWidth={isSel ? 2.5 : 1}
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
                            fill={meta.fill}
                            fillOpacity={doc.image ? 0.85 : 1}
                            stroke={isSel ? "#0ea5e9" : meta.stroke}
                            strokeWidth={isSel ? 2.5 : 1}
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
                        {showLabels && s.name && (
                          <text
                            x={s.x} y={s.y + r + 12}
                            textAnchor="middle" fontSize={11} fontWeight={600}
                            fill="#1f2937"
                            stroke="#ffffff" strokeWidth={3} paintOrder="stroke"
                            pointerEvents="none"
                          >
                            {s.name}
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
                      fill={getPlotType(draftRect.typeId).fill}
                      fillOpacity={0.5}
                      stroke={getPlotType(draftRect.typeId).stroke}
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
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
                      // user sees the shape, not just an outline.
                      const previewPoints = pathCursor ? [...placed, [pathCursor.x, pathCursor.y] as [number, number]] : placed;
                      const previewStr = previewPoints.map(([px, py]) => `${px},${py}`).join(" ");
                      return (
                        <g pointerEvents="none">
                          {previewPoints.length >= 3 && (
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
          <div className="text-[10px] text-muted-foreground truncate">{meta.name}{age != null ? ` · age ${age}` : ""}</div>
        </div>
      </div>

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
