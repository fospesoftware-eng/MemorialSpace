import { Link } from "wouter";
import { useListMemorials } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Eye, Image as ImageIcon, Settings, Plus, Globe, Lock, Loader2 } from "lucide-react";

export default function CustomerMemorials() {
  const { data: memorials, isLoading } = useListMemorials();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Memorial Pages</h1>
            <p className="text-muted-foreground mt-1">Honor and preserve the stories of those you love.</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" />New Memorial</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <Card key={i} className="h-64 animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const list = memorials ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Memorial Pages</h1>
          <p className="text-muted-foreground mt-1">Honor and preserve the stories of those you love.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" />New Memorial</Button>
      </div>

      {list.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto opacity-40 mb-3" />
            <p className="font-medium">No memorial pages yet.</p>
            <p className="text-sm mt-1">Create your first memorial to honor someone you love.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {list.map((m) => {
            const photos = Array.isArray(m.photos) ? (m.photos as string[]) : [];
            const isPublic = m.isPublic ?? true;
            return (
              <Card key={m.id} className="border-border/60 bg-card hover:border-primary/30 transition-all group overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-primary/20 via-card to-rose-500/10 relative">
                  {photos[0] ? (
                    <img src={photos[0]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <div className="absolute top-3 right-3 flex gap-2">
                    {isPublic ? (
                      <Badge variant="secondary" className="bg-primary/20 text-primary border border-primary/30 backdrop-blur"><Globe className="h-3 w-3 mr-1" />Public</Badge>
                    ) : (
                      <Badge variant="outline" className="backdrop-blur"><Lock className="h-3 w-3 mr-1" />Private</Badge>
                    )}
                  </div>
                  <div className="absolute -bottom-8 left-5 h-16 w-16 rounded-full bg-card border-2 border-primary/30 flex items-center justify-center text-primary text-lg font-bold shadow-lg overflow-hidden">
                    {photos[0] ? (
                      <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      m.title?.split(" ").map(n => n[0]).slice(0, 2).join("")
                    )}
                  </div>
                </div>
                <CardContent className="pt-12 pb-6 px-5">
                  <h3 className="text-lg font-bold line-clamp-1">{m.title || "Untitled Memorial"}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{m.biography || "No biography yet."}</p>
                  <div className="grid grid-cols-3 gap-2 mt-5 mb-5">
                    <Stat icon={Eye} value={m.viewCount ?? 0} label="Views" />
                    <Stat icon={Heart} value={0} label="Tributes" />
                    <Stat icon={ImageIcon} value={photos.length} label="Photos" />
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={m.qrCode ? `/memorial/${m.qrCode}` : `/account/memorial/${m.id}`}>View page</Link>
                    </Button>
                    <Button variant="ghost" size="sm"><Settings className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
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
