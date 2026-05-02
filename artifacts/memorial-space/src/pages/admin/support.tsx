import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LifeBuoy, AlertCircle, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { format } from "date-fns";

type Ticket = {
  id: string;
  subject: string;
  org: string;
  contact: string;
  priority: "urgent" | "high" | "normal" | "low";
  status: "open" | "in-progress" | "resolved";
  opened: Date;
  preview: string;
};

const tickets: Ticket[] = [
  { id: "T-2026-0421", subject: "Bulk import of 1,800 historical records failing", org: "Mountainview Funeral Group", contact: "robert.c@mountainview.com", priority: "urgent", status: "in-progress", opened: new Date(2026, 4, 1, 9, 14), preview: "We've tried three times overnight. CSV is UTF-8 with proper headers but rows 401-450 keep erroring..." },
  { id: "T-2026-0420", subject: "QR codes not redirecting to mobile memorial pages", org: "Greenwood Memorial Park", contact: "margaret@greenwood-memorial.com", priority: "high", status: "open", opened: new Date(2026, 4, 1, 8, 2), preview: "After our last rollout, scanning a QR on iOS opens the desktop layout. Android works fine..." },
  { id: "T-2026-0419", subject: "Stripe payouts arriving 24h late", org: "Sunset Valley", contact: "j.okonkwo@sunsetvalley.com", priority: "high", status: "open", opened: new Date(2026, 3, 30, 16, 45), preview: "Marketplace orders processed Sunday haven't hit our account yet. Last week was on time..." },
  { id: "T-2026-0418", subject: "Request: bulk obituary template", org: "Pine Hill Cemetery", contact: "elena@pinehill.org", priority: "normal", status: "open", opened: new Date(2026, 3, 30, 11, 22), preview: "Would love a way to apply the same obituary template across multiple memorial pages..." },
  { id: "T-2026-0417", subject: "User can't access plot map on iPad", org: "Hillside Eternal Rest", contact: "d.martinez@hillside.us", priority: "normal", status: "in-progress", opened: new Date(2026, 3, 29, 14, 8), preview: "Page just spins forever. Network shows the request returning 200 but nothing renders..." },
  { id: "T-2026-0416", subject: "Refund: duplicate charge on subscription", org: "St. Mary's Cemetery", contact: "thomas@stmarys.ca", priority: "low", status: "resolved", opened: new Date(2026, 3, 28, 10, 30), preview: "Got billed twice for April. Need a refund for the extra $199. Already confirmed with Stripe..." },
];

const priorityColor: Record<string, string> = {
  urgent: "border-rose-500/40 text-rose-400 bg-rose-500/10",
  high: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  normal: "border-sky-500/40 text-sky-400 bg-sky-500/10",
  low: "border-border text-muted-foreground",
};

const statusIcon: Record<string, { icon: typeof AlertCircle; color: string }> = {
  open: { icon: AlertCircle, color: "text-rose-400" },
  "in-progress": { icon: Clock, color: "text-amber-400" },
  resolved: { icon: CheckCircle2, color: "text-emerald-400" },
};

export default function AdminSupport() {
  const [filter, setFilter] = useState<"all" | "open" | "in-progress" | "resolved">("all");
  const filtered = filter === "all" ? tickets : tickets.filter(t => t.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Customer requests requiring platform team attention.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90"><MessageSquare className="h-4 w-4 mr-2" />New ticket</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-rose-500/30 bg-rose-500/5"><CardContent className="p-4"><div className="flex items-center gap-3"><AlertCircle className="h-5 w-5 text-rose-400" /><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Open</p><p className="text-2xl font-bold">{tickets.filter(t => t.status === "open").length}</p></div></div></CardContent></Card>
        <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="p-4"><div className="flex items-center gap-3"><Clock className="h-5 w-5 text-amber-400" /><div><p className="text-xs uppercase tracking-wider text-muted-foreground">In Progress</p><p className="text-2xl font-bold">{tickets.filter(t => t.status === "in-progress").length}</p></div></div></CardContent></Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5"><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Resolved (7d)</p><p className="text-2xl font-bold">14</p></div></div></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-4"><div className="flex items-center gap-3"><LifeBuoy className="h-5 w-5 text-primary" /><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Avg Response</p><p className="text-2xl font-bold">42m</p></div></div></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "open", "in-progress", "resolved"] as const).map(s => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize" data-testid={`filter-${s}`}>
            {s.replace("-", " ")}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(t => {
          const StatusIcon = statusIcon[t.status].icon;
          return (
            <Card key={t.id} className="border-border/60 hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <StatusIcon className={`h-5 w-5 mt-1 shrink-0 ${statusIcon[t.status].color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold">{t.subject}</p>
                      <Badge variant="outline" className={`capitalize text-[10px] ${priorityColor[t.priority]}`}>{t.priority}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{t.preview}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground/70">{t.org}</span>
                      <span>·</span>
                      <span>{t.contact}</span>
                      <span>·</span>
                      <span>{t.id}</span>
                      <span>·</span>
                      <span>{format(t.opened, "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
