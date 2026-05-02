import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Eye, Image as ImageIcon, Settings, Plus, Globe, Lock } from "lucide-react";

const memorials = [
  { id: 1, name: "Eleanor Rose Thompson", years: "1934 — 2021", role: "Owner", views: 147, tributes: 12, photos: 8, isPublic: true },
  { id: 2, name: "George William Mitchell", years: "1941 — 2022", role: "Owner", views: 89, tributes: 8, photos: 5, isPublic: true },
  { id: 3, name: "Robert James Anderson", years: "1928 — 2024", role: "Contributor", views: 212, tributes: 24, photos: 14, isPublic: true },
];

export default function CustomerMemorials() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Memorial Pages</h1>
          <p className="text-muted-foreground mt-1">Honor and preserve the stories of those you love.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" />New Memorial</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {memorials.map((m) => (
          <Card key={m.id} className="border-border/60 bg-card hover:border-primary/30 transition-all group overflow-hidden">
            <div className="h-32 bg-gradient-to-br from-primary/20 via-card to-rose-500/10 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <div className="absolute top-3 right-3 flex gap-2">
                {m.isPublic ? (
                  <Badge variant="secondary" className="bg-primary/20 text-primary border border-primary/30 backdrop-blur"><Globe className="h-3 w-3 mr-1" />Public</Badge>
                ) : (
                  <Badge variant="outline" className="backdrop-blur"><Lock className="h-3 w-3 mr-1" />Private</Badge>
                )}
                <Badge variant="outline" className="backdrop-blur">{m.role}</Badge>
              </div>
              <div className="absolute -bottom-8 left-5 h-16 w-16 rounded-full bg-card border-2 border-primary/30 flex items-center justify-center text-primary text-lg font-bold shadow-lg">
                {m.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </div>
            </div>
            <CardContent className="pt-12 pb-6 px-5">
              <h3 className="text-lg font-bold">{m.name}</h3>
              <p className="text-sm text-muted-foreground">{m.years}</p>
              <div className="grid grid-cols-3 gap-2 mt-5 mb-5">
                <Stat icon={Eye} value={m.views} label="Views" />
                <Stat icon={Heart} value={m.tributes} label="Tributes" />
                <Stat icon={ImageIcon} value={m.photos} label="Photos" />
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1"><Link href={`~/find/memorial/${m.id}`}>View page</Link></Button>
                {m.role === "Owner" && (
                  <Button variant="ghost" size="sm"><Settings className="h-4 w-4" /></Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return (
    <div className="text-center p-2 rounded-md bg-card/50 border border-border/40">
      <Icon className="h-3 w-3 text-muted-foreground mx-auto mb-1" />
      <p className="text-base font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

