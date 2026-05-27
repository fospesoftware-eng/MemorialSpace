import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListWorkOrders,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useDeleteWorkOrder,
  useListWorkOrderComments,
  useCreateWorkOrderComment,
  useListAssets,
  getListWorkOrdersQueryKey,
  getListWorkOrderCommentsQueryKey,
  type WorkOrder,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Wrench, MessageSquare, Send, Trash2, Play, CheckCircle2, XCircle, RotateCcw, Clock, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const ORG_ID = 1;

type Status = "open" | "in_progress" | "completed" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";
type WOType = "maintenance" | "burial" | "cleaning" | "inspection" | "other";

const STATUS_COLOR: Record<Status, string> = {
  open: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/20 text-primary",
  completed: "bg-[#40916c]/20 text-[#40916c]",
  cancelled: "bg-destructive/20 text-destructive",
};
const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/20 text-primary",
  high: "bg-[#d4a843]/20 text-[#d4a843]",
  urgent: "bg-destructive/20 text-destructive",
};

interface Form {
  title: string;
  description: string;
  type: WOType;
  priority: Priority;
  dueDate: string;
  assetId: string;
  laborHours: string;
  laborCost: string;
  materialsCost: string;
  completionNotes: string;
}
const empty: Form = { title: "", description: "", type: "maintenance", priority: "medium", dueDate: "", assetId: "", laborHours: "", laborCost: "", materialsCost: "", completionNotes: "" };

