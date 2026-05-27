import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInvoice,
  useIssueInvoice,
  useVoidInvoice,
  useDeleteInvoice,
  useCreatePayment,
  useDeletePayment,
  getGetInvoiceQueryKey,
  getListInvoicesQueryKey,
  getGetAccountingSummaryQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ArrowLeft,
  Send,
  XCircle,
  Trash2,
  Plus,
  Printer,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  ORG_ID,
  formatMoney,
  invoiceStatusBadgeClass,
  invoiceStatusLabel,
} from "./_shared";

const PAYMENT_METHODS = ["cash", "check", "card", "bank_transfer", "other"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  card: "Card",
  bank_transfer: "Bank transfer",
  other: "Other",
};

interface Props {
  invoiceId: number;
}

export default function InvoiceDetail({ invoiceId }: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useGetInvoice(invoiceId, {
    organizationId: ORG_ID,
  });

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [voidConfirm, setVoidConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [pmtAmount, setPmtAmount] = useState("");
  const [pmtDate, setPmtDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pmtMethod, setPmtMethod] = useState<PaymentMethod>("check");
  const [pmtReference, setPmtReference] = useState("");
  const [pmtNotes, setPmtNotes] = useState("");

  function invalidateAll() {
    queryClient.invalidateQueries({
      queryKey: getGetInvoiceQueryKey(invoiceId, { organizationId: ORG_ID }),
    });
    queryClient.invalidateQueries({
      queryKey: getListInvoicesQueryKey({ organizationId: ORG_ID }),
    });
    queryClient.invalidateQueries({
      queryKey: getGetAccountingSummaryQueryKey({ organizationId: ORG_ID }),
    });
  }

  const issueMutation = useIssueInvoice({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Invoice issued" });
      },
      onError: (e) =>
        toast({ title: "Failed to issue invoice", description: String(e), variant: "destructive" }),
    },
  });
  const voidMutation = useVoidInvoice({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setVoidConfirm(false);
        toast({ title: "Invoice voided" });
      },
      onError: (e) =>
        toast({ title: "Failed to void invoice", description: String(e), variant: "destructive" }),
    },
  });
  const deleteMutation = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Draft deleted" });
        setLocation("/accounting/invoices");
      },
      onError: (e) =>
        toast({ title: "Failed to delete invoice", description: String(e), variant: "destructive" }),
    },
  });
  const createPayment = useCreatePayment({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setPaymentOpen(false);
        setPmtAmount("");
        setPmtReference("");
        setPmtNotes("");
        toast({ title: "Payment recorded" });
      },
      onError: (e) =>
        toast({ title: "Failed to record payment", description: String(e), variant: "destructive" }),
    },
  });
  const deletePayment = useDeletePayment({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Payment removed" });
      },
      onError: (e) =>
        toast({ title: "Failed to remove payment", description: String(e), variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading invoice...</div>;
  if (!invoice) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">Invoice not found.</p>
        <Link href="/accounting/invoices">
          <Button variant="outline">Back to invoices</Button>
        </Link>
      </div>
    );
  }

  const isDraft = invoice.status === "draft";
  const isVoided = invoice.status === "voided";
  const isPaid = invoice.status === "paid";
  const canTakePayment = invoice.status === "issued" || invoice.status === "partially_paid";
  const remaining = Math.max(0, (invoice.total ?? 0) - (invoice.amountPaid ?? 0));

  function submitPayment() {
    const amount = Number(pmtAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Enter a positive amount", variant: "destructive" });
      return;
    }
    createPayment.mutate({
      data: {
        organizationId: ORG_ID,
        invoiceId,
        amount,
        paymentDate: pmtDate,
        method: pmtMethod,
        reference: pmtReference.trim() || undefined,
        notes: pmtNotes.trim() || undefined,
      },
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/accounting/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {invoice.invoiceNumber ?? `Draft #${invoice.id}`}
              </h1>
              <Badge
                variant="outline"
                className={`capitalize border-none ${invoiceStatusBadgeClass(invoice.status)}`}
              >
                {invoiceStatusLabel(invoice.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {invoice.customer?.name ?? "Customer"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
          {isDraft && (
            <>
              <Link href={`/accounting/invoices/${invoice.id}/edit`}>
                <Button variant="outline" className="gap-2">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </Link>
              <Button
                className="gap-2"
                onClick={() =>
                  issueMutation.mutate({
                    id: invoice.id,
                    params: { organizationId: ORG_ID },
                  })
                }
                disabled={issueMutation.isPending}
              >
                <Send className="h-4 w-4" /> Issue invoice
              </Button>
              <Button
                variant="ghost"
                className="gap-2 text-destructive"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete draft
              </Button>
            </>
          )}
          {canTakePayment && (
            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
              <DialogTrigger asChild>
                <Button
                  className="gap-2"
                  onClick={() => {
                    setPmtAmount(remaining.toFixed(2));
                    setPmtDate(new Date().toISOString().slice(0, 10));
                  }}
                >
                  <Plus className="h-4 w-4" /> Record payment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Record payment</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label htmlFor="pmt-amount">Amount *</Label>
                    <Input
                      id="pmt-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={pmtAmount}
                      onChange={(e) => setPmtAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Balance due: {formatMoney(remaining)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="pmt-date">Date</Label>
                      <Input
                        id="pmt-date"
                        type="date"
                        value={pmtDate}
                        onChange={(e) => setPmtDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="pmt-method">Method</Label>
                      <Select
                        value={pmtMethod}
                        onValueChange={(v) => setPmtMethod(v as PaymentMethod)}
                      >
                        <SelectTrigger id="pmt-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_METHOD_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="pmt-ref">Reference</Label>
                    <Input
                      id="pmt-ref"
                      placeholder="e.g. Check #1234"
                      value={pmtReference}
                      onChange={(e) => setPmtReference(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmt-notes">Notes</Label>
                    <Textarea
                      id="pmt-notes"
                      rows={2}
                      value={pmtNotes}
                      onChange={(e) => setPmtNotes(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPaymentOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={submitPayment} disabled={createPayment.isPending}>
                    Record payment
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {!isDraft && !isVoided && !isPaid && (
            <Button
              variant="outline"
              className="gap-2 text-destructive"
              onClick={() => setVoidConfirm(true)}
            >
              <XCircle className="h-4 w-4" /> Void
            </Button>
          )}
        </div>
      </div>

      {/* Printable invoice body */}
      <div className="bg-card border rounded-xl shadow-sm p-8 print:shadow-none print:border-0 print:rounded-none">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-primary">INVOICE</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {invoice.invoiceNumber ?? `Draft #${invoice.id}`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Riverside Memorial</p>
            <p className="text-sm text-muted-foreground">ops@riversidememorial.com</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Bill to
            </p>
            <p className="font-semibold">{invoice.customer?.name ?? "(unknown)"}</p>
            {invoice.customer?.email && (
              <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>
            )}
            {invoice.customer?.addressLine1 && (
              <p className="text-sm text-muted-foreground">{invoice.customer.addressLine1}</p>
            )}
            {(invoice.customer?.city ||
              invoice.customer?.state ||
              invoice.customer?.postalCode) && (
              <p className="text-sm text-muted-foreground">
                {[invoice.customer.city, invoice.customer.state, invoice.customer.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>
          <div className="text-right space-y-1">
            <DateRow
              label="Issue date"
              value={invoice.issueDate ? format(new Date(invoice.issueDate), "MMM d, yyyy") : "—"}
            />
            <DateRow
              label="Due date"
              value={invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "—"}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(invoice.items ?? []).map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.description}</TableCell>
                <TableCell className="text-right">{it.quantity}</TableCell>
                <TableCell className="text-right">{formatMoney(it.unitPrice)}</TableCell>
                <TableCell className="text-right">{formatMoney(it.lineTax)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(it.lineTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-end mt-6">
          <div className="w-full max-w-xs space-y-2">
            <SumRow label="Subtotal" value={formatMoney(invoice.subtotal)} />
            <SumRow label="Tax" value={formatMoney(invoice.taxTotal)} />
            <div className="border-t pt-2 mt-2">
              <SumRow label="Total" value={formatMoney(invoice.total)} bold />
            </div>
            <SumRow label="Amount paid" value={formatMoney(invoice.amountPaid)} />
            <div className="border-t pt-2 mt-2">
              <SumRow
                label="Balance due"
                value={formatMoney(invoice.balanceDue)}
                bold
                accent={invoice.balanceDue > 0 ? "text-destructive" : "text-primary"}
              />
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Notes
            </p>
            <p className="text-sm whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Payment history (not printed) */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.payments ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    No payments recorded
                  </TableCell>
                </TableRow>
              ) : (
                (invoice.payments ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.paymentDate ? format(new Date(p.paymentDate), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell>{p.reference ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(p.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          deletePayment.mutate({
                            id: p.id,
                            params: { organizationId: ORG_ID },
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={voidConfirm} onOpenChange={setVoidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice will be marked voided and removed from outstanding receivables.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                voidMutation.mutate({
                  id: invoice.id,
                  params: { organizationId: ORG_ID },
                })
              }
            >
              Void invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft and all its line items will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteMutation.mutate({
                  id: invoice.id,
                  params: { organizationId: ORG_ID },
                })
              }
            >
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function SumRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "text-base font-bold" : "font-medium"} ${accent ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
