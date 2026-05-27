import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTaxRates,
  useCreateTaxRate,
  useUpdateTaxRate,
  useDeleteTaxRate,
  getListTaxRatesQueryKey,
  type TaxRate,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Archive, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ORG_ID } from "./_shared";

export default function AccountingTaxRates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const listKey = getListTaxRatesQueryKey({ organizationId: ORG_ID, includeArchived: true });
  const { data: rates, isLoading } = useListTaxRates({
    organizationId: ORG_ID,
    includeArchived: true,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const createMutation = useCreateTaxRate({
    mutation: {
      onSuccess: () => {
        invalidate();
        setOpen(false);
        toast({ title: "Tax rate created" });
      },
      onError: (e) =>
        toast({ title: "Failed to create tax rate", description: String(e), variant: "destructive" }),
    },
  });
  const updateMutation = useUpdateTaxRate({
    mutation: {
      onSuccess: () => {
        invalidate();
        setOpen(false);
        toast({ title: "Tax rate updated" });
      },
      onError: (e) =>
        toast({ title: "Failed to update tax rate", description: String(e), variant: "destructive" }),
    },
  });
  const deleteMutation = useDeleteTaxRate({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Tax rate archived" });
      },
      onError: (e) =>
        toast({ title: "Failed to archive tax rate", description: String(e), variant: "destructive" }),
    },
  });

  function openCreate() {
    setEditing(null);
    setName("");
    setRate("");
    setIsDefault(false);
    setOpen(true);
  }

  function openEdit(r: TaxRate) {
    setEditing(r);
    setName(r.name);
    setRate(String(r.ratePercent));
    setIsDefault(r.isDefault ?? false);
    setOpen(true);
  }

  function submit() {
    const ratePercent = Number(rate);
    if (!name.trim() || !Number.isFinite(ratePercent) || ratePercent < 0) {
      toast({ title: "Provide a name and non-negative rate", variant: "destructive" });
      return;
    }
    const data = { organizationId: ORG_ID, name: name.trim(), ratePercent, isDefault };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate({ data });
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax rates</h1>
          <p className="text-muted-foreground mt-1">
            Manage sales-tax rates applied to invoice line items.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Tax Rate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit tax rate" : "New tax rate"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="tax-name">Name *</Label>
                <Input
                  id="tax-name"
                  placeholder="e.g. State Sales Tax"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tax-rate">Rate (%) *</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="e.g. 7.25"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="tax-default" className="cursor-pointer">
                    Default rate
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Pre-select this rate on new invoice lines.
                  </p>
                </div>
                <Switch id="tax-default" checked={isDefault} onCheckedChange={setIsDefault} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? "Save changes" : "Create rate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Loading tax rates...
                </TableCell>
              </TableRow>
            ) : (rates ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  <Percent className="mx-auto h-6 w-6 mb-2 opacity-50" />
                  No tax rates yet — create one to start charging tax on invoices.
                </TableCell>
              </TableRow>
            ) : (
              (rates ?? []).map((r) => (
                <TableRow key={r.id} className={r.isArchived ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.isDefault && (
                      <Badge variant="outline" className="ml-2 border-primary/40 text-primary">
                        Default
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{r.ratePercent}%</TableCell>
                  <TableCell>
                    {r.isArchived ? (
                      <Badge variant="outline" className="bg-muted">
                        Archived
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-none">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(r)}
                      disabled={r.isArchived}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        deleteMutation.mutate({
                          id: r.id,
                          params: { organizationId: ORG_ID },
                        })
                      }
                      disabled={r.isArchived}
                      title="Archive"
                    >
                      <Archive className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Archived rates remain attached to historical invoices but cannot be applied to
        new lines. Deleting a rate is not permitted to preserve accounting integrity.
      </p>
    </div>
  );
}
