import { useGetDashboardSummary, useGetRecentActivity, useGetPlotStatusBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, Users, Calendar, DollarSign, Activity, Wrench } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format } from "date-fns";

const ORG_ID = 1;

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary(ORG_ID);
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity(ORG_ID);
  const { data: plotBreakdown, isLoading: loadingPlot } = useGetPlotStatusBreakdown(ORG_ID);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const PIE_COLORS = {
    available: 'hsl(var(--primary))',
    reserved: '#d4a843',
    occupied: '#374151',
    maintenance: '#ef4444'
  };

  const pieData = plotBreakdown ? [
    { name: 'Available', value: plotBreakdown.available, color: PIE_COLORS.available },
    { name: 'Reserved', value: plotBreakdown.reserved, color: PIE_COLORS.reserved },
    { name: 'Occupied', value: plotBreakdown.occupied, color: PIE_COLORS.occupied },
    { name: 'Maintenance', value: plotBreakdown.maintenance, color: PIE_COLORS.maintenance },
  ].filter(d => d.value > 0) : [];

  // Mock revenue data for chart
  const revenueData = [
    { name: 'Jan', total: Math.random() * 5000 + 1000 },
    { name: 'Feb', total: Math.random() * 5000 + 1000 },
    { name: 'Mar', total: Math.random() * 5000 + 1000 },
    { name: 'Apr', total: Math.random() * 5000 + 1000 },
    { name: 'May', total: Math.random() * 5000 + 1000 },
    { name: 'Jun', total: Math.random() * 5000 + 1000 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of cemetery operations and metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary ? formatCurrency(summary.totalRevenue) : '...'}</div>
            <p className="text-xs text-muted-foreground">
              +{summary ? formatCurrency(summary.monthlyRevenue) : '...'} this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plots</CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalPlots ?? '...'}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.availablePlots ?? 0} available
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.pendingBookings ?? '...'}</div>
            <p className="text-xs text-muted-foreground">
              Out of {summary?.totalBookings ?? 0} total bookings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Work Orders</CardTitle>
            <Wrench className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.openWorkOrders ?? '...'}</div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue across all services</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `$${value}`}
                  />
                  <RechartsTooltip 
                    cursor={{fill: 'hsl(var(--muted))'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Plot Status</CardTitle>
            <CardDescription>Current utilization of grounds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex items-center justify-center">
              {loadingPlot ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest operations and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {loadingActivity ? (
              <div className="text-sm text-muted-foreground">Loading activity...</div>
            ) : activity && activity.length > 0 ? (
              activity.map((item) => (
                <div key={item.id} className="flex items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No recent activity.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}