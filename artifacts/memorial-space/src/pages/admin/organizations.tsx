import { useState } from "react";
import {
  Building2,
  Search,
  MoreHorizontal,
  Eye,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  Users,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  CEMETERY_TYPE_META,
  FEATURE_GROUPS,
  FEATURE_META,
  type CemeteryType,
  type PlatformFeature,
} from "@/lib/cemetery-features";
import { Settings2, Layers } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import {
  formatCents,
  formatDate,
  orgStatusClass,
  subStatusClass,
} from "./_shared";
import {
  useAdminOrgs,
  useAdminOrgDetail,
  useAdminPlans,
  useSuspendOrg,
  useReactivateOrg,
  useDeleteOrg,
  useUpdateOrg,
  useCreateSubscription,
  useCancelSubscription,
  type OrgAdminRow,
} from "./api";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AdminOrganizations() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [suspendId, setSuspendId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data: orgs, isLoading } = useAdminOrgs({
    q: q.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const suspend = useSuspendOrg();
  const reactivate = useReactivateOrg();
  const del = useDeleteOrg();
  const { toast } = useToast();

  const counts = (orgs ?? []).reduce(
    (a, o) => {
      a.total++;
      a[o.status] = (a[o.status] ?? 0) + 1;
      return a;
    },
    { total: 0 } as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#d4a843] mb-1">Super Admin</p>
          <h1 className="text-3xl font-bold tracking-tight">Cemetery Organizations</h1>
          <p className="text-muted-foreground mt-1">
            Every customer organization across the platform — manage subscriptions,
            suspend, and review billing.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{counts.total ?? 0} total</Badge>
          <Badge variant="outline" className={orgStatusClass.active}>
            {counts.active ?? 0} active
          </Badge>
          <Badge variant="outline" className={orgStatusClass.trial}>
            {counts.trial ?? 0} trial
          </Badge>
          <Badge variant="outline" className={orgStatusClass.suspended}>
            {counts.suspended ?? 0} suspended
          </Badge>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="admin-org-search"
              placeholder="Search by name, slug, or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="admin-org-status" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Organization</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Subscription</th>
                  <th className="text-right px-4 py-3 font-medium">Users</th>
                  <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && (orgs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No organizations match.
                    </td>
                  </tr>
                )}
                {(orgs ?? []).map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                    data-testid={`admin-org-row-${o.id}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setOpenId(o.id)}
                        className="text-left flex items-center gap-3 group"
                      >
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                          {o.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <p className="font-medium group-hover:text-[#d4a843]">{o.name}</p>
                          <p className="text-xs text-muted-foreground">
                            /{o.slug} · {o.cemeteryType}
                            {o.city ? ` · ${o.city}` : ""}
                          </p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={orgStatusClass[o.status] ?? ""}>
                        {o.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {o.plan ? (
                        <Badge
                          variant="outline"
                          className={
                            o.plan.slug === "enterprise"
                              ? "border-[#d4a843]/40 text-[#d4a843]"
                              : ""
                          }
                        >
                          {o.plan.name} · {formatCents(o.plan.priceCents)}/mo
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No plan</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {o.subscription ? (
                        <Badge variant="outline" className={subStatusClass[o.subscription.status]}>
                          {o.subscription.status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.userCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {o.outstandingCents > 0 ? (
                        <span className="text-amber-400">{formatCents(o.outstandingCents)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`admin-org-menu-${o.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setOpenId(o.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(`/c/${o.slug}?previewOrgId=${o.id}`, "_blank")
                            }
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open public site
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {o.status === "suspended" ? (
                            <DropdownMenuItem
                              onClick={() => {
                                reactivate.mutate(o.id, {
                                  onSuccess: () =>
                                    toast({ title: "Reactivated", description: o.name }),
                                });
                              }}
                            >
                              <Play className="h-4 w-4 mr-2 text-emerald-400" />
                              Reactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setSuspendId(o.id);
                                setSuspendReason("");
                              }}
                            >
                              <Pause className="h-4 w-4 mr-2 text-amber-400" />
                              Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-400"
                            onClick={() => setDeleteId(o.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete organization
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <OrgDetailSheet id={openId} onClose={() => setOpenId(null)} />

      <Dialog open={suspendId != null} onOpenChange={(o) => !o && setSuspendId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Suspended organizations cannot sign in. Their data is preserved and you can
              reactivate at any time.
            </p>
            <div>
              <Label>Reason (optional, internal)</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                placeholder="Non-payment, support escalation, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendId(null)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                if (suspendId == null) return;
                suspend.mutate(
                  { id: suspendId, reason: suspendReason || undefined },
                  {
                    onSuccess: () => {
                      toast({ title: "Suspended", description: "Organization is now suspended." });
                      setSuspendId(null);
                    },
                    onError: (e: Error) =>
                      toast({ title: "Failed", description: e.message, variant: "destructive" }),
                  },
                );
              }}
            >
              <Pause className="h-4 w-4 mr-2" />
              Suspend now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the organization and all of its data — burials,
              plots, billing, everything. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (deleteId == null) return;
                del.mutate(deleteId, {
                  onSuccess: () => {
                    toast({ title: "Deleted" });
                    setDeleteId(null);
                  },
                  onError: (e: Error) =>
                    toast({ title: "Failed", description: e.message, variant: "destructive" }),
                });
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrgDetailSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading } = useAdminOrgDetail(id);
  const { data: plans } = useAdminPlans();
  const update = useUpdateOrg();
  const createSub = useCreateSubscription();
  const cancelSub = useCancelSubscription();
  const { toast } = useToast();
  const [planId, setPlanId] = useState<string>("");
  const [trial, setTrial] = useState(false);

  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent key={id ?? "none"} className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#d4a843]" />
            {data?.org.name ?? (isLoading ? "Loading…" : "Organization")}
          </SheetTitle>
        </SheetHeader>

        {data && (
          <div className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Slug" value={`/${data.org.slug}`} />
              <Field label="Type" value={data.org.cemeteryType} />
              <Field label="Email" value={data.org.email ?? "—"} />
              <Field label="Phone" value={data.org.phone ?? "—"} />
              <Field label="City" value={data.org.city ?? "—"} />
              <Field label="Country" value={data.org.country ?? "—"} />
              <Field label="Status" value={data.org.status} />
              <Field label="Joined" value={formatDate(data.org.createdAt)} />
              <Field label="Users" value={String(data.users.length)} />
              <Field label="Plots" value={String(data.org.totalPlots ?? 0)} />
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-[#d4a843]" /> Subscriptions
              </h3>
              <div className="space-y-2">
                {data.subscriptions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No subscriptions on record.</p>
                )}
                {data.subscriptions.map(({ sub, plan }) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/40"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {plan?.name ?? "Plan removed"} · {formatCents(sub.pricePerPeriodCents)}/{sub.billingPeriod === "yearly" ? "yr" : "mo"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(sub.currentPeriodStart)} → {formatDate(sub.currentPeriodEnd)}
                        {sub.trialEndsAt ? ` · trial ends ${formatDate(sub.trialEndsAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={subStatusClass[sub.status]}>
                        {sub.status}
                      </Badge>
                      {(sub.status === "active" || sub.status === "trialing") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            cancelSub.mutate(
                              { id: sub.id, immediate: true },
                              {
                                onSuccess: () => toast({ title: "Cancelled" }),
                              },
                            )
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-end gap-2 p-3 rounded-lg border border-dashed border-border/60">
                <div className="flex-1">
                  <Label className="text-xs">Assign new plan</Label>
                  <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick plan…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(plans ?? []).filter((p) => p.isActive).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} · {formatCents(p.priceCents)}/mo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs pb-2">
                  <input
                    type="checkbox"
                    checked={trial}
                    onChange={(e) => setTrial(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Start trial
                </label>
                <Button
                  disabled={!planId}
                  onClick={() => {
                    if (!planId || id == null) return;
                    createSub.mutate(
                      { organizationId: id, planId: Number(planId), startTrial: trial },
                      {
                        onSuccess: () => {
                          toast({ title: "Subscription created" });
                          setPlanId("");
                          setTrial(false);
                        },
                        onError: (e: Error) =>
                          toast({
                            title: "Failed",
                            description: e.message,
                            variant: "destructive",
                          }),
                      },
                    );
                  }}
                >
                  Subscribe
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#d4a843]" /> Recent invoices
              </h3>
              {data.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No platform invoices.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.invoices.slice(0, 5).map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between text-sm p-2 rounded border border-border/40"
                    >
                      <span>
                        {i.invoiceNumber ?? `Draft #${i.id}`} · {formatCents(i.totalCents, i.currency)}
                      </span>
                      <Badge variant="outline" className="text-xs">{i.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-[#d4a843]" /> Team ({data.users.length})
              </h3>
              <div className="space-y-1">
                {data.users.slice(0, 8).map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between text-sm p-2 rounded border border-border/30"
                  >
                    <div>
                      <span className="font-medium">{u.name ?? u.email}</span>
                      <span className="text-xs text-muted-foreground ml-2">{u.email}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {u.role}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {u.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <OrgCemeteryTypesEditor org={data.org} />

            <OrgFeaturesEditor org={data.org} />

            <div>
              <Label className="text-xs">Internal notes (Super Admin only)</Label>
              <Textarea
                rows={3}
                defaultValue={data.org.internalNotes ?? ""}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val !== (data.org.internalNotes ?? "")) {
                    update.mutate(
                      { id: data.org.id, internalNotes: val || null },
                      { onSuccess: () => toast({ title: "Notes saved" }) },
                    );
                  }
                }}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrgCemeteryTypesEditor({ org }: { org: OrgAdminRow }) {
  const update = useUpdateOrg();
  const { toast } = useToast();
  // Local optimistic state so rapid toggles aren't fighting an in-flight PATCH.
  // Resync when the org id changes (different sheet) or the server payload
  // genuinely changes (after invalidate/refetch).
  const initial = (
    org.cemeteryTypes && org.cemeteryTypes.length > 0
      ? org.cemeteryTypes
      : [org.cemeteryType]
  ) as CemeteryType[];
  const [current, setCurrent] = useState<CemeteryType[]>(initial);
  const lastKey = `${org.id}:${initial.slice().sort().join(",")}`;
  const [seenKey, setSeenKey] = useState(lastKey);
  if (lastKey !== seenKey) {
    setSeenKey(lastKey);
    setCurrent(initial);
  }

  function toggle(t: CemeteryType) {
    const next = current.includes(t)
      ? current.filter((x) => x !== t)
      : [...current, t];
    if (next.length === 0) {
      toast({
        title: "Keep at least one type",
        description: "An organization must have at least one cemetery type.",
        variant: "destructive",
      });
      return;
    }
    setCurrent(next); // optimistic — subsequent toggles read this, not the prop
    update.mutate(
      {
        id: org.id,
        cemeteryTypes: next as unknown as OrgAdminRow["cemeteryTypes"],
        cemeteryType: next[0],
      },
      {
        onSuccess: () => toast({ title: "Cemetery types updated" }),
        onError: (e: Error) => {
          setCurrent(initial); // rollback
          toast({ title: "Failed", description: e.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <div>
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-[#d4a843]" /> Cemetery types
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CEMETERY_TYPE_META.map((t) => {
          const Icon = t.icon;
          const on = current.includes(t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => toggle(t.value)}
              data-testid={`admin-org-type-${t.value}`}
              className={
                "flex items-center gap-2 p-2 rounded-md border text-left text-xs transition-colors " +
                (on
                  ? "border-[#d4a843]/50 bg-[#d4a843]/10 text-foreground"
                  : "border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className={"h-4 w-4 " + (on ? "text-[#d4a843]" : t.accent)} />
              <span className="font-medium truncate">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrgFeaturesEditor({ org }: { org: OrgAdminRow }) {
  const update = useUpdateOrg();
  const { toast } = useToast();
  // Mirror local state so rapid toggles don't read stale prop data while a
  // PATCH is in flight (the prop only updates after the cache invalidates).
  const initial = (org.enabledFeatures ?? {}) as Record<PlatformFeature, boolean>;
  const [features, setFeatures] = useState<Record<PlatformFeature, boolean>>(initial);
  const featuresKey = `${org.id}:${Object.entries(initial)
    .sort()
    .map(([k, v]) => `${k}=${v ? 1 : 0}`)
    .join(",")}`;
  const [seenKey, setSeenKey] = useState(featuresKey);
  if (featuresKey !== seenKey) {
    setSeenKey(featuresKey);
    setFeatures(initial);
  }

  function setFeature(key: PlatformFeature, value: boolean) {
    const next = { ...features, [key]: value };
    setFeatures(next); // optimistic
    update.mutate(
      {
        id: org.id,
        enabledFeatures: next as unknown as OrgAdminRow["enabledFeatures"],
        ...(key === "columbarium" ? { featuresColumbarium: value } : {}),
      },
      {
        onSuccess: () =>
          toast({
            title: value ? "Feature enabled" : "Feature disabled",
            description: FEATURE_META.find((f) => f.key === key)?.label,
          }),
        onError: (e: Error) => {
          setFeatures(initial); // rollback
          toast({ title: "Failed", description: e.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <div>
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-[#d4a843]" /> Available features
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Toggle which modules this organization can use. Disabled modules are
        hidden from their team's navigation.
      </p>
      <div className="space-y-4">
        {FEATURE_GROUPS.map((group) => {
          const items = FEATURE_META.filter((f) => f.group === group);
          return (
            <div key={group}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {group}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {items.map((f) => {
                  const Icon = f.icon;
                  const on = !!features[f.key];
                  return (
                    <div
                      key={f.key}
                      className="flex items-center gap-3 p-2 rounded-md border border-border/40 bg-muted/10"
                    >
                      <div
                        className={
                          "h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 " +
                          (on
                            ? "bg-[#d4a843]/15 text-[#d4a843]"
                            : "bg-card text-muted-foreground border border-border/40")
                        }
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{f.label}</p>
                        <p className="text-xs text-muted-foreground leading-snug">
                          {f.description}
                        </p>
                      </div>
                      <Switch
                        checked={on}
                        onCheckedChange={(v) => setFeature(f.key, v)}
                        data-testid={`admin-org-feature-${f.key}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

// Re-export for convenience (used by analytics page) - keep at bottom to avoid clutter.
export type { OrgAdminRow };
