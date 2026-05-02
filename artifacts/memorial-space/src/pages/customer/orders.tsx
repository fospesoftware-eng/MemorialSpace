import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Truck, CheckCircle2, Clock, ShoppingBag } from "lucide-react";

const orders = [
  { id: "ORD-2026-0341", items: "White Lily Arrangement × 1", total: 65, status: "delivered", date: "Apr 28, 2026", dest: "Eleanor's gravesite", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10" },
  { id: "ORD-2026-0298", items: "Annual Plot Care — A-003", total: 240, status: "active", date: "Apr 02, 2026", dest: "Subscription · auto-renews Apr 2027", icon: Clock, color: "text-amber-400 bg-amber-500/10" },
  { id: "ORD-2026-0411", items: "Red Rose Wreath × 2", total: 178, status: "in-transit", date: "May 01, 2026", dest: "Out for delivery", icon: Truck, color: "text-sky-400 bg-sky-500/10" },
  { id: "ORD-2025-1102", items: "Memorial Bench engraving", total: 1450, status: "delivered", date: "Nov 10, 2025", dest: "Installed at A-003", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10" },
];

export default function CustomerOrders() {
  const total = orders.reduce((s, o) => s + o.total, 0);
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
        <p className="text-muted-foreground mt-1">Flowers, services, and care plans for your loved ones.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total spent</span><ShoppingBag className="h-4 w-4 text-muted-foreground" /></div>
          <p className="text-3xl font-bold mt-2">${total.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Active subscriptions</span><Clock className="h-4 w-4 text-muted-foreground" /></div>
          <p className="text-3xl font-bold mt-2">1</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-5">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">In transit</span><Truck className="h-4 w-4 text-muted-foreground" /></div>
          <p className="text-3xl font-bold mt-2">{orders.filter(o => o.status === "in-transit").length}</p>
        </CardContent></Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0 divide-y divide-border/40">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center gap-4 p-5 hover:bg-card/50 transition-colors" data-testid={`order-${o.id}`}>
              <div className={`h-12 w-12 rounded-lg ${o.color} flex items-center justify-center shrink-0`}>
                <o.icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{o.items}</p>
                  <Badge variant="outline" className="capitalize">{o.status.replace("-", " ")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{o.dest}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{o.id} · {o.date}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">${o.total.toLocaleString()}</p>
                <Button variant="ghost" size="sm" className="mt-1">View receipt</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
