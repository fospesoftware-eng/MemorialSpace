import { useState } from "react";
import {
  CreditCard,
  Plus,
  Star,
  Trash2,
  Pencil,
  Check,
  X,
  FileText,
  Send,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

import {
  formatCents,
  formatDate,
  invoiceStatusClass,
  subStatusClass,
} from "./_shared";
import {
  useAdminPlans,
  useAdminSubscriptions,
  useAdminInvoices,
  useAdminInvoice,
  useAdminOrgs,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  useCreateInvoice,
  useIssueInvoice,
  usePayInvoice,
  useVoidInvoice,
  type PlanRow,
} from "./api";

export default function AdminBilling() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#d4a843] mb-1">Super Admin</p>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage SaaS plans, customer subscriptions, and platform invoices.
        </p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans" data-testid="admin-billing-plans">Plans</TabsTrigger>
          <TabsTrigger value="subs" data-testid="admin-billing-subs">Subscriptions</TabsTrigger>
          <TabsTrigger value="invoices" data-testid="admin-billing-invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-6">
          <PlansTab />
        </TabsContent>
        <TabsContent value="subs" className="mt-6">
          <SubscriptionsTab />
        </TabsContent>
        <TabsContent value="invoices" className="mt-6">
          <InvoicesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// -------------------- Plans Tab --------------------

function PlansTab() {
  const { data: plans } = useAdminPlans();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="admin-new-plan" onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 mr-2" />
              New plan
            </Button>
          </DialogTrigger>
          <PlanFormDialog
            plan={editing}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(plans ?? []).map((p) => (
          <PlanCard key={p.id} plan={p} onEdit={() => { setEditing(p); setOpen(true); }} />
        ))}
        {(plans ?? []).length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">
            No plans yet. Create one to start.
          </p>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, onEdit }: { plan: PlanRow; onEdit: () => void }) {
  const del = useDeletePlan();
  const update = useUpdatePlan();
  const { toast } = useToast();
  return (
    <Card
      className={`border-border/60 ${plan.isFeatured ? "ring-1 ring-[#d4a843]/40" : ""} ${!plan.isActive ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {plan.name}
              {plan.isFeatured && <Star className="h-4 w-4 fill-[#d4a843] text-[#d4a843]" />}
              {!plan.isActive && <Badge variant="outline">archived</Badge>}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{plan.description ?? ""}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="text-3xl font-bold">{formatCents(plan.priceCents)}</span>
          <span className="text-muted-foreground">/{plan.billingPeriod === "yearly" ? "yr" : "mo"}</span>
        </div>
        <div className="space-y-1.5 text-sm">
          <Bullet text={`${plan.maxUsers ?? "Unlimited"} users`} />
          <Bullet text={`${plan.maxPlots?.toLocaleString() ?? "Unlimited"} plots`} />
          <Bullet text={`${plan.maxStorageMb != null ? `${(plan.maxStorageMb / 1000).toFixed(0)} GB` : "Unlimited"} storage`} />
          <Bullet text={`${plan.trialDays}-day trial`} />
          {Object.entries(plan.features ?? {}).filter(([, v]) => v).map(([k]) => (
            <Bullet key={k} text={prettyFeature(k)} />
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                update.mutate(
                  { id: plan.id, isFeatured: !plan.isFeatured },
                  { onSuccess: () => toast({ title: plan.isFeatured ? "Unfeatured" : "Featured" }) },
                )
              }
            >
              <Star className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-rose-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    If any subscriptions reference this plan, it will be archived instead.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 hover:bg-rose-700"
                    onClick={() =>
                      del.mutate(plan.id, {
                        onSuccess: () => toast({ title: "Plan removed" }),
                      })
                    }
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function prettyFeature(k: string): string {
  return k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function PlanFormDialog({ plan, onClose }: { plan: PlanRow | null; onClose: () => void }) {
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const { toast } = useToast();
  const [name, setName] = useState(plan?.name ?? "");
  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [priceDollars, setPriceDollars] = useState(plan ? (plan.priceCents / 100).toFixed(2) : "");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(plan?.billingPeriod ?? "monthly");
  const [trialDays, setTrialDays] = useState(plan?.trialDays ?? 14);
  const [maxUsers, setMaxUsers] = useState<string>(plan?.maxUsers != null ? String(plan.maxUsers) : "");
  const [maxPlots, setMaxPlots] = useState<string>(plan?.maxPlots != null ? String(plan.maxPlots) : "");
  const [maxStorageMb, setMaxStorageMb] = useState<string>(
    plan?.maxStorageMb != null ? String(plan.maxStorageMb) : "",
  );

  const submit = () => {
    const priceCents = Math.round(Number(priceDollars) * 100);
    const body = {
      name,
      slug:
        slug ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      description: description || null,
      priceCents,
      billingPeriod,
      trialDays: Number(trialDays) || 0,
      maxUsers: maxUsers === "" ? null : Number(maxUsers),
      maxPlots: maxPlots === "" ? null : Number(maxPlots),
      maxStorageMb: maxStorageMb === "" ? null : Number(maxStorageMb),
    };
    if (plan) {
      update.mutate(
        { id: plan.id, ...body },
        {
          onSuccess: () => {
            toast({ title: "Plan updated" });
            onClose();
          },
          onError: (e: Error) =>
            toast({ title: "Failed", description: e.message, variant: "destructive" }),
        },
      );
    } else {
      create.mutate(body, {
        onSuccess: () => {
          toast({ title: "Plan created" });
          onClose();
        },
        onError: (e: Error) =>
          toast({ title: "Failed", description: e.message, variant: "destructive" }),
      });
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{plan ? "Edit plan" : "New plan"}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Slug (auto)</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated" />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea rows={2} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Price (USD)</Label>
          <Input type="number" step="0.01" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} />
        </div>
        <div>
          <Label>Billing period</Label>
          <Select value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as "monthly" | "yearly")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Trial days</Label>
          <Input type="number" value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
        </div>
        <div>
          <Label>Max users (blank = ∞)</Label>
          <Input type="number" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} />
        </div>
        <div>
          <Label>Max plots</Label>
          <Input type="number" value={maxPlots} onChange={(e) => setMaxPlots(e.target.value)} />
        </div>
        <div>
          <Label>Max storage (MB)</Label>
          <Input type="number" value={maxStorageMb} onChange={(e) => setMaxStorageMb(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!name || !priceDollars}>
          {plan ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// -------------------- Subscriptions Tab --------------------

function SubscriptionsTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data } = useAdminSubscriptions({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Subscriptions</CardTitle>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Organization</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Period</th>
              <th className="text-right px-4 py-3 font-medium">MRR</th>
              <th className="text-left px-4 py-3 font-medium">Trial ends</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map(({ sub, plan, org }) => (
              <tr key={sub.id} className="border-b border-border/30">
                <td className="px-4 py-3">{org?.name ?? `Org #${sub.organizationId}`}</td>
                <td className="px-4 py-3">{plan?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={subStatusClass[sub.status]}>{sub.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(sub.currentPeriodStart)} → {formatDate(sub.currentPeriodEnd)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCents(
                    sub.billingPeriod === "yearly"
                      ? Math.round(sub.pricePerPeriodCents / 12)
                      : sub.pricePerPeriodCents,
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {sub.trialEndsAt ? formatDate(sub.trialEndsAt) : "—"}
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No subscriptions match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// -------------------- Invoices Tab --------------------

function InvoicesTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data } = useAdminInvoices({
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="admin-new-invoice"><Plus className="h-4 w-4 mr-2" />New invoice</Button>
          </DialogTrigger>
          <CreateInvoiceDialog onClose={() => setCreateOpen(false)} />
        </Dialog>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Number</th>
                <th className="text-left px-4 py-3 font-medium">Organization</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-right px-4 py-3 font-medium">Paid</th>
                <th className="text-left px-4 py-3 font-medium">Due</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map(({ inv, org }) => (
                <tr
                  key={inv.id}
                  className="border-b border-border/30 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setOpenId(inv.id)}
                  data-testid={`admin-invoice-row-${inv.id}`}
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    {inv.invoiceNumber ?? `Draft #${inv.id}`}
                  </td>
                  <td className="px-4 py-3">{org?.name ?? `Org #${inv.organizationId}`}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={invoiceStatusClass[inv.status]}>
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(inv.totalCents, inv.currency)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                    {formatCents(inv.amountPaidCents, inv.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(inv.createdAt)}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No invoices match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <InvoiceDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function CreateInvoiceDialog({ onClose }: { onClose: () => void }) {
  const { data: orgs } = useAdminOrgs();
  const create = useCreateInvoice();
  const { toast } = useToast();
  const [orgId, setOrgId] = useState("");
  const [description, setDescription] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(
    new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  );

  const submit = () => {
    if (!orgId || !amountDollars) return;
    create.mutate(
      {
        organizationId: Number(orgId),
        periodStart,
        periodEnd,
        description: description || undefined,
        lineItems: [
          {
            description: description || "Subscription",
            quantity: 1,
            unitPriceCents: Math.round(Number(amountDollars) * 100),
          },
        ],
      },
      {
        onSuccess: () => {
          toast({ title: "Draft invoice created" });
          onClose();
        },
        onError: (e: Error) =>
          toast({ title: "Failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New platform invoice</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Organization</Label>
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger><SelectValue placeholder="Pick an org…" /></SelectTrigger>
            <SelectContent>
              {(orgs ?? []).map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Subscription — May" />
        </div>
        <div>
          <Label>Amount (USD)</Label>
          <Input type="number" step="0.01" value={amountDollars} onChange={(e) => setAmountDollars(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Period start</Label>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <Label>Period end</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!orgId || !amountDollars}>Create draft</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function InvoiceDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data } = useAdminInvoice(id);
  const issue = useIssueInvoice();
  const pay = usePayInvoice();
  const voidInv = useVoidInvoice();
  const { toast } = useToast();
  const [payAmount, setPayAmount] = useState("");

  return (
    <Dialog open={id != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#d4a843]" />
            {data?.invoice.invoiceNumber ?? `Draft #${id}`}
            {data && (
              <Badge variant="outline" className={invoiceStatusClass[data.invoice.status]}>
                {data.invoice.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Organization</p>
                <p className="font-medium">{data.organization?.name ?? `Org #${data.invoice.organizationId}`}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Period</p>
                <p>
                  {formatDate(data.invoice.periodStart)} → {formatDate(data.invoice.periodEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Issued</p>
                <p>{formatDate(data.invoice.issuedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due</p>
                <p>{formatDate(data.invoice.dueDate)}</p>
              </div>
            </div>

            <div className="border border-border/60 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                    <th className="text-right px-3 py-2 font-medium">Unit</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.invoice.lineItems ?? []).map((li, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-3 py-2">{li.description}</td>
                      <td className="px-3 py-2 text-right">{li.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCents(li.unitPriceCents)}</td>
                      <td className="px-3 py-2 text-right">{formatCents(li.lineTotalCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border/60">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">Subtotal</td>
                    <td className="px-3 py-2 text-right">{formatCents(data.invoice.subtotalCents)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">Tax</td>
                    <td className="px-3 py-2 text-right">{formatCents(data.invoice.taxCents)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                    <td className="px-3 py-2 text-right">{formatCents(data.invoice.totalCents)}</td>
                  </tr>
                  <tr className="text-emerald-400">
                    <td colSpan={3} className="px-3 py-2 text-right">Paid</td>
                    <td className="px-3 py-2 text-right">{formatCents(data.invoice.amountPaidCents)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-right">Balance</td>
                    <td className="px-3 py-2 text-right">
                      {formatCents(data.invoice.totalCents - data.invoice.amountPaidCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {data.payments.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Payments</p>
                {data.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1">
                    <span>{formatDate(p.paidAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
                    <span className="text-emerald-400">{formatCents(p.amountCents)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-3 border-t border-border/40">
              {data.invoice.status === "draft" && (
                <Button
                  onClick={() => issue.mutate(data.invoice.id, { onSuccess: () => toast({ title: "Issued" }) })}
                >
                  <Send className="h-4 w-4 mr-2" /> Issue
                </Button>
              )}
              {(data.invoice.status === "open" || data.invoice.status === "draft") && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-32"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!payAmount) return;
                      pay.mutate(
                        {
                          id: data.invoice.id,
                          amountCents: Math.round(Number(payAmount) * 100),
                          method: "manual",
                        },
                        {
                          onSuccess: () => {
                            toast({ title: "Payment recorded" });
                            setPayAmount("");
                          },
                          onError: (e: Error) =>
                            toast({ title: "Failed", description: e.message, variant: "destructive" }),
                        },
                      );
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Record payment
                  </Button>
                </div>
              )}
              {data.invoice.status !== "paid" && data.invoice.status !== "void" && (
                <Button
                  variant="outline"
                  onClick={() => voidInv.mutate(data.invoice.id, { onSuccess: () => toast({ title: "Voided" }) })}
                >
                  <Ban className="h-4 w-4 mr-2" /> Void
                </Button>
              )}
              <Button variant="ghost" onClick={onClose} className="ml-auto">
                <X className="h-4 w-4 mr-2" /> Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
