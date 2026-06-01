import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  useGetMapData,
  useListOrganizations,
  getGetMapDataQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { PlotDetailSheet } from "@/components/plot-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hand, MapPin, Maximize, Search, ZoomIn, ZoomOut } from "lucide-react";

type PublishedSpot = {
  id: string;
  temporaryId?: string;
  x: number;
  y: number;
  name?: string;
  dob?: string;
  dod?: string;
  spotTypeId?: string;
  imageFileName?: string;
  imagePath?: string;
  notes?: string;
};

type PublishedDoc = {
  name: string;
  imgWidth: number;
  imgHeight: number;
  spots: PublishedSpot[];
};

const MAP_GRID_COLUMNS = ["A", "B", "C", "D"];
const MAP_GRID_ROWS = ["1", "2", "3", "4", "5"];

function spotPercent(spot: PublishedSpot, width: number, height: number) {
  return {
    left: `${Math.max(1, Math.min(99, (spot.x / Math.max(width, 1)) * 100))}%`,
    top: `${Math.max(1, Math.min(99, (spot.y / Math.max(height, 1)) * 100))}%`,
  };
}

function groupPlots(plots: any[] | undefined) {
  const groups = new Map<string, any[]>();
  for (const plot of plots ?? []) {
    const section = plot.section || "Grid A";
    const list = groups.get(section) ?? [];
    list.push(plot);
    groups.set(section, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([section, items]) => ({
      section,
      plots: items.sort((a, b) => a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true })),
    }));
}

