import { Link } from "wouter";
import { format } from "date-fns";
import {
  useGetDashboardSummary,
  useGetPlotStatusBreakdown,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import {
  Activity,
  ArrowRight,
  Calendar,
  DollarSign,
  FileText,
  Map,
  MapPin,
  QrCode,
  ScanText,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const ORG_ID = 1;

const PIE_COLORS = {
  available: "hsl(var(--primary))",
  reserved: "#d4a843",
  occupied: "#4b5563",
  maintenance: "#dc2626",
};

type RecentActivityItem = {
  id: number;
  type: string;
  description: string;
  createdAt: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  loading,
  tone = "primary",
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof DollarSign;
  loading?: boolean;
  tone?: "primary" | "amber" | "blue" | "rose";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-sky-500/10 text-sky-600",
    rose: "bg-rose-500/10 text-rose-600",
  }[tone];

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardDescription className="text-xs font-medium uppercase tracking-wider">{title}</CardDescription>
          {loading ? <Skeleton className="h-8 w-24" /> : <CardTitle className="text-2xl">{value}</CardTitle>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-4 w-32" /> : <p className="text-sm text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary(ORG_ID);
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity(ORG_ID);
  const { data: plotBreakdown, isLoading: loadingPlot } = useGetPlotStatusBreakdown(ORG_ID);
  const recentActivity = (activity ?? []) as RecentActivityItem[];

  const totalPlots = summary?.totalPlots ?? 0;
  const occupiedPlots = summary?.occupiedPlots ?? 0;
  const reservedPlots = summary?.reservedPlots ?? 0;
  const availablePlots = summary?.availablePlots ?? 0;
  const utilization = percent(occupiedPlots + reservedPlots, totalPlots);
  const bookingRate = percent(summary?.pendingBookings ?? 0, summary?.totalBookings ?? 0);

  const pieData = plotBreakdown ? [
    { name: "Available", value: plotBreakdown.available, color: PIE_COLORS.available },
    { name: "Reserved", value: plotBreakdown.reserved, color: PIE_COLORS.reserved },
    { name: "Occupied", value: plotBreakdown.occupied, color: PIE_COLORS.occupied },
    { name: "Maintenance", value: plotBreakdown.maintenance, color: PIE_COLORS.maintenance },
  ].filter((d) => d.value > 0) : [];

  const operationsData = summary ? [
    { name: "Plots", total: summary.totalPlots },
    { name: "Burials", total: summary.totalBurials },
    { name: "Bookings", total: summary.totalBookings },
    { name: "Memorials", total: summary.totalMemorials },
    { name: "QR Codes", total: summary.totalQrCodes },
    { name: "Work", total: summary.openWorkOrders },
  ] : [];

  const quickActions = [
    { label: "Open Map", href: "/map", icon: Map },
    { label: "Add Burial", href: "/burials", icon: Users },
    { label: "Import Data", href: "/import-data", icon: ScanText },
    { label: "Work Orders", href: "/work-orders", icon: Wrench },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Activity className="h-4 w-4" />
            Cemetery operator
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Operations Dashboard</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            A live view of revenue, grounds availability, bookings, work orders, and recent cemetery activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button key={action.href} asChild variant="outline" className="gap-2 transition-all duration-200 hover:-translate-y-0.5">
              <Link href={action.href}>
                <action.icon className="h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total revenue"
          value={formatCurrency(summary?.totalRevenue ?? 0)}
          detail={`${formatCurrency(summary?.monthlyRevenue ?? 0)} estimated this month`}
          icon={DollarSign}
          loading={loadingSummary}
        />
        <StatCard
          title="Grounds utilization"
          value={`${utilization}%`}
          detail={`${formatNumber(availablePlots)} available of ${formatNumber(totalPlots)} plots`}
          icon={MapPin}
          loading={loadingSummary}
          tone="blue"
        />
        <StatCard
          title="Pending bookings"
          value={formatNumber(summary?.pendingBookings ?? 0)}
          detail={`${bookingRate}% of ${formatNumber(summary?.totalBookings ?? 0)} total bookings`}
          icon={Calendar}
          loading={loadingSummary}
          tone="amber"
        />
        <StatCard
          title="Open work orders"
          value={formatNumber(summary?.openWorkOrders ?? 0)}
          detail="Maintenance items requiring attention"
          icon={Wrench}
          loading={loadingSummary}
          tone="rose"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Operations Snapshot</CardTitle>
              <CardDescription>Current record volume across core cemetery workflows</CardDescription>
            </div>
            <Badge variant="outline" className="w-fit gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Live metrics
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loadingSummary ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operationsData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Plot Status</CardTitle>
            <CardDescription>Availability and occupancy across the grounds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="h-[220px] w-full">
              {loadingPlot ? (
                <Skeleton className="h-full w-full" />
              ) : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="48%" innerRadius={58} outerRadius={82} paddingAngle={2} dataKey="value">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No plot data available</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Occupied + reserved</span>
                <span className="text-muted-foreground">{utilization}%</span>
              </div>
              <Progress value={utilization} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Today's Focus</CardTitle>
            <CardDescription>High-signal items for the operations team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Pending bookings", value: summary?.pendingBookings ?? 0, icon: Calendar, href: "/bookings" },
              { label: "Open work orders", value: summary?.openWorkOrders ?? 0, icon: Wrench, href: "/work-orders" },
              { label: "Memorial pages", value: summary?.totalMemorials ?? 0, icon: FileText, href: "/memorials" },
              { label: "QR codes", value: summary?.totalQrCodes ?? 0, icon: QrCode, href: "/qr-codes" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center justify-between rounded-md border border-border/70 px-3 py-3 transition-all duration-200 hover:border-primary/40 hover:bg-muted/40"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">Open workspace</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {loadingSummary ? <Skeleton className="h-5 w-8" /> : formatNumber(item.value)}
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest operations and updates</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">Last 10 items</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {loadingActivity ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-md px-2 py-3">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))
              ) : recentActivity.length > 0 ? (
                recentActivity.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 rounded-md px-2 py-3 transition-colors duration-200 hover:bg-muted/40">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No recent activity yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
