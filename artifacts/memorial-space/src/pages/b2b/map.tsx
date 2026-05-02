import { useState } from "react";
import { useGetMapData } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ORG_ID = 1;

export default function MapPage() {
  const { data, isLoading } = useGetMapData(ORG_ID);
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);

  const selectedPlot = data?.plots?.find(p => p.id === selectedPlotId);

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
        <SheetContent className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <SheetHeader>
            <SheetTitle className="text-2xl text-sidebar-foreground">Plot {selectedPlot?.plotNumber}</SheetTitle>
            <SheetDescription>
              Section: {selectedPlot?.section || 'N/A'} • Row: {selectedPlot?.row || 'N/A'}
            </SheetDescription>
          </SheetHeader>
          {selectedPlot && (
            <div className="mt-8 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider mb-2">Status</h3>
                <Badge variant="outline" className={`capitalize border-none text-white ${getStatusColor(selectedPlot.status)}`}>
                  {selectedPlot.status}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider mb-2">Type</h3>
                <p className="capitalize">{selectedPlot.type || 'Standard'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider mb-2">Owner Information</h3>
                <p className="font-medium text-lg">{selectedPlot.ownerName || 'Unassigned'}</p>
                {selectedPlot.ownerContact && (
                  <p className="text-muted-foreground mt-1">{selectedPlot.ownerContact}</p>
                )}
              </div>
              {selectedPlot.price && (
                <div>
                  <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider mb-2">Price</h3>
                  <p className="text-lg">${selectedPlot.price.toLocaleString()}</p>
                </div>
              )}
              {selectedPlot.notes && (
                <div>
                  <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider mb-2">Notes</h3>
                  <p className="text-sm">{selectedPlot.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}