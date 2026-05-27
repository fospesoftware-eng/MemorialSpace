import { Link } from "wouter";
import { useListMemorials } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageSquare, ShoppingBag, Calendar, ArrowRight, Sparkles, Bell, MapPin, Loader2 } from "lucide-react";

const upcoming = [
  { date: "May 12", title: "White lilies delivery", subtitle: "To Eleanor's gravesite — weekly subscription", type: "delivery" },
  { date: "May 18", title: "Memorial visit reminder", subtitle: "Eleanor Rose Thompson — 2nd anniversary", type: "remind" },
  { date: "Jun 02", title: "Annual care plan renews", subtitle: "Plot A-003 cleaning & upkeep", type: "billing" },
];

const recent = [
  { who: "James M.", what: "left a tribute on Eleanor Rose Thompson", when: "2 hours ago" },
  { who: "Patricia K.", what: "shared photos to George William Mitchell", when: "Yesterday" },
  { who: "You", what: "ordered a Red Rose Wreath", when: "3 days ago" },
];

export default function CustomerDashboard() {
  const { data: memorials, isLoading } = useListMemorials();
  const myMemorials = memorials?.slice(0, 2) ?? [];

  const stats = [
    { label: "Memorial Pages", value: memorials?.length ?? 0, icon: Heart, hue: "text-rose-400 bg-rose-500/10" },
    { label: "Tributes Left", value: 14, icon: MessageSquare, hue: "text-sky-400 bg-sky-500/10" },
    { label: "Saved Records", value: 5, icon: MapPin, hue: "text-amber-400 bg-amber-500/10" },
    { label: "Active Orders", value: 3, icon: ShoppingBag, hue: "text-emerald-400 bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, Sarah</h1>
          <p className="text-muted-foreground mt-1">Stay connected to those you love. Here's what's happening.</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90" data-testid="button-find-grave">
          <Link href="~/find"><Sparkles className="h-4 w-4 mr-2" />Find a Loved One</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60 bg-card hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className={`h-10 w-10 rounded-lg ${s.hue} flex items-center justify-center mb-3`}>
                <s.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Upcoming</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/orders">View all<ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((u, i) => (
              <div key={i} className="flex items-start gap-4 p-3 rounded-lg border border-border/40 hover:border-border transition-colors">
                <div className="text-center min-w-[56px]">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{u.date.split(" ")[0]}</p>
                  <p className="text-2xl font-bold text-primary">{u.date.split(" ")[1]}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{u.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{u.subtitle}</p>
                </div>
                <Badge variant="outline" className="capitalize">{u.type}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recent.map((r, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                <div>
                  <p className="text-sm"><span className="font-medium">{r.who}</span> {r.what}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.when}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Memorials I manage */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-rose-400" />Memorials I Manage</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Pages where you can post updates, photos, and respond to tributes.</p>
          </div>
          <Button asChild variant="outline"><Link href="/memorials">Manage all</Link></Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : myMemorials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Heart className="h-8 w-8 mx-auto opacity-40 mb-2" />
              <p className="font-medium">No memorial pages yet.</p>
              <p className="text-sm mt-1">Create your first memorial to honor someone you love.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myMemorials.map((m) => {
                const photos = Array.isArray(m.photos) ? (m.photos as string[]) : [];
                return (
                  <Link key={m.id} href={m.qrCode && m.orgSlug && m.isPublic !== false ? `/c/${m.orgSlug}/memorial/${m.qrCode}` : `/account/memorial/${m.id}`}>
                    <div className="flex items-center gap-4 p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors cursor-pointer">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-rose-500/20 flex items-center justify-center text-primary font-semibold border border-border/40 overflow-hidden shrink-0">
                        {photos[0] ? (
                          <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (m.title || "").split(" ").map(n => n[0]).slice(0, 2).join("")
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{m.title || "Untitled Memorial"}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{m.biography || "No biography yet."}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{m.viewCount ?? 0} views</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
