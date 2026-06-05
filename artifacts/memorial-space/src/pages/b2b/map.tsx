import { useEffect, useMemo, useState } from "react";
import {
  useGetMapData,
  useListOrganizations,
  useListBurials,
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
import { MapPin, QrCode, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
  memorialCode?: string | null;
  qrImageUrl?: string | null;
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
    const section = plot.section || "Unsectioned";
    const list = groups.get(section) ?? [];
    list.push(plot);
    groups.set(section, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([section, items]) => ({
      section,
      plots: items.sort((a: any, b: any) =>
        a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true }),
      ),
    }));
}

export default function MapPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: orgs, isLoading: orgsLoading } = useListOrganizations();

  const defaultOrgId = user?.organizationId ?? undefined;
  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(defaultOrgId);
  useEffect(() => {
    if (!selectedOrgId && defaultOrgId) setSelectedOrgId(defaultOrgId);
  }, [defaultOrgId, selectedOrgId]);

  const selectedOrg = useMemo(
    () => orgs?.find((o: any) => o.id === selectedOrgId),
    [orgs, selectedOrgId],
  );

  const { data, isLoading } = useGetMapData(selectedOrgId ?? 0, {
    query: {
      enabled: selectedOrgId != null,
      queryKey: getGetMapDataQueryKey(selectedOrgId ?? 0),
      refetchOnWindowFocus: true,
    },
  });

  const { data: allBurials } = useListBurials(
    { organizationId: selectedOrgId ?? 0 },
    { query: { enabled: selectedOrgId != null } },
  );

  const burialByPlotId = useMemo(() => {
    const map = new Map<number, any>();
    for (const b of allBurials ?? []) {
      if (!map.has(b.plotId)) map.set(b.plotId, b);
    }
    return map;
  }, [allBurials]);

  const groupedPlots = useMemo(() => groupPlots(data?.plots), [data?.plots]);
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);

  // Published map data — used only to enrich grid spots with names and QR codes
  const [publishedDoc, setPublishedDoc] = useState<PublishedDoc | null>(null);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedError, setPublishedError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrResult, setQrResult] = useState<{ created: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSelectedPlotId(null);
    setPublishedDoc(null);
    setPublishedError(null);
    if (!selectedOrg?.slug) return;
    setPublishedLoading(true);
    fetch(`/api/cemetery-maps/public/${encodeURIComponent(selectedOrg.slug)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
        return body?.doc as PublishedDoc;
      })
      .then((doc) => {
        if (!cancelled) setPublishedDoc(doc);
      })
      .catch(() => {
        // No published map yet — grid still shows from DB plots
      })
      .finally(() => {
        if (!cancelled) setPublishedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrg?.slug]);

  // Build a quick lookup: plotNumber (lowercase) → published spot
  const spotByPlotNumber = useMemo(() => {
    const map = new Map<string, PublishedSpot>();
    for (const spot of publishedDoc?.spots ?? []) {
      if (spot.temporaryId) map.set(spot.temporaryId.toLowerCase(), spot);
    }
    return map;
  }, [publishedDoc?.spots]);

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return groupedPlots;
    return groupedPlots
      .map((group) => ({
        ...group,
        plots: group.plots.filter((plot: any) => {
          const spot = spotByPlotNumber.get(plot.plotNumber.toLowerCase());
          return (
            plot.plotNumber.toLowerCase().includes(term) ||
            plot.section?.toLowerCase().includes(term) ||
            spot?.name?.toLowerCase().includes(term) ||
            spot?.notes?.toLowerCase().includes(term)
          );
        }),
      }))
      .filter((group) => group.plots.length > 0);
  }, [groupedPlots, query, spotByPlotNumber]);

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

  async function handleGenerateQrCodes() {
    if (!selectedOrgId) return;
    setQrGenerating(true);
    setQrResult(null);
    try {
      const res = await fetch("/api/qr-codes/bulk-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: selectedOrgId }),
      });
      const body = await res.json();
      setQrResult({ created: body.created ?? 0, total: body.total ?? 0 });
      // Refresh map data so QR fields show up immediately
      void queryClient.invalidateQueries({
        queryKey: getGetMapDataQueryKey(selectedOrgId),
      });
      // Reload published doc to pick up new QR URLs
      if (selectedOrg?.slug) {
        const r2 = await fetch(
          `/api/cemetery-maps/public/${encodeURIComponent(selectedOrg.slug)}`,
          { credentials: "include" },
        );
        const b2 = await r2.json().catch(() => ({}));
        if (b2?.doc) setPublishedDoc(b2.doc as PublishedDoc);
      }
    } finally {
      setQrGenerating(false);
    }
  }

  const totalPlots = data?.plots?.length ?? 0;
  const hasQrCodes = (publishedDoc?.spots ?? []).some((s) => s.qrImageUrl);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grid View</h1>
          <p className="text-muted-foreground mt-1">
            Browse all burial spots by section and row. Click any spot for full details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedOrgId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={qrGenerating || !selectedOrgId}
              onClick={handleGenerateQrCodes}
            >
              <QrCode className="h-4 w-4" />
              {qrGenerating ? "Generating…" : "Generate QR Codes"}
            </Button>
          )}
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedOrgId?.toString() ?? ""}
            onValueChange={(v) => {
              setSelectedOrgId(Number(v));
              setSelectedPlotId(null);
              setQrResult(null);
            }}
            disabled={orgsLoading}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a cemetery" />
            </SelectTrigger>
            <SelectContent>
              {orgs?.map((org: any) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {qrResult && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {qrResult.created > 0
            ? `Generated ${qrResult.created} new QR code${qrResult.created !== 1 ? "s" : ""} (${qrResult.total} total burials).`
            : `All ${qrResult.total} burial${qrResult.total !== 1 ? "s" : ""} already have QR codes.`}
        </div>
      )}

      {selectedOrg && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#40916c]" /> Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#d4a843]" /> Reserved
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#374151]" /> Occupied
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#ef4444]" /> Maintenance
          </div>
          {totalPlots > 0 && (
            <span className="ml-auto text-muted-foreground">
              {totalPlots} spot{totalPlots !== 1 ? "s" : ""}
              {hasQrCodes ? " · QR codes active" : ""}
            </span>
          )}
        </div>
      )}

      <div className="bg-card border rounded-xl shadow-sm p-6 space-y-4">
        {!selectedOrgId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a cemetery above to view its burial spots.
          </div>
        ) : isLoading || publishedLoading ? (
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : groupedPlots.length > 0 ? (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, plot number, section…"
                className="pl-9"
              />
            </div>

            <div className="space-y-8">
              {filteredGroups.map((group) => (
                <section key={group.section} className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{group.section}</h2>
                    <p className="text-xs text-muted-foreground">
                      {group.plots.length} spot{group.plots.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-12 gap-3">
                    {group.plots.map((plot: any) => {
                      const spot = spotByPlotNumber.get(plot.plotNumber.toLowerCase());
                      const burial = burialByPlotId.get(plot.id);
                      const displayName = burial?.deceasedName ?? spot?.name ?? null;
                      const lat = burial?.latitude ?? plot.latitude;
                      const lon = burial?.longitude ?? plot.longitude;
                      const hasGps = lat != null && lon != null;
                      return (
                        <button
                          type="button"
                          key={plot.id}
                          data-testid={`plot-${plot.id}`}
                          onClick={() => setSelectedPlotId(plot.id)}
                          className={`aspect-square rounded-md transition-all duration-200 border-2 cursor-pointer flex flex-col items-center justify-center gap-0 text-[10px] font-medium text-white/90 overflow-hidden px-0.5 ${
                            selectedPlotId === plot.id
                              ? "border-primary scale-110 shadow-lg z-10"
                              : "border-transparent hover:scale-105"
                          } ${getStatusColor(plot.status)}`}
                          title={[
                            displayName ?? `Spot ${plot.plotNumber}`,
                            `Status: ${plot.status}`,
                            hasGps ? `GPS: ${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}` : null,
                            burial?.veteranStatus ?? null,
                          ].filter(Boolean).join(" · ")}
                        >
                          <span className="truncate w-full text-center leading-tight">
                            {plot.plotNumber}
                          </span>
                          {displayName && (
                            <span className="truncate w-full text-center leading-tight text-[8px] opacity-80">
                              {displayName.split(" ")[0]}
                            </span>
                          )}
                          {hasGps && <span className="text-[6px] opacity-50">📍</span>}
                          {spot?.qrImageUrl && (
                            <QrCode className="h-2 w-2 opacity-60 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
              {filteredGroups.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No spots match your search.</p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {publishedError ?? "No burial spots found. Publish a Map Maker map to sync spots here."}
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
