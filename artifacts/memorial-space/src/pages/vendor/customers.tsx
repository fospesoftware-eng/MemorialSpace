/**
 * Vendor customer CRM — distinct customers (by email) with per-customer
 * spend, request count, and contact info. Powers the "vendor network SaaS"
 * pitch: vendors keep their relationships, not just one-off leads.
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Search, Mail, Phone, DollarSign, Calendar } from "lucide-react";
import { useVendorCustomers } from "./api";

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function VendorCustomers() {
  const { data, isLoading } = useVendorCustomers();
  const [q, setQ] = useState("");

  const customers = data?.customers ?? [];
  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return customers;
    return customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(lc) ||
        c.customerEmail.toLowerCase().includes(lc) ||
        (c.customerPhone ?? "").includes(lc),
    );
  }, [customers, q]);

  const totals = useMemo(() => {
    const totalSpent = customers.reduce((a, c) => a + c.totalSpent, 0);
    const repeat = customers.filter((c) => c.requestCount > 1).length;
    return { totalSpent, repeat, count: customers.length };
  }, [customers]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="customers-title">Customers</h1>
        <p className="text-muted-foreground mt-1">
          Every family who's reached out. Your private CRM — never lose a relationship.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3"><Users className="h-5 w-5" /></div>
          <p className="text-3xl font-bold" data-testid="stat-customer-count">{totals.count}</p>
          <p className="text-sm text-muted-foreground mt-1">Total customers</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-3"><Calendar className="h-5 w-5" /></div>
          <p className="text-3xl font-bold">{totals.repeat}</p>
          <p className="text-sm text-muted-foreground mt-1">Repeat customers</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3"><DollarSign className="h-5 w-5" /></div>
          <p className="text-3xl font-bold">{fmtMoney(totals.totalSpent)}</p>
          <p className="text-sm text-muted-foreground mt-1">Lifetime customer value</p>
        </CardContent></Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, or phone…" className="pl-9" data-testid="input-search-customers" />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading customers…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground" data-testid="empty-customers">
            <Users className="h-10 w-10 mx-auto opacity-40 mb-3" />
            <p className="font-medium">No customers yet.</p>
            <p className="text-sm mt-1">When families submit requests, they show up here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const initials = c.customerName.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            return (
              <Card key={c.customerEmail} className="border-border/60 hover:border-primary/40 transition-colors" data-testid={`customer-card-${c.customerEmail}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 border border-primary/30">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{c.customerName}</p>
                      <p className="text-xs text-muted-foreground">{c.requestCount} request{c.requestCount === 1 ? "" : "s"}</p>
                    </div>
                    {c.totalSpent > 0 ? (
                      <p className="text-sm font-bold text-emerald-400 tabular-nums">{fmtMoney(c.totalSpent)}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="h-3 w-3 shrink-0" />
                      <a href={`mailto:${c.customerEmail}`} className="truncate hover:text-foreground">{c.customerEmail}</a>
                    </div>
                    {c.customerPhone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        <a href={`tel:${c.customerPhone}`} className="truncate hover:text-foreground">{c.customerPhone}</a>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>Last contact {relativeTime(c.lastContactAt)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
