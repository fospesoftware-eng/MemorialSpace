import { useState } from "react";
import { useGetMapData, useListBurials, getListBurialsQueryKey } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Calendar, Cross, FileText, ImageOff, MapPin } from "lucide-react";
import { format } from "date-fns";

const ORG_ID = 1;

// Pretty-format an ISO date string (YYYY-MM-DD or full ISO). Returns null
// for missing or unparseable values so callers can render an em-dash.
function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.valueOf())) return null;
  return format(d, "MMM d, yyyy");
}

// Years between dob and dod (or today if still present). Returns null when
// inputs are missing or invalid, so we never display "NaN years".
function calcAge(dob: string | null | undefined, dod: string | null | undefined): number | null {
  if (!dob) return null;
  const start = new Date(dob);
  const end = dod ? new Date(dod) : new Date();
  if (isNaN(start.valueOf()) || isNaN(end.valueOf())) return null;
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}

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
                        {burials.map((b) => {
                          const dob = fmtDate(b.deceasedDob);
                          const dod = fmtDate(b.deceasedDod);
                          const buried = fmtDate(b.burialDate);
                          const age = calcAge(b.deceasedDob, b.deceasedDod);
                          return (
                            <li
                              key={b.id}
                              data-testid={`burial-${b.id}`}
                              className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 overflow-hidden"
                            >
                              <div className="flex gap-3 p-3">
                                {b.photoUrl ? (
                                  <img
                                    src={b.photoUrl}
                                    alt={b.deceasedName}
                                    className="h-16 w-16 rounded-md object-cover border border-sidebar-border shrink-0"
                                  />
                                ) : (
                                  <div className="h-16 w-16 rounded-md flex items-center justify-center bg-sidebar-accent/60 border border-sidebar-border shrink-0">
                                    <ImageOff className="h-5 w-5 text-sidebar-foreground/40" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-sidebar-foreground/60 shrink-0" />
                                    <p className="font-semibold text-sm truncate">{b.deceasedName}</p>
                                  </div>
                                  <p className="text-[11px] text-sidebar-foreground/70 mt-0.5">
                                    {dob ?? "—"} – {dod ?? "—"}
                                    {age != null && <span className="ml-1.5 text-sidebar-foreground/50">· age {age}</span>}
                                  </p>
                                  {b.religion && (
                                    <Badge variant="outline" className="mt-1.5 text-[10px] border-sidebar-border bg-transparent capitalize">
                                      {b.religion}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {(buried || b.notes) && (
                                <div className="border-t border-sidebar-border/60 px-3 py-2 space-y-1.5 text-[11px]">
                                  {buried && (
                                    <div className="flex items-start gap-1.5">
                                      <Calendar className="h-3 w-3 mt-0.5 text-sidebar-foreground/60 shrink-0" />
                                      <span className="text-sidebar-foreground/80">
                                        Interred <strong className="text-sidebar-foreground">{buried}</strong>
                                      </span>
                                    </div>
                                  )}
                                  {b.notes && (
                                    <div className="flex items-start gap-1.5">
                                      <FileText className="h-3 w-3 mt-0.5 text-sidebar-foreground/60 shrink-0" />
                                      <p className="text-sidebar-foreground/80 whitespace-pre-line break-words">{b.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="border-t border-sidebar-border/60 px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-sidebar-foreground/50">
                                <MapPin className="h-2.5 w-2.5" />
                                <span>Plot #{b.plotId}</span>
                                <span className="mx-1">·</span>
                                <span>Record #{b.id}</span>
                              </div>
                            </li>
                          );
                        })}
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
