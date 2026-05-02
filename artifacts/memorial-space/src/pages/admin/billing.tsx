import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const mrrTrend = [
  { m: "Nov", mrr: 78400, churn: 1.4 }, { m: "Dec", mrr: 82100, churn: 1.6 }, { m: "Jan", mrr: 89500, churn: 1.1 },
  { m: "Feb", mrr: 94200, churn: 1.2 }, { m: "Mar", mrr: 102800, churn: 0.9 }, { m: "Apr", mrr: 118600, churn: 1.0 }, { m: "May", mrr: 127300, churn: 0.8 },
];
const planMix = [
  { name: "Starter", value: 38, color: "#38bdf8" },
  { name: "Professional", value: 47, color: "#40916c" },
  { name: "Enterprise", value: 15, color: "#d4a843" },
];
const invoices = [
  { id: "INV-58210", org: "Mountainview Funeral Group", plan: "Enterprise", amount: 2400, date: "May 1", status: "paid" },
  { id: "INV-58209", org: "Greenwood Memorial Park", plan: "Professional", amount: 499, date: "May 1", status: "paid" },
  { id: "INV-58208", org: "Pine Hill Cemetery", plan: "Starter", amount: 199, date: "May 1", status: "paid" },
  { id: "INV-58207", org: "Hillside Eternal Rest", plan: "Professional", amount: 499, date: "Apr 30", status: "failed" },
  { id: "INV-58206", org: "Sunset Valley", plan: "Professional", amount: 499, date: "Apr 30", status: "paid" },
  { id: "INV-58205", org: "St. Mary's Cemetery", plan: "Starter", amount: 199, date: "Apr 30", status: "pending" },
];

const statusColor: Record<string, string> = {
  paid: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  pending: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  failed: "border-rose-500/40 text-rose-400 bg-rose-500/10",
};

export default function AdminBilling() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Revenue</h1>
        <p className="text-muted-foreground mt-1">MRR, churn, plan mix, and recent invoices.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-muted-foreground">MRR</span><DollarSign className="h-4 w-4 text-[#d4a843]" /></div>
          <p className="text-2xl font-bold mt-2">$127,300</p>
          <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" />+8.0% MoM</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-muted-foreground">ARR</span><DollarSign className="h-4 w-4 text-[#d4a843]" /></div>
          <p className="text-2xl font-bold mt-2">$1.53M</p>
          <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" />+62% YoY</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-muted-foreground">Churn (30d)</span><TrendingDown className="h-4 w-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold mt-2">0.8%</p>
          <p className="text-xs text-emerald-400 mt-1">Best month on record</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-muted-foreground">Avg Contract Value</span><FileText className="h-4 w-4 text-primary" /></div>
          <p className="text-2xl font-bold mt-2">$4,780</p>
          <p className="text-xs text-muted-foreground mt-1">Annualized</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader><CardTitle>MRR & Churn Trend</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrTrend}>
                <defs>
                  <linearGradient id="mrrG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#mrrG)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle>Plan Mix</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planMix} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80} innerRadius={50} paddingAngle={3}>
                  {planMix.map((p) => <Cell key={p.name} fill={p.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 p-4 hover:bg-card/50 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-[#d4a843]/10 text-[#d4a843] flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{inv.org}</p>
                  <p className="text-xs text-muted-foreground">{inv.id} · {inv.date}</p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex">{inv.plan}</Badge>
                <p className="font-bold w-20 text-right">${inv.amount}</p>
                <Badge variant="outline" className={`capitalize ${statusColor[inv.status]}`}>{inv.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
