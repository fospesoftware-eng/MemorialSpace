import { useState } from "react";
import { Link } from "wouter";
import { useListInvoices } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import {
  ORG_ID,
  formatMoney,
  invoiceStatusBadgeClass,
  invoiceStatusLabel,
} from "./_shared";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "voided", label: "Voided" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

export default function AccountingInvoicesList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: invoices, isLoading } = useListInvoices({
    organizationId: ORG_ID,
    ...(statusFilter !== "all"
      ? { status: statusFilter as Exclude<StatusFilter, "all"> }
      : {}),
  });

  const filtered = (invoices ?? []).filter((inv) => {
    const term = search.toLowerCase();
    return (
      !term ||
      (inv.invoiceNumber ?? "").toLowerCase().includes(term) ||
      inv.customerName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Bill customers for plots, services, and merchandise.
          </p>
        </div>
        <Link href="/accounting/invoices/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 bg-card p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice # or customer..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <FileText className="mx-auto h-6 w-6 mb-2 opacity-50" />
                  No invoices match your filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <Link
                      href={`/accounting/invoices/${inv.id}`}
                      className="hover:underline"
                    >
                      {inv.invoiceNumber ?? `Draft #${inv.id}`}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.customerName}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize border-none ${invoiceStatusBadgeClass(inv.status)}`}
                    >
                      {invoiceStatusLabel(inv.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {inv.issueDate ? format(new Date(inv.issueDate), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell>
                    {inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(inv.total)}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(inv.amountPaid)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMoney(inv.balanceDue)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
