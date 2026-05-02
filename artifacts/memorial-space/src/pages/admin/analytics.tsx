import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, LineChart, Line, Legend } from "recharts";
import { Globe, Users, Eye, MessageSquare } from "lucide-react";

const engagement = [
  { day: "Mon", views: 4200, tributes: 84, orders: 22 },
  { day: "Tue", views: 4800, tributes: 91, orders: 28 },
  { day: "Wed", views: 5100, tributes: 102, orders: 31 },
  { day: "Thu", views: 4900, tributes: 88, orders: 26 },
  { day: "Fri", views: 6300, tributes: 124, orders: 41 },
  { day: "Sat", views: 7800, tributes: 168, orders: 53 },
  { day: "Sun", views: 7100, tributes: 152, orders: 48 },
];

const regions = [
  { region: "California", value: 84 },
  { region: "Texas", value: 67 },
  { region: "New York", value: 54 },
  { region: "Florida", value: 49 },
  { region: "Ontario", value: 32 },
  { region: "Oregon", value: 28 },
  { region: "Illinois", value: 24 },
  { region: "Other", value: 41 },
];

export default function AdminAnalytics() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
        <p className="text-muted-foreground mt-1">Engagement and adoption across the entire MemorialSpace network.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex justify-between items-start"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Page Views (7d)</p><p className="text-2xl font-bold mt-2">40,200</p><Badge variant="outline" className="mt-2 text-xs border-emerald-500/40 text-emerald-400">+18.4%</Badge></div><Eye className="h-5 w-5 text-sky-400" /></div>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex justify-between items-start"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Active Visitors</p><p className="text-2xl font-bold mt-2">8,432</p><Badge variant="outline" className="mt-2 text-xs border-emerald-500/40 text-emerald-400">+12%</Badge></div><Users className="h-5 w-5 text-primary" /></div>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex justify-between items-start"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Tributes (7d)</p><p className="text-2xl font-bold mt-2">809</p><Badge variant="outline" className="mt-2 text-xs border-emerald-500/40 text-emerald-400">+22%</Badge></div><MessageSquare className="h-5 w-5 text-rose-400" /></div>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex justify-between items-start"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Countries Active</p><p className="text-2xl font-bold mt-2">38</p><Badge variant="outline" className="mt-2 text-xs">3 new this month</Badge></div><Globe className="h-5 w-5 text-[#d4a843]" /></div>
        </CardContent></Card>
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle>Daily Engagement (last 7 days)</CardTitle></CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={engagement}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="tributes" stroke="#fb7185" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="orders" stroke="#d4a843" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader><CardTitle>Cemeteries by Region</CardTitle></CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regions} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis type="category" dataKey="region" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
