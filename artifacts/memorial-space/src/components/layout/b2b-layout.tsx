import { useMemo, useState, type KeyboardEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  Award,
  Banknote,
  BarChart3,
  Bell,
  Box,
  Boxes,
  Building,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Globe,
  Layers,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  Menu,
  Percent,
  QrCode,
  Receipt,
  ScanText,
  Search,
  Shield,
  ShoppingBag,
  Sliders,
  Sparkles,
  Upload,
  UserSquare2,
  Users,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
};

type NavigationSection = {
  name: string;
  items: NavigationItem[];
};

const dashboardItem: NavigationItem = {
  name: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboard,
  description: "Daily operations overview",
};

const navigation: NavigationSection[] = [
  {
    name: "Cemetery Operations",
    items: [
      {
        name: "Create Cemetery",
        href: "/organizations",
        icon: Building,
        description: "Add a cemetery profile",
      },
      {
        name: "Cemetery Details",
        href: "/settings",
        icon: MapPin,
        description: "Location, contacts, coordinates",
      },
      {
        name: "Map Maker",
        href: "/map-maker",
        icon: Layers,
        description: "Draw a map manually",
      },
      {
        name: "AI Map Maker",
        href: "/ai-map-maker",
        icon: Wand2,
        description: "Generate a map from uploads",
        badge: "AI",
      },
      {
        name: "Map View",
        href: "/map",
        icon: Map,
        description: "View the active cemetery map",
      },
      {
        name: "Burial Spots",
        href: "/burial-spots",
        icon: MapPin,
        description: "Manage plot and spot records",
      },
      {
        name: "Columbarium",
        href: "/columbarium",
        icon: Box,
        description: "Niche inventory",
      },
      {
        name: "Mausoleum",
        href: "/mausoleum",
        icon: Building2,
        description: "Crypt inventory",
      },
      {
        name: "Bookings",
        href: "/bookings",
        icon: Calendar,
        description: "Family appointments",
      },
      {
        name: "Work Orders",
        href: "/work-orders",
        icon: Wrench,
        description: "Grounds tasks",
        badge: "Open",
      },
    ],
  },
  {
    name: "Import Data",
    items: [
      {
        name: "Import Center",
        href: "/import-data",
        icon: Upload,
        description: "Batch cemetery records",
      },
      {
        name: "Headstone AI Import",
        href: "/import-data/headstones",
        icon: ScanText,
        description: "Scan images with AI",
        badge: "AI",
      },
    ],
  },
  {
    name: "Operations & Finance",
    items: [
      {
        name: "Assets",
        href: "/assets",
        icon: Boxes,
        description: "Equipment and vehicles",
      },
      {
        name: "Maintenance",
        href: "/maintenance",
        icon: CalendarClock,
        description: "Preventive schedule",
      },
      {
        name: "Expenses",
        href: "/expenses",
        icon: Banknote,
        description: "Operational spending",
      },
    ],
  },
  {
    name: "Memorial Services",
    items: [
      {
        name: "Memorial Pages",
        href: "/memorials",
        icon: Award,
        description: "Family-facing tributes",
      },
      {
        name: "Obituaries",
        href: "/obituaries",
        icon: FileText,
        description: "Published notices",
      },
      {
        name: "QR Codes",
        href: "/qr-codes",
        icon: QrCode,
        description: "Physical memorial links",
      },
    ],
  },
  {
    name: "Public Website",
    items: [
      {
        name: "Website Builder",
        href: "/site-builder",
        icon: Globe,
        description: "Manage public site",
      },
    ],
  },
  {
    name: "Marketplace",
    items: [
      {
        name: "Catalog & Orders",
        href: "/marketplace",
        icon: ShoppingBag,
        description: "Shop products and orders",
      },
    ],
  },
  {
    name: "Accounting",
    items: [
      {
        name: "Overview",
        href: "/accounting",
        icon: BarChart3,
        description: "Revenue and balances",
      },
      {
        name: "Invoices",
        href: "/accounting/invoices",
        icon: Receipt,
        description: "Bills and payments",
      },
      {
        name: "Customers",
        href: "/accounting/customers",
        icon: UserSquare2,
        description: "Family accounts",
      },
      {
        name: "Tax Rates",
        href: "/accounting/tax-rates",
        icon: Percent,
        description: "Regional tax rules",
      },
    ],
  },
  {
    name: "Team & Access",
    items: [
      {
        name: "Members",
        href: "/team",
        icon: Users,
        description: "Staff directory",
      },
      {
        name: "Roles & Permissions",
        href: "/team/roles",
        icon: Shield,
        description: "Access controls",
      },
    ],
  },
  {
    name: "Settings",
    items: [
      {
        name: "Cemetery Setup",
        href: "/cemetery-setup",
        icon: Sliders,
        description: "Site configuration",
      },
      {
        name: "Payment Gateway",
        href: "/settings/payment-gateway",
        icon: CreditCard,
        description: "Payment setup",
      },
    ],
  },
];

const searchableRoutes = [
  { ...dashboardItem, section: "Overview" },
  ...navigation.flatMap((section) =>
    section.items.map((item) => ({ ...item, section: section.name })),
  ),
];

function findRoute(location: string) {
  return [...searchableRoutes]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) => location === item.href || location.startsWith(`${item.href}/`),
    );
}

