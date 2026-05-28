import { Building2, Heart, Shield, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";

const portals = [
  {
    href: "/sign-in/cemetery",
    icon: Building2,
    label: "Cemetery Operator",
    description: "Sign in to manage plots, burials, bookings, and memorial services.",
    accent: "primary",
    accentClasses: "bg-primary/10 border-primary/30 text-primary group-hover:border-primary/60",
    testId: "hub-cemetery",
  },
  {
    href: "/sign-in/family",
    icon: Heart,
    label: "Family Member",
    description: "Sign in to your account to manage memorials, tributes, and orders.",
    accent: "rose",
    accentClasses: "bg-rose-500/10 border-rose-500/30 text-rose-400 group-hover:border-rose-500/60",
    testId: "hub-family",
  },
  {
    href: "/sign-in/admin",
    icon: Shield,
    label: "Platform Super Admin",
    description: "Internal MemorialSpace team console.",
    accent: "gold",
    accentClasses: "bg-[#d4a843]/10 border-[#d4a843]/30 text-[#d4a843] group-hover:border-[#d4a843]/60",
    testId: "hub-admin",
  },
];

export default function SignInHub() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <header className="w-full border-b border-border/40 bg-background/60 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <Logo height={32} />
          </a>
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Sign in to MemorialSpace</h1>
            <p className="mt-3 text-muted-foreground">Choose the portal that matches your role.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {portals.map((p) => (
              <a
                key={p.href}
                href={p.href}
                data-testid={p.testId}
                className="group block"
              >
                <Card className={`border-border/60 transition-all hover:shadow-xl hover:shadow-black/30 h-full`}>
                  <CardContent className="p-5 space-y-3">
                    <div className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-colors ${p.accentClasses}`}>
                      <p.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{p.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium pt-1 text-foreground/60 group-hover:text-foreground transition-colors">
                      Continue <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            New cemetery wanting to evaluate the platform?{" "}
            <a href="/#pricing" className="text-primary hover:underline font-medium">Request a demo</a>
          </p>
        </div>
      </main>

      <footer className="border-t border-border/40 py-4">
        <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">© 2026 MemorialSpace. Honoring legacies with technology.</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href="/privacy-policy" className="hover:text-foreground">Privacy</a>
            <a href="/terms-and-conditions" className="hover:text-foreground">Terms</a>
            <a href="/" className="hover:text-foreground">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
