import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAssets,
  useCreateAsset,
  useUpdateAsset,
  useDeleteAsset,
  getListAssetsQueryKey,
  type Asset,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Boxes, Pencil, Trash2, Truck, Wrench, Building2, Map, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ORG_ID = 1;

type AssetType = "equipment" | "vehicle" | "area" | "building" | "tool" | "other";
type AssetStatus = "active" | "maintenance" | "retired";

interface Form {
  name: string;
  type: AssetType;
  location: string;
  serialNumber: string;
  purchaseDate: string;
  status: AssetStatus;
  notes: string;
}
const empty: Form = { name: "", type: "equipment", location: "", serialNumber: "", purchaseDate: "", status: "active", notes: "" };

const TYPE_ICON: Record<AssetType, typeof Boxes> = {
  equipment: Wrench, vehicle: Truck, area: Map, building: Building2, tool: Wrench, other: Tag,
};

const STATUS_COLOR: Record<AssetStatus, string> = {
  active: "bg-[#40916c]/20 text-[#40916c]",
  maintenance: "bg-[#d4a843]/20 text-[#d4a843]",
  retired: "bg-muted text-muted-foreground",
};

export default function Assets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [confirmDel, setConfirmDel] = useState<Asset | null>(null);

  const { data: rows, isLoading } = useListAssets({ organizationId: ORG_ID });
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAssetsQueryKey({ organizationId: ORG_ID }) });

  const create = useCreateAsset({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setForm(empty); toast({ title: "Asset created" }); } } });
  const update = useUpdateAsset({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); setForm(empty); toast({ title: "Asset updated" }); } } });
  const del = useDeleteAsset({ mutation: { onSuccess: () => { invalidate(); setConfirmDel(null); toast({ title: "Asset deleted" }); } } });

  const filtered = (rows ?? []).filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.location ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const submit = () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const body = {
      organizationId: ORG_ID,
      name: form.name.trim(),
      type: form.type,
      location: form.location || null,
      serialNumber: form.serialNumber || null,
      purchaseDate: form.purchaseDate || null,
      status: form.status,
      notes: form.notes || null,
    };
    if (editing) update.mutate({ id: editing.id, data: body });
    else create.mutate({ data: body });
  };

  const startEdit = (a: Asset) => {
    setEditing(a);
    setForm({
      name: a.name, type: a.type as AssetType, location: a.location ?? "",
      serialNumber: a.serialNumber ?? "", purchaseDate: a.purchaseDate ?? "",
      status: a.status as AssetStatus, notes: a.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground mt-1">Equipment, vehicles, buildings, and grounds you maintain.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-asset"><Plus className="h-4 w-4" />New Asset</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit Asset" : "New Asset"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-asset-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as AssetType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                      <SelectItem value="building">Building</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                      <SelectItem value="tool">Tool</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as AssetStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Section A • Building 1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Serial Number</Label>
                  <Input value={form.serialNumber} onChange={(e) => setForm(f => ({ ...f, serialNumber: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Purchase Date</Label>
                  <Input type="date" value={form.purchaseDate} onChange={(e) => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={create.isPending || update.isPending} data-testid="button-save-asset">
                {editing ? "Save changes" : "Create asset"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search assets..." className="pl-9 bg-background" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "asset" : "assets"}</div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading assets...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                <Boxes className="mx-auto h-6 w-6 mb-2 opacity-50" />No assets yet
              </TableCell></TableRow>
            ) : filtered.map(a => {
              const Icon = TYPE_ICON[a.type as AssetType] ?? Boxes;
              return (
                <TableRow key={a.id} data-testid={`row-asset-${a.id}`}>
                  <TableCell className="font-medium flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{a.name}</TableCell>
                  <TableCell className="capitalize">{a.type}</TableCell>
                  <TableCell>{a.location ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{a.serialNumber ?? "-"}</TableCell>
                  <TableCell><Badge variant="outline" className={`capitalize border-none ${STATUS_COLOR[a.status as AssetStatus]}`}>{a.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(a)} data-testid={`button-edit-asset-${a.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDel(a)} data-testid={`button-delete-asset-${a.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>"{confirmDel?.name}" will be permanently removed.</AlertDialogDescription>
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