function SidebarContent() {
  const [location] = useLocation();
  const isActive = (href: string) =>
    location === href || location.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="relative flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border bg-sidebar-accent/55">
        <a href="/" className="flex items-center">
          <Logo height={36} forDarkBg />
        </a>
        <span className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      </div>

      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/35 p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-primary/40 shadow-sm">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                RM
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">
                Riverside Memorial
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                ops@riversidememorial.com
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Live", "Status"],
              ["AI", "Import"],
              ["Map", "Synced"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-md bg-sidebar/55 px-2 py-1.5">
                <p className="text-sm font-semibold text-sidebar-foreground">
                  {value}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto py-4">
        <nav className="flex-1 space-y-5 px-4">
          <Link
            href={dashboardItem.href}
            className={cn(
              "group relative flex items-center gap-x-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location === dashboardItem.href
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/72 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground hover:translate-x-0.5",
            )}
          >
            {location === dashboardItem.href && (
              <span className="absolute left-0 h-6 w-1 rounded-r bg-primary" />
            )}
            <LayoutDashboard
              className={cn(
                "h-5 w-5 shrink-0 transition-colors",
                location === dashboardItem.href
                  ? "text-primary"
                  : "text-sidebar-foreground/50 group-hover:text-primary",
              )}
              aria-hidden="true"
            />
            Dashboard
          </Link>

          {navigation.map((section) => (
            <div key={section.name}>
              <div className="mb-2 flex items-center justify-between px-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/48">
                  {section.name}
                </span>
                <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/55">
                  {section.items.length}
                </span>
              </div>
              <ul role="list" className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-x-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                            : "text-sidebar-foreground/72 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground hover:translate-x-0.5",
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 h-6 w-1 rounded-r bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-colors",
                            active
                              ? "text-primary"
                              : "text-sidebar-foreground/50 group-hover:text-primary",
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center justify-between rounded-md bg-sidebar-accent/35 px-3 py-2">
          <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/55 font-semibold">
            Appearance
          </span>
          <ThemeToggle variant="sidebar" />
        </div>
        <a
          href="/sign-in/cemetery"
          data-testid="b2b-sign-out"
          className="flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-0.5"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </a>
      </div>
    </div>
  );
}

function CommandSearch({ compact = false }: { compact?: boolean }) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchableRoutes.slice(0, 6);
    return searchableRoutes
      .filter((item) =>
        [item.name, item.section, item.description]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized)),
      )
      .slice(0, 8);
  }, [query]);

  const goToFirstResult = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || results.length === 0) return;
    event.preventDefault();
    navigate(results[0].href);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={cn("relative", compact ? "w-full" : "w-full max-w-md")}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={goToFirstResult}
        placeholder="Search cemetery tools..."
        className="h-10 rounded-md border-border/70 bg-background/75 pl-9 pr-3 shadow-sm backdrop-blur"
        data-testid="b2b-command-search"
      />
      {open && (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-md border border-border/80 bg-popover/98 shadow-xl backdrop-blur animate-in fade-in zoom-in-95 duration-150">
          <div className="border-b border-border/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Jump to workspace
          </div>
          <div className="max-h-80 overflow-auto p-1">
            {results.length > 0 ? (
              results.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/70"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.section}{" "}
                      {item.description ? `- ${item.description}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching cemetery tools
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OperatorHeader({ mobileMenu }: { mobileMenu: React.ReactNode }) {
  const [location] = useLocation();
  const route = findRoute(location) ?? {
    ...dashboardItem,
    section: "Overview",
  };
  const section = route.section;
  const siblingRoutes = searchableRoutes
    .filter((item) => item.section === section && item.href !== route.href)
    .slice(0, 3);

  return (
    <header className="sticky top-0 z-30 border-b border-border/65 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">{mobileMenu}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Cemetery operator</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-primary">{section}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {route.name}
              </h1>
              {route.badge && (
                <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                  {route.badge}
                </Badge>
              )}
            </div>
            {route.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {route.description}
              </p>
            )}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <CommandSearch />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative h-10 w-10"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" />
                  <span className="sr-only">Open notifications</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Operations pulse</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">
                      Map sync healthy
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Grounds data is ready for staff
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className="items-start gap-3">
                  <Wrench className="mt-0.5 h-4 w-4 text-amber-600" />
                  <span>
                    <span className="block text-sm font-medium">
                      Work order queue
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Review assignments before closing
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild className="gap-2">
              <Link href="/import-data">
                <Upload className="h-4 w-4" />
                Import
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:hidden">
          <CommandSearch compact />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-primary/25 bg-primary/5 px-3 py-1 text-primary"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Operational
          </Badge>
          <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            AI import ready
          </Badge>
          {siblingRoutes.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3"
            >
              <Link href={item.href}>
                <item.icon className="h-3.5 w-3.5" />
                {item.name}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </header>
  );
}

export function B2BLayout({ children }: { children: React.ReactNode }) {
  const mobileMenu = (
    <SheetTrigger asChild>
      <Button variant="outline" size="icon" className="h-10 w-10">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open sidebar</span>
      </Button>
    </SheetTrigger>
  );

  return (
    <Sheet>
      <div className="b2b-workspace flex min-h-screen w-full bg-background">
        <SheetContent
          side="left"
          className="w-72 p-0 bg-sidebar border-r-sidebar-border"
        >
          <SidebarContent />
        </SheetContent>

        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col border-r border-sidebar-border shadow-2xl shadow-black/10">
          <SidebarContent />
        </div>

        <main className="relative flex min-w-0 flex-1 flex-col lg:pl-72">
          <OperatorHeader mobileMenu={mobileMenu} />
          <div className="b2b-page-stage mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </Sheet>
  );
}
