import { useState, useRef, useCallback, useEffect, useMemo, type ChangeEvent, type DragEvent as ReactDragEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  Upload, Sparkles, Loader2, ArrowRight, FileImage, FileText, X,
  Wand2, MapPin as MapPinIcon, Square as SquareIcon, AlertCircle,
  CheckCircle2, Layers, Eye, EyeOff, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  usePlotTypes, useSpotTypes, FALLBACK_PLOT_TYPE, FALLBACK_SPOT_TYPE,
  SPOT_ICONS, newId, fileToDataUrl, downscaleImage,
  type PlotType, type SpotType, type PlotStatus, type BurialSpot,
} from "@/lib/cemetery-config";

// ---------- PDF rendering (lazy) ----------

interface PdfRenderResult { dataUrl: string; width: number; height: number; pageCount: number }

async function renderPdfPageToDataUrl(file: File, pageNumber: number): Promise<PdfRenderResult> {
  const pdfjs = await import("pdfjs-dist");
  // Vite turns this into a hashed asset URL at build time.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const safePage = Math.min(Math.max(1, pageNumber), pdf.numPages);
  const page = await pdf.getPage(safePage);

  // Pick a render scale that lands near 1600px on the longer edge,
  // matching what the rest of the editor uses.
  const baseViewport = page.getViewport({ scale: 1 });
  const longEdge = Math.max(baseViewport.width, baseViewport.height);
  const targetLongEdge = 1600;
  const scale = Math.max(0.5, Math.min(3, targetLongEdge / longEdge));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable for PDF render.");
  // White background so transparent PDFs don't render onto a transparent canvas.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
    width: canvas.width,
    height: canvas.height,
    pageCount: pdf.numPages,
  };
}

// ---------- Types matching the API ----------

interface DetectedPlot {
  label: string;
  typeId: string;
  status: PlotStatus;
  x: number; y: number; w: number; h: number; // normalised 0..1
}
interface DetectedSpot {
  label: string;
  spotTypeId: string;
  x: number; y: number; // normalised 0..1
}
interface DetectionResult {
  plots: DetectedPlot[];
  spots: DetectedSpot[];
  notes?: string;
}

interface SourceImage {
  dataUrl: string;
  width: number;
  height: number;
  /** Filename without extension, used as the suggested map name. */
  baseName: string;
  /** Either "image" or "pdf:<page>" — only used for the user-visible label. */
  origin: string;
}

// ---------- Map Maker handoff ----------
// We hand the AI-generated map off to /app/map-maker by writing a "pending"
// MapDoc into localStorage. The map-maker page picks it up on mount.
// (Same key prefix as regular saved maps so behavior stays predictable.)
const PENDING_KEY = "memorialspace.map-maker:__pending__";

function makeSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "ai-import";
}

// ---------- Component ----------

