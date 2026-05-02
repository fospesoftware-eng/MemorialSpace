import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Box, Plus, Square, ArrowLeft, Trash2, Upload, ImageOff, ChevronRight, Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & API helpers
// ---------------------------------------------------------------------------

// Demo tenant id (matches the rest of the B2B app, which is single-org for the
// demo). When real auth lands, swap this for the current user's org id.
const ORG_ID = 1;

type Niche = {
  id: number;
  columbariumId: number;
  row: number;
  col: number;
  occupantName: string | null;
  dob: string | null;
  dod: string | null;
  inscription: string | null;
  photoUrl: string | null;
  status: "available" | "reserved" | "occupied";
  notes: string | null;
  updatedAt: string;
};

type Columbarium = {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  rows: number;
  cols: number;
  createdAt: string;
  updatedAt: string;
};

type ColumbariumDetail = Columbarium & { niches: Niche[] };

const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Compress a File to a JPEG data URL no wider than `maxEdge` so we can store
// niche portraits inline without object storage. Stays comfortably under the
// 12MB JSON body limit even for chunky originals.
async function fileToCompressedDataUrl(file: File, maxEdge = 600, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file).catch(async () => {
    // Safari fallback via <img>.
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r, j) => { img.onload = r; img.onerror = j; });
    return img as unknown as ImageBitmap;
  });
  const w = (bmp as ImageBitmap).width ?? 0;
  const h = (bmp as ImageBitmap).height ?? 0;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(bmp as CanvasImageSource, 0, 0, tw, th);
  return canvas.toDataURL("image/jpeg", quality);
}

// ---------------------------------------------------------------------------
// Top-level router for /columbarium and /columbarium/:id
// ---------------------------------------------------------------------------

export default function ColumbariumModule() {
  const [matchDetail, params] = useRoute<{ id: string }>("/columbarium/:id");
  if (matchDetail && params?.id) {
    const id = Number(params.id);
    if (Number.isFinite(id)) return <ColumbariumDetailPage id={id} />;
  }
  return <ColumbariumListPage />;
}

// ---------------------------------------------------------------------------
// LIST: all walls for the current org
// ---------------------------------------------------------------------------