export default function MapPage() {
  const { user } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = useListOrganizations();

  const defaultOrgId = user?.organizationId ?? undefined;
  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(defaultOrgId);
  useEffect(() => {
    if (!selectedOrgId && defaultOrgId) setSelectedOrgId(defaultOrgId);
  }, [defaultOrgId, selectedOrgId]);

  const selectedOrg = useMemo(
    () => orgs?.find((o) => o.id === selectedOrgId),
    [orgs, selectedOrgId],
  );

  const { data, isLoading } = useGetMapData(selectedOrgId ?? 0, {
    query: {
      enabled: selectedOrgId != null,
      queryKey: getGetMapDataQueryKey(selectedOrgId ?? 0),
      refetchOnWindowFocus: true,
    },
  });

  const groupedPlots = useMemo(() => groupPlots(data?.plots), [data?.plots]);
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [selectedPublishedSpotId, setSelectedPublishedSpotId] = useState<string | null>(null);
  const [publishedDoc, setPublishedDoc] = useState<PublishedDoc | null>(null);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPanMode, setMapPanMode] = useState(false);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const mapPanDragRef = useRef<{ pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSelectedPlotId(null);
    setSelectedPublishedSpotId(null);
    setPublishedDoc(null);
    setPublishedError(null);
    if (!selectedOrg?.slug) return;
    setPublishedLoading(true);
    fetch(`/api/cemetery-maps/public/${encodeURIComponent(selectedOrg.slug)}`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
        return body?.doc as PublishedDoc;
      })
      .then((doc) => {
        if (!cancelled) setPublishedDoc(doc);
      })
      .catch((err) => {
        if (!cancelled) setPublishedError(err instanceof Error ? err.message : "Published map could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setPublishedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrg?.slug]);

  const visiblePublishedSpots = useMemo(() => {
    const term = query.trim().toLowerCase();
    const spots = publishedDoc?.spots ?? [];
    if (!term) return spots;
    return spots.filter((spot) => [
      spot.name,
      spot.temporaryId,
      spot.dob,
      spot.dod,
      spot.notes,
    ].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [publishedDoc?.spots, query]);

  const selectedPublishedSpot = useMemo(() => {
    if (selectedPublishedSpotId) {
      return publishedDoc?.spots?.find((spot) => spot.id === selectedPublishedSpotId) ?? null;
    }
    if (!selectedPlotId) return null;
    const plot = data?.plots?.find((item) => item.id === selectedPlotId);
    if (!plot) return null;
    return publishedDoc?.spots?.find((spot) => String(spot.temporaryId ?? "").toLowerCase() === String(plot.plotNumber).toLowerCase()) ?? null;
  }, [data?.plots, publishedDoc?.spots, selectedPlotId, selectedPublishedSpotId]);

  const onMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!mapPanMode) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-map-spot='true']")) return;
    mapPanDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: mapPan.x,
      startPanY: mapPan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!mapPanMode || !mapPanDragRef.current) return;
    if (mapPanDragRef.current.pointerId !== event.pointerId) return;
    setMapPan({
      x: mapPanDragRef.current.startPanX + event.clientX - mapPanDragRef.current.startX,
      y: mapPanDragRef.current.startPanY + event.clientY - mapPanDragRef.current.startY,
    });
  };

  const onMapPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!mapPanDragRef.current || mapPanDragRef.current.pointerId !== event.pointerId) return;
    mapPanDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-[#40916c] hover:bg-[#40916c]/80";
      case "reserved":
        return "bg-[#d4a843] hover:bg-[#d4a843]/80";
      case "occupied":
        return "bg-[#374151] hover:bg-[#374151]/80";
      case "maintenance":
        return "bg-[#ef4444] hover:bg-[#ef4444]/80";
      default:
        return "bg-secondary hover:bg-secondary/80";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Map View</h1>
          <p className="text-muted-foreground mt-1">
            View the selected cemetery live map and synced burial spots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedOrgId?.toString() ?? ""}
            onValueChange={(v) => {
              setSelectedOrgId(Number(v));
              setSelectedPlotId(null);
              setSelectedPublishedSpotId(null);
            }}
            disabled={orgsLoading}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a cemetery" />
            </SelectTrigger>
            <SelectContent>
              {orgs?.map((org) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedOrg && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#40916c]"></div> Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#d4a843]"></div> Reserved
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#374151]"></div> Occupied
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#ef4444]"></div> Maintenance
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl shadow-sm p-6">
        {!selectedOrgId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a cemetery above to view its map.
          </div>
        ) : isLoading || publishedLoading ? (
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : publishedDoc?.spots?.length ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{publishedDoc.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {visiblePublishedSpots.length} of {publishedDoc.spots.length} burial spots visible
                  </p>
                </div>
                <div className="relative sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search names, dates, plot"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="relative h-[calc(100vh-18rem)] min-h-[520px] overflow-auto rounded border border-[#d8d4c8] bg-[#e8e4d8] p-4">
                <div className="sticky left-1/2 top-3 z-30 flex w-max -translate-x-1/2 items-center gap-1 rounded border border-[#27382d]/20 bg-[#fffdf6]/95 p-1.5 shadow">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMapZoom((z) => Math.min(2.5, z + 0.1))} title="Zoom in">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMapZoom((z) => Math.max(0.55, z - 0.1))} title="Zoom out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant={mapPanMode ? "default" : "ghost"} className="h-8 w-8" onClick={() => setMapPanMode((v) => !v)} title="Pan mode">
                    <Hand className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setMapZoom(1);
                      setMapPan({ x: 0, y: 0 });
                      setMapPanMode(false);
                    }}
                    title="Fit map"
                  >
                    <Maximize className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-[11px] font-semibold text-[#576657]">{Math.round(mapZoom * 100)}%</span>
                </div>

                <div
                  className="relative mx-auto overflow-hidden rounded-sm border bg-[#f7f5ee] p-10 text-[#1d2a22] shadow-inner"
                  style={{
                    width: publishedDoc.imgWidth,
                    height: publishedDoc.imgHeight,
                    maxWidth: "min(100%, calc((100vh - 20rem) * 0.72))",
                    maxHeight: "calc(100vh - 20rem)",
                    aspectRatio: `${publishedDoc.imgWidth} / ${publishedDoc.imgHeight}`,
                  }}
                  onPointerDown={onMapPointerDown}
                  onPointerMove={onMapPointerMove}
                  onPointerUp={onMapPointerUp}
                  onPointerCancel={onMapPointerUp}
                >
                <div className="absolute left-4 top-6 flex flex-col items-center gap-1 text-[#101813]">
                  <div className="text-xs font-semibold">N</div>
                  <div className="relative h-12 w-12">
                    <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-[#101813]" />
                    <div className="absolute left-0 top-1/2 h-px w-12 -translate-y-1/2 bg-[#101813]" />
                    <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[#101813] bg-white" />
                    <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#101813]" />
                  </div>
                  <div className="flex w-14 justify-between text-xs font-semibold"><span>W</span><span>E</span></div>
                  <div className="text-xs font-semibold">S</div>
                </div>

                <div
                  className="absolute inset-x-[9%] bottom-[12%] top-[5%] border border-[#c9c9c3] bg-white shadow-[inset_0_0_0_10px_rgba(0,0,0,0.04)]"
                  style={{
                    transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`,
                    transformOrigin: "center center",
                    transition: mapPanMode ? "none" : "transform 120ms ease-out",
                    cursor: mapPanMode ? "grab" : "default",
                  }}
                >
                  {MAP_GRID_COLUMNS.map((label, index) => (
                    <div key={`top-${label}`} className="absolute top-0 -translate-y-full text-center text-[10px] font-semibold" style={{ left: `${index * 25}%`, width: "25%" }}>{label}</div>
                  ))}
                  {MAP_GRID_COLUMNS.map((label, index) => (
                    <div key={`bottom-${label}`} className="absolute bottom-0 translate-y-full text-center text-[10px] font-semibold" style={{ left: `${index * 25}%`, width: "25%" }}>{label}</div>
                  ))}
                  {MAP_GRID_ROWS.map((label, index) => (
                    <div key={`left-${label}`} className="absolute right-full -translate-y-1/2 pr-1 text-[11px] font-semibold" style={{ top: `${(index + 0.5) * 20}%` }}>{label}</div>
                  ))}
                  {MAP_GRID_ROWS.map((label, index) => (
                    <div key={`right-${label}`} className="absolute left-full -translate-y-1/2 pl-1 text-[11px] font-semibold" style={{ top: `${(index + 0.5) * 20}%` }}>{label}</div>
                  ))}
                  {MAP_GRID_COLUMNS.slice(1).map((label, index) => (
                    <div key={`v-${label}`} className="absolute top-0 h-full w-px bg-[#f0b7b7]/70" style={{ left: `${(index + 1) * 25}%` }} />
                  ))}
                  {MAP_GRID_ROWS.slice(1).map((label, index) => (
                    <div key={`h-${label}`} className="absolute left-0 h-px w-full bg-[#f0b7b7]/70" style={{ top: `${(index + 1) * 20}%` }} />
                  ))}
                  {visiblePublishedSpots.map((spot) => {
                    const plot = (data?.plots ?? []).find(
                      (item) => String(item.plotNumber).toLowerCase() === String(spot.temporaryId ?? "").toLowerCase(),
                    );
                    const active = selectedPlotId != null && plot?.id === selectedPlotId;
                    const position = spotPercent(spot, publishedDoc.imgWidth, publishedDoc.imgHeight);
                    return (
                      <button
                        type="button"
                        key={spot.id}
                        data-map-spot="true"
                        data-testid={`map-grid-box-${spot.id}`}
                        onClick={() => {
                          setSelectedPublishedSpotId(spot.id);
                          setSelectedPlotId(plot?.id ?? null);
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 border border-[#9ca3af] bg-white px-1 py-0.5 text-center text-[7px] font-semibold leading-none shadow-sm transition hover:z-20 hover:scale-125 ${
                          active || selectedPublishedSpotId === spot.id ? "z-20 ring-2 ring-primary ring-offset-1" : ""
                        }`}
                        style={{
                          ...position,
                          borderTopColor: plot?.status === "reserved" ? "#d4a843" : plot?.status === "occupied" ? "#374151" : "#40916c",
                          borderTopWidth: 3,
                        }}
                        title={`${spot.name || "Burial spot"} - ${spot.temporaryId ?? ""}`}
                      >
                        <span className="block max-w-[46px] truncate">{spot.name || spot.temporaryId}</span>
                        {(spot.dob || spot.dod) && <span className="block max-w-[46px] truncate font-normal">{spot.dob ?? "?"}-{spot.dod ?? "?"}</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                  <div className="text-lg font-semibold">{selectedOrg?.name ?? publishedDoc.name}</div>
                  <div className="text-xs text-muted-foreground">Cemetery Overview</div>
                </div>
                <div className="absolute bottom-4 right-4 rounded border bg-white/95 p-2 text-[10px] shadow">
                  <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Legend</div>
                  <div className="space-y-1">
                    <div><span className="mr-1 inline-block h-2 w-2 bg-[#40916c]" />Available</div>
                    <div><span className="mr-1 inline-block h-2 w-2 bg-[#d4a843]" />Reserved</div>
                    <div><span className="mr-1 inline-block h-2 w-2 bg-[#374151]" />Occupied</div>
                  </div>
                </div>
                </div>
              </div>
            </div>

            <aside className="rounded border bg-background p-4">
              {selectedPublishedSpot ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Burial Spot</div>
                    <h3 className="mt-1 text-lg font-semibold">
                      {selectedPublishedSpot.name || selectedPublishedSpot.temporaryId || "Unknown burial"}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Info label="Plot" value={selectedPublishedSpot.temporaryId} />
                    <Info label="DOB" value={selectedPublishedSpot.dob} />
                    <Info label="DOD" value={selectedPublishedSpot.dod} />
                    <Info label="Image" value={selectedPublishedSpot.imageFileName || selectedPublishedSpot.imagePath} />
                  </div>
                  {selectedPublishedSpot.notes && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedPublishedSpot.notes}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Click a burial square to view synced burial and headstone details.</p>
              )}
            </aside>
          </div>
        ) : groupedPlots.length > 0 ? (
          <div className="space-y-8">
            {groupedPlots.map((group) => (
              <section key={group.section} className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{group.section}</h2>
                  <p className="text-xs text-muted-foreground">
                    {group.plots.length} spot{group.plots.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-12 gap-3">
                  {group.plots.map((plot) => (
                    <button
                      type="button"
                      key={plot.id}
                      data-testid={`plot-${plot.id}`}
                      onClick={() => setSelectedPlotId(plot.id)}
                      className={`aspect-square rounded-md transition-all duration-200 border-2 cursor-pointer flex items-center justify-center text-xs font-medium text-white/90 ${
                        selectedPlotId === plot.id
                          ? "border-primary scale-110 shadow-lg z-10"
                          : "border-transparent hover:scale-105"
                      } ${getStatusColor(plot.status)}`}
                      title={`Spot ${plot.plotNumber} - ${plot.status}`}
                      onMouseDown={() => setSelectedPublishedSpotId(null)}
                    >
                      {plot.plotNumber}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {publishedError ?? "No live map published yet. Publish a Map Maker map to sync spots here."}
          </div>
        )}
      </div>

      <PlotDetailSheet
        plotId={selectedPlotId}
        organizationId={selectedOrgId ?? null}
        onOpenChange={(open) => !open && setSelectedPlotId(null)}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value || "-"}</div>
    </div>
  );
}
