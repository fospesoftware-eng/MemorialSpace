import { useEffect, useMemo, useState } from "react";
import {
  useGetMapData,
  useListOrganizations,
  getGetMapDataQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { PlotDetailSheet } from "@/components/plot-detail-sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Search } from "lucide-react";

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
  const [publishedDoc, setPublishedDoc] = useState<PublishedDoc | null>(null);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSelectedPlotId(null);
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

  const plotByNumber = useMemo(() => {
    const map = new Map<string, any>();
    for (const plot of data?.plots ?? []) {
      map.set(String(plot.plotNumber).toLowerCase(), plot);
    }
    return map;
  }, [data?.plots]);

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
    if (!selectedPlotId) return null;
    const plot = data?.plots?.find((item) => item.id === selectedPlotId);
    if (!plot) return null;
    return publishedDoc?.spots?.find((spot) => String(spot.temporaryId ?? "").toLowerCase() === String(plot.plotNumber).toLowerCase()) ?? null;
  }, [data?.plots, publishedDoc?.spots, selectedPlotId]);

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

              <div className="relative overflow-hidden rounded border bg-[#fbf8ef] shadow-inner" style={{ aspectRatio: `${publishedDoc.imgWidth} / ${publishedDoc.imgHeight}` }}>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(74,86,70,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(74,86,70,0.12)_1px,transparent_1px)] bg-[size:28px_28px]" />
                {visiblePublishedSpots.map((spot) => {
                  const plot = plotByNumber.get(String(spot.temporaryId ?? "").toLowerCase());
                  const left = `${(spot.x / publishedDoc.imgWidth) * 100}%`;
                  const top = `${(spot.y / publishedDoc.imgHeight) * 100}%`;
                  const active = selectedPlotId != null && plot?.id === selectedPlotId;
                  return (
                    <button
                      type="button"
                      key={spot.id}
                      onClick={() => plot?.id && setSelectedPlotId(plot.id)}
                      className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-white shadow transition hover:scale-150 ${
                        active ? "scale-150 ring-2 ring-primary ring-offset-2" : ""
                      } ${plot ? getStatusColor(plot.status) : "bg-[#64748b]"}`}
                      style={{ left, top }}
                      title={spot.name || spot.temporaryId || "Burial spot"}
                    />
                  );
                })}
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
