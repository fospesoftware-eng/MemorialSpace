/**
 * Vendor request inbox. Lists incoming `vendor_requests` with status filters
 * and a focused detail panel where the vendor accepts / declines / completes
 * each request and adds private vendor notes.
 */
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Inbox, Mail, Phone, MapPin, Heart, MessageSquare, CheckCircle2, XCircle, Clock, Sparkles, Loader2, AlertCircle, Save,
} from "lucide-react";
import { useVendorRequests, useUpdateRequest, type VendorRequestStatus, type VendorRequestRow } from "./api";

const STATUS_TABS: { key: VendorRequestStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "completed", label: "Completed" },
  { key: "declined", label: "Declined" },
  { key: "cancelled", label: "Cancelled" },
];

const statusBadge: Record<VendorRequestStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending:   { label: "Pending",   cls: "border-amber-400/40 text-amber-300 bg-amber-400/5",      icon: Clock },
  accepted:  { label: "Accepted",  cls: "border-sky-400/40 text-sky-300 bg-sky-400/5",            icon: CheckCircle2 },
  declined:  { label: "Declined",  cls: "border-rose-400/40 text-rose-300 bg-rose-400/5",         icon: XCircle },
  completed: { label: "Completed", cls: "border-emerald-400/40 text-emerald-300 bg-emerald-400/5",icon: Sparkles },
  cancelled: { label: "Cancelled", cls: "border-muted-foreground/30 text-muted-foreground bg-muted/30", icon: XCircle },
};

export default function VendorRequests() {
  const [tab, setTab] = useState<VendorRequestStatus | "all">("all");
  const filterStatus = tab === "all" ? undefined : tab;
  const { data, isLoading } = useVendorRequests(filterStatus);
  const update = useUpdateRequest();
  const [focusId, setFocusId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Auto-focus a request via `?focus=ID` (deep-linked from dashboard).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("focus"));
    if (Number.isFinite(id) && id > 0) setFocusId(id);
  }, []);

  const requests = data?.requests ?? [];
  const focused = useMemo(() => requests.find((r) => r.id === focusId) ?? null, [requests, focusId]);

  // Hydrate notes when focus changes.
  useEffect(() => {
    setNotesDraft(focused?.vendorNotes ?? "");
    setError(null);
  }, [focused?.id]);

  const setStatus = async (r: VendorRequestRow, status: VendorRequestStatus) => {
    setError(null);
    try { await update.mutateAsync({ id: r.id, patch: { status, vendorNotes: notesDraft.trim() || null } }); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  };

  const saveNotes = async () => {
    if (!focused) return;
    setError(null);
    try { await update.mutateAsync({ id: focused.id, patch: { vendorNotes: notesDraft.trim() || null } }); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Requests</h1>
          <p className="text-muted-foreground mt-1">Incoming service requests from families.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border/40">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`tab-${t.key}`}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : requests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Inbox className="h-8 w-8 mx-auto opacity-40 mb-2" />
                <p className="text-sm">No requests in this view.</p>
              </CardContent>
            </Card>
          ) : (
            requests.map((r) => {
              const sb = statusBadge[r.status];
              const Icon = sb.icon;
              const isFocused = r.id === focusId;
              return (
                <button
                  key={r.id}
                  onClick={() => setFocusId(r.id)}
                  data-testid={`request-row-${r.id}`}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    isFocused ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{r.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.customerEmail}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider shrink-0 ${sb.cls}`}>
                      <Icon className="h-3 w-3 mr-1" />{sb.label}
                    </Badge>
                  </div>
                  {r.deceasedName ? (
                    <p className="text-xs text-muted-foreground mt-1 truncate"><Heart className="h-3 w-3 inline mr-1" />for {r.deceasedName}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.message}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-2">{new Date(r.createdAt).toLocaleString()}</p>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-3">
          {focused ? (
            <Card className="border-border/60" data-testid="request-detail">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Request from</p>
                    <h2 className="text-2xl font-bold mt-1">{focused.customerName}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(focused.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs uppercase tracking-wider ${statusBadge[focused.status].cls}`}>
                    {statusBadge[focused.status].label}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-border/40 bg-muted/20 p-4 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a href={`mailto:${focused.customerEmail}`} className="truncate hover:underline">{focused.customerEmail}</a>
                  </div>
                  {focused.customerPhone ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={`tel:${focused.customerPhone}`} className="truncate hover:underline">{focused.customerPhone}</a>
                    </div>
                  ) : null}
                  {focused.deceasedName ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <Heart className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">For {focused.deceasedName}</span>
                    </div>
                  ) : null}
                  {focused.serviceLocation ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{focused.serviceLocation}</span>
                    </div>
                  ) : null}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" />Message
                  </p>
                  <p className="text-sm whitespace-pre-line bg-card border border-border/40 rounded-md p-4">{focused.message}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Private vendor notes</p>
                  <Textarea
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Notes only you can see — quotes, follow-ups, etc."
                    data-testid="input-vendor-notes"
                  />
                </div>

                {error ? (
                  <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-300 px-3 py-2 text-xs flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span>{error}</span>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 justify-between border-t border-border/40 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setStatus(focused, "accepted")}
                      disabled={update.isPending || focused.status === "accepted"}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      data-testid="button-accept"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />Accept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setStatus(focused, "declined")}
                      disabled={update.isPending || focused.status === "declined"}
                      data-testid="button-decline"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />Decline
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setStatus(focused, "completed")}
                      disabled={update.isPending || focused.status === "completed"}
                      data-testid="button-complete"
                    >
                      <Sparkles className="h-4 w-4 mr-1.5" />Mark complete
                    </Button>
                  </div>
                  <Button variant="ghost" onClick={saveNotes} disabled={update.isPending} data-testid="button-save-notes">
                    {update.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Save notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed h-full">
              <CardContent className="p-10 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[300px]">
                <Inbox className="h-10 w-10 opacity-40 mb-3" />
                <p className="text-sm">Pick a request from the list to view details and respond.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
