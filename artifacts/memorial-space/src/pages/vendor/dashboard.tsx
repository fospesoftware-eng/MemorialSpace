/**
 * Vendor dashboard — KPI cards + recent requests + publish-status nudge.
 * Pulls from `GET /api/vendor/metrics` (single round trip).
 */
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox, CheckCircle2, XCircle, Clock, Wrench, ArrowRight, AlertTriangle, Sparkles } from "lucide-react";
import { useVendorMe, useVendorMetrics, type VendorRequestRow } from "./api";

const statusBadge: Record<VendorRequestRow["status"], { label: string; cls: string }> = {
  pending:   { label: "Pending",   cls: "border-amber-400/40 text-amber-300 bg-amber-400/5" },
  accepted:  { label: "Accepted",  cls: "border-sky-400/40 text-sky-300 bg-sky-400/5" },
  declined:  { label: "Declined",  cls: "border-rose-400/40 text-rose-300 bg-rose-400/5" },
  completed: { label: "Completed", cls: "border-emerald-400/40 text-emerald-300 bg-emerald-400/5" },
  cancelled: { label: "Cancelled", cls: "border-muted-foreground/30 text-muted-foreground bg-muted/30" },
};

export default function VendorDashboard() {
  const { data: me } = useVendorMe();
  const { data, isLoading } = useVendorMetrics();
  const vendor = me?.vendor;
  const metrics = data;
  const c = metrics?.requestCounts;

  const stats = [
    { label: "Pending",    value: c?.pending ?? 0,    icon: Clock,         hue: "text-amber-400 bg-amber-500/10" },
    { label: "Accepted",   value: c?.accepted ?? 0,   icon: CheckCircle2,  hue: "text-sky-400 bg-sky-500/10" },
    { label: "Completed",  value: c?.completed ?? 0,  icon: Sparkles,      hue: "text-emerald-400 bg-emerald-500/10" },
    { label: "Services",   value: metrics?.servicesCount ?? 0, icon: Wrench, hue: "text-primary bg-primary/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="dashboard-title">
            Welcome back{vendor ? `, ${vendor.businessName}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            Your request inbox at a glance. Stay close to the families who need you.
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90" data-testid="button-view-requests">
          <Link href="/requests"><Inbox className="h-4 w-4 mr-2" />Open inbox</Link>
        </Button>
      </div>

      {vendor && !vendor.isPublished ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-4 flex items-start gap-3" data-testid="unpublished-banner">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-200">Your profile is hidden from families.</p>
            <p className="text-sm text-amber-200/80 mt-0.5">
              Finish your profile, add at least one service, and toggle "Publish" to start receiving requests.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
            <Link href="/profile">Finish profile<ArrowRight className="h-3 w-3 ml-1" /></Link>
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60 bg-card hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className={`h-10 w-10 rounded-lg ${s.hue} flex items-center justify-center mb-3`}>
                <s.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-bold" data-testid={`stat-${s.label.toLowerCase()}`}>{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5 text-primary" />Recent requests</CardTitle>
          <Button variant="ghost" size="sm" asChild><Link href="/requests">View all<ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !metrics?.recentRequests?.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground" data-testid="empty-recent">
              <Inbox className="h-8 w-8 mx-auto mb-3 opacity-40" />
              No requests yet. Once a family submits one, it'll show up here.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {metrics.recentRequests.map((r) => {
                const sb = statusBadge[r.status];
                return (
                  <div key={r.id} className="py-3 flex items-start gap-4" data-testid={`recent-request-${r.id}`}>
                    <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold">
                      {r.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{r.customerName}</p>
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${sb.cls}`}>{sb.label}</Badge>
                        {r.deceasedName ? (
                          <span className="text-xs text-muted-foreground truncate">for {r.deceasedName}</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{r.message}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                    <Button asChild size="sm" variant="ghost"><Link href={`/requests?focus=${r.id}`}>Open</Link></Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {vendor && c?.pending === 0 && metrics?.servicesCount === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-8 text-center">
            <Wrench className="h-10 w-10 mx-auto text-primary/60 mb-3" />
            <h3 className="text-lg font-semibold">Add your first service</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Services are what families browse and request. Add at least one before publishing your profile.
            </p>
            <Button asChild className="mt-4">
              <Link href="/services">Add a service<ArrowRight className="h-3 w-3 ml-2" /></Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
