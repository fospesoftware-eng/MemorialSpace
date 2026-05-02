import { useState, useRef, useEffect, useMemo, useCallback, type PointerEvent as ReactPointerEvent, type ChangeEvent } from "react";
import {
  Upload, MousePointer2, Square, Trash2, Save, Download, Image as ImageIcon,
  Box, Layers, Eye, EyeOff, FolderOpen, FileImage, Plus, Hand,
  ZoomIn, ZoomOut, RotateCcw, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type PlotType = "RC" | "CON" | "FC" | "MU" | "PATH" | "BUILDING";
type PlotStatus = "available" | "reserved" | "occupied";
type Tool = "select" | "draw" | "pan";
type View = "2d" | "3d";

interface Plot {
  id: string;
  type: PlotType;
  label: string;
  status: PlotStatus;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MapDoc {
  name: string;
  image: string | null;
  imgWidth: number;
  imgHeight: number;
  plots: Plot[];
  updatedAt: number;
}

const PLOT_TYPES: Record<PlotType, { label: string; fill: string; stroke: string; description: string }> = {
  RC:       { label: "Roman Catholic", fill: "#a8d5d2", stroke: "#5a9290", description: "Catholic section" },
  CON:      { label: "Consecrated",     fill: "#6ba5a3", stroke: "#3d7572", description: "Consecrated ground" },
  FC:       { label: "Free Church",     fill: "#3d6b6a", stroke: "#244442", description: "Non-denominational" },
  MU:       { label: "Muslim",          fill: "#8b9bbf", stroke: "#5a6a8c", description: "Muslim section" },
  PATH:     { label: "Path / Road",     fill: "#d1d5db", stroke: "#9ca3af", description: "Walkway or road" },
  BUILDING: { label: "Building",        fill: "#475569", stroke: "#1e293b", description: "Office, chapel, etc." },
};

const STATUS_COLORS: Record<PlotStatus, string> = {
  available: "#22c55e",
  reserved:  "#eab308",
  occupied:  "#ef4444",
};

const STORAGE_KEY = "memorialspace.map-maker";
const SAMPLE_MAP_URL = "/sample-cemetery-map.webp";
const DEFAULT_DOC: MapDoc = {
  name: "Untitled Cemetery Map",
  image: null,
  imgWidth: 1200,
  imgHeight: 800,
  plots: [],
  updatedAt: Date.now(),
};

const newId = () => `p_${Math.random().toString(36).slice(2, 9)}`;

export default function MapMaker() {
  const [doc, setDoc] = useState<MapDoc>(DEFAULT_DOC);
  const [tool, setTool] = useState<Tool>("select");
  const [activeType, setActiveType] = useState<PlotType>("CON");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("2d");
  const [tilt, setTilt] = useState(55);
  const [zoom, setZoom] = useState(1);
  const [showImage, setShowImage] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [draftRect, setDraftRect] = useState<Plot | null>(null);
  const [savedMaps, setSavedMaps] = useState<{ key: string; name: string; updatedAt: number }[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragState = useRef<{ mode: "create" | "move" | "resize"; id?: string; offsetX?: number; offsetY?: number; anchorX?: number; anchorY?: number } | null>(null);
  const draftRectRef = useRef<Plot | null>(null);
  const viewRef = useRef<View>("2d");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { viewRef.current = view; }, [view]);

  // Cancel any active drag on view/tool change to avoid mid-drag inconsistencies
  useEffect(() => {
    if (dragState.current) {
      dragState.current = null;
      draftRectRef.current = null;
      setDraftRect(null);
    }
  }, [view, tool]);

  const selected = useMemo(() => doc.plots.find((p) => p.id === selectedId) ?? null, [doc.plots, selectedId]);

  // Refresh saved maps list
  const refreshSaved = useCallback(() => {
    const list: { key: string; name: string; updatedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${STORAGE_KEY}:`)) {
        try {
          const m = JSON.parse(localStorage.getItem(k)!) as MapDoc;
          list.push({ key: k, name: m.name, updatedAt: m.updatedAt });
        } catch {}
      }
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    setSavedMaps(list);
  }, []);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  // Convert client coords → SVG image coords
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

  // Pointer events on the SVG canvas
  const onCanvasPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (view === "3d") return;
    const target = e.target as SVGElement;
    const isPlotEl = target.dataset.plot === "true";
    const isResizeEl = target.dataset.resize === "true";
    const { x, y } = toSvgPoint(e);

    if (tool === "draw" && !isPlotEl && !isResizeEl) {
      const id = newId();
      const draft: Plot = {
        id, type: activeType, label: "", status: "available",
        x, y, w: 0, h: 0,
      };
      draftRectRef.current = draft;
      setDraftRect(draft);
      dragState.current = { mode: "create", id, anchorX: x, anchorY: y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "select") {
      if (isResizeEl && selectedId) {
        dragState.current = { mode: "resize", id: selectedId, anchorX: x, anchorY: y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
      if (isPlotEl) {
        const id = target.dataset.plotId!;
        setSelectedId(id);
        const plot = doc.plots.find((p) => p.id === id);
        if (plot) {
          dragState.current = { mode: "move", id, offsetX: x - plot.x, offsetY: y - plot.y };
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        }
        return;
      }
      // empty area
      setSelectedId(null);
    }
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragState.current || viewRef.current === "3d") return;
    const { x, y } = toSvgPoint(e);
    const ds = dragState.current;

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

    if (ds.mode === "move" && ds.id) {
      setDoc((d) => ({
        ...d,
        plots: d.plots.map((p) =>
          p.id === ds.id ? { ...p, x: x - ds.offsetX!, y: y - ds.offsetY! } : p
        ),
      }));
    }

    if (ds.mode === "resize" && ds.id) {
      setDoc((d) => ({
        ...d,
        plots: d.plots.map((p) => {
          if (p.id !== ds.id) return p;
          const w = Math.max(8, x - p.x);
          const h = Math.max(8, y - p.y);
          return { ...p, w, h };
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
      // Compute final geometry from ref (avoids React state race) and current pointer
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
        setSelectedId(finalPlot.id);
        setTool("select");
      }
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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        setDoc((d) => ({ ...d, plots: d.plots.filter((p) => p.id !== selectedId), updatedAt: Date.now() }));
        setSelectedId(null);
      }
      if (e.key === "Escape") setSelectedId(null);
      const k = e.key.toLowerCase();
      if (k === "v") setTool("select");
      if (k === "r") setTool("draw");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  // Image upload (background)
  const onUploadImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setDoc((d) => ({ ...d, image: dataUrl, imgWidth: img.naturalWidth, imgHeight: img.naturalHeight }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const loadSample = async () => {
    try {
      const res = await fetch(SAMPLE_MAP_URL);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          setDoc({
            name: "St. Woolos Cemetery — Sample",
            image: dataUrl,
            imgWidth: img.naturalWidth,
            imgHeight: img.naturalHeight,
            plots: SAMPLE_PLOTS,
            updatedAt: Date.now(),
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to load sample", err);
    }
  };

  // Save / load
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
      // QuotaExceededError or similar — usually due to large embedded image
      const msg = err instanceof DOMException && err.name === "QuotaExceededError"
        ? "Storage full — image is too large. Try removing the background image before saving, or save without it."
        : "Failed to save map locally. Try removing the background image and saving again.";
      setSaveError(msg);
      // auto-dismiss after a few seconds
      setTimeout(() => setSaveError(null), 6000);
    }
  };

  const load = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const m = JSON.parse(raw) as MapDoc;
      setDoc(m);
      setSelectedId(null);
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

  const updateSelected = (patch: Partial<Plot>) => {
    if (!selectedId) return;
    setDoc((d) => ({ ...d, plots: d.plots.map((p) => p.id === selectedId ? { ...p, ...patch } : p), updatedAt: Date.now() }));
  };

  const counts = useMemo(() => {
    const out: Record<PlotType, number> & { total: number; available: number; reserved: number; occupied: number } = {
      RC: 0, CON: 0, FC: 0, MU: 0, PATH: 0, BUILDING: 0,
      total: doc.plots.length, available: 0, reserved: 0, occupied: 0,
    };
    for (const p of doc.plots) {
      out[p.type] += 1;
      out[p.status] += 1;
    }
    return out;
  }, [doc.plots]);

  const cursorClass = tool === "draw" ? "cursor-crosshair" : "cursor-default";

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 h-[calc(100vh-0rem)] flex flex-col bg-background">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 h-14 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Input
              value={doc.name}
              onChange={(e) => setDoc((d) => ({ ...d, name: e.target.value }))}
              className="h-7 w-64 text-sm font-semibold border-transparent bg-transparent focus:bg-background focus:border-input px-2"
              data-testid="input-map-name"
            />
            <div className="text-[10px] text-muted-foreground px-2">{counts.total} plots · saved {timeAgo(doc.updatedAt)}</div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-1">
          <Button size="sm" variant={view === "2d" ? "default" : "outline"} onClick={() => setView("2d")} data-testid="view-2d">
            <Square className="h-3.5 w-3.5 mr-1.5" /> 2D
          </Button>
          <Button size="sm" variant={view === "3d" ? "default" : "outline"} onClick={() => setView("3d")} data-testid="view-3d">
            <Box className="h-3.5 w-3.5 mr-1.5" /> 3D
          </Button>
        </div>

        {view === "3d" && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted">
            <Label className="text-xs text-muted-foreground">Tilt</Label>
            <Slider value={[tilt]} onValueChange={([v]) => setTilt(v)} min={20} max={75} step={1} className="w-32" />
            <span className="text-xs tabular-nums text-muted-foreground w-8">{tilt}°</span>
          </div>
        )}

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} data-testid="zoom-out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} data-testid="zoom-in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setZoom(1)} title="Reset zoom">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1" />

        <Button size="sm" variant="ghost" onClick={() => setShowImage((v) => !v)} data-testid="toggle-image">
          {showImage ? <Eye className="h-3.5 w-3.5 mr-1.5" /> : <EyeOff className="h-3.5 w-3.5 mr-1.5" />}
          Image
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowLabels((v) => !v)}>
          {showLabels ? <Eye className="h-3.5 w-3.5 mr-1.5" /> : <EyeOff className="h-3.5 w-3.5 mr-1.5" />}
          Labels
        </Button>
        <Separator orientation="vertical" className="h-8" />
        <Button size="sm" variant="outline" onClick={exportJson} data-testid="export-json">
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export
        </Button>
        <Button size="sm" onClick={save} data-testid="save-map">
          <Save className="h-3.5 w-3.5 mr-1.5" /> Save
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: Tools + Plot palette */}
        <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Tool</div>
            <div className="grid grid-cols-2 gap-1">
              <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Select" testId="tool-select" />
              <ToolButton active={tool === "draw"} onClick={() => setTool("draw")} icon={Square} label="Draw" testId="tool-draw" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {tool === "draw" ? "Drag on the canvas to place a plot." : "Click a plot to edit. Drag to move."}
            </p>
          </div>

          <div className="p-3 border-b border-border">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Plot Type</div>
            <div className="space-y-1">
              {(Object.keys(PLOT_TYPES) as PlotType[]).map((t) => {
                const meta = PLOT_TYPES[t];
                const isActive = activeType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setActiveType(t); setTool("draw"); }}
                    data-testid={`palette-${t}`}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                      isActive ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
                    )}
                  >
                    <div
                      className="h-5 w-5 shrink-0 rounded border"
                      style={{ background: meta.fill, borderColor: meta.stroke }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight">{t}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight truncate">{meta.label}</div>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{counts[t]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3">
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
        </aside>

        {/* Center: Canvas */}
        <div className="flex-1 min-w-0 relative bg-[radial-gradient(circle_at_50%_50%,hsl(var(--muted))_0,hsl(var(--background))_70%)] overflow-hidden">
          {/* Empty state */}
          {!doc.image && doc.plots.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center max-w-sm pointer-events-auto">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                  <FileImage className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Start your cemetery map</h3>
                <p className="text-sm text-muted-foreground mb-4">Upload a map image as a base layer, or start fresh by drawing plots on the grid.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload image
                  </Button>
                  <Button size="sm" variant="outline" onClick={loadSample}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Try sample
                  </Button>
                </div>
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
                  data-testid="map-canvas"
                >
                  {/* Grid for empty canvas */}
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

                  {/* 3D depth shadows - render before plots so they sit underneath */}
                  {view === "3d" && doc.plots.map((p) => (
                    <rect
                      key={`shadow-${p.id}`}
                      x={p.x + 4} y={p.y + 4}
                      width={p.w} height={p.h}
                      fill="rgba(0,0,0,0.35)"
                      pointerEvents="none"
                    />
                  ))}

                  {/* Plots */}
                  {doc.plots.map((p) => {
                    const meta = PLOT_TYPES[p.type];
                    const isSel = p.id === selectedId;
                    return (
                      <g key={p.id}>
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
                        />
                        {/* status indicator dot */}
                        {p.w > 12 && p.h > 12 && (
                          <circle
                            cx={p.x + p.w - 6} cy={p.y + 6} r={3}
                            fill={STATUS_COLORS[p.status]}
                            pointerEvents="none"
                          />
                        )}
                        {showLabels && p.w > 24 && p.h > 14 && (
                          <text
                            x={p.x + p.w / 2}
                            y={p.y + p.h / 2 + 3}
                            textAnchor="middle"
                            fontSize={Math.min(11, p.h * 0.45)}
                            fontWeight={600}
                            fill={isLightFill(meta.fill) ? "#1f2937" : "#ffffff"}
                            pointerEvents="none"
                          >
                            {p.label || p.type}
                          </text>
                        )}
                        {/* Resize handle on selected */}
                        {isSel && (
                          <rect
                            data-resize="true"
                            x={p.x + p.w - 5} y={p.y + p.h - 5}
                            width={10} height={10}
                            fill="#0ea5e9"
                            stroke="#fff"
                            strokeWidth={1.5}
                            className="cursor-nwse-resize"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Draft rectangle while drawing */}
                  {draftRect && (
                    <rect
                      x={draftRect.x} y={draftRect.y}
                      width={draftRect.w} height={draftRect.h}
                      fill={PLOT_TYPES[draftRect.type].fill}
                      fillOpacity={0.5}
                      stroke={PLOT_TYPES[draftRect.type].stroke}
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />
                  )}
                </svg>
              </div>
            </div>
          </ScrollArea>

          {/* Status bar */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-muted-foreground bg-background/90 backdrop-blur border border-border rounded px-2 py-1 pointer-events-none">
            <Hand className="h-3 w-3" />
            <span>Hotkeys: <kbd className="px-1 bg-muted rounded">V</kbd> Select · <kbd className="px-1 bg-muted rounded">R</kbd> Draw · <kbd className="px-1 bg-muted rounded">⌫</kbd> Delete</span>
          </div>

          {/* Save error toast */}
          {saveError && (
            <div
              role="alert"
              data-testid="save-error"
              className="absolute top-3 right-3 max-w-sm flex items-start gap-2 bg-destructive text-destructive-foreground border border-destructive rounded-md px-3 py-2 shadow-lg"
            >
              <Trash2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-snug">{saveError}</div>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="text-destructive-foreground/80 hover:text-destructive-foreground text-xs ml-1 -mr-1"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Right: Properties + saved maps */}
        <aside className="w-72 shrink-0 border-l border-border bg-card flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Selected Plot</div>
              {selected ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={selected.label}
                      onChange={(e) => updateSelected({ label: e.target.value })}
                      placeholder={selected.type}
                      className="h-8"
                      data-testid="input-plot-label"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={selected.type} onValueChange={(v) => updateSelected({ type: v as PlotType })}>
                      <SelectTrigger className="h-8" data-testid="select-plot-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PLOT_TYPES) as PlotType[]).map((t) => (
                          <SelectItem key={t} value={t}>
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-sm" style={{ background: PLOT_TYPES[t].fill }} />
                              <span>{t} · {PLOT_TYPES[t].label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={selected.status} onValueChange={(v) => updateSelected({ status: v as PlotStatus })}>
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Width</Label>
                      <Input type="number" value={Math.round(selected.w)} onChange={(e) => updateSelected({ w: Math.max(8, +e.target.value) })} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Height</Label>
                      <Input type="number" value={Math.round(selected.h)} onChange={(e) => updateSelected({ h: Math.max(8, +e.target.value) })} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">X</Label>
                      <Input type="number" value={Math.round(selected.x)} onChange={(e) => updateSelected({ x: +e.target.value })} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Y</Label>
                      <Input type="number" value={Math.round(selected.y)} onChange={(e) => updateSelected({ y: +e.target.value })} className="h-8" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive border-destructive/30"
                    onClick={() => {
                      setDoc((d) => ({ ...d, plots: d.plots.filter((p) => p.id !== selected.id), updatedAt: Date.now() }));
                      setSelectedId(null);
                    }}
                    data-testid="delete-plot"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete plot
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Click a plot on the canvas to edit its properties, or pick a plot type and drag on the canvas to draw a new one.</p>
              )}
            </div>

            <div className="p-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Map Stats</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Plots" value={counts.total} />
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
                      <button
                        type="button"
                        onClick={() => load(m.key)}
                        data-testid={`load-${m.key}`}
                        className="flex-1 min-w-0 text-left"
                      >
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
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-3"
                onClick={() => {
                  setDoc(DEFAULT_DOC);
                  setSelectedId(null);
                }}
                data-testid="new-map"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New empty map
              </Button>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, icon: Icon, label, testId }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; testId?: string }) {
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
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // perceived luminance
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

// A few seed plots for the sample map (positions tuned for the St. Woolos sample image, ~1024x614)
const SAMPLE_PLOTS: Plot[] = [
  { id: newId(), type: "RC", label: "RC-A1", status: "available", x: 220, y: 230, w: 60, h: 30 },
  { id: newId(), type: "RC", label: "RC-A2", status: "occupied",  x: 285, y: 230, w: 60, h: 30 },
  { id: newId(), type: "RC", label: "RC-A3", status: "reserved",  x: 350, y: 230, w: 60, h: 30 },
  { id: newId(), type: "CON", label: "C-12", status: "available", x: 480, y: 305, w: 55, h: 28 },
  { id: newId(), type: "CON", label: "C-13", status: "occupied",  x: 540, y: 305, w: 55, h: 28 },
  { id: newId(), type: "FC", label: "FC-7", status: "available",  x: 600, y: 380, w: 50, h: 28 },
  { id: newId(), type: "MU", label: "MU-1", status: "reserved",   x: 145, y: 340, w: 45, h: 28 },
  { id: newId(), type: "BUILDING", label: "Office", status: "occupied", x: 800, y: 365, w: 45, h: 22 },
];
