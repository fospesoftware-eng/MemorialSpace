/**
 * Sidebar layout for the marketplace-vendor dashboard. Pattern matches the
 * existing customer/admin/B2B layouts so the look is consistent across
 * tiers — only the nav items and badge color differ.
 */
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Inbox, Wrench, Building2, LogOut, Store, Sparkles, Globe2, EyeOff, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useVendorMe } from "@/pages/vendor/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const nav = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, key: "dashboard" },
  { name: "Requests", href: "/requests", icon: Inbox, key: "requests" },
  { name: "Orders", href: "/orders", icon: Receipt, key: "orders" },
  { name: "Customers", href: "/customers", icon: Users, key: "customers" },
  { name: "Services", href: "/services", icon: Wrench, key: "services" },
  { name: "Business profile", href: "/profile", icon: Building2, key: "profile" },
];

export function VendorLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const { data } = useVendorMe();
  const vendor = data?.vendor;
  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  // Two-letter avatar fallback derived from the business name.
  const initials = (user?.name || "V")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen w-full bg-background flex">
      <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="flex h-16 shrink-0 items-center px-6 bg-sidebar-accent/50 border-b border-sidebar-border">
          <a href="/" className="flex items-center gap-2 text-primary">
            <Store className="h-6 w-6" />
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">Vendor portal</span>
          </a>
        </div>

        <div className="px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-primary/30">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold" data-testid="vendor-avatar">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate" data-testid="vendor-business-name">
                {user?.name ?? "Vendor"}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
            </div>
          </div>
          {vendor ? (
            <div className="mt-3 flex items-center gap-2">
              {vendor.isPublished ? (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-emerald-400/40 text-emerald-300 bg-emerald-400/5">
                  <Globe2 className="h-3 w-3 mr-1" /> Live
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-amber-400/40 text-amber-300 bg-amber-400/5">
                  <EyeOff className="h-3 w-3 mr-1" /> Hidden
                </Badge>
              )}
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 px-4 py-4">
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              data-testid={`nav-${item.key}`}
              className={cn(
                "group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive(item.href) ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                )}
              />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3 space-y-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">Appearance</span>
            <ThemeToggle variant="sidebar" />
          </div>
          {vendor ? (
            <a
              href={`~/vendors/${vendor.slug}`}
              className="flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 rounded-md"
              data-testid="link-public-page"
            >
              <Sparkles className="h-3.5 w-3.5" />
              View public page
            </a>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={async () => { await signOut(); window.location.href = "/sign-in/vendor"; }}
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4 mr-2" />Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="container mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
