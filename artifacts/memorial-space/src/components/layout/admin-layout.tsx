import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, Users, CreditCard, BarChart3, LifeBuoy, Shield, Menu, LogOut, Banknote } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const nav = [
  { name: "Platform Overview", href: "/", key: "overview", icon: LayoutDashboard },
  { name: "Organizations", href: "/organizations", key: "organizations", icon: Building2 },
  { name: "Users", href: "/users", key: "users", icon: Users },
  { name: "Billing & MRR", href: "/billing", key: "billing", icon: CreditCard },
  { name: "Payment Gateway", href: "/payment-gateway", key: "payment-gateway", icon: Banknote },
  { name: "Analytics", href: "/analytics", key: "analytics", icon: BarChart3 },
  { name: "Support Tickets", href: "/support", key: "support", icon: LifeBuoy },
];

function SidebarContent() {
  const [location] = useLocation();
  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center px-6 bg-sidebar-accent/50 border-b border-sidebar-border">
        <a href="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#d4a843]" />
          <div>
            <div className="text-sm font-bold leading-tight text-sidebar-foreground">MemorialSpace</div>
            <div className="text-[10px] uppercase tracking-widest text-[#d4a843]">Super Admin</div>
          </div>
        </a>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {nav.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            data-testid={`nav-admin-${item.key}`}
            className={cn(
              "group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon
              className={cn(
                "h-5 w-5 shrink-0",
                isActive(item.href) ? "text-[#d4a843]" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
              )}
            />
            <span className="flex-1">{item.name}</span>
            {item.name === "Support Tickets" && (
              <Badge variant="secondary" className="bg-[#ef4444]/20 text-[#fca5a5] border border-[#ef4444]/40 text-[10px]">3</Badge>
            )}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
        <div className="rounded-lg border border-[#d4a843]/30 bg-[#d4a843]/5 p-3">
          <p className="text-xs text-[#d4a843] font-semibold uppercase tracking-wider">Production</p>
          <p className="text-xs text-sidebar-foreground/70 mt-1">Operating since 2021</p>
        </div>
        <div className="flex items-center justify-between px-3">
          <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">Appearance</span>
          <ThemeToggle variant="sidebar" />
        </div>
        <a
          href="/sign-in/admin"
          data-testid="admin-sign-out"
          className="flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </a>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="fixed top-4 left-4 z-40 lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col border-r border-sidebar-border">
        <SidebarContent />
      </div>

      <main className="flex-1 lg:pl-72 w-full">
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
