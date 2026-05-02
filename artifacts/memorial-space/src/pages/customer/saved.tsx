import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, MapPin, ArrowRight, BellRing } from "lucide-react";

const saved = [
  { name: "Eleanor Rose Thompson", cemetery: "Greenwood Memorial Park", plot: "A-003", relationship: "Aunt", reminder: "Anniversary May 18" },
  { name: "George William Mitchell", cemetery: "Greenwood Memorial Park", plot: "A-007", relationship: "Family friend", reminder: "Veterans Day Nov 11" },
  { name: "Patricia Mae Ng", cemetery: "Sunset Valley Cemetery", plot: "B-014", relationship: "Mentor", reminder: null },
  { name: "Robert James Anderson", cemetery: "Sunset Valley Cemetery", plot: "C-021", relationship: "Grandfather", reminder: "Birthday Aug 04" },
  { name: "Margaret Chen", cemetery: "Greenwood Memorial Park", plot: "D-009", relationship: "Grandmother", reminder: null },
];

export default function CustomerSaved() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saved Records</h1>
        <p className="text-muted-foreground mt-1">Quick access to the gravesites and memorials that matter to you.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {saved.map((s) => (
          <Card key={s.name} className="border-border/60 hover:border-primary/30 transition-colors group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Bookmark className="h-5 w-5 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.relationship}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{s.plot}</Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                <MapPin className="h-3.5 w-3.5" />
                <span>{s.cemetery}</span>
              </div>
              {s.reminder && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-md px-2 py-1.5 mb-3">
                  <BellRing className="h-3 w-3" />
                  <span>Reminder: {s.reminder}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="~/find">View memorial<ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
