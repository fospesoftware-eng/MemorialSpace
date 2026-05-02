import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getListCustomersQueryKey,
  type Customer,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Search, Users, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ORG_ID } from "./_shared";

interface FormState {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  notes: "",
};

export default function AccountingCustomers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);

  const listKey = getListCustomersQueryKey({ organizationId: ORG_ID });
  const { data: customers, isLoading } = useListCustomers({ organizationId: ORG_ID });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const createMutation = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        invalidate();
        setOpen(false);
        toast({ title: "Customer created" });
      },
      onError: (e) => toast({ title: "Failed to create customer", description: String(e), variant: "destructive" }),
    },
  });
  const updateMutation = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        invalidate();
        setOpen(false);
        toast({ title: "Customer updated" });
      },
      onError: (e) => toast({ title: "Failed to update customer", description: String(e), variant: "destructive" }),
    },
  });
  const deleteMutation = useDeleteCustomer({
    mutation: {
      onSuccess: () => {
        invalidate();
        setConfirmDelete(null);
        toast({ title: "Customer deleted" });
      },
      onError: (e) => toast({ title: "Failed to delete customer", description: String(e), variant: "destructive" }),
    },
  });

  const filtered = (customers ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search),
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      addressLine1: c.addressLine1 ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      postalCode: c.postalCode ?? "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const data = {
      organizationId: ORG_ID,
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      addressLine1: form.addressLine1.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      postalCode: form.postalCode.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
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
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Billing contacts for invoices and payments.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2">
                <Label htmlFor="cust-name">Name *</Label>
                <Input
                  id="cust-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="cust-email">Email</Label>
                <Input
                  id="cust-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="cust-phone">Phone</Label>
                <Input
                  id="cust-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="cust-addr">Address</Label>
                <Input
                  id="cust-addr"
                  value={form.addressLine1}
                  onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="cust-city">City</Label>
                <Input
                  id="cust-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="cust-state">State</Label>
                  <Input
                    id="cust-state"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cust-zip">ZIP</Label>
                  <Input
                    id="cust-zip"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  />
                </div>
              </div>
              <div className="col-span-2">
                <Label htmlFor="cust-notes">Notes</Label>
                <Textarea
                  id="cust-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
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
                {editing ? "Save changes" : "Create customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card p-4 border rounded-xl shadow-sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Loading customers...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <Users className="mx-auto h-6 w-6 mb-2 opacity-50" />
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.email ?? "-"}</TableCell>
                  <TableCell>{c.phone ?? "-"}</TableCell>
                  <TableCell>
                    {[c.city, c.state].filter(Boolean).join(", ") || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(c)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold">{confirmDelete?.name}</span> and all
              their associated invoices. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmDelete &&
                deleteMutation.mutate({
                  id: confirmDelete.id,
                  params: { organizationId: ORG_ID },
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
