import { useState } from "react";
import { useGetMapData, useListBurials, getListBurialsQueryKey } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cross } from "lucide-react";
import { BurialDetails } from "@/components/burial-details";

const ORG_ID = 1;

export default function MapPage() {
  const { data, isLoading } = useGetMapData(ORG_ID);
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);

  const selectedPlot = data?.plots?.find(p => p.id === selectedPlotId);

  // Lazy-load burials only when a plot is selected. The hook is enabled
  // conditionally so we don't hammer the API on every plot in the grid.
  // The generated UseQueryOptions type requires `queryKey`, so we pass the
  // helper that builds the same key the hook would default to.
  const burialsParams = selectedPlotId != null
    ? { organizationId: ORG_ID, plotId: selectedPlotId }
    : undefined;
  const { data: burials, isLoading: burialsLoading } = useListBurials(
    burialsParams,
    {
      query: {
        enabled: selectedPlotId != null,
        queryKey: getListBurialsQueryKey(burialsParams),
      },
    },
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-[#40916c] hover:bg-[#40916c]/80';
      case 'reserved': return 'bg-[#d4a843] hover:bg-[#d4a843]/80';
      case 'occupied': return 'bg-[#374151] hover:bg-[#374151]/80';
      case 'maintenance': return 'bg-[#ef4444] hover:bg-[#ef4444]/80';
      default: return 'bg-secondary hover:bg-secondary/80';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cemetery Map</h1>
        <p className="text-muted-foreground mt-1">Interactive visual plot layout and assignment status.</p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#40916c]"></div> Available</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#d4a843]"></div> Reserved</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#374151]"></div> Occupied</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#ef4444]"></div> Maintenance</div>
      </div>

      <div className="bg-card border rounded-xl shadow-sm p-6">
        {isLoading ? (
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
                  selectedPlotId === plot.id ? 'border-primary scale-110 shadow-lg z-10' : 'border-transparent hover:scale-105'
                } ${getStatusColor(plot.status)}`}
                title={`Plot ${plot.plotNumber} - ${plot.status}`}
              >
                {plot.plotNumber}
              </button>
            ))}
            {(!data?.plots || data.plots.length === 0) && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No plots configured for this organization yet.
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!selectedPlotId} onOpenChange={(open) => !open && setSelectedPlotId(null)}>
        <SheetContent className="bg-sidebar border-sidebar-border text-sidebar-foreground w-full sm:max-w-md p-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <SheetHeader>
                <SheetTitle className="text-2xl text-sidebar-foreground">Plot {selectedPlot?.plotNumber}</SheetTitle>
                <SheetDescription>
                  Section: {selectedPlot?.section || 'N/A'} • Row: {selectedPlot?.row || 'N/A'}
                </SheetDescription>
              </SheetHeader>

              {selectedPlot && (
                <div className="mt-8 space-y-6">
                  {/* ----- Plot facts ----- */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider">Status</h3>
                      <Badge variant="outline" className={`capitalize border-none text-white ${getStatusColor(selectedPlot.status)}`}>
                        {selectedPlot.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">Type</div>
                        <p className="capitalize">{selectedPlot.type || 'Standard'}</p>
                      </div>
                      {selectedPlot.price != null && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">Price</div>
                          <p>${selectedPlot.price.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">Owner</div>
                      <p className="font-medium">{selectedPlot.ownerName || 'Unassigned'}</p>
                      {selectedPlot.ownerContact && (
                        <p className="text-xs text-sidebar-foreground/70 mt-0.5">{selectedPlot.ownerContact}</p>
                      )}
                    </div>

                    {selectedPlot.notes && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">Plot notes</div>
                        <p className="text-sm whitespace-pre-line">{selectedPlot.notes}</p>
                      </div>
                    )}
                  </section>

                  <Separator className="bg-sidebar-border" />

                  {/* ----- Burial records ----- */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
                        <Cross className="h-3.5 w-3.5" /> Burial records
                      </h3>
                      {burials && burials.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{burials.length}</Badge>
                      )}
                    </div>

                    {burialsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-24 rounded-md bg-sidebar-accent/40" />
                        <Skeleton className="h-24 rounded-md bg-sidebar-accent/40" />
                      </div>
                    ) : !burials || burials.length === 0 ? (
                      <p className="text-xs text-sidebar-foreground/60 italic py-3 px-3 rounded-md border border-dashed border-sidebar-border bg-sidebar-accent/20">
                        No burial records linked to this plot yet.
                      </p>
                    ) : (
                      <ul className="space-y-3" data-testid="burial-list">
                        {burials.map((b) => (
                          <li key={b.id} data-testid={`burial-${b.id}`}>
                            <BurialDetails
                              variant="admin"
                              burial={{
                                name: b.deceasedName,
                                dob: b.deceasedDob,
                                dod: b.deceasedDod,
                                burialDate: b.burialDate,
                                religion: b.religion,
                                photoUrl: b.photoUrl,
                                notes: b.notes,
                              }}
                            />
                            <div className="px-3 py-1.5 mt-px text-[10px] text-sidebar-foreground/50">
                              Plot #{b.plotId} · Record #{b.id}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
