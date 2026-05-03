/**
 * Vendor orders — every accepted/completed request, with revenue, payment
 * status, and scheduled date. This is the "what have I sold" view (versus
 * /requests which is "who has asked").
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Receipt, Search, DollarSign, CalendarClock, Repeat, X } from "lucide-react";
import { useVendorOrders, type VendorOrderRow, type VendorPaymentStatus } from "./api";

const PAYMENT_BADGE: Record<VendorPaymentStatus, { label: string; cls: string }> = {
  unpaid:    { label: "Unpaid",    cls: "border-amber-400/40 text-amber-300 bg-amber-400/5" },
  invoiced:  { label: "Invoiced",  cls: "border-sky-400/40 text-sky-300 bg-sky-400/5" },
  paid:      { label: "Paid",      cls: "border-emerald-400/40 text-emerald-300 bg-emerald-400/5" },
  refunded:  { label: "Refunded",  cls: "border-rose-400/40 text-rose-300 bg-rose-400/5" },
};

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function VendorOrders() {
  const { data, isLoading } = useVendorOrders();
  const [q, setQ] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<VendorPaymentStatus | "all">("all");

  const orders = data?.orders ?? [];
  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (paymentFilter !== "all" && o.paymentStatus !== paymentFilter) return false;
      if (!lc) return true;
      return (
        o.customerName.toLowerCase().includes(lc) ||
        o.customerEmail.toLowerCase().includes(lc) ||
        (o.serviceName ?? "").toLowerCase().includes(lc) ||
        (o.deceasedName ?? "").toLowerCase().includes(lc)
      );
    });
  }, [orders, q, paymentFilter]);

  const totals = useMemo(() => {
    const paid = filtered.reduce((a, o) => a + (o.paidAmount ?? 0), 0);
    const quoted = filtered.reduce((a, o) => a + (o.quotedAmount ?? 0), 0);
    const recurring = filtered.filter((o) => o.isRecurring).length;
    return { paid, quoted, recurring };
  }, [filtered]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="orders-title">Orders</h1>
        <p className="text-muted-foreground mt-1">
          Every accepted request. Track quotes, payments, and recurring subscriptions.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3"><DollarSign className="h-5 w-5" /></div>
          <p className="text-3xl font-bold" data-testid="stat-paid">{fmtMoney(totals.paid)}</p>
          <p className="text-sm text-muted-foreground mt-1">Realised revenue (filtered)</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="h-10 w-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3"><Receipt className="h-5 w-5" /></div>
          <p className="text-3xl font-bold">{fmtMoney(totals.quoted)}</p>
          <p className="text-sm text-muted-foreground mt-1">Total quoted</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-3"><Repeat className="h-5 w-5" /></div>
          <p className="text-3xl font-bold">{totals.recurring}</p>
          <p className="text-sm text-muted-foreground mt-1">Recurring subscriptions</p>
        </CardContent></Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-7 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer, service, or deceased…" className="pl-9" data-testid="input-search-orders" />
          </div>
          <div className="md:col-span-5 flex flex-wrap gap-1.5">
            {(["all", "unpaid", "invoiced", "paid", "refunded"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setPaymentFilter(s)}
                data-testid={`filter-${s}`}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  paymentFilter === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "All" : PAYMENT_BADGE[s].label}
              </button>
            ))}
            {q || paymentFilter !== "all" ? (
              <Button size="sm" variant="ghost" onClick={() => { setQ(""); setPaymentFilter("all"); }} className="ml-auto">
                <X className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading orders…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground" data-testid="empty-orders">
            <Receipt className="h-10 w-10 mx-auto opacity-40 mb-3" />
            <p className="font-medium">No orders match these filters.</p>
            <p className="text-sm mt-1">Accepted and completed requests will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Service</th>
                  <th className="text-right px-4 py-3">Quoted</th>
                  <th className="text-right px-4 py-3">Paid</th>
                  <th className="text-left px-4 py-3">Payment</th>
                  <th className="text-left px-4 py-3">Scheduled</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((o: VendorOrderRow) => {
                  const pb = PAYMENT_BADGE[o.paymentStatus];
                  return (
                    <tr key={o.id} className="hover:bg-muted/20" data-testid={`order-row-${o.id}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate">{o.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{o.customerEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{o.serviceName ?? "—"}</span>
                          {o.isRecurring ? (
                            <Badge variant="outline" className="text-[10px] border-violet-400/40 text-violet-300 bg-violet-400/5"><Repeat className="h-2.5 w-2.5 mr-1" />Recurring</Badge>
                          ) : null}
                        </div>
                        {o.deceasedName ? <p className="text-xs text-muted-foreground mt-0.5">For {o.deceasedName}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(o.quotedAmount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtMoney(o.paidAmount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${pb.cls}`}>{pb.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {o.scheduledFor ? (
                          <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{new Date(o.scheduledFor).toLocaleDateString()}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">{o.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
