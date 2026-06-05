/**
 * Reusable plot detail Sheet — opens when a burial spot is clicked in the
 * Grid View, Burial Spots list, or Cemetery Map.
 */
import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cross, QrCode as QrCodeIcon } from "lucide-react";
import { BurialDetails } from "@/components/burial-details";
import { BurialFamilyLinks } from "@/components/burial-family-links";

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
    case "available":   return "bg-[#40916c] hover:bg-[#40916c]/80";
    case "reserved":    return "bg-[#d4a843] hover:bg-[#d4a843]/80";
    case "occupied":    return "bg-[#374151] hover:bg-[#374151]/80";
    case "maintenance": return "bg-[#ef4444] hover:bg-[#ef4444]/80";
    default:            return "bg-secondary hover:bg-secondary/80";
  }
}

// ─── Per-burial QR panel ──────────────────────────────────────────────────────
// Self-contained: owns its own QR state so it doesn't depend on shared hook
// timing. Starts with whatever the parent found in the cache, then lets the
// operator generate if missing.

type BurialQrPanelProps = {
  burialId: number;
  plotId: number;
  organizationId: number;
  siteSlug: string | undefined;
  initialQr: QrCode | undefined;
  burial: {
    name: string;
    dob: string | null;
    dod: string | null;
    burialDate: string | null;
    religion: string | null;
    photoUrl: string | null;
    notes: string | null;
  };
};

function BurialQrPanel({ burialId, plotId, organizationId, siteSlug, initialQr, burial }: BurialQrPanelProps) {
  const [qr, setQr] = useState<QrCode | undefined>(initialQr);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when the parent resolves its hook (e.g. initial render before cache hit)
  useEffect(() => {
    if (initialQr && !qr) setQr(initialQr);
  }, [initialQr, qr]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/qr-codes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ burialId, plotId, organizationId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Failed (${res.status})`);
      setQr(body as QrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-2">
      <BurialDetails
        variant="admin"
        siteSlug={siteSlug}
        burial={{
          name: burial.name,
          dob: burial.dob,
          dod: burial.dod,
          burialDate: burial.burialDate,
          religion: burial.religion,
          photoUrl: burial.photoUrl,
          notes: burial.notes,
          memorialCode: qr?.code ?? null,
          qrImageUrl: qr?.qrImageUrl ?? null,
          editPin: qr?.editPin ?? null,
        }}
      />

      {/* Show Generate button only when no QR exists */}
      {!qr && (
        <div className="flex flex-col gap-1.5 px-3 py-3 rounded-md border border-dashed border-sidebar-border bg-sidebar-accent/20">
          <p className="text-xs text-sidebar-foreground/60">
            No QR code yet — generate one to link this burial to a memorial page.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 self-start"
            disabled={generating}
            onClick={handleGenerate}
          >
            <QrCodeIcon className="h-3.5 w-3.5" />
            {generating ? "Generating…" : "Generate QR Code"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── PlotDetailSheet ──────────────────────────────────────────────────────────

export type PlotDetailSheetProps = {
  plotId: number | null;
  organizationId: number | null;
  onOpenChange: (open: boolean) => void;
};

export function PlotDetailSheet({ plotId, organizationId, onOpenChange }: PlotDetailSheetProps) {
  const orgId = organizationId ?? 0;
  const enabled = organizationId != null && plotId != null;

  const { data: plots } = useListPlots(
    { organizationId: orgId },
    { query: { enabled: organizationId != null } },
  );
  const plot = plots?.find((p: any) => p.id === plotId);

  const burialsParams = enabled ? { organizationId: orgId, plotId: plotId! } : undefined;
  const { data: burials, isLoading: burialsLoading } = useListBurials(burialsParams, {
    query: {
      enabled,
      queryKey: getListBurialsQueryKey(burialsParams),
    },
  });

  const { data: qrCodes } = useListQrCodes(
    { organizationId: orgId },
    { query: { enabled: organizationId != null } },
  );
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
                {/* Spot facts */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-sidebar-foreground/70 uppercase tracking-wider">Status</h3>
                    <Badge variant="outline" className={`capitalize border-none text-white ${getStatusColor(plot.status)}`}>
                      {plot.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">Type</div>
                      <p className="capitalize">{plot.type || "Standard"}</p>
                    </div>
                    {plot.price != null && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">Price</div>
                        <p>${plot.price.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">Owner</div>
                    <p className="font-medium">{plot.ownerName || "Unassigned"}</p>
                    {plot.ownerContact && (
                      <p className="text-xs text-sidebar-foreground/70 mt-0.5">{plot.ownerContact}</p>
                    )}
                  </div>

                  {plot.notes && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 mb-1">Burial spot notes</div>
                      <p className="text-sm whitespace-pre-line">{plot.notes}</p>
                    </div>
                  )}
                </section>

                <Separator className="bg-sidebar-border" />

                {/* Burial records */}
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
                    </div>
                  ) : !burials || burials.length === 0 ? (
                    <p className="text-xs text-sidebar-foreground/60 italic py-3 px-3 rounded-md border border-dashed border-sidebar-border bg-sidebar-accent/20">
                      No interment records linked to this burial spot yet.
                    </p>
                  ) : (
                    <ul className="space-y-4" data-testid="burial-list">
                      {(burials as any[]).map((b) => (
                        <li key={b.id} data-testid={`burial-${b.id}`} className="space-y-1.5">
                          <BurialQrPanel
                            burialId={b.id}
                            plotId={b.plotId}
                            organizationId={orgId}
                            siteSlug={org?.slug}
                            initialQr={qrByBurial.get(b.id)}
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
                          <BurialFamilyLinks burialId={b.id} />
                          <div className="px-3 py-1 text-[10px] text-sidebar-foreground/50">
                            Burial spot #{b.plotId} · Record #{b.id}
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
  );
}

// ─── BurialDetailSheet (used by Burials list page) ───────────────────────────

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
  const { data: qrCodes } = useListQrCodes({ organizationId });
  const { data: org } = useGetOrganization(organizationId);
  const qrByBurial = useMemo(() => buildQrByBurialMap(qrCodes), [qrCodes]);

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
                Burial spot #{burial?.plotId ?? "—"} · Record #{burial?.id ?? "—"}
              </SheetDescription>
            </SheetHeader>

            {burial && (
              <div className="mt-8 space-y-3" data-testid="burial-detail">
                <BurialQrPanel
                  burialId={burial.id}
                  plotId={burial.plotId}
                  organizationId={organizationId}
                  siteSlug={org?.slug}
                  initialQr={qrByBurial.get(burial.id)}
                  burial={{
                    name: burial.deceasedName,
                    dob: burial.deceasedDob,
                    dod: burial.deceasedDod,
                    burialDate: burial.burialDate,
                    religion: burial.religion,
                    photoUrl: burial.photoUrl,
                    notes: burial.notes,
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
