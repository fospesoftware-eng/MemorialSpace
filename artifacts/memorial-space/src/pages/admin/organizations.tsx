import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MoreHorizontal, Building2 } from "lucide-react";
import { useListOrganizations } from "@workspace/api-client-react";
import { format } from "date-fns";

const planFor = (i: number) => ["Starter", "Professional", "Enterprise"][i % 3];
const planColor: Record<string, string> = {
  Starter: "border-sky-500/40 text-sky-400",
  Professional: "border-primary/40 text-primary",
  Enterprise: "border-[#d4a843]/40 text-[#d4a843]",
};

export default function AdminOrganizations() {
  const { data: orgs, isLoading } = useListOrganizations();
  const [q, setQ] = useState("");

  const fakes = [
    { id: 1001, name: "Riverside Memorial Gardens", slug: "riverside", city: "Portland", country: "Oregon, US", totalPlots: 1240, createdAt: new Date(2026, 4, 1).toISOString() },
    { id: 1002, name: "St. Mary's Catholic Cemetery", slug: "stmarys", city: "Toronto", country: "Ontario, CA", totalPlots: 580, createdAt: new Date(2026, 3, 29).toISOString() },
    { id: 1003, name: "Mountainview Funeral Group", slug: "mountainview", city: "Denver", country: "Colorado, US", totalPlots: 4820, createdAt: new Date(2026, 3, 27).toISOString() },
    { id: 1004, name: "Hillside Eternal Rest", slug: "hillside", city: "Austin", country: "Texas, US", totalPlots: 920, createdAt: new Date(2026, 3, 25).toISOString() },
    { id: 1005, name: "Pine Hill Cemetery", slug: "pinehill", city: "Burlington", country: "Vermont, US", totalPlots: 320, createdAt: new Date(2026, 2, 12).toISOString() },
  ];
  const all: { id: number; name: string; slug: string; city?: string; country?: string; totalPlots?: number; createdAt: string }[] = [...(orgs ?? []), ...fakes];
  const filtered = all.filter(o => o.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground mt-1">All cemeteries currently active on the platform.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">+ Onboard cemetery</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p><p className="text-2xl font-bold mt-1">{all.length}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Enterprise</p><p className="text-2xl font-bold mt-1 text-[#d4a843]">{all.filter((_, i) => i % 3 === 2).length}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Pro</p><p className="text-2xl font-bold mt-1 text-primary">{all.filter((_, i) => i % 3 === 1).length}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Starter</p><p className="text-2xl font-bold mt-1 text-sky-400">{all.filter((_, i) => i % 3 === 0).length}</p></CardContent></Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/40 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border-0 bg-transparent focus-visible:ring-0"
              data-testid="search-orgs"
            />
          </div>
          <div className="divide-y divide-border/40">
            {isLoading && <div className="p-8 text-center text-muted-foreground">Loading…</div>}
            {filtered.map((o, i) => {
              const plan = planFor(i);
              return (
                <div key={o.id} className="flex items-center gap-4 p-4 hover:bg-card/50 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.city || o.country ? `${o.city ?? ""}${o.city && o.country ? ", " : ""}${o.country ?? ""}` : o.slug}
                      {o.totalPlots ? ` · ${o.totalPlots.toLocaleString()} plots` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={planColor[plan]}>{plan}</Badge>
                  <span className="text-xs text-muted-foreground hidden md:inline w-24 text-right">
                    {format(new Date(o.createdAt), "MMM d, yyyy")}
                  </span>
                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
