/**
 * Reusable plot detail Sheet. Same content as the old inline panel in
 * `pages/b2b/map.tsx`, extracted so the Plots list, Burials list, and
 * Cemetery Map all open the *same* drawer when a row/cell is clicked.
 */
import { useMemo } from "react";
import {
  useListPlots,
  useListBurials,
  useListQrCodes,
  useGetOrganization,
  getListBurialsQueryKey,
} from "@workspace/api-client-react";
import type { QrCode } from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cross } from "lucide-react";
import { BurialDetails } from "@/components/burial-details";
import { BurialFamilyLinks } from "@/components/burial-family-links";

/**
 * Build a `burialId → QrCode` lookup. When multiple QR rows exist for the
 * same burial (legacy data) we keep the first; the bulk-generate endpoint
 * is idempotent so this is rare in practice.
 */
function buildQrByBurialMap(rows: QrCode[] | undefined): Map<number, QrCode> {
  const map = new Map<number, QrCode>();
  if (!rows) return map;
  for (const r of rows) {
    if (r.burialId != null && !map.has(r.burialId)) map.set(r.burialId, r);
  }
  return map;
}

function getStatusColor(status: string) {
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
}

export type PlotDetailSheetProps = {
  plotId: number | null;
  /** When null the sheet is disabled (nothing fetched). */
  organizationId: number | null;
  onOpenChange: (open: boolean) => void;
};

export function PlotDetailSheet({
  plotId,
  organizationId,
  onOpenChange,
}: PlotDetailSheetProps) {
  const orgId = organizationId ?? 0;
  // Fetch plot data lazily — list endpoint is already cached by react-query
  // when the page rendering this sheet has called useListPlots/useGetMapData.
  const { data: plots } = useListPlots({ organizationId: orgId });
  const plot = plots?.find((p) => p.id === plotId);

  const burialsParams =
    plotId != null ? { organizationId: orgId, plotId } : undefined;
  const { data: burials, isLoading: burialsLoading } = useListBurials(
    burialsParams,
    {
      query: {
        enabled: plotId != null && organizationId != null,
        queryKey: getListBurialsQueryKey(burialsParams),
      },
    },
  );

  // QR codes + org slug for the per-burial memorial QR panel.
  const { data: qrCodes } = useListQrCodes({ organizationId: orgId });
  const { data: org } = useGetOrganization(orgId);
  const qrByBurial = useMemo(() => buildQrByBurialMap(qrCodes), [qrCodes]);

  return (
    <Sheet open={plotId != null} onOpenChange={onOpenChange}>
      <SheetContent className="bg-sidebar border-sidebar-border text-sidebar-foreground w-full sm:max-w-md p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader>
              <SheetTitle className="text-2xl text-sidebar-foreground">
                Burial Spot {plot?.plotNumber ?? "—"}
              </SheetTitle>
              <SheetDescription>
                Section: {plot?.section || "N/A"} • Row: {plot?.row || "N/A"}
              </SheetDescription>
            </SheetHeader>

            {plot && (
              <div className="mt-8 space-y-6">
                {/* ----- Burial spot facts ----- */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider">
                      Status
                    </h3>
                    <Badge
                      variant="outline"
                      className={`capitalize border-none text-white ${getStatusColor(plot.status)}`}
                    >
                      {plot.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">
                        Type
                      </div>
                      <p className="capitalize">{plot.type || "Standard"}</p>
                    </div>
                    {plot.price != null && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">
                          Price
                        </div>
                        <p>${plot.price.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">
                      Owner
                    </div>
                    <p className="font-medium">
                      {plot.ownerName || "Unassigned"}
                    </p>
                    {plot.ownerContact && (
                      <p className="text-xs text-sidebar-foreground/70 mt-0.5">
                        {plot.ownerContact}
                      </p>
                    )}
                  </div>

                  {plot.notes && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">
                        Burial spot notes
                      </div>
                      <p className="text-sm whitespace-pre-line">
                        {plot.notes}
                      </p>
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
                      <Badge variant="secondary" className="text-[10px]">
                        {burials.length}
                      </Badge>
                    )}
                  </div>

                  {burialsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-24 rounded-md bg-sidebar-accent/40" />
                      <Skeleton className="h-24 rounded-md bg-sidebar-accent/40" />
                    </div>
                  ) : !burials || burials.length === 0 ? (
                    <p className="text-xs text-sidebar-foreground/60 italic py-3 px-3 rounded-md border border-dashed border-sidebar-border bg-sidebar-accent/20">
                      No interment records linked to this burial spot yet.
                    </p>
                  ) : (
                    <ul className="space-y-3" data-testid="burial-list">
                      {burials.map((b) => {
                        const qr = qrByBurial.get(b.id);
                        return (
                          <li key={b.id} data-testid={`burial-${b.id}`}>
                            <BurialDetails
                              variant="admin"
                              siteSlug={org?.slug}
                              burial={{
                                name: b.deceasedName,
                                dob: b.deceasedDob,
                                dod: b.deceasedDod,
                                burialDate: b.burialDate,
                                religion: b.religion,
                                photoUrl: b.photoUrl,
                                notes: b.notes,
                                memorialCode: qr?.code ?? null,
                                qrImageUrl: qr?.qrImageUrl ?? null,
                                editPin: qr?.editPin ?? null,
                              }}
                            />
                            <BurialFamilyLinks burialId={b.id} />
                            <div className="px-3 py-1.5 mt-px text-[10px] text-sidebar-foreground/50">
                              Burial spot #{b.plotId} · Record #{b.id}
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
  );
}

/**
 * Sheet showing a single burial record (used by the Burials list page).
 * Reuses the same shared `<BurialDetails>` card so styling stays in sync
 * with the map and plot drawers.
 */
export type BurialRecord = {
  id: number;
  plotId: number;
  deceasedName: string;
  deceasedDob: string | null;
  deceasedDod: string | null;
  burialDate: string | null;
  religion: string | null;
  photoUrl: string | null;
  notes: string | null;
};

export function BurialDetailSheet({
  burial,
  organizationId,
  open,
  onOpenChange,
}: {
  burial: BurialRecord | null;
  organizationId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const orgId = organizationId;
  const { data: qrCodes } = useListQrCodes({ organizationId: orgId });
  const { data: org } = useGetOrganization(orgId);
  const qrByBurial = useMemo(() => buildQrByBurialMap(qrCodes), [qrCodes]);
  const qr = burial ? qrByBurial.get(burial.id) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-sidebar border-sidebar-border text-sidebar-foreground w-full sm:max-w-md p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader>
              <SheetTitle className="text-2xl text-sidebar-foreground">
                {burial?.deceasedName ?? "Burial record"}
              </SheetTitle>
              <SheetDescription>
                Burial spot #{burial?.plotId ?? "—"} · Record #
                {burial?.id ?? "—"}
              </SheetDescription>
            </SheetHeader>

            {burial && (
              <div className="mt-8" data-testid="burial-detail">
                <BurialDetails
                  variant="admin"
                  siteSlug={org?.slug}
                  burial={{
                    name: burial.deceasedName,
                    dob: burial.deceasedDob,
                    dod: burial.deceasedDod,
                    burialDate: burial.burialDate,
                    religion: burial.religion,
                    photoUrl: burial.photoUrl,
                    notes: burial.notes,
                    memorialCode: qr?.code ?? null,
                    qrImageUrl: qr?.qrImageUrl ?? null,
                    editPin: qr?.editPin ?? null,
                  }}
                />
                <BurialFamilyLinks burialId={burial.id} />
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
