import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, DollarSign, TrendingUp, Activity, AlertCircle, CheckCircle2, Server } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { useListOrganizations } from "@workspace/api-client-react";

const mrrData = [
  { month: "Nov", mrr: 78400 }, { month: "Dec", mrr: 82100 }, { month: "Jan", mrr: 89500 },
  { month: "Feb", mrr: 94200 }, { month: "Mar", mrr: 102800 }, { month: "Apr", mrr: 118600 }, { month: "May", mrr: 127300 },
];
const signups = [
  { month: "Nov", count: 14 }, { month: "Dec", count: 11 }, { month: "Jan", count: 19 },
  { month: "Feb", count: 23 }, { month: "Mar", count: 28 }, { month: "Apr", count: 34 }, { month: "May", count: 21 },
];

export default function AdminDashboard() {
  const { data: orgs } = useListOrganizations();
  const orgCount = orgs?.length ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#d4a843] mb-1">Super Admin</p>
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Real-time health and growth across all MemorialSpace customers.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Monthly Recurring Revenue" value="$127,300" delta="+8.0%" icon={DollarSign} accent="text-[#d4a843] bg-[#d4a843]/10" />
        <KPI label="Active Cemeteries" value={String(320 + orgCount)} delta="+21 this month" icon={Building2} accent="text-primary bg-primary/10" />
        <KPI label="Total Family Users" value="148,420" delta="+4,210 this week" icon={Users} accent="text-sky-400 bg-sky-500/10" />
        <KPI label="Platform Uptime" value="99.98%" delta="30-day" icon={Activity} accent="text-emerald-400 bg-emerald-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#d4a843]" />MRR Growth</CardTitle>
            <p className="text-xs text-muted-foreground">Trailing 7 months · USD</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrData}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => [`$${v.toLocaleString()}`, "MRR"]} />
                <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#mrrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />New Cemeteries</CardTitle>
            <p className="text-xs text-muted-foreground">Signups per month</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signups}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader><CardTitle>Recent Signups</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "Riverside Memorial Gardens", plan: "Professional", date: "May 1, 2026", region: "Oregon, US" },
              { name: "St. Mary's Catholic Cemetery", plan: "Starter", date: "Apr 29, 2026", region: "Toronto, CA" },
              { name: "Mountainview Funeral Group", plan: "Enterprise", date: "Apr 27, 2026", region: "Colorado, US" },
              { name: "Hillside Eternal Rest", plan: "Professional", date: "Apr 25, 2026", region: "Texas, US" },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:border-border transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                    {s.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.region}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className={s.plan === "Enterprise" ? "border-[#d4a843]/40 text-[#d4a843]" : ""}>{s.plan}</Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{s.date}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-emerald-400" />System Health</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { svc: "API Gateway", status: "Operational", icon: CheckCircle2, color: "text-emerald-400" },
              { svc: "Database (Primary)", status: "Operational", icon: CheckCircle2, color: "text-emerald-400" },
              { svc: "Search Index", status: "Operational", icon: CheckCircle2, color: "text-emerald-400" },
              { svc: "Email Delivery", status: "Degraded", icon: AlertCircle, color: "text-amber-400" },
              { svc: "Payments (Stripe)", status: "Operational", icon: CheckCircle2, color: "text-emerald-400" },
            ].map((s) => (
              <div key={s.svc} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.svc}</span>
                <span className={`flex items-center gap-1.5 ${s.color}`}>
                  <s.icon className="h-3.5 w-3.5" /> {s.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ label, value, delta, icon: Icon, accent }: { label: string; value: string; delta: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
            <p className="text-xs text-emerald-400 mt-1">{delta}</p>
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
