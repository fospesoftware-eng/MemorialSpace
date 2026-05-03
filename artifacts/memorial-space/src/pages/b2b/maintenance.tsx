import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMaintenanceSchedules,
  useCreateMaintenanceSchedule,
  useUpdateMaintenanceSchedule,
  useDeleteMaintenanceSchedule,
  useGenerateMaintenanceWorkOrder,
  useListAssets,
  getListMaintenanceSchedulesQueryKey,
  getListWorkOrdersQueryKey,
  type MaintenanceSchedule,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, CalendarClock, Pencil, Trash2, Play, Repeat, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, parseISO } from "date-fns";

const ORG_ID = 1;

type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
type Priority = "low" | "medium" | "high" | "urgent";

interface Form {
  title: string;
  description: string;
  assetId: string;
  frequency: Frequency;
  intervalDays: number;
  nextDueAt: string;
  priority: Priority;
  isActive: boolean;
}
const empty: Form = { title: "", description: "", assetId: "", frequency: "monthly", intervalDays: 30, nextDueAt: "", priority: "medium", isActive: true };

const FREQ_DAYS: Record<Frequency, number> = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, yearly: 365, custom: 30 };
const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/20 text-primary",
  high: "bg-[#d4a843]/20 text-[#d4a843]",
  urgent: "bg-destructive/20 text-destructive",
};

export default function Maintenance() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceSchedule | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [confirmDel, setConfirmDel] = useState<MaintenanceSchedule | null>(null);

  const { data: schedules, isLoading } = useListMaintenanceSchedules({ organizationId: ORG_ID });
  const { data: assets } = useListAssets({ organizationId: ORG_ID });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListMaintenanceSchedulesQueryKey({ organizationId: ORG_ID }) });
    qc.invalidateQueries({ queryKey: getListWorkOrdersQueryKey({ organizationId: ORG_ID }) });
  };

  const create = useCreateMaintenanceSchedule({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setForm(empty); toast({ title: "Schedule created" }); } } });
  const update = useUpdateMaintenanceSchedule({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); setForm(empty); toast({ title: "Schedule updated" }); } } });
  const del = useDeleteMaintenanceSchedule({ mutation: { onSuccess: () => { invalidate(); setConfirmDel(null); toast({ title: "Schedule deleted" }); } } });
  const generate = useGenerateMaintenanceWorkOrder({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Work order generated" }); } } });

  const submit = () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    const body = {
      organizationId: ORG_ID,
      title: form.title.trim(),
      description: form.description || null,
      assetId: form.assetId ? Number(form.assetId) : null,
      frequency: form.frequency,
      intervalDays: form.intervalDays || FREQ_DAYS[form.frequency],
      nextDueAt: form.nextDueAt || null,
      priority: form.priority,
      isActive: form.isActive,
    };
    if (editing) update.mutate({ id: editing.id, data: body });
    else create.mutate({ data: body });
  };

  const startEdit = (s: MaintenanceSchedule) => {
    setEditing(s);
    setForm({
      title: s.title, description: s.description ?? "",
      assetId: s.assetId ? String(s.assetId) : "",
      frequency: s.frequency as Frequency, intervalDays: s.intervalDays,
      nextDueAt: s.nextDueAt ?? "",
      priority: s.priority as Priority, isActive: s.isActive,
    });
    setOpen(true);
  };

  const overdue = (s: MaintenanceSchedule) => s.nextDueAt && isPast(parseISO(s.nextDueAt)) && s.isActive;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
          <p className="text-muted-foreground mt-1">Recurring maintenance schedules. Generate work orders on demand or when due.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-schedule"><Plus className="h-4 w-4" />New Schedule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit Schedule" : "New Maintenance Schedule"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Mow Section A lawns" data-testid="input-schedule-title" />
              </div>
              <div className="grid gap-1.5">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5 col-span-2">
                  <Label>Frequency</Label>
                  <Select value={form.frequency} onValueChange={(v) => {
                    const f = v as Frequency;
                    setForm(prev => ({ ...prev, frequency: f, intervalDays: FREQ_DAYS[f] }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Days</Label>
                  <Input type="number" min={1} value={form.intervalDays} onChange={(e) => setForm(f => ({ ...f, intervalDays: Number(e.target.value) || 1 }))} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Next Due Date</Label>
                <Input type="date" value={form.nextDueAt} onChange={(e) => setForm(f => ({ ...f, nextDueAt: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm font-medium">Active</Label>
                  <p className="text-xs text-muted-foreground">Inactive schedules won't generate work orders.</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={create.isPending || update.isPending} data-testid="button-save-schedule">
                {editing ? "Save changes" : "Create schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading schedules...</div>
      ) : (schedules ?? []).length === 0 ? (
        <div className="border rounded-xl bg-card p-12 text-center text-muted-foreground">
          <Repeat className="mx-auto h-8 w-8 mb-3 opacity-50" />
          <p className="font-medium text-foreground">No schedules yet</p>
          <p className="text-sm mt-1">Create a recurring maintenance task to keep your grounds and equipment in shape.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(schedules ?? []).map(s => {
            const asset = (assets ?? []).find(a => a.id === s.assetId);
            const isOverdue = overdue(s);
            return (
              <div key={s.id} className={`bg-card border rounded-xl p-5 shadow-sm flex flex-col gap-3 ${isOverdue ? "border-destructive/40" : ""}`} data-testid={`card-schedule-${s.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold tracking-tight truncate">{s.title}</h3>
                    {asset && <p className="text-xs text-muted-foreground mt-0.5 truncate">{asset.name}</p>}
                  </div>
                  <Badge variant="outline" className={`capitalize border-none ${PRIORITY_COLOR[s.priority as Priority]}`}>{s.priority}</Badge>
                </div>

                {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" />{s.frequency} · every {s.intervalDays}d</div>
                </div>

                <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {isOverdue ? <AlertCircle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                  Next due: {s.nextDueAt ? format(parseISO(s.nextDueAt), "MMM d, yyyy") : "Not scheduled"}
                  {isOverdue && " (overdue)"}
                </div>

                {!s.isActive && <Badge variant="outline" className="self-start">Inactive</Badge>}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button size="sm" variant="default" className="gap-1.5 flex-1"
                    disabled={!s.isActive || generate.isPending}
                    onClick={() => generate.mutate({ id: s.id, data: { organizationId: ORG_ID } })}
                    data-testid={`button-generate-${s.id}`}>
                    <Play className="h-3.5 w-3.5" />Generate WO
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirmDel(s)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
            <AlertDialogDescription>"{confirmDel?.title}" will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && del.mutate({ id: confirmDel.id, params: { organizationId: ORG_ID } })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
