import { Link, useLocation } from "wouter";
import { Menu, Facebook, Instagram, Linkedin, Youtube, Twitter } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SimpleThemeToggle } from "@/components/simple-theme-toggle";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/find", label: "Find Loved Ones" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/vendors", label: "Marketplace" },
  { href: "/shop", label: "Store" },
];

const FooterCol = ({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) => (
  <div>
    <p className="text-sm font-semibold mb-3 text-foreground">{title}</p>
    <ul className="space-y-2 text-sm text-muted-foreground">
      {links.map((l) => (
        <li key={l.label}>
          <Link href={l.href} className="hover:text-foreground transition-colors">
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

export function MarketingHeader() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <Logo height={56} />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <Link
              key={l.label}
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

        <div className="hidden md:flex items-center gap-3">
          <SimpleThemeToggle />
          <Button asChild variant="ghost" size="sm" data-testid="link-signin">
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-primary/40 text-primary hover:bg-primary/10"
            data-testid="link-create-memorial"
          >
            <Link href="/sign-in/family">Create Memorial</Link>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-background">
            <div className="flex flex-col gap-3 mt-8">
              {navLinks.map((l) => (
                <Link key={l.label} href={l.href} className="text-base font-medium py-2 text-foreground/80 hover:text-foreground">{l.label}</Link>
              ))}
              <div className="border-t border-border my-3" />
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Theme</span>
                <SimpleThemeToggle />
              </div>
              <div className="border-t border-border my-3" />
              <Button asChild variant="outline"><Link href="/sign-in">Sign In</Link></Button>
              <Button asChild variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
                <Link href="/sign-in/family">Create Memorial</Link>
              </Button>
              <div className="border-t border-border my-3" />
              <Link href="/account" className="text-sm text-muted-foreground py-1">My Account</Link>
              <Link href="/admin" className="text-sm text-muted-foreground py-1">Admin Console</Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

export function SaasMarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
            {/* Column 1: Brand */}
            <div className="col-span-2 md:col-span-3 lg:col-span-1">
              <Link href="/" className="flex items-center mb-4">
                <Logo height={44} />
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                A complete digital memorial ecosystem for memorial spaces, families, partners, and future generations.
              </p>
              <p className="text-sm text-muted-foreground italic mb-6">
                Preserve memories. Manage spaces. Connect generations.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" aria-label="Facebook" className="text-muted-foreground hover:text-foreground transition-colors"><Facebook className="h-4 w-4" /></a>
                <a href="#" aria-label="Instagram" className="text-muted-foreground hover:text-foreground transition-colors"><Instagram className="h-4 w-4" /></a>
                <a href="#" aria-label="LinkedIn" className="text-muted-foreground hover:text-foreground transition-colors"><Linkedin className="h-4 w-4" /></a>
                <a href="#" aria-label="YouTube" className="text-muted-foreground hover:text-foreground transition-colors"><Youtube className="h-4 w-4" /></a>
                <a href="#" aria-label="X / Twitter" className="text-muted-foreground hover:text-foreground transition-colors"><Twitter className="h-4 w-4" /></a>
              </div>
            </div>

            {/* Column 2: Company */}
            <FooterCol
              title="Company"
              links={[
                { label: "About Us", href: "#" },
                { label: "Contact", href: "/contact" },
                { label: "Careers", href: "#" },
                { label: "Our Mission", href: "#" },
                { label: "How It Works", href: "/tutorial" },
                { label: "News & Updates", href: "#" },
                { label: "Blog", href: "#" },
                { label: "Media Kit", href: "#" },
                { label: "Partner With Us", href: "#" },
              ]}
            />

            {/* Column 3: Support */}
            <FooterCol
              title="Support"
              links={[
                { label: "Help Center", href: "#" },
                { label: "Customer Support", href: "/contact" },
                { label: "FAQs", href: "#" },
                { label: "Report a Problem", href: "#" },
                { label: "Submit a Request", href: "#" },
                { label: "Memorial Page Support", href: "#" },
                { label: "Account & Login Help", href: "#" },
                { label: "Billing Support", href: "#" },
                { label: "Data Correction Request", href: "#" },
                { label: "Request a Demo", href: "/demo" },
              ]}
            />

            {/* Column 4: Partners & Marketplace */}
            <FooterCol
              title="Partners & Marketplace"
              links={[
                { label: "Marketplace", href: "/vendors" },
                { label: "Store", href: "/shop" },
                { label: "Vendor Registration", href: "/vendor/signup" },
                { label: "Partner Registration", href: "#" },
                { label: "Memorial Space Registration", href: "/signup/cemetery" },
                { label: "Service Provider Listing", href: "#" },
                { label: "Funeral Service Providers", href: "#" },
                { label: "Flower & Tribute Vendors", href: "#" },
                { label: "Headstone & Plaque Providers", href: "#" },
                { label: "Pet Memorial Services", href: "#" },
                { label: "Business Dashboard", href: "#" },
                { label: "Vendor Login", href: "/sign-in/vendor" },
              ]}
            />

            {/* Column 5: Legal & Policies */}
            <FooterCol
              title="Terms & Policies"
              links={[
                { label: "Terms & Conditions", href: "/terms-and-conditions" },
                { label: "Privacy Policy", href: "/privacy-policy" },
                { label: "Cookie Policy", href: "/cookie-policy" },
                { label: "Refund Policy", href: "/refund-policy" },
                { label: "Data Protection Policy", href: "#" },
                { label: "User Content Policy", href: "#" },
                { label: "Memorial Content Policy", href: "#" },
                { label: "Marketplace Policy", href: "#" },
                { label: "Vendor Terms", href: "#" },
                { label: "Partner Terms", href: "/partner-terms" },
                { label: "QR Memorial Policy", href: "#" },
              ]}
            />
          </div>

          <div className="mt-14 pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              &copy; 2026 MemorialSpace.app. All rights reserved. Honoring legacies with technology.
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms-and-conditions" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Security</Link>
              <Link href="/cookie-policy" className="hover:text-foreground transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
