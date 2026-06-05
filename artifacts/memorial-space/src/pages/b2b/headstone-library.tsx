import { useEffect, useMemo, useState } from "react";
import { useListOrganizations } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BookImage, ExternalLink, Image as ImageIcon, MapPin, Search, Unlink } from "lucide-react";

type LinkedPlot = {
  plotId: number;
  plotNumber: string;
  section: string | null;
  row: string | null;
  status: string;
};

type LinkedBurial = {
  burialId: number;
  deceasedName: string;
  deceasedDob: string | null;
  deceasedDod: string | null;
};

type LibraryImage = {
  imageFileName: string;
  storedPath: string;
  people: Array<{ name: string; dateOfBirth?: string | null; dateOfDeath?: string | null }>;
  isFamilyHeadstone?: boolean;
  inscriptionText?: string;
  confidence?: number;
  status?: string;
  verifiedAt?: string;
  linkedPlot: LinkedPlot | null;
  linkedBurial: LinkedBurial | null;
};

type LibraryResponse = {
  organizationId: number;
  folder: string;
  totalImages: number;
  linkedCount: number;
  images: LibraryImage[];
};

function statusColor(status: string) {
  switch (status) {
    case "available": return "bg-[#40916c]/20 text-[#40916c]";
    case "reserved":  return "bg-[#d4a843]/20 text-[#d4a843]";
    case "occupied":  return "bg-[#374151]/20 text-[#374151] dark:bg-[#374151]/40 dark:text-slate-300";
    case "maintenance": return "bg-destructive/20 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function HeadstoneLibraryPage() {
  const { user } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = useListOrganizations();

  const defaultOrgId = user?.organizationId ?? undefined;
  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(defaultOrgId);
  useEffect(() => {
    if (!selectedOrgId && defaultOrgId) setSelectedOrgId(defaultOrgId);
  }, [defaultOrgId, selectedOrgId]);

  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterLinked, setFilterLinked] = useState<"all" | "linked" | "unlinked">("all");
  const [selectedImage, setSelectedImage] = useState<LibraryImage | null>(null);

  useEffect(() => {
    if (!selectedOrgId) { setLibrary(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedImage(null);
    fetch(`/api/headstone-import/library?cemeteryId=${selectedOrgId}`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
        return body as LibraryResponse;
      })
      .then((data) => { if (!cancelled) setLibrary(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load library."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedOrgId]);

  const filteredImages = useMemo(() => {
    const images = library?.images ?? [];
    const term = query.trim().toLowerCase();
    return images.filter((img) => {
      if (filterLinked === "linked" && !img.linkedPlot) return false;
      if (filterLinked === "unlinked" && img.linkedPlot) return false;
      if (!term) return true;
      return (
        img.imageFileName.toLowerCase().includes(term) ||
        img.inscriptionText?.toLowerCase().includes(term) ||
        img.people.some((p) => p.name.toLowerCase().includes(term)) ||
        img.linkedBurial?.deceasedName.toLowerCase().includes(term) ||
        img.linkedPlot?.plotNumber.toLowerCase().includes(term) ||
        img.linkedPlot?.section?.toLowerCase().includes(term)
      );
    });
  }, [library?.images, query, filterLinked]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <BookImage className="h-4 w-4" /> Import Data
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Headstone Library</h1>
          <p className="mt-1 text-muted-foreground">
            All headstone images uploaded for this cemetery, linked to their burial spots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={selectedOrgId?.toString() ?? ""}
            onValueChange={(v) => { setSelectedOrgId(Number(v)); setQuery(""); setFilterLinked("all"); }}
            disabled={orgsLoading}
          >
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Select a cemetery" />
            </SelectTrigger>
            <SelectContent>
              {orgs?.map((org: any) => (
                <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats bar */}
      {library && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span><span className="font-semibold text-foreground">{library.totalImages}</span> total images</span>
          <span><span className="font-semibold text-foreground">{library.linkedCount}</span> linked to burial spots</span>
          <span><span className="font-semibold text-foreground">{library.totalImages - library.linkedCount}</span> unlinked</span>
        </div>
      )}

      {/* Filters */}
      {library && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, plot, inscription…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {(["all", "linked", "unlinked"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterLinked(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filterLinked === f
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        {!selectedOrgId ? (
          <div className="text-center py-16 text-muted-foreground">
            Select a cemetery above to view its headstone library.
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 text-destructive">{error}</div>
        ) : !library?.images.length ? (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            <ImageIcon className="mx-auto h-10 w-10 opacity-30" />
            <p>No headstone images found for this cemetery.</p>
            <p className="text-sm">Use <strong>Headstone AI Import</strong> to upload and scan images.</p>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No images match your search.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
            {filteredImages.map((img) => (
              <button
                key={img.imageFileName}
                type="button"
                onClick={() => setSelectedImage(img === selectedImage ? null : img)}
                className={`group flex flex-col rounded-xl border overflow-hidden bg-background text-left transition-all hover:shadow-md ${
                  selectedImage === img ? "ring-2 ring-primary shadow-md" : ""
                }`}
              >
                {/* Image thumbnail */}
                <div className="relative aspect-[3/4] w-full bg-muted overflow-hidden">
                  <img
                    src={img.storedPath}
                    alt={img.imageFileName}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Linked badge */}
                  <div className="absolute top-2 right-2">
                    {img.linkedPlot ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#40916c] px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                        <MapPin className="h-2.5 w-2.5" /> {img.linkedPlot.plotNumber}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground shadow">
                        <Unlink className="h-2.5 w-2.5" /> unlinked
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex flex-col gap-0.5 p-2.5">
                  <p className="truncate text-xs font-semibold leading-tight">
                    {img.linkedBurial?.deceasedName
                      || img.people[0]?.name
                      || img.imageFileName}
                  </p>
                  {(img.linkedBurial?.deceasedDob || img.linkedBurial?.deceasedDod || img.people[0]?.dateOfBirth || img.people[0]?.dateOfDeath) && (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {img.linkedBurial?.deceasedDob ?? img.people[0]?.dateOfBirth ?? "?"} –{" "}
                      {img.linkedBurial?.deceasedDod ?? img.people[0]?.dateOfDeath ?? "?"}
                    </p>
                  )}
                  {img.linkedPlot && (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {[img.linkedPlot.section, img.linkedPlot.row].filter(Boolean).join(" / ")}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedImage && (
        <div className="border rounded-xl bg-card shadow-sm p-6 grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="w-full md:w-56 shrink-0">
            <img
              src={selectedImage.storedPath}
              alt={selectedImage.imageFileName}
              className="w-full rounded-lg border object-cover shadow-sm"
            />
            <a
              href={selectedImage.storedPath}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Open full size
            </a>
          </div>

          <div className="space-y-5 min-w-0">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">File</p>
              <p className="text-sm font-mono break-all">{selectedImage.imageFileName}</p>
            </div>

            {/* People extracted by AI */}
            {selectedImage.people.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                  AI Extracted People
                </p>
                <div className="space-y-1.5">
                  {selectedImage.people.map((p, i) => (
                    <div key={i} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <p className="font-semibold">{p.name}</p>
                      {(p.dateOfBirth || p.dateOfDeath) && (
                        <p className="text-xs text-muted-foreground">
                          {p.dateOfBirth ?? "?"} – {p.dateOfDeath ?? "?"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked burial spot */}
            {selectedImage.linkedPlot ? (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                  Linked Burial Spot
                </p>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Plot {selectedImage.linkedPlot.plotNumber}</span>
                    <Badge variant="outline" className={`text-[10px] capitalize border-none ${statusColor(selectedImage.linkedPlot.status)}`}>
                      {selectedImage.linkedPlot.status}
                    </Badge>
                  </div>
                  {(selectedImage.linkedPlot.section || selectedImage.linkedPlot.row) && (
                    <p className="text-xs text-muted-foreground">
                      Section: {selectedImage.linkedPlot.section ?? "—"} &nbsp;/&nbsp; Row: {selectedImage.linkedPlot.row ?? "—"}
                    </p>
                  )}
                  {selectedImage.linkedBurial && (
                    <div className="pt-1 border-t mt-1">
                      <p className="font-semibold">{selectedImage.linkedBurial.deceasedName}</p>
                      {(selectedImage.linkedBurial.deceasedDob || selectedImage.linkedBurial.deceasedDod) && (
                        <p className="text-xs text-muted-foreground">
                          {selectedImage.linkedBurial.deceasedDob ?? "?"} – {selectedImage.linkedBurial.deceasedDod ?? "?"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Unlink className="mb-1 h-4 w-4" />
                Not yet linked to a burial spot. Use the Map Maker or Headstone AI Import to assign this image to a plot.
              </div>
            )}

            {/* Inscription */}
            {selectedImage.inscriptionText && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Inscription Text
                </p>
                <p className="text-sm whitespace-pre-line rounded-md border bg-muted/20 px-3 py-2">
                  {selectedImage.inscriptionText}
                </p>
              </div>
            )}

            {/* Confidence + status */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {selectedImage.confidence != null && (
                <span>Confidence: <strong>{Math.round(selectedImage.confidence * 100)}%</strong></span>
              )}
              {selectedImage.status && (
                <span>Status: <strong className="capitalize">{selectedImage.status.replace(/_/g, " ")}</strong></span>
              )}
              {selectedImage.verifiedAt && (
                <span>Verified: <strong>{new Date(selectedImage.verifiedAt).toLocaleDateString()}</strong></span>
              )}
              {selectedImage.isFamilyHeadstone && (
                <Badge variant="secondary" className="text-[10px]">Family headstone</Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