function ColumbariumListPage() {
  const queryClient = useQueryClient();
  const [, setLoc] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", rows: 8, cols: 12 });

  const listQ = useQuery<Columbarium[]>({
    queryKey: ["columbaria", ORG_ID],
    queryFn: () => apiJson<Columbarium[]>(`${apiBase}/columbaria?orgId=${ORG_ID}`),
  });

  const createM = useMutation({
    mutationFn: (body: { name: string; description: string; rows: number; cols: number }) =>
      apiJson<Columbarium>(`${apiBase}/columbaria`, {
        method: "POST",
        body: JSON.stringify({ ...body, organizationId: ORG_ID }),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["columbaria", ORG_ID] });
      setOpenCreate(false);
      setCreateForm({ name: "", description: "", rows: 8, cols: 12 });
      setLoc(`/columbarium/${created.id}`);
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => apiJson<void>(`${apiBase}/columbaria/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columbaria", ORG_ID] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Box className="h-3.5 w-3.5" />
            <span>Cemetery Operations</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Columbarium</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Manage cremation niche walls. Each wall is a grid of niches you can fill in with
            occupant details, photos, and inscriptions — and view in 2D or 3D.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-wall"><Plus className="h-4 w-4 mr-2" />New wall</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New columbarium wall</DialogTitle>
              <DialogDescription>Set up a niche wall by giving it a name and grid size. You can always resize later.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Wall name</Label>
                <Input
                  className="mt-1"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="St. Mary Memorial Wall"
                  data-testid="input-wall-name"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  className="mt-1"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Indoor chapel — north wall"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rows</Label>
                  <Input
                    type="number" min={1} max={50} className="mt-1"
                    value={createForm.rows}
                    onChange={(e) => setCreateForm((f) => ({ ...f, rows: Math.max(1, Math.min(50, Number(e.target.value) || 1)) }))}
                    data-testid="input-wall-rows"
                  />
                </div>
                <div>
                  <Label>Columns</Label>
                  <Input
                    type="number" min={1} max={50} className="mt-1"
                    value={createForm.cols}
                    onChange={(e) => setCreateForm((f) => ({ ...f, cols: Math.max(1, Math.min(50, Number(e.target.value) || 1)) }))}
                    data-testid="input-wall-cols"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Total niches: <span className="font-medium text-foreground">{createForm.rows * createForm.cols}</span>
              </p>
              <Button
                className="w-full"
                disabled={!createForm.name.trim() || createM.isPending}
                onClick={() => createM.mutate(createForm)}
                data-testid="button-submit-wall"
              >
                {createM.isPending ? "Creating..." : "Create wall"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {listQ.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-44 animate-pulse bg-muted" />)}
        </div>
      ) : (listQ.data?.length ?? 0) === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center text-center gap-3 max-w-md mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Box className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">No columbarium walls yet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Create your first niche wall to start adding cremation slots, photos, and inscriptions.
              You'll be able to view the wall in 2D or as a tilted 3D perspective.
            </p>
            <Button onClick={() => setOpenCreate(true)} className="mt-2"><Plus className="h-4 w-4 mr-2" />Create your first wall</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listQ.data?.map((w) => (
            <Card
              key={w.id}
              className="group relative hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => setLoc(`/columbarium/${w.id}`)}
              data-testid={`card-wall-${w.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Box className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{w.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{w.rows} × {w.cols} grid · {w.rows * w.cols} niches</p>
                    </div>
                  </div>
                  <Button
                    size="icon" variant="ghost"
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${w.name}"? This will remove all niches in this wall.`)) deleteM.mutate(w.id); }}
                    data-testid={`button-delete-wall-${w.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {w.description && <p className="text-sm text-muted-foreground line-clamp-2">{w.description}</p>}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Open wall</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DETAIL: one wall — niche grid + niche editor + 2D/3D toggle
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<Niche["status"], { fill: string; stroke: string; label: string }> = {
  available: { fill: "rgb(31 41 55)",     stroke: "rgb(75 85 99)",   label: "Available" },
  reserved:  { fill: "rgb(120 53 15)",    stroke: "rgb(217 119 6)",  label: "Reserved"  },
  occupied:  { fill: "rgb(20 83 45)",     stroke: "rgb(34 197 94)",  label: "Occupied"  },
};

function ColumbariumDetailPage({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const detailQ = useQuery<ColumbariumDetail>({
    queryKey: ["columbarium", id],
    queryFn: () => apiJson<ColumbariumDetail>(`${apiBase}/columbaria/${id}`),
  });

  const [view, setView] = useState<"2d" | "3d">("2d");
  const [tilt, setTilt] = useState(45);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  // Index niches by "row,col" for O(1) lookup while painting the grid.
  const nicheMap = useMemo(() => {
    const m = new Map<string, Niche>();
    for (const n of detailQ.data?.niches ?? []) m.set(`${n.row},${n.col}`, n);
    return m;
  }, [detailQ.data]);

  const upsertM = useMutation({
    mutationFn: (vars: { row: number; col: number; body: Partial<Niche> }) =>
      apiJson<Niche>(`${apiBase}/columbaria/${id}/niches/${vars.row}/${vars.col}`, {
        method: "PUT",
        body: JSON.stringify(vars.body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columbarium", id] }),
  });

  const clearM = useMutation({
    mutationFn: (vars: { row: number; col: number }) =>
      apiJson<void>(`${apiBase}/columbaria/${id}/niches/${vars.row}/${vars.col}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columbarium", id] }),
  });

  if (detailQ.isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-10 w-1/3 bg-muted rounded" /><div className="h-[500px] bg-muted rounded-lg" /></div>;
  }
  if (!detailQ.data) {
    return (
      <div className="space-y-4">
        <Link href="/columbarium"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <Card className="p-8 text-center">
          <CardTitle className="text-lg mb-2">Wall not found</CardTitle>
          <p className="text-sm text-muted-foreground">This columbarium wall may have been deleted.</p>
        </Card>
      </div>
    );
  }

  const wall = detailQ.data;
  const total = wall.rows * wall.cols;
  const occupiedCount = wall.niches.filter((n) => n.status === "occupied").length;
  const reservedCount = wall.niches.filter((n) => n.status === "reserved").length;
  const availableCount = total - occupiedCount - reservedCount;

  const selectedNiche: Niche | null = selected ? (nicheMap.get(`${selected.row},${selected.col}`) ?? null) : null;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/columbarium"><Button variant="ghost" size="sm" className="mb-2 -ml-2"><ArrowLeft className="h-4 w-4 mr-1.5" />All walls</Button></Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" /> {wall.name}
          </h1>
          {wall.description && <p className="text-sm text-muted-foreground mt-1">{wall.description}</p>}
        </div>

        {/* View toolbar — same UX language as the Map Maker */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1 bg-background/80 backdrop-blur p-1 rounded-md border shadow-sm">
            <Button size="sm" variant={view === "2d" ? "default" : "outline"} onClick={() => setView("2d")} data-testid="button-view-2d">
              <Square className="h-3.5 w-3.5 mr-1.5" /> 2D
            </Button>
            <Button size="sm" variant={view === "3d" ? "default" : "outline"} onClick={() => setView("3d")} data-testid="button-view-3d">
              <Layers3 className="h-3.5 w-3.5 mr-1.5" /> 3D
            </Button>
          </div>
          {view === "3d" && (
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur px-3 py-1 rounded-md border shadow-sm animate-in fade-in slide-in-from-left-2">
              <span className="text-[10px] font-medium uppercase text-muted-foreground">Tilt</span>
              <Slider value={[tilt]} onValueChange={([v]) => setTilt(v)} min={20} max={75} step={1} className="w-24" />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total niches" value={total} />
        <StatCard label="Occupied" value={occupiedCount} dotClass="bg-green-500" />
        <StatCard label="Reserved" value={reservedCount} dotClass="bg-amber-500" />
        <StatCard label="Available" value={availableCount} dotClass="bg-slate-500" />
      </div>

      {/* Wall canvas */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-b from-background to-muted/30 min-h-[480px] flex items-center justify-center p-6 sm:p-10" style={{ perspective: "1500px" }}>
            <NicheWall
              wall={wall}
              nicheMap={nicheMap}
              view={view}
              tilt={tilt}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-slate-500 bg-slate-700" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-amber-500 bg-amber-900/60" /> Reserved</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-green-500 bg-green-900/60" /> Occupied</span>
        <span className="ml-auto">Click any niche to view or edit its details.</span>
      </div>

      {/* Niche editor sheet */}
      <NicheEditorSheet
        open={selected !== null}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        wall={wall}
        position={selected}
        existing={selectedNiche}
        onSave={(payload) => {
          if (!selected) return;
          upsertM.mutate({ row: selected.row, col: selected.col, body: payload });
        }}
        onClear={() => {
          if (!selected) return;
          clearM.mutate({ row: selected.row, col: selected.col });
          setSelected(null);
        }}
        saving={upsertM.isPending}
      />
    </div>
  );
}

function StatCard({ label, value, dotClass }: { label: string; value: number; dotClass?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {dotClass && <span className={cn("inline-block w-1.5 h-1.5 rounded-full", dotClass)} />}
          {label}
        </div>
        <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Niche wall renderer (SVG, 2D + tilted 3D)
// ---------------------------------------------------------------------------

const NICHE_W = 64;       // px per niche, drawing space
const NICHE_H = 80;
const NICHE_GAP = 6;

function NicheWall({
  wall, nicheMap, view, tilt, selected, onSelect,
}: {
  wall: Columbarium;
  nicheMap: Map<string, Niche>;
  view: "2d" | "3d";
  tilt: number;
  selected: { row: number; col: number } | null;
  onSelect: (pos: { row: number; col: number } | null) => void;
}) {
  const cellW = NICHE_W + NICHE_GAP;
  const cellH = NICHE_H + NICHE_GAP;
  const padX = 40, padY = 40;
  const totalW = padX * 2 + wall.cols * cellW - NICHE_GAP;
  const totalH = padY * 2 + wall.rows * cellH - NICHE_GAP;

  // Auto-shrink to fit horizontally on smaller screens. The 3D rotation
  // adds vertical space so we leave a generous max-width and let the
  // browser scroll if needed.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      // Leave a 20px safety margin on each side.
      const fit = Math.min(1.0, (w - 40) / totalW);
      setScale(Math.max(0.35, fit));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalW]);

  const transform = view === "3d"
    ? `rotateX(${tilt}deg) scale(${scale * 0.92})`
    : `scale(${scale})`;

  return (
    <div ref={wrapperRef} className="w-full flex items-center justify-center" style={{ minHeight: 460 }}>
      <div
        style={{
          transform,
          transformOrigin: "center center",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <svg
          width={totalW}
          height={totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block" }}
        >
          <defs>
            <linearGradient id="wall-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0f1614" />
              <stop offset="1" stopColor="#1a2622" />
            </linearGradient>
            <linearGradient id="wall-frame" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3d4d46" />
              <stop offset="1" stopColor="#1a2622" />
            </linearGradient>
            <pattern id="wall-grout" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#0d1411" />
              <path d="M0 0 L8 8 M-1 7 L1 9 M7 -1 L9 1" stroke="#1a2422" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Wall back panel + frame for the "memorial" feel */}
          <rect x="2" y="2" width={totalW - 4} height={totalH - 4} rx="8" fill="url(#wall-frame)" />
          <rect x="14" y="14" width={totalW - 28} height={totalH - 28} rx="6" fill="url(#wall-grout)" />

          {/* 3D back-shadow tiles for depth (only in 3D mode) */}
          {view === "3d" && Array.from({ length: wall.rows }).map((_, r) =>
            Array.from({ length: wall.cols }).map((_, c) => (
              <rect
                key={`s-${r}-${c}`}
                x={padX + c * cellW + 5}
                y={padY + r * cellH + 6}
                width={NICHE_W}
                height={NICHE_H}
                rx="3"
                fill="rgba(0,0,0,0.55)"
                pointerEvents="none"
              />
            ))
          )}

          {/* Niche tiles */}
          {Array.from({ length: wall.rows }).map((_, r) =>
            Array.from({ length: wall.cols }).map((_, c) => {
              const n = nicheMap.get(`${r},${c}`);
              const status = n?.status ?? "available";
              const colors = STATUS_COLORS[status];
              const x = padX + c * cellW;
              const y = padY + r * cellH;
              const isSel = selected?.row === r && selected?.col === c;
              return (
                <NicheTile
                  key={`n-${r}-${c}`}
                  x={x} y={y}
                  niche={n ?? null}
                  fill={colors.fill}
                  stroke={isSel ? "#22c55e" : colors.stroke}
                  strokeWidth={isSel ? 2.5 : 1}
                  onClick={() => onSelect({ row: r, col: c })}
                />
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}

function NicheTile({
  x, y, niche, fill, stroke, strokeWidth, onClick,
}: {
  x: number; y: number;
  niche: Niche | null;
  fill: string; stroke: string; strokeWidth: number;
  onClick: () => void;
}) {
  // Each niche shows: small portrait band on top, name initials, year range.
  const initials = niche?.occupantName
    ? niche.occupantName.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase()
    : "";
  const photo = niche?.photoUrl ?? null;
  const year = (s: string | null | undefined) => (s ? String(s).slice(0, 4) : "");
  const dob = year(niche?.dob);
  const dod = year(niche?.dod);
  const lifespan = dob || dod ? `${dob}${dob || dod ? "–" : ""}${dod}` : "";

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
      data-testid={`niche-${Math.round(y)}-${Math.round(x)}`}
    >
      {/* Tile body */}
      <rect width={NICHE_W} height={NICHE_H} rx="3" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Portrait area (top 60%) */}
      <rect x="3" y="3" width={NICHE_W - 6} height={NICHE_H * 0.55} rx="2" fill="#0a0f0d" stroke="rgba(255,255,255,0.06)" />
      {photo ? (
        <image
          href={photo}
          x="3" y="3"
          width={NICHE_W - 6} height={NICHE_H * 0.55}
          preserveAspectRatio="xMidYMid slice"
          style={{ borderRadius: 2 }}
        />
      ) : initials ? (
        <text
          x={NICHE_W / 2} y={NICHE_H * 0.32}
          textAnchor="middle"
          fontSize="14" fontWeight="600"
          fill="rgba(255,255,255,0.55)"
          fontFamily="system-ui, sans-serif"
        >
          {initials}
        </text>
      ) : (
        <text
          x={NICHE_W / 2} y={NICHE_H * 0.32}
          textAnchor="middle" fontSize="9"
          fill="rgba(255,255,255,0.25)"
          fontFamily="system-ui, sans-serif"
        >
          empty
        </text>
      )}
      {/* Plaque area (bottom) */}
      {niche?.occupantName && (
        <text
          x={NICHE_W / 2} y={NICHE_H * 0.74}
          textAnchor="middle" fontSize="6.5" fontWeight="600"
          fill="rgba(255,255,255,0.85)"
          fontFamily="system-ui, sans-serif"
        >
          {truncate(niche.occupantName, 14)}
        </text>
      )}
      {lifespan && (
        <text
          x={NICHE_W / 2} y={NICHE_H * 0.88}
          textAnchor="middle" fontSize="6"
          fill="rgba(255,255,255,0.6)"
          fontFamily="system-ui, sans-serif"
        >
          {lifespan}
        </text>
      )}
    </g>
  );
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// ---------------------------------------------------------------------------
// Niche editor sheet
// ---------------------------------------------------------------------------

function NicheEditorSheet({
  open, onOpenChange, wall, position, existing, onSave, onClear, saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  wall: Columbarium;
  position: { row: number; col: number } | null;
  existing: Niche | null;
  onSave: (payload: Partial<Niche>) => void;
  onClear: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Niche>>({});
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // Reset form whenever the selected niche changes.
  useEffect(() => {
    setForm({
      occupantName: existing?.occupantName ?? "",
      dob: existing?.dob ?? "",
      dod: existing?.dod ?? "",
      inscription: existing?.inscription ?? "",
      photoUrl: existing?.photoUrl ?? null,
      status: existing?.status ?? "available",
      notes: existing?.notes ?? "",
    });
    setPhotoErr(null);
  }, [existing, position?.row, position?.col]);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setPhotoErr(null);
    try {
      const url = await fileToCompressedDataUrl(file, 600, 0.82);
      setForm((f) => ({ ...f, photoUrl: url }));
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : "Failed to read image");
    }
  }, []);

  if (!position) return null;

  // Build a friendly position label like "Row 3, Col 5".
  const posLabel = `Row ${position.row + 1} · Col ${position.col + 1}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Niche · {posLabel}
            {existing && (
              <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide">
                {STATUS_COLORS[existing.status].label}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {wall.name} — edit occupant details, status, and the niche portrait. Changes save to the wall when you click <strong>Save</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Photo */}
          <div className="flex items-center gap-3">
            <div className="h-20 w-16 rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Label htmlFor="niche-photo" className="text-xs">Portrait</Label>
              <div className="flex items-center gap-2 mt-1">
                <label
                  htmlFor="niche-photo"
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent cursor-pointer transition-colors"
                  data-testid="button-upload-niche-photo"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload
                </label>
                <input
                  id="niche-photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {form.photoUrl && (
                  <Button size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, photoUrl: null }))}>
                    Remove
                  </Button>
                )}
              </div>
              {photoErr && <p className="text-[11px] text-destructive mt-1">{photoErr}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">JPG/PNG. Auto-resized to 600px max edge.</p>
            </div>
          </div>

          <div>
            <Label>Occupant name</Label>
            <Input
              className="mt-1"
              value={form.occupantName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, occupantName: e.target.value }))}
              placeholder="In loving memory of…"
              data-testid="input-niche-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Born</Label>
              <Input
                type="text" className="mt-1" placeholder="e.g. 1948 or 1948-03-12"
                value={form.dob ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                data-testid="input-niche-dob"
              />
            </div>
            <div>
              <Label>Died</Label>
              <Input
                type="text" className="mt-1" placeholder="e.g. 2024 or 2024-11-02"
                value={form.dod ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, dod: e.target.value }))}
                data-testid="input-niche-dod"
              />
            </div>
          </div>

          <div>
            <Label>Inscription</Label>
            <Textarea
              className="mt-1" rows={2}
              value={form.inscription ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, inscription: e.target.value }))}
              placeholder="Forever in our hearts"
              data-testid="input-niche-inscription"
            />
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={(form.status as Niche["status"]) ?? "available"}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as Niche["status"] }))}
            >
              <SelectTrigger className="mt-1" data-testid="select-niche-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Internal notes (not displayed)</Label>
            <Textarea
              className="mt-1" rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Reservation paid 2024-11-15, contact next of kin Maria"
            />
          </div>
        </div>

        <SheetFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {existing && (
            <Button
              variant="ghost" className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Clear this niche? Occupant details and photo will be removed.")) onClear(); }}
              data-testid="button-clear-niche"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Clear niche
            </Button>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => { onSave(form); onOpenChange(false); }}
              disabled={saving}
              data-testid="button-save-niche"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
