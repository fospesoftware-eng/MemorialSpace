import { Link, useLocation } from "wouter";
import { LayoutDashboard, Map, MapPin, Users, Calendar, Award, Wrench, QrCode, FileText, ShoppingBag, Settings, Building, Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    name: "Cemetery Operations",
    items: [
      { name: "Map View", href: "/map", icon: Map },
      { name: "Plots", href: "/plots", icon: MapPin },
      { name: "Burials", href: "/burials", icon: Users },
      { name: "Bookings", href: "/bookings", icon: Calendar },
      { name: "Work Orders", href: "/work-orders", icon: Wrench },
    ],
  },
  {
    name: "Memorial Services",
    items: [
      { name: "Memorial Pages", href: "/memorials", icon: Award },
      { name: "Obituaries", href: "/obituaries", icon: FileText },
      { name: "QR Codes", href: "/qr-codes", icon: QrCode },
    ],
  },
  {
    name: "Marketplace",
    items: [
      { name: "Catalog & Orders", href: "/marketplace", icon: ShoppingBag },
    ],
  },
  {
    name: "Settings",
    items: [
      { name: "Organizations", href: "/organizations", icon: Building },
      { name: "Users", href: "/users", icon: Users },
      { name: "General Settings", href: "/settings", icon: Settings },
    ],
  },
];

function SidebarContent() {
  const [location] = useLocation();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center px-6 bg-sidebar-accent/50 border-b border-sidebar-border">
        <a href="/" className="flex items-center gap-2 text-primary">
          <Award className="h-6 w-6" />
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">MemorialSpace</span>
        </a>
      </div>

      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-primary/30">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">RM</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">Riverside Memorial</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">ops@riversidememorial.com</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto py-4">
        <nav className="flex-1 space-y-6 px-4">
          <div>
            <Link
              href="/dashboard"
              className={cn(
                "group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium",
                location === "/dashboard"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
              Dashboard
            </Link>
          </div>

          {navigation.filter(item => item.items).map((section) => (
            <div key={section.name}>
              <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 mb-2 px-3">
                {section.name}
              </div>
              <ul role="list" className="space-y-1">
                {section.items?.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium",
                        location.startsWith(item.href)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          location.startsWith(item.href) ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center justify-between px-3">
          <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">Appearance</span>
          <ThemeToggle variant="sidebar" />
        </div>
        <a
          href="/sign-in/cemetery"
          data-testid="b2b-sign-out"
          className="flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </a>
      </div>
    </div>
  );
}

export function B2BLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="fixed top-4 left-4 z-40 lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-r-sidebar-border">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col border-r border-sidebar-border">
        <SidebarContent />
      </div>

      <main className="flex-1 lg:pl-72 w-full">
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}