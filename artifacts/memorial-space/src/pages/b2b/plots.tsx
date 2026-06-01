import { useEffect, useMemo, useState } from "react";
import { useListOrganizations, useListPlots } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin } from "lucide-react";
import { PlotDetailSheet } from "@/components/plot-detail-sheet";

export default function Plots() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const { data: orgs, isLoading: orgsLoading } = useListOrganizations();
  const defaultOrgId = user?.organizationId ?? undefined;
  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(defaultOrgId);
  useEffect(() => {
    if (!selectedOrgId && defaultOrgId) setSelectedOrgId(defaultOrgId);
  }, [defaultOrgId, selectedOrgId]);
  const selectedOrg = useMemo(
    () => orgs?.find((org) => org.id === selectedOrgId),
    [orgs, selectedOrgId],
  );
  const { data: plots, isLoading } = useListPlots(
    { organizationId: selectedOrgId ?? 0 },
    {
      query: {
        enabled: selectedOrgId != null,
      },
    },
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-primary/20 text-primary";
      case "reserved":
        return "bg-[#d4a843]/20 text-[#d4a843]";
      case "occupied":
        return "bg-muted text-muted-foreground";
      case "maintenance":
        return "bg-destructive/20 text-destructive";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const filteredPlots =
    plots?.filter(
      (p) =>
        p.plotNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.section?.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Burial Spots</h1>
          <p className="text-muted-foreground mt-1">
            Manage cemetery burial spots, sections, rows, assignments, and
            pricing.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={selectedOrgId?.toString() ?? ""}
            onValueChange={(value) => {
              setSelectedOrgId(Number(value));
              setSelectedPlotId(null);
            }}
            disabled={orgsLoading}
          >
            <SelectTrigger className="w-full sm:w-64" data-testid="select-burial-spots-cemetery">
              <SelectValue placeholder="Select cemetery" />
            </SelectTrigger>
            <SelectContent>
              {orgs?.map((org) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2" disabled={!selectedOrgId}>
            <Plus className="h-4 w-4" />
            Add Burial Spot
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search burial spots by number or section..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Spot Number</TableHead>
              <TableHead>Section/Row</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!selectedOrgId ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Select a cemetery to manage its burial spots.
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading burial spots...
                </TableCell>
              </TableRow>
            ) : filteredPlots.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  <MapPin className="mx-auto h-6 w-6 mb-2 opacity-50" />
                  No burial spots found
                  {selectedOrg ? ` for ${selectedOrg.name}` : ""}
                </TableCell>
              </TableRow>
            ) : (
              filteredPlots.map((plot) => (
                <TableRow
                  key={plot.id}
                  data-testid={`plot-row-${plot.id}`}
                  onClick={() => setSelectedPlotId(plot.id)}
                  className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPlotId(plot.id);
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {plot.plotNumber}
                  </TableCell>
                  <TableCell>
                    {plot.section || "-"} / {plot.row || "-"}
                  </TableCell>
                  <TableCell className="capitalize">
                    {plot.type || "Standard"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize border-none ${getStatusColor(plot.status)}`}
                    >
                      {plot.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {plot.ownerName || (
                      <span className="text-muted-foreground italic">
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {plot.price ? `$${plot.price.toLocaleString()}` : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PlotDetailSheet
        plotId={selectedPlotId}
        organizationId={selectedOrgId ?? null}
        onOpenChange={(open) => !open && setSelectedPlotId(null)}
      />
    </div>
  );
}
