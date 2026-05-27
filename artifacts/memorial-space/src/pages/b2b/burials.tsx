import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBurials,
  useListQrCodes,
  getListQrCodesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users, QrCode as QrCodeIcon } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { BurialDetailSheet, type BurialRecord } from "@/components/plot-detail-sheet";

const ORG_ID = 1;
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export default function Burials() {
  const [search, setSearch] = useState("");
  const [selectedBurial, setSelectedBurial] = useState<BurialRecord | null>(null);
  const [bulking, setBulking] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: burials, isLoading } = useListBurials({ organizationId: ORG_ID });
  const { data: qrCodes } = useListQrCodes({ organizationId: ORG_ID });

  // How many burials still need a memorial QR? Drives the "Generate QRs"
  // CTA visibility/label so operators only see it when there's work to do.
  const burialsWithQr = new Set(
    (qrCodes ?? []).map((q) => q.burialId).filter((x): x is number => x != null),
  );
  const missingQrCount = (burials ?? []).filter((b) => !burialsWithQr.has(b.id)).length;

  const handleBulkGenerate = async () => {
    setBulking(true);
    try {
      const res = await fetch(`${BASE}/api/qr-codes/bulk-generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: ORG_ID }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { created: number; alreadyCovered: number; total: number };
      queryClient.invalidateQueries({ queryKey: getListQrCodesQueryKey() });
      toast({
        title: data.created > 0 ? `Generated ${data.created} new QR codes` : "All burials already have QR codes",
        description: `${data.alreadyCovered + data.created} of ${data.total} burials are now covered.`,
      });
    } catch (err) {
      toast({
        title: "Bulk generation failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulking(false);
    }
  };

  const filteredBurials = burials?.filter(b => 
    b.deceasedName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Burials</h1>
          <p className="text-muted-foreground mt-1">Manage burial records and deceased information.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            data-testid="bulk-generate-qr"
            onClick={handleBulkGenerate}
            disabled={bulking || (burials?.length ?? 0) === 0}
            title={
              missingQrCount > 0
                ? `${missingQrCount} burials are missing a memorial QR`
                : "Re-runs the QR generator (no-op if all burials are covered)"
            }
          >
            <QrCodeIcon className="h-4 w-4" />
            {bulking
              ? "Generating QRs…"
              : missingQrCount > 0
                ? `Generate ${missingQrCount} QR${missingQrCount === 1 ? "" : "s"}`
                : "QRs up to date"}
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Burial
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search deceased name..." 
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
              <TableHead>Deceased Name</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Date of Death</TableHead>
              <TableHead>Burial Date</TableHead>
              <TableHead>Religion</TableHead>
              <TableHead>Plot ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading burials...</TableCell>
              </TableRow>
            ) : filteredBurials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Users className="mx-auto h-6 w-6 mb-2 opacity-50" />
                  No burials found
                </TableCell>
              </TableRow>
            ) : (
              filteredBurials.map((burial) => (
                <TableRow
                  key={burial.id}
                  data-testid={`burial-row-${burial.id}`}
                  onClick={() => setSelectedBurial(burial as BurialRecord)}
                  className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedBurial(burial as BurialRecord);
                    }
                  }}
                >
                  <TableCell className="font-medium">{burial.deceasedName}</TableCell>
                  <TableCell>{burial.deceasedDob ? format(new Date(burial.deceasedDob), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{burial.deceasedDod ? format(new Date(burial.deceasedDod), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{burial.burialDate ? format(new Date(burial.burialDate), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{burial.religion || '-'}</TableCell>
                  <TableCell>{burial.plotId}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BurialDetailSheet
        burial={selectedBurial}
        organizationId={ORG_ID}
        open={selectedBurial != null}
        onOpenChange={(open) => !open && setSelectedBurial(null)}
      />
    </div>
  );
}