import { Link } from "wouter";
import { useGetAccountingSummary, useListInvoices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, AlertTriangle, TrendingUp, FileText, Plus } from "lucide-react";
import { ORG_ID, formatMoney, invoiceStatusBadgeClass, invoiceStatusLabel } from "./_shared";

export default function AccountingOverview() {
  const { data: summary, isLoading: loadingSummary } = useGetAccountingSummary({
    organizationId: ORG_ID,
  });
  const { data: invoices } = useListInvoices({ organizationId: ORG_ID });

  const recent = (invoices ?? []).slice(0, 8);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
          <p className="text-muted-foreground mt-1">
            Invoices, payments, and accounts receivable.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting/invoices/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Outstanding"
          value={loadingSummary ? "—" : formatMoney(summary?.totalOutstanding ?? 0)}
          subtitle={`${summary?.issuedCount ?? 0} open invoice(s)`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          title="Overdue"
          value={loadingSummary ? "—" : formatMoney(summary?.totalOverdue ?? 0)}
          subtitle={`${summary?.overdueCount ?? 0} past due`}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="text-destructive"
        />
        <KpiCard
          title="Paid this month"
          value={loadingSummary ? "—" : formatMoney(summary?.paidThisMonth ?? 0)}
          subtitle="Cash collected"
          icon={<TrendingUp className="h-4 w-4" />}
          accent="text-primary"
        />
        <KpiCard
          title="Invoiced this month"
          value={loadingSummary ? "—" : formatMoney(summary?.invoicedThisMonth ?? 0)}
          subtitle={`${summary?.draftCount ?? 0} draft, ${summary?.paidCount ?? 0} paid`}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent invoices</CardTitle>
            <Link href="/accounting/invoices">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No invoices yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.map((inv) => (
                    <TableRow key={inv.id}>
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
                      <TableCell className="text-right">
                        {formatMoney(inv.total)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(inv.balanceDue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AR aging</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.aging ?? []).map((b) => (
                  <TableRow key={b.label}>
                    <TableCell>{b.label}</TableCell>
                    <TableCell className="text-right">{b.count}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(b.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span className={`text-muted-foreground ${accent ?? ""}`}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
