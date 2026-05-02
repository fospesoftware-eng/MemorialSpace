import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, PieChart as PieIcon, Target, DollarSign } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useAdminMetrics } from "./api";
import { formatCents } from "./_shared";

const PLAN_COLORS = ["#d4a843", "hsl(var(--primary))", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function AdminAnalytics() {
  const { data: m } = useAdminMetrics();
  const monthly = (m?.monthly ?? []).map((x) => ({ ...x, mrr: x.mrrCents / 100 }));
  const planDist = Object.entries(m?.planDistribution ?? {}).map(([name, value]) => ({
    name,
    value,
  }));
  const subStateData = [
    { name: "Active", value: m?.activeSubscriptions ?? 0, fill: "hsl(var(--primary))" },
    { name: "Trialing", value: m?.trialingSubscriptions ?? 0, fill: "#d4a843" },
    { name: "Past due", value: m?.pastDueSubscriptions ?? 0, fill: "#f97316" },
    { name: "Cancelled", value: m?.cancelledSubscriptions ?? 0, fill: "#64748b" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#d4a843] mb-1">Super Admin</p>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Revenue, plan mix, and subscription health across the platform.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="MRR" value={formatCents(m?.mrrCents ?? 0)} icon={DollarSign} accent="text-[#d4a843] bg-[#d4a843]/10" />
        <KPI label="ARR" value={formatCents(m?.arrCents ?? 0)} icon={TrendingUp} accent="text-primary bg-primary/10" />
        <KPI
          label="Total customers"
          value={String((m?.activeSubscriptions ?? 0) + (m?.trialingSubscriptions ?? 0))}
          icon={Target}
          accent="text-emerald-400 bg-emerald-500/10"
        />
        <KPI
          label="Total collected"
          value={formatCents(m?.collectedCents ?? 0)}
          icon={DollarSign}
          accent="text-sky-400 bg-sky-500/10"
        />
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#d4a843]" />
            Revenue & signups (12 months)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
              />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <RTooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="mrr" name="MRR ($)" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="signups" name="New signups" stroke="#d4a843" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-[#d4a843]" />
              Plan distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {planDist.map((_, i) => (
                    <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Subscription health</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subStateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {subStateData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