export default function WorkOrders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [detail, setDetail] = useState<WorkOrder | null>(null);
  const [confirmDel, setConfirmDel] = useState<WorkOrder | null>(null);
  const [commentText, setCommentText] = useState("");

  const { data: workOrders, isLoading } = useListWorkOrders({ organizationId: ORG_ID });
  const { data: assets } = useListAssets({ organizationId: ORG_ID });
  const { data: comments } = useListWorkOrderComments(
    detail?.id ?? 0,
    { organizationId: ORG_ID },
    { query: { enabled: !!detail, queryKey: getListWorkOrderCommentsQueryKey(detail?.id ?? 0, { organizationId: ORG_ID }) } },
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: getListWorkOrdersQueryKey({ organizationId: ORG_ID }) });
  const invalidateComments = (id: number) => qc.invalidateQueries({ queryKey: getListWorkOrderCommentsQueryKey(id, { organizationId: ORG_ID }) });

  const create = useCreateWorkOrder({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setForm(empty); toast({ title: "Work order created" }); } } });
  const update = useUpdateWorkOrder({ mutation: { onSuccess: (data) => { invalidate(); setDetail(data); toast({ title: "Updated" }); } } });
  const del = useDeleteWorkOrder({ mutation: { onSuccess: () => { invalidate(); setConfirmDel(null); setDetail(null); toast({ title: "Deleted" }); } } });
  const addComment = useCreateWorkOrderComment({ mutation: { onSuccess: () => { if (detail) invalidateComments(detail.id); setCommentText(""); } } });

  const filtered = useMemo(() => (workOrders ?? []).filter(wo =>
    (statusFilter === "all" || wo.status === statusFilter) &&
    (!search || wo.title.toLowerCase().includes(search.toLowerCase()))
  ), [workOrders, search, statusFilter]);

  const counts = useMemo(() => {
    const list = workOrders ?? [];
    return {
      open: list.filter(w => w.status === "open").length,
      in_progress: list.filter(w => w.status === "in_progress").length,
      completed: list.filter(w => w.status === "completed").length,
    };
  }, [workOrders]);

  const submitCreate = () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    const body = {
      organizationId: ORG_ID,
      title: form.title.trim(),
      description: form.description || null,
      type: form.type,
      status: "open" as Status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assetId: form.assetId ? Number(form.assetId) : null,
      laborHours: form.laborHours || null,
      laborCost: form.laborCost || null,
      materialsCost: form.materialsCost || null,
      completionNotes: form.completionNotes || null,
    };
    create.mutate({ data: body });
  };

  const transition = (wo: WorkOrder, status: Status) => {
    // Server auto-sets completedAt when status="completed".
    update.mutate({
      id: wo.id,
      data: {
        organizationId: ORG_ID,
        title: wo.title,
        type: wo.type,
        status,
        priority: wo.priority,
      } as never,
    });
  };

  const saveCosts = (wo: WorkOrder, patch: { laborHours?: string; laborCost?: string; materialsCost?: string; completionNotes?: string }) => {
    update.mutate({
      id: wo.id,
      data: {
        organizationId: ORG_ID,
        title: wo.title,
        type: wo.type,
        status: wo.status,
        priority: wo.priority,
        ...patch,
      } as never,
    });
  };

  const totalCost = (wo: WorkOrder) => {
    const lc = Number(wo.laborCost ?? 0);
    const mc = Number(wo.materialsCost ?? 0);
    return (lc + mc).toFixed(2);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Work Orders</h1>
          <p className="text-muted-foreground mt-1">Cemetery operations: maintenance, cleaning, inspections, burials.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-work-order"><Plus className="h-4 w-4" />Create Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Work Order</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Repair fence at Section B" data-testid="input-wo-title" />
              </div>
              <div className="grid gap-1.5">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as WOType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="burial">Burial</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v as Priority }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Asset</Label>
                  <Select value={form.assetId || "none"} onValueChange={(v) => setForm(f => ({ ...f, assetId: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No asset —</SelectItem>
                      {(assets ?? []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submitCreate} disabled={create.isPending} data-testid="button-save-work-order">Create order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-3">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Open</div>
          <div className="text-2xl font-bold mt-1">{counts.open}</div>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">In Progress</div>
          <div className="text-2xl font-bold mt-1 text-primary">{counts.in_progress}</div>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold mt-1 text-[#40916c]">{counts.completed}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search work orders..." className="pl-9 bg-background" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading work orders...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                <Wrench className="mx-auto h-6 w-6 mb-2 opacity-50" />No work orders
              </TableCell></TableRow>
            ) : filtered.map((wo) => (
              <TableRow key={wo.id} className="cursor-pointer" onClick={() => setDetail(wo)} data-testid={`row-wo-${wo.id}`}>
                <TableCell className="font-medium">{wo.title}</TableCell>
                <TableCell className="capitalize">{wo.type}</TableCell>
                <TableCell><Badge variant="outline" className={`capitalize border-none ${STATUS_COLOR[wo.status as Status]}`}>{wo.status.replace("_", " ")}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={`capitalize border-none ${PRIORITY_COLOR[wo.priority as Priority]}`}>{wo.priority}</Badge></TableCell>
                <TableCell>{wo.dueDate ? format(parseISO(wo.dueDate), "MMM d, yyyy") : "-"}</TableCell>
                <TableCell className="text-right font-mono">${totalCost(wo)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8">{detail.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`capitalize border-none ${STATUS_COLOR[detail.status as Status]}`}>{detail.status.replace("_", " ")}</Badge>
                  <Badge variant="outline" className={`capitalize border-none ${PRIORITY_COLOR[detail.priority as Priority]}`}>{detail.priority}</Badge>
                  <Badge variant="outline" className="capitalize">{detail.type}</Badge>
                </div>

                {detail.description && (
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                    <p className="text-sm mt-1.5 whitespace-pre-wrap">{detail.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Due</Label>
                    <p className="mt-1.5">{detail.dueDate ? format(parseISO(detail.dueDate), "MMM d, yyyy") : "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Created</Label>
                    <p className="mt-1.5">{format(new Date(detail.createdAt), "MMM d, yyyy")}</p>
                  </div>
                </div>

                {/* Status transitions */}
                <div className="flex flex-wrap gap-2">
                  {detail.status === "open" && (
                    <Button size="sm" className="gap-1.5" onClick={() => transition(detail, "in_progress")} data-testid="button-start"><Play className="h-3.5 w-3.5" />Start</Button>
                  )}
                  {detail.status === "in_progress" && (
                    <Button size="sm" className="gap-1.5" onClick={() => transition(detail, "completed")} data-testid="button-complete"><CheckCircle2 className="h-3.5 w-3.5" />Complete</Button>
                  )}
                  {(detail.status === "open" || detail.status === "in_progress") && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => transition(detail, "cancelled")}><XCircle className="h-3.5 w-3.5" />Cancel</Button>
                  )}
                  {detail.status !== "open" && detail.status !== "in_progress" && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => transition(detail, "open")}><RotateCcw className="h-3.5 w-3.5" />Reopen</Button>
                  )}
                </div>

                {/* Costs */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><DollarSign className="h-4 w-4" />Cost Tracking</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1">
                      <Label className="text-xs">Labor hrs</Label>
                      <Input type="number" step="0.25" min="0" defaultValue={detail.laborHours ?? ""}
                        onBlur={(e) => e.target.value !== (detail.laborHours ?? "") && saveCosts(detail, { laborHours: e.target.value })}
                        data-testid="input-labor-hours" />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Labor $</Label>
                      <Input type="number" step="0.01" min="0" defaultValue={detail.laborCost ?? ""}
                        onBlur={(e) => e.target.value !== (detail.laborCost ?? "") && saveCosts(detail, { laborCost: e.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Materials $</Label>
                      <Input type="number" step="0.01" min="0" defaultValue={detail.materialsCost ?? ""}
                        onBlur={(e) => e.target.value !== (detail.materialsCost ?? "") && saveCosts(detail, { materialsCost: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono font-semibold">${totalCost(detail)}</span>
                  </div>
                </div>

                {/* Completion notes */}
                {detail.status === "completed" && (
                  <div className="border rounded-lg p-4 space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Completion Notes</Label>
                    <Textarea defaultValue={detail.completionNotes ?? ""} rows={3}
                      onBlur={(e) => e.target.value !== (detail.completionNotes ?? "") && saveCosts(detail, { completionNotes: e.target.value })}
                      placeholder="What was done..." />
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" />Activity</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(comments ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No comments yet.</p>
                    ) : (comments ?? []).map(c => (
                      <div key={c.id} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                          <span className="font-medium">{c.authorName ?? "Staff"}</span>
                          <Clock className="h-3 w-3" />
                          {format(new Date(c.createdAt), "MMM d, h:mm a")}
                        </div>
                        <p className="whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && commentText.trim()) {
                          addComment.mutate({ id: detail.id, data: { body: commentText.trim(), authorName: "Staff" } });
                        }
                      }} data-testid="input-wo-comment" />
                    <Button size="icon" disabled={!commentText.trim() || addComment.isPending}
                      onClick={() => addComment.mutate({ id: detail.id, data: { body: commentText.trim(), authorName: "Staff" } })}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t flex justify-end">
                  <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => setConfirmDel(detail)}>
                    <Trash2 className="h-4 w-4" />Delete order
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete work order?</AlertDialogTitle>
            <AlertDialogDescription>"{confirmDel?.title}" will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && del.mutate({ id: confirmDel.id })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
