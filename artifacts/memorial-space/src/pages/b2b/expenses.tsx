import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useApproveExpense,
  useRejectExpense,
  useMarkExpensePaid,
  useListExpenseCategories,
  useCreateExpenseCategory,
  getListExpensesQueryKey,
  getListExpenseCategoriesQueryKey,
  type Expense,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
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
import { Plus, Receipt, Pencil, Trash2, CheckCircle2, XCircle, DollarSign, Tag, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const ORG_ID = 1;

type Status = "pending" | "approved" | "rejected" | "paid";
type Method = "cash" | "card" | "check" | "transfer" | "other";

const STATUS_COLOR: Record<Status, string> = {
  pending: "bg-[#d4a843]/20 text-[#d4a843]",
  approved: "bg-primary/20 text-primary",
  rejected: "bg-destructive/20 text-destructive",
  paid: "bg-[#40916c]/20 text-[#40916c]",
};

interface Form {
  description: string;
  amount: string;
  expenseDate: string;
  categoryId: string;
  vendorName: string;
  paymentMethod: Method;
  receiptUrl: string;
  notes: string;
}
const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Form => ({ description: "", amount: "", expenseDate: today(), categoryId: "", vendorName: "", paymentMethod: "card", receiptUrl: "", notes: "" });

const fmtMoney = (s: string | null) => {
  if (s == null) return "$0.00";
  const n = Number(s);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : `$${s}`;
};

export default function Expenses() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"all" | Status>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Form>(empty());
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#3b82f6");
  const [confirmDel, setConfirmDel] = useState<Expense | null>(null);

  const { data: expenses, isLoading } = useListExpenses({ organizationId: ORG_ID });
  const { data: categories } = useListExpenseCategories({ organizationId: ORG_ID });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListExpensesQueryKey({ organizationId: ORG_ID }) });
  };
  const invalidateCats = () => qc.invalidateQueries({ queryKey: getListExpenseCategoriesQueryKey({ organizationId: ORG_ID }) });

  const create = useCreateExpense({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setForm(empty()); toast({ title: "Expense recorded" }); } } });
  const update = useUpdateExpense({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); setForm(empty()); toast({ title: "Expense updated" }); } } });
  const del = useDeleteExpense({ mutation: { onSuccess: () => { invalidate(); setConfirmDel(null); toast({ title: "Expense deleted" }); } } });
  const approve = useApproveExpense({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Approved" }); } } });
  const reject = useRejectExpense({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Rejected" }); } } });
  const markPaid = useMarkExpensePaid({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Marked as paid" }); } } });
  const createCat = useCreateExpenseCategory({ mutation: { onSuccess: () => { invalidateCats(); setCatOpen(false); setCatName(""); toast({ title: "Category added" }); } } });

  const filtered = useMemo(
    () => (expenses ?? []).filter(e => tab === "all" || e.status === tab),
    [expenses, tab],
  );

  const totals = useMemo(() => {
    const list = expenses ?? [];
    const sum = (status: Status) => list.filter(e => e.status === status).reduce((acc, e) => acc + Number(e.amount || 0), 0);
    return {
      pending: sum("pending"),
      approved: sum("approved"),
      paid: sum("paid"),
      total: list.reduce((acc, e) => acc + Number(e.amount || 0), 0),
    };
  }, [expenses]);

  const submit = () => {
    if (!form.description.trim() || !form.amount || !form.expenseDate) {
      toast({ title: "Description, amount, and date are required", variant: "destructive" });
      return;
    }
    const body = {
      organizationId: ORG_ID,
      description: form.description.trim(),
      amount: form.amount,
      expenseDate: form.expenseDate,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      vendorName: form.vendorName || null,
      paymentMethod: form.paymentMethod,
      receiptUrl: form.receiptUrl || null,
      notes: form.notes || null,
    };
    if (editing) update.mutate({ id: editing.id, data: body });
    else create.mutate({ data: body });
  };

  const startEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      description: e.description,
      amount: String(e.amount),
      expenseDate: e.expenseDate,
      categoryId: e.categoryId ? String(e.categoryId) : "",
      vendorName: e.vendorName ?? "",
      paymentMethod: e.paymentMethod as Method,
      receiptUrl: e.receiptUrl ?? "",
      notes: e.notes ?? "",
    });
    setOpen(true);
  };

  const catById = (id: number | null | undefined) => (categories ?? []).find(c => c.id === id);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground mt-1">Track operating expenses, route approvals, and mark payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Tag className="h-4 w-4" />Categories</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Expense Categories</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {(categories ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(categories ?? []).map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-2 border rounded-md">
                        <div className="h-4 w-4 rounded-full" style={{ background: c.color }} />
                        <span className="flex-1 text-sm">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t pt-3 space-y-3">
                  <Label>Add new category</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Name" value={catName} onChange={(e) => setCatName(e.target.value)} />
                    <Input type="color" className="w-16 p-1" value={catColor} onChange={(e) => setCatColor(e.target.value)} />
                  </div>
                  <Button size="sm" disabled={!catName.trim() || createCat.isPending}
                    onClick={() => createCat.mutate({ data: { organizationId: ORG_ID, name: catName.trim(), color: catColor } })}
                    className="w-full">Add category</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty()); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-expense"><Plus className="h-4 w-4" />Record Expense</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Record Expense"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1.5">
                  <Label>Description *</Label>
                  <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Lawn fertilizer purchase" data-testid="input-expense-desc" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Amount *</Label>
                    <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" data-testid="input-expense-amount" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Date *</Label>
                    <Input type="date" value={form.expenseDate} onChange={(e) => setForm(f => ({ ...f, expenseDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Category</Label>
                    <Select value={form.categoryId || "none"} onValueChange={(v) => setForm(f => ({ ...f, categoryId: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— No category —</SelectItem>
                        {(categories ?? []).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Payment Method</Label>
                    <Select value={form.paymentMethod} onValueChange={(v) => setForm(f => ({ ...f, paymentMethod: v as Method }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Vendor / Payee</Label>
                  <Input value={form.vendorName} onChange={(e) => setForm(f => ({ ...f, vendorName: e.target.value }))} placeholder="Acme Garden Supply" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Receipt URL</Label>
                  <Input value={form.receiptUrl} onChange={(e) => setForm(f => ({ ...f, receiptUrl: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="grid gap-1.5">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={create.isPending || update.isPending} data-testid="button-save-expense">
                  {editing ? "Save changes" : "Record expense"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: totals.total, color: "text-foreground" },
          { label: "Pending", value: totals.pending, color: "text-[#d4a843]" },
          { label: "Approved", value: totals.approved, color: "text-primary" },
          { label: "Paid", value: totals.paid, color: "text-[#40916c]" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>${s.value.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[200px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    <Receipt className="mx-auto h-6 w-6 mb-2 opacity-50" />No expenses
                  </TableCell></TableRow>
                ) : filtered.map(e => {
                  const cat = catById(e.categoryId);
                  return (
                    <TableRow key={e.id} data-testid={`row-expense-${e.id}`}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(e.expenseDate), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-medium">
                        {e.description}
                        {e.receiptUrl && (
                          <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                            {cat.name}
                          </span>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>{e.vendorName ?? "-"}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{fmtMoney(e.amount)}</TableCell>
                      <TableCell><Badge variant="outline" className={`capitalize border-none ${STATUS_COLOR[e.status as Status]}`}>{e.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {e.status === "pending" && (
                            <>
                              <Button size="icon" variant="ghost" className="text-[#40916c]" title="Approve"
                                onClick={() => approve.mutate({ id: e.id, data: { organizationId: ORG_ID } })}
                                data-testid={`button-approve-${e.id}`}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="text-destructive" title="Reject"
                                onClick={() => reject.mutate({ id: e.id, data: { organizationId: ORG_ID } })}
                                data-testid={`button-reject-${e.id}`}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {e.status === "approved" && (
                            <Button size="icon" variant="ghost" className="text-primary" title="Mark paid"
                              onClick={() => markPaid.mutate({ id: e.id, data: { organizationId: ORG_ID } })}
                              data-testid={`button-pay-${e.id}`}>
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDel(e)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This expense record will be permanently removed.</AlertDialogDescription>
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
