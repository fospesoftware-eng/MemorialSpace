import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  DollarSign,
  TrendingUp,
  Activity,
  Hourglass,
  AlertTriangle,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useAdminMetrics } from "./api";
import { formatCents, formatDateTime, invoiceStatusClass, relativeTime } from "./_shared";

export default function AdminDashboard() {
  const { data: m, isLoading } = useAdminMetrics();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#d4a843] mb-1">Super Admin</p>
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">
          Real-time SaaS health across all MemorialSpace customers.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          label="Monthly Recurring Revenue"
          value={isLoading ? "…" : formatCents(m?.mrrCents ?? 0)}
          delta={isLoading ? "" : `ARR ${formatCents(m?.arrCents ?? 0)}`}
          icon={DollarSign}
          accent="text-[#d4a843] bg-[#d4a843]/10"
        />
        <KPI
          label="Active Cemeteries"
          value={isLoading ? "…" : String(m?.activeSubscriptions ?? 0)}
          delta={`${m?.totalOrganizations ?? 0} total · ${m?.suspendedOrganizations ?? 0} suspended`}
          icon={Building2}
          accent="text-primary bg-primary/10"
        />
        <KPI
          label="Trialing"
          value={isLoading ? "…" : String(m?.trialingSubscriptions ?? 0)}
          delta={`${m?.pastDueSubscriptions ?? 0} past due`}
          icon={Hourglass}
          accent="text-amber-400 bg-amber-500/10"
        />
        <KPI
          label="Outstanding A/R"
          value={isLoading ? "…" : formatCents(m?.outstandingCents ?? 0)}
          delta={`${formatCents(m?.collectedCents ?? 0)} collected total`}
          icon={Wallet}
          accent="text-emerald-400 bg-emerald-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#d4a843]" />
              MRR Growth
            </CardTitle>
            <p className="text-xs text-muted-foreground">Trailing 12 months · USD</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(m?.monthly ?? []).map((d) => ({ ...d, mrr: d.mrrCents / 100 }))}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
                />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "MRR"]}
                />
                <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#mrrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              New Cemeteries
            </CardTitle>
            <p className="text-xs text-muted-foreground">Signups per month</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m?.monthly ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#d4a843]" />
              Recent invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(m?.recentInvoices ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            )}
            {(m?.recentInvoices ?? []).map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:border-border transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[#d4a843]/10 flex items-center justify-center text-[#d4a843] shrink-0">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {i.invoiceNumber ?? `Draft #${i.id}`} · {formatCents(i.totalCents, i.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Org #{i.organizationId} · {formatDateTime(i.createdAt)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={invoiceStatusClass[i.status]}>
                  {i.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              Recent payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(m?.recentPayments ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No payments collected yet.</p>
            )}
            {(m?.recentPayments ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{formatCents(p.amountCents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.method} · {relativeTime(p.paidAt)}
                  </p>
                </div>
                <span className="text-xs text-emerald-400">paid</span>
              </div>
            ))}
            {m?.pastDueSubscriptions ? (
              <div className="mt-3 p-3 rounded-md border border-amber-500/30 bg-amber-500/5 flex items-center gap-2 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {m.pastDueSubscriptions} subscription{m.pastDueSubscriptions === 1 ? "" : "s"} past due
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{delta}</p>
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
