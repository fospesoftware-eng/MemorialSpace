import { useState, useMemo } from "react";
import {
  useGetMapData,
  useListOrganizations,
  getGetMapDataQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { PlotDetailSheet } from "@/components/plot-detail-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";

export default function MapPage() {
  const { user } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = useListOrganizations();

  // Pre-select the user's own organization if available; otherwise leave
  // unselected so the user must pick from the list.
  const defaultOrgId = user?.organizationId ?? undefined;
  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(
    defaultOrgId,
  );

  const selectedOrg = useMemo(
    () => orgs?.find((o) => o.id === selectedOrgId),
    [orgs, selectedOrgId],
  );

  const { data, isLoading } = useGetMapData(selectedOrgId ?? 0, {
    query: {
      enabled: selectedOrgId != null,
      queryKey: getGetMapDataQueryKey(selectedOrgId ?? 0),
    },
  });

  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);

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
            View the active cemetery map, burial spot layout, and assignment
            status.
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
            Select a cemetery above to view its burial spot map.
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
            {data?.plots?.map((plot) => (
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
                title={`Burial spot ${plot.plotNumber} - ${plot.status}`}
              >
                {plot.plotNumber}
              </button>
            ))}
            {(!data?.plots || data.plots.length === 0) && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No burial spots configured for this cemetery yet.
              </div>
            )}
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
