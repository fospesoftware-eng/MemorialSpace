import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Square,
  ArrowLeft,
  Trash2,
  Upload,
  ImageOff,
  ChevronRight,
  Layers3,
  MapPin,
  UserSquare2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & API helpers
// ---------------------------------------------------------------------------

// Demo tenant id (matches the rest of the B2B app, which is single-org for the
// demo). When real auth lands, swap this for the current user's org id.
const ORG_ID = 1;

type CryptStatus = "available" | "reserved" | "occupied";
type CryptType = "single" | "companion" | "family";

type Crypt = {
  id: number;
  mausoleumId: number;
  row: number;
  col: number;
  cryptNumber: string | null;
  cryptType: CryptType;
  status: CryptStatus;
  occupantName: string | null;
  dob: string | null;
  dod: string | null;
  secondOccupantName: string | null;
  secondDob: string | null;
  secondDod: string | null;
  inscription: string | null;
  photoUrl: string | null;
  ownerName: string | null;
  ownerContact: string | null;
  notes: string | null;
  updatedAt: string;
};

type Mausoleum = {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  location: string | null;
  rows: number;
  cols: number;
  createdAt: string;
  updatedAt: string;
};

type MausoleumDetail = Mausoleum & { crypts: Crypt[] };

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
// crypt portraits inline without object storage. Stays well under the 12MB
// JSON body limit even for chunky originals.
async function fileToCompressedDataUrl(
  file: File,
  maxEdge = 600,
  quality = 0.82,
): Promise<string> {
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
    await new Promise((r, j) => {
      img.onload = r;
      img.onerror = j;
    });
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
// Top-level router for /mausoleum and /mausoleum/:id
// ---------------------------------------------------------------------------

export default function MausoleumModule() {
  const [matchDetail, params] = useRoute<{ id: string }>("/mausoleum/:id");
  if (matchDetail && params?.id) {
    const id = Number(params.id);
    if (Number.isFinite(id)) return <MausoleumDetailPage id={id} />;
  }
  return <MausoleumListPage />;
}

// ---------------------------------------------------------------------------
// LIST: all mausoleums for the current org
// ---------------------------------------------------------------------------

function MausoleumListPage() {
  const queryClient = useQueryClient();
  const [, setLoc] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    location: "",
    rows: 4,
    cols: 8,
  });

  const listQ = useQuery<Mausoleum[]>({
    queryKey: ["mausoleums", ORG_ID],
    queryFn: () => apiJson<Mausoleum[]>(`${apiBase}/mausoleums?orgId=${ORG_ID}`),
  });

  const createM = useMutation({
    mutationFn: (body: {
      name: string;
      description: string;
      location: string;
      rows: number;
      cols: number;
    }) =>
      apiJson<Mausoleum>(`${apiBase}/mausoleums`, {
        method: "POST",
        body: JSON.stringify({ ...body, organizationId: ORG_ID }),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["mausoleums", ORG_ID] });
      setOpenCreate(false);
      setCreateForm({ name: "", description: "", location: "", rows: 4, cols: 8 });
      setLoc(`/mausoleum/${created.id}`);
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: number) =>
      apiJson<void>(`${apiBase}/mausoleums/${id}?orgId=${ORG_ID}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mausoleums", ORG_ID] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Building2 className="h-3.5 w-3.5" />
            <span>Cemetery Operations</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Mausoleums</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Manage above-ground burial structures. Each mausoleum holds a grid of crypts
            (single, companion, or family) you can fill in with occupant details, owner
            records, and photos — and view in 2D or interior 3D perspective.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-mausoleum">
              <Plus className="h-4 w-4 mr-2" />
              New mausoleum
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New mausoleum</DialogTitle>
              <DialogDescription>
                Set up a mausoleum building by giving it a name, optional location, and the
                grid size of its crypt wall. You can always resize later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Mausoleum name</Label>
                <Input
                  className="mt-1"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Garden of Peace Mausoleum"
                  data-testid="input-mausoleum-name"
                />
              </div>
              <div>
                <Label>Location (optional)</Label>
                <Input
                  className="mt-1"
                  value={createForm.location}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, location: e.target.value }))
                  }
                  placeholder="Section B, near the chapel"
                  data-testid="input-mausoleum-location"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  className="mt-1"
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Indoor marble mausoleum with skylight, completed 1998"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tiers (rows)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    className="mt-1"
                    value={createForm.rows}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        rows: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                      }))
                    }
                    data-testid="input-mausoleum-rows"
                  />
                </div>
                <div>
                  <Label>Positions (cols)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    className="mt-1"
                    value={createForm.cols}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        cols: Math.max(1, Math.min(40, Number(e.target.value) || 1)),
                      }))
                    }
                    data-testid="input-mausoleum-cols"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Total crypts:{" "}
                <span className="font-medium text-foreground">
                  {createForm.rows * createForm.cols}
                </span>
              </p>
              <Button
                className="w-full"
                disabled={!createForm.name.trim() || createM.isPending}
                onClick={() => createM.mutate(createForm)}
                data-testid="button-submit-mausoleum"
              >
                {createM.isPending ? "Creating..." : "Create mausoleum"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {listQ.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-44 animate-pulse bg-muted" />
          ))}
        </div>
      ) : (listQ.data?.length ?? 0) === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center text-center gap-3 max-w-md mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">No mausoleums yet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Create your first mausoleum to start adding burial crypts, owner records,
              and inscriptions. You'll be able to view the building in 2D plan or interior
              3D perspective.
            </p>
            <Button onClick={() => setOpenCreate(true)} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Create your first mausoleum
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listQ.data?.map((m) => (
            <Card
              key={m.id}
              className="group relative hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => setLoc(`/mausoleum/${m.id}`)}
              data-testid={`card-mausoleum-${m.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{m.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {m.rows} × {m.cols} grid · {m.rows * m.cols} crypts
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Delete "${m.name}"? This will remove all crypts in this mausoleum.`,
                        )
                      )
                        deleteM.mutate(m.id);
                    }}
                    data-testid={`button-delete-mausoleum-${m.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {m.location && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3" />
                    {m.location}
                  </div>
                )}
                {m.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {m.description}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Open mausoleum</span>
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
// DETAIL: one mausoleum — crypt grid + crypt editor + 2D/3D toggle
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<CryptStatus, { fill: string; stroke: string; label: string }> = {
  available: { fill: "rgb(31 41 55)", stroke: "rgb(75 85 99)", label: "Available" },
  reserved: { fill: "rgb(120 53 15)", stroke: "rgb(217 119 6)", label: "Reserved" },
  occupied: { fill: "rgb(20 83 45)", stroke: "rgb(34 197 94)", label: "Occupied" },
};

function MausoleumDetailPage({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const detailQ = useQuery<MausoleumDetail>({
    queryKey: ["mausoleum", id],
    queryFn: () =>
      apiJson<MausoleumDetail>(`${apiBase}/mausoleums/${id}?orgId=${ORG_ID}`),
  });

  const [view, setView] = useState<"2d" | "3d">("2d");
  // Tilt for 3D = how far we rotate the wall away from the camera (deg).
  // 35° feels architectural — like looking up at a chapel wall. The Slider
  // lets ops dial it down to a near-2D view if they prefer.
  const [tilt, setTilt] = useState(35);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  // Index crypts by "row,col" for O(1) lookup while painting the grid.
  const cryptMap = useMemo(() => {
    const m = new Map<string, Crypt>();
    for (const c of detailQ.data?.crypts ?? []) m.set(`${c.row},${c.col}`, c);
    return m;
  }, [detailQ.data]);

  const upsertM = useMutation({
    mutationFn: (vars: { row: number; col: number; body: Partial<Crypt> }) =>
      apiJson<Crypt>(
        `${apiBase}/mausoleums/${id}/crypts/${vars.row}/${vars.col}?orgId=${ORG_ID}`,
        {
          method: "PUT",
          body: JSON.stringify(vars.body),
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mausoleum", id] }),
  });

  const clearM = useMutation({
    mutationFn: (vars: { row: number; col: number }) =>
      apiJson<void>(
        `${apiBase}/mausoleums/${id}/crypts/${vars.row}/${vars.col}?orgId=${ORG_ID}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mausoleum", id] }),
  });

  if (detailQ.isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-1/3 bg-muted rounded" />
        <div className="h-[500px] bg-muted rounded-lg" />
      </div>
    );
  }
  if (!detailQ.data) {
    return (
      <div className="space-y-4">
        <Link href="/mausoleum">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <Card className="p-8 text-center">
          <CardTitle className="text-lg mb-2">Mausoleum not found</CardTitle>
          <p className="text-sm text-muted-foreground">
            This mausoleum may have been deleted.
          </p>
        </Card>
      </div>
    );
  }

  const m = detailQ.data;
  const total = m.rows * m.cols;
  const occupiedCount = m.crypts.filter((c) => c.status === "occupied").length;
  const reservedCount = m.crypts.filter((c) => c.status === "reserved").length;
  const availableCount = total - occupiedCount - reservedCount;

  const selectedCrypt: Crypt | null = selected
    ? cryptMap.get(`${selected.row},${selected.col}`) ?? null
    : null;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/mausoleum">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              All mausoleums
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> {m.name}
          </h1>
          {m.location && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {m.location}
            </p>
          )}
          {m.description && (
            <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
          )}
        </div>

        {/* View toolbar */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1 bg-background/80 backdrop-blur p-1 rounded-md border shadow-sm">
            <Button
              size="sm"
              variant={view === "2d" ? "default" : "outline"}
              onClick={() => setView("2d")}
              data-testid="button-view-2d"
            >
              <Square className="h-3.5 w-3.5 mr-1.5" /> 2D
            </Button>
            <Button
              size="sm"
              variant={view === "3d" ? "default" : "outline"}
              onClick={() => setView("3d")}
              data-testid="button-view-3d"
            >
              <Layers3 className="h-3.5 w-3.5 mr-1.5" /> 3D
            </Button>
          </div>
          {view === "3d" && (
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur px-3 py-1 rounded-md border shadow-sm animate-in fade-in slide-in-from-left-2">
              <span className="text-[10px] font-medium uppercase text-muted-foreground">
                Tilt
              </span>
              <Slider
                value={[tilt]}
                onValueChange={([v]) => setTilt(v)}
                min={5}
                max={60}
                step={1}
                className="w-24"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total crypts" value={total} />
        <StatCard label="Occupied" value={occupiedCount} dotClass="bg-green-500" />
        <StatCard label="Reserved" value={reservedCount} dotClass="bg-amber-500" />
        <StatCard label="Available" value={availableCount} dotClass="bg-slate-500" />
      </div>

      {/* Mausoleum canvas */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            className="bg-gradient-to-b from-background via-muted/20 to-muted/40 min-h-[520px] flex items-center justify-center p-6 sm:p-10"
            style={{ perspective: "1800px" }}
          >
            <CryptWall
              mausoleum={m}
              cryptMap={cryptMap}
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
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm border border-slate-500 bg-slate-700" />{" "}
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm border border-amber-500 bg-amber-900/60" />{" "}
          Reserved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm border border-green-500 bg-green-900/60" />{" "}
          Occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm border border-primary/60 bg-primary/20" />{" "}
          Companion / Family
        </span>
        <span className="ml-auto">Click any crypt to view or edit its details.</span>
      </div>

      {/* Crypt editor sheet */}
      <CryptEditorSheet
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        mausoleum={m}
        position={selected}
        existing={selectedCrypt}
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

function StatCard({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {dotClass && (
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", dotClass)} />
          )}
          {label}
        </div>
        <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Crypt wall renderer (SVG, 2D + tilted 3D)
// ---------------------------------------------------------------------------

// Crypts are noticeably wider than columbarium niches because they hold
// caskets, not urns — the visual heft helps operators distinguish the two
// modules at a glance.
const CRYPT_W = 92;
const CRYPT_H = 68;
const CRYPT_GAP = 4;

function CryptWall({
  mausoleum,
  cryptMap,
  view,
  tilt,
  selected,
  onSelect,
}: {
  mausoleum: Mausoleum;
  cryptMap: Map<string, Crypt>;
  view: "2d" | "3d";
  tilt: number;
  selected: { row: number; col: number } | null;
  onSelect: (pos: { row: number; col: number } | null) => void;
}) {
  const cellW = CRYPT_W + CRYPT_GAP;
  const cellH = CRYPT_H + CRYPT_GAP;
  const padX = 60;
  const padY = 40;
  const totalW = padX * 2 + mausoleum.cols * cellW - CRYPT_GAP;
  // Floor band at the bottom adds an architectural "you are standing in
  // the room" feel in 3D mode without changing the 2D layout meaningfully.
  const floorH = 26;
  const totalH = padY * 2 + mausoleum.rows * cellH - CRYPT_GAP + floorH;

  // Auto-shrink to fit horizontally on smaller screens. The 3D rotation
  // adds vertical space so we leave a generous min-height and let the
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

  // 3D mode tilts the wall *forward at the bottom* (rotateX with negative
  // angle) so we get an "interior looking up at the wall" perspective,
  // which reads like a chapel — distinct from the columbarium's
  // floor-plan-style top-down 3D.
  const transform =
    view === "3d"
      ? `rotateX(${-tilt}deg) scale(${scale * 0.92})`
      : `scale(${scale})`;

  // Visual address: bottom row = Tier 1, left col = Position 1. We render
  // crypts top-to-bottom in the SVG (DOM order matches z-order for nice
  // hover stacking) but display the label flipped so operators see the
  // building the way they walk it.
  const tierFor = (rowFromTop: number) => mausoleum.rows - rowFromTop;

  return (
    <div
      ref={wrapperRef}
      className="w-full flex items-center justify-center"
      style={{ minHeight: 480 }}
    >
      <div
        style={{
          transform,
          transformOrigin: "center bottom",
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
            <linearGradient id="maus-marble" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e8e2d4" />
              <stop offset="1" stopColor="#bcb29c" />
            </linearGradient>
            <linearGradient id="maus-frame" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3d4d46" />
              <stop offset="1" stopColor="#0e1715" />
            </linearGradient>
            <pattern id="maus-veins" width="120" height="120" patternUnits="userSpaceOnUse">
              <rect width="120" height="120" fill="url(#maus-marble)" />
              <path
                d="M0 30 Q40 10 80 40 T160 50"
                stroke="rgba(120,110,90,0.18)"
                strokeWidth="1"
                fill="none"
              />
              <path
                d="M0 80 Q60 70 100 95 T200 90"
                stroke="rgba(140,130,110,0.14)"
                strokeWidth="0.8"
                fill="none"
              />
            </pattern>
            <linearGradient id="maus-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a2422" />
              <stop offset="1" stopColor="#08110f" />
            </linearGradient>
            <radialGradient id="maus-spotlight" cx="0.5" cy="0" r="0.8">
              <stop offset="0" stopColor="rgba(255,240,200,0.18)" />
              <stop offset="1" stopColor="rgba(255,240,200,0)" />
            </radialGradient>
          </defs>

          {/* Outer frame: dark stone surround */}
          <rect x="2" y="2" width={totalW - 4} height={totalH - 4} rx="10" fill="url(#maus-frame)" />
          {/* Inner marble back panel */}
          <rect
            x="14"
            y="14"
            width={totalW - 28}
            height={totalH - 28 - floorH}
            rx="6"
            fill="url(#maus-veins)"
          />
          {/* Spotlight from above for the chapel feel */}
          <rect
            x="14"
            y="14"
            width={totalW - 28}
            height={(totalH - 28 - floorH) * 0.6}
            rx="6"
            fill="url(#maus-spotlight)"
            pointerEvents="none"
          />
          {/* Floor band — only visually meaningful in 3D */}
          <rect
            x="14"
            y={totalH - 14 - floorH}
            width={totalW - 28}
            height={floorH}
            rx="0"
            fill="url(#maus-floor)"
          />
          <line
            x1="14"
            y1={totalH - 14 - floorH}
            x2={totalW - 14}
            y2={totalH - 14 - floorH}
            stroke="rgba(255,255,255,0.06)"
          />

          {/* Tier labels on the left edge (Tier 1 = bottom) */}
          {Array.from({ length: mausoleum.rows }).map((_, r) => {
            const y = padY + r * cellH + CRYPT_H / 2 + 4;
            return (
              <text
                key={`tier-${r}`}
                x={28}
                y={y}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(60,55,40,0.8)"
                fontFamily="Georgia, serif"
                fontWeight="600"
              >
                T{tierFor(r)}
              </text>
            );
          })}

          {/* Position labels along the top */}
          {Array.from({ length: mausoleum.cols }).map((_, c) => {
            const x = padX + c * cellW + CRYPT_W / 2;
            return (
              <text
                key={`pos-${c}`}
                x={x}
                y={26}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(60,55,40,0.7)"
                fontFamily="Georgia, serif"
              >
                {c + 1}
              </text>
            );
          })}

          {/* 3D back-shadow tiles for depth (only in 3D mode) */}
          {view === "3d" &&
            Array.from({ length: mausoleum.rows }).map((_, r) =>
              Array.from({ length: mausoleum.cols }).map((_, c) => (
                <rect
                  key={`s-${r}-${c}`}
                  x={padX + c * cellW + 4}
                  y={padY + r * cellH + 6}
                  width={CRYPT_W}
                  height={CRYPT_H}
                  rx="2"
                  fill="rgba(0,0,0,0.45)"
                  pointerEvents="none"
                />
              )),
            )}

          {/* Crypt tiles */}
          {Array.from({ length: mausoleum.rows }).map((_, r) =>
            Array.from({ length: mausoleum.cols }).map((_, c) => {
              const cr = cryptMap.get(`${r},${c}`);
              const status = cr?.status ?? "available";
              const colors = STATUS_COLORS[status];
              const x = padX + c * cellW;
              const y = padY + r * cellH;
              const isSel = selected?.row === r && selected?.col === c;
              return (
                <CryptTile
                  key={`c-${r}-${c}`}
                  x={x}
                  y={y}
                  tier={tierFor(r)}
                  position={c + 1}
                  crypt={cr ?? null}
                  fill={colors.fill}
                  stroke={isSel ? "#22c55e" : colors.stroke}
                  strokeWidth={isSel ? 2.5 : 1}
                  onClick={() => onSelect({ row: r, col: c })}
                />
              );
            }),
          )}
        </svg>
      </div>
    </div>
  );
}

function CryptTile({
  x,
  y,
  tier,
  position,
  crypt,
  fill,
  stroke,
  strokeWidth,
  onClick,
}: {
  x: number;
  y: number;
  tier: number;
  position: number;
  crypt: Crypt | null;
  fill: string;
  stroke: string;
  strokeWidth: number;
  onClick: () => void;
}) {
  const isCompanion = crypt?.cryptType === "companion" || crypt?.cryptType === "family";
  // Crypts of type companion / family get a primary-coloured top stripe
  // so they pop visually against single crypts.
  const stripeColor = isCompanion ? "rgb(56 189 248)" : "rgba(255,255,255,0.08)";
  const photo = crypt?.photoUrl ?? null;
  const initials = crypt?.occupantName
    ? crypt.occupantName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase()
    : "";
  const year = (s: string | null | undefined) => (s ? String(s).slice(0, 4) : "");
  const dob = year(crypt?.dob);
  const dod = year(crypt?.dod);
  const lifespan = dob || dod ? `${dob}${dob || dod ? "–" : ""}${dod}` : "";
  // Crypt label: prefer the human-given crypt number, otherwise fall back
  // to a Tier/Position address ("T2-P5") — operators always see something
  // useful even for fresh, never-edited crypts.
  const label = crypt?.cryptNumber?.trim() || `T${tier}-P${position}`;

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
      data-testid={`crypt-${tier}-${position}`}
    >
      {/* Main tile */}
      <rect
        width={CRYPT_W}
        height={CRYPT_H}
        rx="3"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Type stripe */}
      <rect width={CRYPT_W} height={3} y="0" rx="2" fill={stripeColor} />

      {/* Plaque area */}
      <rect
        x="4"
        y="6"
        width={CRYPT_W - 8}
        height={CRYPT_H - 10}
        rx="2"
        fill="rgba(0,0,0,0.25)"
        stroke="rgba(255,255,255,0.05)"
      />

      {/* Portrait thumbnail (small, left side) */}
      <rect x="7" y="9" width="22" height="28" rx="2" fill="#0a0f0d" />
      {photo ? (
        <image
          href={photo}
          x="7"
          y="9"
          width="22"
          height="28"
          preserveAspectRatio="xMidYMid slice"
        />
      ) : initials ? (
        <text
          x={7 + 11}
          y={9 + 18}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill="rgba(255,255,255,0.55)"
          fontFamily="system-ui, sans-serif"
        >
          {initials}
        </text>
      ) : null}

      {/* Label / address row */}
      <text
        x={34}
        y={17}
        fontSize="7"
        fill="rgba(255,255,255,0.55)"
        fontFamily="Georgia, serif"
        letterSpacing="0.5"
      >
        {label}
      </text>

      {/* Occupant name */}
      {crypt?.occupantName ? (
        <text
          x={34}
          y={28}
          fontSize="7.5"
          fontWeight="600"
          fill="rgba(255,255,255,0.92)"
          fontFamily="system-ui, sans-serif"
        >
          {truncate(crypt.occupantName, 14)}
        </text>
      ) : (
        <text
          x={34}
          y={28}
          fontSize="7"
          fill="rgba(255,255,255,0.3)"
          fontFamily="system-ui, sans-serif"
          fontStyle="italic"
        >
          empty
        </text>
      )}

      {/* Lifespan */}
      {lifespan && (
        <text
          x={34}
          y={37}
          fontSize="6.5"
          fill="rgba(255,255,255,0.65)"
          fontFamily="system-ui, sans-serif"
        >
          {lifespan}
        </text>
      )}

      {/* Companion second occupant */}
      {isCompanion && crypt?.secondOccupantName && (
        <>
          <line
            x1="6"
            y1="44"
            x2={CRYPT_W - 6}
            y2="44"
            stroke="rgba(255,255,255,0.08)"
          />
          <text
            x={7}
            y={54}
            fontSize="7.5"
            fontWeight="600"
            fill="rgba(255,255,255,0.92)"
            fontFamily="system-ui, sans-serif"
          >
            {truncate(crypt.secondOccupantName, 18)}
          </text>
          {(crypt.secondDob || crypt.secondDod) && (
            <text
              x={7}
              y={62}
              fontSize="6.5"
              fill="rgba(255,255,255,0.6)"
              fontFamily="system-ui, sans-serif"
            >
              {year(crypt.secondDob)}
              {crypt.secondDob || crypt.secondDod ? "–" : ""}
              {year(crypt.secondDod)}
            </text>
          )}
        </>
      )}
    </g>
  );
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// ---------------------------------------------------------------------------
// Crypt editor sheet
// ---------------------------------------------------------------------------

function CryptEditorSheet({
  open,
  onOpenChange,
  mausoleum,
  position,
  existing,
  onSave,
  onClear,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mausoleum: Mausoleum;
  position: { row: number; col: number } | null;
  existing: Crypt | null;
  onSave: (payload: Partial<Crypt>) => void;
  onClear: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Crypt>>({});
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // Reset the form whenever the selected crypt changes — without this the
  // sheet would keep showing the previously-opened crypt's data on the
  // first render after switching positions.
  useEffect(() => {
    setForm({
      cryptNumber: existing?.cryptNumber ?? "",
      cryptType: existing?.cryptType ?? "single",
      status: existing?.status ?? "available",
      occupantName: existing?.occupantName ?? "",
      dob: existing?.dob ?? "",
      dod: existing?.dod ?? "",
      secondOccupantName: existing?.secondOccupantName ?? "",
      secondDob: existing?.secondDob ?? "",
      secondDod: existing?.secondDod ?? "",
      inscription: existing?.inscription ?? "",
      photoUrl: existing?.photoUrl ?? null,
      ownerName: existing?.ownerName ?? "",
      ownerContact: existing?.ownerContact ?? "",
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

  // Bottom row in the SVG = Tier 1, so reverse the row index for the label
  // to match what the operator sees on the wall.
  const tier = mausoleum.rows - position.row;
  const posLabel = `Tier ${tier} · Position ${position.col + 1}`;
  const isCompanion = form.cryptType === "companion" || form.cryptType === "family";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Crypt · {posLabel}
            {existing && (
              <Badge variant="outline" className="ml-1 text-[10px] uppercase tracking-wide">
                {STATUS_COLORS[existing.status].label}
              </Badge>
            )}
            {existing && existing.cryptType !== "single" && (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                {existing.cryptType}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {mausoleum.name} — edit crypt details, occupants, owner record, and the
            portrait. Changes save when you click <strong>Save</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Crypt-level fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Crypt number</Label>
              <Input
                className="mt-1"
                value={form.cryptNumber ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cryptNumber: e.target.value }))
                }
                placeholder={`T${tier}-P${position.col + 1}`}
                data-testid="input-crypt-number"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={(form.cryptType as CryptType) ?? "single"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, cryptType: v as CryptType }))
                }
              >
                <SelectTrigger className="mt-1" data-testid="select-crypt-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="companion">Companion (2)</SelectItem>
                  <SelectItem value="family">Family (3+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={(form.status as CryptStatus) ?? "available"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, status: v as CryptStatus }))
              }
            >
              <SelectTrigger className="mt-1" data-testid="select-crypt-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              <Label htmlFor="crypt-photo" className="text-xs">
                Portrait
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <label
                  htmlFor="crypt-photo"
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent cursor-pointer transition-colors"
                  data-testid="button-upload-crypt-photo"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload
                </label>
                <input
                  id="crypt-photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {form.photoUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((f) => ({ ...f, photoUrl: null }))}
                  >
                    Remove
                  </Button>
                )}
              </div>
              {photoErr && (
                <p className="text-[11px] text-destructive mt-1">{photoErr}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                JPG/PNG. Auto-resized to 600px max edge.
              </p>
            </div>
          </div>

          {/* Primary occupant */}
          <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Primary occupant
            </div>
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={form.occupantName ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, occupantName: e.target.value }))
                }
                placeholder="In loving memory of…"
                data-testid="input-crypt-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Born</Label>
                <Input
                  type="text"
                  className="mt-1"
                  placeholder="e.g. 1948"
                  value={form.dob ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                  data-testid="input-crypt-dob"
                />
              </div>
              <div>
                <Label>Died</Label>
                <Input
                  type="text"
                  className="mt-1"
                  placeholder="e.g. 2024"
                  value={form.dod ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, dod: e.target.value }))}
                  data-testid="input-crypt-dod"
                />
              </div>
            </div>
          </div>

          {/* Second occupant — only meaningful for companion / family */}
          {isCompanion && (
            <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3 animate-in fade-in slide-in-from-top-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Second occupant
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  className="mt-1"
                  value={form.secondOccupantName ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, secondOccupantName: e.target.value }))
                  }
                  placeholder="Spouse, partner, family member…"
                  data-testid="input-crypt-second-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Born</Label>
                  <Input
                    type="text"
                    className="mt-1"
                    value={form.secondDob ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, secondDob: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Died</Label>
                  <Input
                    type="text"
                    className="mt-1"
                    value={form.secondDod ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, secondDod: e.target.value }))
                    }
                  />
                </div>
              </div>
              {form.cryptType === "family" && (
                <p className="text-[11px] text-muted-foreground">
                  Additional family members beyond the second occupant should be recorded
                  in the internal notes section below.
                </p>
              )}
            </div>
          )}

          {/* Inscription */}
          <div>
            <Label>Inscription</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={form.inscription ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, inscription: e.target.value }))}
              placeholder="Forever in our hearts"
              data-testid="input-crypt-inscription"
            />
          </div>

          {/* Owner record */}
          <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              <UserSquare2 className="h-3 w-3" />
              Right-of-entombment owner
            </div>
            <div>
              <Label>Owner name</Label>
              <Input
                className="mt-1"
                value={form.ownerName ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                placeholder="Pre-purchase / next of kin"
                data-testid="input-crypt-owner-name"
              />
            </div>
            <div>
              <Label>Owner contact</Label>
              <Input
                className="mt-1"
                value={form.ownerContact ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ownerContact: e.target.value }))
                }
                placeholder="Phone or email"
                data-testid="input-crypt-owner-contact"
              />
            </div>
          </div>

          {/* Internal notes */}
          <div>
            <Label>Internal notes (not displayed)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Reservation paid 2024-11-15, contact next of kin Maria"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 pb-6 sticky bottom-0 bg-background border-t -mx-6 px-6">
          <Button
            className="flex-1"
            disabled={saving}
            onClick={() => onSave(form)}
            data-testid="button-save-crypt"
          >
            {saving ? "Saving..." : existing ? "Save changes" : "Create crypt"}
          </Button>
          {existing && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Clear this crypt? This removes all data at this position."))
                  onClear();
              }}
              data-testid="button-clear-crypt"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