export default function AiMapMaker() {
  const [, setLocation] = useLocation();
  const [plotTypes] = usePlotTypes();
  const [spotTypes] = useSpotTypes();

  const [source, setSource] = useState<SourceImage | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [mapName, setMapName] = useState("AI-imported map");
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset overlay visibility whenever a fresh result lands.
  useEffect(() => { setShowOverlay(true); }, [result]);

  // ---- File ingestion ----
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setSource(null);
    setPdfFile(null);
    setPdfPageCount(0);
    setPdfPage(1);

    const baseName = file.name.replace(/\.[^.]+$/, "") || "AI imported map";
    setMapName(baseName);

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImg = file.type.startsWith("image/");
    if (!isPdf && !isImg) {
      setError("Please upload a JPG, PNG, WebP image, or a PDF file.");
      return;
    }

    setIsRendering(true);
    try {
      if (isPdf) {
        setPdfFile(file);
        const pdf = await renderPdfPageToDataUrl(file, 1);
        setPdfPageCount(pdf.pageCount);
        setPdfPage(1);
        // Downscale to keep the AI payload reasonable (~<5 MB base64).
        const scaled = await downscaleImage(pdf.dataUrl, 1600);
        setSource({
          dataUrl: scaled.data, width: scaled.width, height: scaled.height,
          baseName, origin: pdf.pageCount > 1 ? `PDF page 1 / ${pdf.pageCount}` : "PDF",
        });
      } else {
        const dataUrl = await fileToDataUrl(file);
        const scaled = await downscaleImage(dataUrl, 1600);
        setSource({
          dataUrl: scaled.data, width: scaled.width, height: scaled.height,
          baseName, origin: "Image",
        });
      }
    } catch (err) {
      setError(`Couldn't read that file: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setIsRendering(false);
    }
  }, []);

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleFile(file);
  };

  // Drag-and-drop on the upload card
  const onUploadDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!isDragOver) setIsDragOver(true);
    }
  };
  const onUploadDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setIsDragOver(false);
  };
  const onUploadDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  useEffect(() => {
    const clear = () => setIsDragOver(false);
    window.addEventListener("drop", clear);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("drop", clear);
      window.removeEventListener("dragend", clear);
    };
  }, []);

  // ---- PDF page navigation ----
  const renderPdfPage = useCallback(async (pageNum: number) => {
    if (!pdfFile) return;
    setIsRendering(true);
    setResult(null);
    try {
      const pdf = await renderPdfPageToDataUrl(pdfFile, pageNum);
      const scaled = await downscaleImage(pdf.dataUrl, 1600);
      setSource((s) => s
        ? { ...s, dataUrl: scaled.data, width: scaled.width, height: scaled.height,
            origin: pdf.pageCount > 1 ? `PDF page ${pageNum} / ${pdf.pageCount}` : "PDF" }
        : s);
      setPdfPage(pageNum);
    } catch (err) {
      setError(`Couldn't render that PDF page: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setIsRendering(false);
    }
  }, [pdfFile]);

  // ---- AI analysis ----
  const analyze = useCallback(async () => {
    if (!source) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const apiBase = import.meta.env.BASE_URL || "/";
      const apiUrl = (apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase).replace(/\/app$/, "") + "/api/ai/detect-map";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: source.dataUrl,
          imgWidth: source.width,
          imgHeight: source.height,
          plotTypes: plotTypes.map((t) => ({ id: t.id, code: t.code, name: t.name })),
          spotTypes: spotTypes.map((t) => ({ id: t.id, name: t.name })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = (body && typeof body.detail === "string") ? body.detail : `HTTP ${res.status}`;
        throw new Error(detail);
      }
      const data = await res.json() as DetectionResult;
      setResult(data);
    } catch (err) {
      setError(`AI analysis failed: ${err instanceof Error ? err.message : "unknown error"}. The cemetery types are still preserved — try again or upload a clearer map.`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [source, plotTypes, spotTypes]);

  // ---- Hand off to the regular Map Maker ----
  const openInMapMaker = useCallback(() => {
    if (!source || !result) return;
    const w = source.width;
    const h = source.height;
    const fallbackPlotId = plotTypes[0]?.id ?? FALLBACK_PLOT_TYPE.id;
    const fallbackSpotId = spotTypes[0]?.id ?? FALLBACK_SPOT_TYPE.id;

    const plots = result.plots.map((p) => ({
      id: newId("p"),
      typeId: plotTypes.find((t) => t.id === p.typeId) ? p.typeId : fallbackPlotId,
      label: p.label || "",
      status: p.status,
      x: Math.max(0, Math.min(w, p.x * w)),
      y: Math.max(0, Math.min(h, p.y * h)),
      w: Math.max(8, Math.min(w, p.w * w)),
      h: Math.max(8, Math.min(h, p.h * h)),
    }));

    const spots: BurialSpot[] = result.spots.map((s) => ({
      id: newId("s"),
      x: Math.max(0, Math.min(w, s.x * w)),
      y: Math.max(0, Math.min(h, s.y * h)),
      name: s.label || "",
      spotTypeId: spotTypes.find((t) => t.id === s.spotTypeId) ? s.spotTypeId : fallbackSpotId,
    }));

    const slug = makeSlug(mapName);
    const doc = {
      name: mapName.trim() || "AI-imported map",
      image: source.dataUrl,
      imgWidth: source.width,
      imgHeight: source.height,
      plots,
      spots,
      updatedAt: Date.now(),
    };

    try {
      // Save under both the pending key (read by map-maker on mount) AND a regular
      // saved-maps key so it appears in the "Saved Maps" list immediately.
      localStorage.setItem(`memorialspace.map-maker:${slug}`, JSON.stringify(doc));
      localStorage.setItem(PENDING_KEY, JSON.stringify({ doc, slug }));
    } catch (err) {
      setError(`Couldn't hand off to the editor — local storage is full. Try removing the background or older saved maps. (${err instanceof Error ? err.message : "unknown error"})`);
      return;
    }
    setLocation("/map-maker");
  }, [source, result, plotTypes, spotTypes, mapName, setLocation]);

  // ---- Helpers ----
  const getPlotType = useCallback((id: string): PlotType => plotTypes.find((t) => t.id === id) ?? FALLBACK_PLOT_TYPE, [plotTypes]);
  const getSpotType = useCallback((id: string): SpotType => spotTypes.find((t) => t.id === id) ?? FALLBACK_SPOT_TYPE, [spotTypes]);

  const detectionSummary = useMemo(() => {
    if (!result) return null;
    const byType: Record<string, number> = {};
    for (const p of result.plots) byType[p.typeId] = (byType[p.typeId] ?? 0) + 1;
    return { plots: result.plots.length, spots: result.spots.length, byType };
  }, [result]);

  return (
    <div className="space-y-6" data-testid="ai-map-maker-root">
      {/* ============ Header ============ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Link href="/map-maker" className="hover:text-foreground inline-flex items-center gap-1" data-testid="link-back-mapmaker">
              <ChevronLeft className="h-3 w-3" /> Map Maker
            </Link>
            <span>/</span>
            <span>AI</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">AI Map Maker</h1>
              <p className="text-sm text-muted-foreground">Convert an existing JPG, PNG, or PDF cemetery map into an interactive, editable digital map.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cemetery-setup">
            <Button variant="outline" size="sm" data-testid="btn-cemetery-setup">Manage cemetery types</Button>
          </Link>
          <Link href="/map-maker">
            <Button variant="outline" size="sm" data-testid="btn-open-mapmaker">Open Map Maker</Button>
          </Link>
        </div>
      </div>

      {/* How-it-works strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StepCard step={1} title="Upload your map" description="Drag a JPG, PNG, WebP, or PDF straight from your scanner, plotting software, or council records." icon={Upload} />
        <StepCard step={2} title="AI detects plots" description="Claude identifies sections, paths and buildings, classifies them against your cemetery types, and returns clickable bounding boxes." icon={Sparkles} />
        <StepCard step={3} title="Refine in Map Maker" description="One click hands the result off to the regular Map Maker so you can rename plots, drop burial spots and save." icon={Layers} />
      </div>

      {/* ============ Upload card ============ */}
      <Card data-testid="card-upload">
        <CardHeader>
          <CardTitle className="text-base">1. Upload a source map</CardTitle>
          <CardDescription>Supported formats: JPG, PNG, WebP, PDF (first page is rendered, multi-page PDFs let you pick the page).</CardDescription>
        </CardHeader>
        <CardContent>
          {!source ? (
            <div
              onDragOver={onUploadDragOver}
              onDragLeave={onUploadDragLeave}
              onDrop={onUploadDrop}
              data-testid="dropzone"
              className={[
                "relative rounded-lg border-2 border-dashed transition-colors p-10 text-center",
                isDragOver ? "border-primary bg-primary/10" : "border-primary/30 bg-card hover:border-primary/50",
              ].join(" ")}
            >
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <p className="text-base font-medium mb-1">Drag &amp; drop a map file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse — JPG, PNG, WebP, or PDF up to ~12 MB</p>
              <Button onClick={() => fileInputRef.current?.click()} data-testid="btn-pick-file">
                <Upload className="h-4 w-4 mr-2" /> Choose file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                onChange={onPickFile}
                className="hidden"
                data-testid="file-input"
              />
              {isRendering && (
                <div className="absolute inset-0 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reading file…
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="gap-1">
                  {pdfFile ? <FileText className="h-3 w-3" /> : <FileImage className="h-3 w-3" />}
                  {source.origin}
                </Badge>
                <span className="text-sm text-muted-foreground">{source.width} × {source.height}px</span>
                <span className="text-sm font-medium">{source.baseName}</span>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => { setSource(null); setPdfFile(null); setResult(null); setError(null); }} data-testid="btn-remove-source">
                  <X className="h-4 w-4 mr-1.5" /> Remove
                </Button>
              </div>

              {pdfFile && pdfPageCount > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="outline"
                    disabled={pdfPage <= 1 || isRendering}
                    onClick={() => renderPdfPage(pdfPage - 1)}
                    data-testid="btn-pdf-prev"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-sm tabular-nums">Page {pdfPage} of {pdfPageCount}</span>
                  <Button
                    size="sm" variant="outline"
                    disabled={pdfPage >= pdfPageCount || isRendering}
                    onClick={() => renderPdfPage(pdfPage + 1)}
                    data-testid="btn-pdf-next"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  {isRendering && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              )}

              {/* Preview with optional overlay */}
              <div className="relative rounded-lg border border-border overflow-hidden bg-muted">
                <img
                  src={source.dataUrl}
                  alt="Source map preview"
                  className="w-full h-auto block"
                  data-testid="img-preview"
                />
                {result && showOverlay && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${source.width} ${source.height}`}
                    preserveAspectRatio="none"
                    data-testid="detection-overlay"
                  >
                    {result.plots.map((p, i) => {
                      const t = getPlotType(p.typeId);
                      return (
                        <g key={`p${i}`}>
                          <rect
                            x={p.x * source.width} y={p.y * source.height}
                            width={p.w * source.width} height={p.h * source.height}
                            fill={t.fill} fillOpacity={0.35}
                            stroke={t.stroke} strokeWidth={2}
                          />
                          {p.label && (
                            <text
                              x={p.x * source.width + 6}
                              y={p.y * source.height + 18}
                              fill="#ffffff" stroke="#000000" strokeWidth={3}
                              paintOrder="stroke"
                              fontSize={14} fontWeight={600}
                            >
                              {p.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    {result.spots.map((s, i) => (
                      <circle
                        key={`s${i}`}
                        cx={s.x * source.width} cy={s.y * source.height}
                        r={8}
                        fill={getSpotType(s.spotTypeId).color}
                        stroke="#ffffff" strokeWidth={2}
                      />
                    ))}
                  </svg>
                )}
                {result && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2 h-7"
                    onClick={() => setShowOverlay((v) => !v)}
                    data-testid="btn-toggle-overlay"
                  >
                    {showOverlay ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                    {showOverlay ? "Hide overlay" : "Show overlay"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ Analyze card ============ */}
      {source && (
        <Card data-testid="card-analyze">
          <CardHeader>
            <CardTitle className="text-base">2. Analyse with AI</CardTitle>
            <CardDescription>
              Sends the rendered image to Claude (via Replit AI Integrations) along with your current
              <Link href="/cemetery-setup" className="text-primary hover:underline"> cemetery types</Link>. Costs a small amount of credits per run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  onClick={analyze}
                  disabled={isAnalyzing || isRendering || !source}
                  data-testid="btn-analyze"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing map…</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Analyse map with AI</>
                  )}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Typically 10-25 seconds. Re-run if results are off.
                </span>
              </div>
            )}

            {isAnalyzing && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Working on it…</AlertTitle>
                <AlertDescription>
                  Claude is reading your map, finding sections, and matching them to your cemetery types. Hang tight.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" data-testid="alert-error">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============ Results card ============ */}
      {result && detectionSummary && source && (
        <Card data-testid="card-results">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  3. Review &amp; open in Map Maker
                </CardTitle>
                <CardDescription>
                  Detected <strong>{detectionSummary.plots}</strong> plots and <strong>{detectionSummary.spots}</strong> spots.
                  You'll be able to rename, move, resize and add more in the editor.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={analyze} disabled={isAnalyzing} data-testid="btn-rerun">
                  <Sparkles className="h-4 w-4 mr-1.5" /> Re-run AI
                </Button>
                <Button onClick={openInMapMaker} data-testid="btn-open-in-editor">
                  Open in Map Maker
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.notes && (
              <div className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">
                {result.notes}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Map name
              </label>
              <input
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                className="h-9 w-full sm:w-96 rounded-md border border-input bg-background px-3 text-sm"
                placeholder="My cemetery map"
                data-testid="input-map-name"
              />
            </div>

            <Separator />

            {/* Detected plots breakdown */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Detected by section type
              </div>
              {detectionSummary.plots === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No plot regions were found. Try a clearer map, or open in Map Maker and draw plots manually.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {Object.entries(detectionSummary.byType).sort((a, b) => b[1] - a[1]).map(([typeId, n]) => {
                    const t = getPlotType(typeId);
                    return (
                      <div key={typeId} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                        <span className="h-4 w-4 rounded-sm border" style={{ background: t.fill, borderColor: t.stroke }} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{t.name}</div>
                          <div className="text-[11px] text-muted-foreground">{t.code}</div>
                        </div>
                        <div className="ml-auto text-sm tabular-nums font-semibold">{n}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {result.spots.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Detected burial spots
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.spots.slice(0, 12).map((s, i) => {
                    const t = getSpotType(s.spotTypeId);
                    const Icon = SPOT_ICONS[t.icon] ?? MapPinIcon;
                    return (
                      <Badge key={i} variant="outline" className="gap-1.5">
                        <Icon className="h-3 w-3" style={{ color: t.color }} />
                        {s.label || t.name}
                      </Badge>
                    );
                  })}
                  {result.spots.length > 12 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      +{result.spots.length - 12} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>AI output is a starting point</AlertTitle>
              <AlertDescription>
                The detected boxes are based on what Claude could see in the image. Hand it off to the
                Map Maker to fine-tune positions, fix any mis-classified sections, and add per-grave burial spots.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Subcomponents ----------

function StepCard({
  step, title, description, icon: Icon,
}: {
  step: number; title: string; description: string; icon: typeof Sparkles;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 text-primary text-xs font-semibold">
            {step}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">{title}</div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
