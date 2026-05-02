import { Link, useLocation } from "wouter";
import { Award, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaasMarketingLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const links = [
    { href: "/#features", label: "Features" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#testimonials", label: "Customers" },
    { href: "/find", label: "Find a Loved One" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-[#2d5f3f] flex items-center justify-center shadow-lg shadow-primary/20">
              <Award className="h-5 w-5 text-background" />
            </div>
            <div>
              <div className="font-bold text-base leading-tight">MemorialSpace</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">For Cemeteries</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  location === l.href ? "text-foreground" : "text-foreground/60 hover:text-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" data-testid="link-signin">
              <Link href="/app/dashboard">Client Sign In</Link>
            </Button>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90" data-testid="link-demo">
              <Link href="/#pricing">Request Demo</Link>
            </Button>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <div className="flex flex-col gap-3 mt-8">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="text-base font-medium py-2 text-foreground/80 hover:text-foreground">{l.label}</Link>
                ))}
                <div className="border-t border-border my-3" />
                <Button asChild variant="outline"><Link href="/app/dashboard">Client Sign In</Link></Button>
                <Button asChild><Link href="/#pricing">Request Demo</Link></Button>
                <div className="border-t border-border my-3" />
                <Link href="/account" className="text-sm text-muted-foreground py-1">My Account</Link>
                <Link href="/admin" className="text-sm text-muted-foreground py-1">Admin Console</Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/40 bg-background/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-[#2d5f3f] flex items-center justify-center">
                  <Award className="h-4 w-4 text-background" />
                </div>
                <span className="font-bold">MemorialSpace</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">The complete platform for cemeteries to manage operations, honor lives, and serve families with dignity.</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-3">Product</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/#features" className="hover:text-foreground">Features</Link></li>
                <li><Link href="/#pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/find" className="hover:text-foreground">Family Portal</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold mb-3">Portals</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/app/dashboard" className="hover:text-foreground">Cemetery Client</Link></li>
                <li><Link href="/account" className="hover:text-foreground">Family Member</Link></li>
                <li><Link href="/admin" className="hover:text-foreground">Platform Admin</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© 2026 MemorialSpace. Honoring legacies with technology.</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Privacy</span><span>Terms</span><span>Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
