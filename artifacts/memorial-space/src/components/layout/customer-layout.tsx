import { Link, useLocation } from "wouter";
import { LayoutDashboard, Heart, ShoppingBag, MessageSquare, Bookmark, Settings, Menu, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const nav = [
  { name: "Overview", href: "/", icon: LayoutDashboard, key: "overview" },
  { name: "My Memorials", href: "/memorials", icon: Heart, key: "memorials" },
  { name: "Tributes Left", href: "/tributes", icon: MessageSquare, key: "tributes" },
  { name: "Saved Records", href: "/saved", icon: Bookmark, key: "saved" },
  { name: "Orders", href: "/orders", icon: ShoppingBag, key: "orders" },
  { name: "Settings", href: "/settings", icon: Settings, key: "settings" },
];

function SidebarContent() {
  const [location] = useLocation();
  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center px-6 bg-sidebar-accent/50 border-b border-sidebar-border">
        <a href="/" className="flex items-center">
          <Logo height={36} />
        </a>
      </div>

      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-primary/30">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">SC</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">Sarah Chen</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">sarah.chen@email.com</p>
          </div>
        </div>
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
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon
              className={cn(
                "h-5 w-5 shrink-0",
                isActive(item.href) ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
              )}
            />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center justify-between px-3">
          <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">Appearance</span>
          <ThemeToggle variant="sidebar" />
        </div>
        <a
          href="/sign-in/family"
          data-testid="customer-sign-out"
          className="flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </a>
      </div>
    </div>
  );
}

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="fixed top-4 left-4 z-40 lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-r-sidebar-border">
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
