import { Link, useLocation } from "wouter";
import { Search, Award, BookOpen, ShoppingBag, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6 md:gap-10">
            <a href="/" className="flex items-center space-x-2">
              <Award className="h-6 w-6 text-primary" />
              <span className="inline-block font-bold">MemorialSpace</span>
            </a>
            <nav className="hidden md:flex gap-6">
              <Link
                href="/"
                className={cn(
                  "flex items-center text-sm font-medium transition-colors hover:text-foreground/80",
                  location === "/" ? "text-foreground" : "text-foreground/60"
                )}
              >
                <Search className="mr-2 h-4 w-4" />
                Grave Search
              </Link>
              <Link
                href="/obituaries"
                className={cn(
                  "flex items-center text-sm font-medium transition-colors hover:text-foreground/80",
                  location.startsWith("/obituaries") ? "text-foreground" : "text-foreground/60"
                )}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Obituaries
              </Link>
              <Link
                href="/shop"
                className={cn(
                  "flex items-center text-sm font-medium transition-colors hover:text-foreground/80",
                  location.startsWith("/shop") ? "text-foreground" : "text-foreground/60"
                )}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Marketplace
              </Link>
            </nav>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href="/account">
                <User className="h-4 w-4 mr-1.5" />
                My Account
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" data-testid="public-sign-out">
              <a href="/">
                <LogOut className="h-4 w-4 mr-1.5" />
                Sign Out
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border/40 py-6 md:px-8 md:py-0">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Powered by <Award className="inline-block h-4 w-4 mb-1 mx-1 text-primary" /> MemorialSpace. Honoring legacies.
          </p>
        </div>
      </footer>
    </div>
  );
}