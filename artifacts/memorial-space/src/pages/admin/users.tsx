import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search } from "lucide-react";
import { useState } from "react";

const users = [
  { name: "Margaret Holloway", email: "margaret@greenwood-memorial.com", role: "Cemetery Admin", org: "Greenwood Memorial Park", status: "active", lastSeen: "Just now" },
  { name: "James Okonkwo", email: "j.okonkwo@sunsetvalley.com", role: "Operations", org: "Sunset Valley", status: "active", lastSeen: "2 hours ago" },
  { name: "Elena Vasquez", email: "elena@pinehill.org", role: "Family Services", org: "Pine Hill Cemetery", status: "active", lastSeen: "Yesterday" },
  { name: "Robert Chen", email: "robert.c@mountainview.com", role: "Cemetery Admin", org: "Mountainview Funeral Group", status: "active", lastSeen: "3 days ago" },
  { name: "Sarah Chen", email: "sarah.chen@email.com", role: "Family Member", org: "—", status: "active", lastSeen: "Just now" },
  { name: "David Martinez", email: "d.martinez@hillside.us", role: "Cemetery Admin", org: "Hillside Eternal Rest", status: "pending", lastSeen: "—" },
  { name: "Aisha Patel", email: "aisha.p@email.com", role: "Family Member", org: "—", status: "active", lastSeen: "1 week ago" },
  { name: "Thomas Richardson", email: "thomas@stmarys.ca", role: "Cemetery Admin", org: "St. Mary's Cemetery", status: "suspended", lastSeen: "2 weeks ago" },
];

const statusColor: Record<string, string> = {
  active: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  pending: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  suspended: "border-rose-500/40 text-rose-400 bg-rose-500/10",
};

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const filtered = users.filter(u => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.includes(q.toLowerCase()) || u.org.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Users</h1>
        <p className="text-muted-foreground mt-1">Cemetery admins and family members across the platform.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Total Users</p><p className="text-2xl font-bold mt-1">148,420</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Cemetery Staff</p><p className="text-2xl font-bold mt-1">1,840</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Family Members</p><p className="text-2xl font-bold mt-1">146,580</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Pending Invites</p><p className="text-2xl font-bold mt-1 text-amber-400">42</p></CardContent></Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/40 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users by name, email, or org..." value={q} onChange={e => setQ(e.target.value)} className="border-0 bg-transparent focus-visible:ring-0" data-testid="search-users" />
          </div>
          <div className="divide-y divide-border/40">
            {filtered.map((u) => (
              <div key={u.email} className="flex items-center gap-4 p-4 hover:bg-card/50 transition-colors">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{u.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex">{u.role}</Badge>
                <span className="text-xs text-muted-foreground hidden md:inline truncate w-44">{u.org}</span>
                <Badge variant="outline" className={`capitalize ${statusColor[u.status]}`}>{u.status}</Badge>
                <span className="text-xs text-muted-foreground hidden lg:inline w-24 text-right">{u.lastSeen}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
