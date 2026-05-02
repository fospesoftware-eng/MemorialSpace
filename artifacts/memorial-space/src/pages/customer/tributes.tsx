import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Heart } from "lucide-react";
import { format } from "date-fns";

const tributes = [
  { id: 1, memorial: "Eleanor Rose Thompson", message: "Aunt Eleanor, you were the heart of every family gathering. Your laugh still echoes in our kitchen.", date: new Date(2026, 3, 22), reactions: 14 },
  { id: 2, memorial: "George William Mitchell", message: "Thank you for your service, George. The whole community feels your absence.", date: new Date(2026, 3, 15), reactions: 9 },
  { id: 3, memorial: "Patricia Mae Ng", message: "Patricia's painting class changed how I see the world. Her colors live in every sunset.", date: new Date(2026, 2, 28), reactions: 21 },
  { id: 4, memorial: "Eleanor Rose Thompson", message: "Lit a candle today on what would have been your 92nd birthday. We miss you terribly.", date: new Date(2026, 2, 12), reactions: 18 },
];

export default function CustomerTributes() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tributes I've Left</h1>
        <p className="text-muted-foreground mt-1">A record of the words you've shared in remembrance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/60"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Total tributes</p>
          <p className="text-3xl font-bold mt-2">{tributes.length}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">People honored</p>
          <p className="text-3xl font-bold mt-2">{new Set(tributes.map(t => t.memorial)).size}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Hearts received</p>
          <p className="text-3xl font-bold mt-2">{tributes.reduce((s, t) => s + t.reactions, 0)}</p>
        </CardContent></Card>
      </div>

      <div className="space-y-4">
        {tributes.map((t) => (
          <Card key={t.id} className="border-border/60 hover:border-primary/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">For</p>
                  <Badge variant="outline">{t.memorial}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{format(t.date, "MMM d, yyyy")}</span>
              </div>
              <p className="text-foreground leading-relaxed italic">"{t.message}"</p>
              <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm text-rose-400">
                  <Heart className="h-4 w-4 fill-current" />
                  <span>{t.reactions} hearts</span>
                </div>
                <button className="text-xs text-muted-foreground hover:text-foreground">Edit · Delete</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
