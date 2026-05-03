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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Inbox, Mail, Phone, MapPin, Heart, MessageSquare, CheckCircle2, XCircle, Clock, Sparkles, Loader2, AlertCircle, Save, DollarSign, CalendarClock, Repeat,
} from "lucide-react";
import { useVendorRequests, useUpdateRequest, type VendorRequestStatus, type VendorRequestRow, type VendorPaymentStatus, type VendorRequestPatch } from "./api";

const PAYMENT_BADGE: Record<VendorPaymentStatus, { label: string; cls: string }> = {
  unpaid:    { label: "Unpaid",    cls: "border-amber-400/40 text-amber-300 bg-amber-400/5" },
  invoiced:  { label: "Invoiced",  cls: "border-sky-400/40 text-sky-300 bg-sky-400/5" },
  paid:      { label: "Paid",      cls: "border-emerald-400/40 text-emerald-300 bg-emerald-400/5" },
  refunded:  { label: "Refunded",  cls: "border-rose-400/40 text-rose-300 bg-rose-400/5" },
};

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
  const [quotedDraft, setQuotedDraft] = useState("");
  const [paidDraft, setPaidDraft] = useState("");
  const [paymentDraft, setPaymentDraft] = useState<VendorPaymentStatus>("unpaid");
  const [scheduledDraft, setScheduledDraft] = useState("");
  const [recurringDraft, setRecurringDraft] = useState(false);
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

  // Hydrate drafts when focus changes.
  useEffect(() => {
    setNotesDraft(focused?.vendorNotes ?? "");
    setQuotedDraft(focused?.quotedAmount?.toString() ?? "");
    setPaidDraft(focused?.paidAmount?.toString() ?? "");
    setPaymentDraft(focused?.paymentStatus ?? "unpaid");
    setScheduledDraft(focused?.scheduledFor ? focused.scheduledFor.slice(0, 10) : "");
    setRecurringDraft(focused?.isRecurring ?? false);
    setError(null);
  }, [focused?.id]);

  const buildDraftPatch = (): VendorRequestPatch => {
    const quoted = quotedDraft.trim() === "" ? null : Number(quotedDraft);
    const paid = paidDraft.trim() === "" ? null : Number(paidDraft);
    return {
      vendorNotes: notesDraft.trim() || null,
      quotedAmount: quoted,
      paidAmount: paid,
      paymentStatus: paymentDraft,
      scheduledFor: scheduledDraft ? new Date(scheduledDraft).toISOString() : null,
      isRecurring: recurringDraft,
    };
  };

  const setStatus = async (r: VendorRequestRow, status: VendorRequestStatus) => {
    setError(null);
    try { await update.mutateAsync({ id: r.id, patch: { ...buildDraftPatch(), status } }); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  };

  const saveDetails = async () => {
    if (!focused) return;
    setError(null);
    try { await update.mutateAsync({ id: focused.id, patch: buildDraftPatch() }); }
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-border/40 bg-card/50 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3 w-3" />Quoted ($)</Label>
                    <Input type="number" min={0} value={quotedDraft} onChange={(e) => setQuotedDraft(e.target.value)} placeholder="0" data-testid="input-quoted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3 w-3" />Paid ($)</Label>
                    <Input type="number" min={0} value={paidDraft} onChange={(e) => setPaidDraft(e.target.value)} placeholder="0" data-testid="input-paid" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Payment status</Label>
                    <div className="flex flex-wrap gap-1">
                      {(["unpaid", "invoiced", "paid", "refunded"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPaymentDraft(s)}
                          data-testid={`payment-${s}`}
                          className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                            paymentDraft === s
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {PAYMENT_BADGE[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3 w-3" />Scheduled for</Label>
                    <Input type="date" value={scheduledDraft} onChange={(e) => setScheduledDraft(e.target.value)} data-testid="input-scheduled" />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-violet-300" />
                      <div>
                        <p className="text-sm font-medium">Recurring subscription</p>
                        <p className="text-[11px] text-muted-foreground">Mark on for monthly grave care, annual remembrance, etc.</p>
                      </div>
                    </div>
                    <Switch checked={recurringDraft} onCheckedChange={setRecurringDraft} data-testid="switch-recurring" />
                  </div>
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
                  <Button variant="ghost" onClick={saveDetails} disabled={update.isPending} data-testid="button-save-notes">
                    {update.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Save details
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
