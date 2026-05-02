import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCustomers,
  useListTaxRates,
  useGetInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  getListInvoicesQueryKey,
  getGetInvoiceQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ORG_ID, formatMoney } from "./_shared";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRateId: string; // "none" or numeric string for the Select primitive
}

const blankLine: LineItem = {
  description: "",
  quantity: "1",
  unitPrice: "0",
  taxRateId: "none",
};

interface Props {
  invoiceId?: number;
}

export default function InvoiceEdit({ invoiceId }: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isEdit = typeof invoiceId === "number";

  const { data: customers } = useListCustomers({ organizationId: ORG_ID });
  const { data: taxRates } = useListTaxRates({ organizationId: ORG_ID });
  // useGetInvoice's typed options require queryKey, but we just want to gate the
  // request when there's no id. Use enabled via a cast to keep the generated
  // query-key default while still avoiding a request for the "new" route.
  const { data: existing, isLoading: loadingExisting } = useGetInvoice(
    invoiceId ?? 0,
    { organizationId: ORG_ID },
    {
      query: { enabled: isEdit } as { enabled: boolean; queryKey: readonly unknown[] },
    },
  );

  const [customerId, setCustomerId] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [items, setItems] = useState<LineItem[]>([{ ...blankLine }]);

  // Hydrate when editing an existing draft.
  useEffect(() => {
    if (!isEdit || !existing) return;
    setCustomerId(String(existing.customerId));
    setIssueDate(existing.issueDate ?? "");
    setDueDate(existing.dueDate ?? "");
    setNotes(existing.notes ?? "");
    setItems(
      (existing.items ?? []).map((i) => ({
        description: i.description,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        taxRateId: i.taxRateId != null ? String(i.taxRateId) : "none",
      })),
    );
  }, [existing, isEdit]);

  const createMutation = useCreateInvoice({
    mutation: {
      onSuccess: (inv) => {
        queryClient.invalidateQueries({
          queryKey: getListInvoicesQueryKey({ organizationId: ORG_ID }),
        });
        toast({ title: "Draft invoice created" });
        if (inv?.id) setLocation(`/accounting/invoices/${inv.id}`);
        else setLocation("/accounting/invoices");
      },
      onError: (e) =>
        toast({ title: "Failed to create invoice", description: String(e), variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateInvoice({
    mutation: {
      onSuccess: (inv) => {
        queryClient.invalidateQueries({
          queryKey: getListInvoicesQueryKey({ organizationId: ORG_ID }),
        });
        if (inv?.id) {
          queryClient.invalidateQueries({
            queryKey: getGetInvoiceQueryKey(inv.id, { organizationId: ORG_ID }),
          });
        }
        toast({ title: "Invoice updated" });
        if (inv?.id) setLocation(`/accounting/invoices/${inv.id}`);
      },
      onError: (e) =>
        toast({ title: "Failed to update invoice", description: String(e), variant: "destructive" }),
    },
  });

  const rateById = useMemo(() => {
    const m = new Map<number, number>();
    (taxRates ?? []).forEach((t) => m.set(t.id, t.ratePercent));
    return m;
  }, [taxRates]);

  // Live preview totals (server is still authoritative on submit).
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const lineSub = qty * price;
      const ratePct =
        it.taxRateId !== "none" ? rateById.get(Number(it.taxRateId)) ?? 0 : 0;
      subtotal += lineSub;
      taxTotal += lineSub * (ratePct / 100);
    }
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      total: Math.round((subtotal + taxTotal) * 100) / 100,
    };
  }, [items, rateById]);

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { ...blankLine }]);
  }
  function removeItem(i: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function submit() {
    if (!customerId) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    const parsedItems = items
      .filter((it) => it.description.trim())
      .map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        taxRateId: it.taxRateId !== "none" ? Number(it.taxRateId) : null,
      }));
    if (parsedItems.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    const data = {
      organizationId: ORG_ID,
      customerId: Number(customerId),
      issueDate: issueDate || undefined,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
      items: parsedItems,
    };
    if (isEdit && invoiceId) {
      updateMutation.mutate({ id: invoiceId, data });
    } else {
      createMutation.mutate({ data });
    }
  }

  if (isEdit && loadingExisting) {
    return <div className="text-muted-foreground">Loading invoice...</div>;
  }
  if (isEdit && existing && existing.status !== "draft") {
    return (
      <div className="space-y-4">
        <p className="text-destructive">
          This invoice is no longer a draft and cannot be edited.
        </p>
        <Link href={`/accounting/invoices/${invoiceId}`}>
          <Button variant="outline">Back to invoice</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/accounting/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEdit ? "Edit invoice" : "New invoice"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Drafts are not sent until you issue them.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting/invoices">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            onClick={submit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save draft" : "Create draft"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Bill to & dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="inv-customer">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="inv-customer">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(customers ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No customers yet —{" "}
                  <Link
                    href="/accounting/customers"
                    className="underline text-primary"
                  >
                    create one first
                  </Link>
                  .
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inv-issue">Issue date</Label>
                <Input
                  id="inv-issue"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="inv-due">Due date</Label>
                <Input
                  id="inv-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="inv-notes">Notes</Label>
              <Textarea
                id="inv-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Visible to the customer on the invoice."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals (preview)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
            <Row label="Tax" value={formatMoney(totals.taxTotal)} />
            <div className="border-t pt-2 mt-2">
              <Row label="Total" value={formatMoney(totals.total)} bold />
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Server recalculates totals on save.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line items</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Unit price</TableHead>
                <TableHead className="w-48">Tax</TableHead>
                <TableHead className="w-32 text-right">Line total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, i) => {
                const qty = Number(it.quantity) || 0;
                const price = Number(it.unitPrice) || 0;
                const lineSub = qty * price;
                const ratePct =
                  it.taxRateId !== "none" ? rateById.get(Number(it.taxRateId)) ?? 0 : 0;
                const lineTotal = lineSub + lineSub * (ratePct / 100);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        placeholder="e.g. Plot purchase, Section A-12"
                        value={it.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className="text-right"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, { quantity: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="text-right"
                        value={it.unitPrice}
                        onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={it.taxRateId}
                        onValueChange={(v) => updateItem(i, { taxRateId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No tax</SelectItem>
                          {(taxRates ?? []).map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name} ({t.ratePercent}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(lineTotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "text-base font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
