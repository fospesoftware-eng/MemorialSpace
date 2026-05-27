import { useState } from "react";
import { Link } from "wouter";
import {
  Building2,
  Heart,
  Search,
  Shield,
  Copy,
  Check,
  ArrowRight,
  KeyRound,
  Mail,
  Globe,
  Sparkles,
  Info,
  Store,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Portal = {
  key: string;
  name: string;
  tagline: string;
  url: string;
  email: string;
  password: string;
  icon: typeof Building2;
  accent: "green" | "rose" | "gold" | "sky" | "violet";
  audience: string;
  highlights: string[];
};

const portals: Portal[] = [
  {
    key: "saas",
    name: "SaaS Marketing",
    tagline: "Public landing site for cemetery operators evaluating MemorialSpace.",
    url: "/",
    email: "—",
    password: "—",
    icon: Sparkles,
    accent: "green",
    audience: "Prospective cemetery clients",
    highlights: ["Hero & feature tour", "3-tier pricing", "Customer testimonials"],
  },
  {
    key: "find",
    name: "Family Portal (Public)",
    tagline: "B2C grave search, public obituaries, and the memorial marketplace.",
    url: "/find",
    email: "guest@memorialspace.com",
    password: "no login required",
    icon: Search,
    accent: "sky",
    audience: "Visitors searching for a loved one",
    highlights: ["Cross-cemetery grave search", "Public memorial pages", "Flowers & care marketplace"],
  },
  {
    key: "account",
    name: "Customer Dashboard",
    tagline: "Family-member account: managed memorials, tributes, orders, saved records.",
    url: "/account",
    email: "sarah.chen@email.com",
    password: "Demo2026!",
    icon: Heart,
    accent: "rose",
    audience: "Family members & memorial owners",
    highlights: ["Manage 2 memorial pages", "Tributes left & received", "Order history & care plans"],
  },
  {
    key: "app",
    name: "Cemetery Operator (B2B)",
    tagline: "Day-to-day operations for cemetery staff: plots, burials, bookings, work orders.",
    url: "/app/dashboard",
    email: "ops@riversidememorial.com",
    password: "Cemetery2026!",
    icon: Building2,
    accent: "green",
    audience: "Cemetery managers & groundskeepers",
    highlights: ["Interactive plot map", "Burial & booking workflows", "QR codes & memorial pages"],
  },
  {
    key: "vendor",
    name: "Marketplace Vendor",
    tagline: "Third-party service providers — florists, stonemasons, transport — managing services and incoming family requests.",
    url: "/vendor/dashboard",
    email: "florist@test.com",
    password: "password123",
    icon: Store,
    accent: "violet",
    audience: "Florists, stonemasons & care providers",
    highlights: ["Service catalog & pricing", "Incoming request inbox", "Public listing on /vendors"],
  },
  {
    key: "admin",
    name: "Platform Super Admin",
    tagline: "MemorialSpace internal console — every cemetery, every user, MRR & analytics.",
    url: "/admin",
    email: "admin@memorialspace.com",
    password: "SuperAdmin2026!",
    icon: Shield,
    accent: "gold",
    audience: "MemorialSpace platform team",
    highlights: ["MRR & growth charts", "Organization management", "Support ticket triage"],
  },
];

const accentClass: Record<Portal["accent"], { bg: string; text: string; border: string; ring: string }> = {
  green: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
    ring: "group-hover:border-primary/60",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
    ring: "group-hover:border-rose-500/60",
  },
  gold: {
    bg: "bg-[#d4a843]/10",
    text: "text-[#d4a843]",
    border: "border-[#d4a843]/30",
    ring: "group-hover:border-[#d4a843]/60",
  },
  sky: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/30",
    ring: "group-hover:border-sky-500/60",
  },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/30",
    ring: "group-hover:border-violet-500/60",
  },
};

function CopyField({ label, value, icon: Icon, testId }: { label: string; value: string; icon: typeof Mail; testId: string }) {
  const [copied, setCopied] = useState(false);
  const isPlaceholder = value === "—" || value === "no login required";

  const handleCopy = async () => {
    if (isPlaceholder) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
          <div className="font-mono text-xs text-foreground truncate">{value}</div>
        </div>
      </div>
      {!isPlaceholder && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleCopy}
          data-testid={testId}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
        </Button>
      )}
    </div>
  );
}

export default function DemoCredentials() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div
          className="absolute inset-0 -z-10 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(58,130,90,0.18), transparent 70%)",
          }}
        />
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6">
            <KeyRound className="h-3.5 w-3.5" />
            Demo Access
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Explore every <span className="text-primary">MemorialSpace</span> surface
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Click any portal below to open it instantly. All data is sample data — no real
            authentication is required to walk through the experience.
          </p>
          <div className="mt-6 inline-flex items-start gap-2 rounded-lg border border-[#d4a843]/30 bg-[#d4a843]/5 px-4 py-3 text-left max-w-2xl">
            <Info className="h-4 w-4 text-[#d4a843] mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-[#d4a843] font-semibold">Demo environment.</span>{" "}
              Credentials are illustrative — the public preview lets anyone reach each portal directly.
              Use these accounts when scripting walkthroughs or onboarding stakeholders.
            </p>
          </div>
        </div>
      </section>

      {/* Portal grid */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {portals.map((p) => {
            const a = accentClass[p.accent];
            const Icon = p.icon;
            return (
              <Card
                key={p.key}
                data-testid={`portal-card-${p.key}`}
                className={`group border-border/60 ${a.ring} transition-all hover:shadow-lg hover:shadow-black/20 flex flex-col`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`h-11 w-11 rounded-lg ${a.bg} ${a.border} border flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${a.text}`} />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
                      {p.audience}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-lg font-bold tracking-tight">{p.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{p.tagline}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5 flex-1 flex flex-col">
                  <div className="space-y-2">
                    <CopyField label="URL" value={p.url} icon={Globe} testId={`copy-url-${p.key}`} />
                    <CopyField label="Email" value={p.email} icon={Mail} testId={`copy-email-${p.key}`} />
                    <CopyField label="Password" value={p.password} icon={KeyRound} testId={`copy-password-${p.key}`} />
                  </div>

                  <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/40">
                    {p.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`h-1 w-1 rounded-full ${a.text.replace("text-", "bg-")} mt-1.5 shrink-0`} />
                        {h}
                      </li>
                    ))}
                  </ul>

                  <div className="pt-3 mt-auto">
                    <Button
                      asChild
                      className="w-full bg-primary hover:bg-primary/90"
                      data-testid={`open-portal-${p.key}`}
                    >
                      <Link href={p.url}>
                        Open portal <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Quick reference table */}
      <section className="container mx-auto max-w-5xl px-4 sm:px-6 pb-16">
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Logo height={20} />
              <h3 className="text-base font-semibold">Quick reference</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All five surfaces of MemorialSpace at a glance.
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border/60 bg-card/40">
                    <th className="text-left px-6 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Portal</th>
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">URL</th>
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {portals.map((p, idx) => {
                    const a = accentClass[p.accent];
                    return (
                      <tr key={p.key} className={`${idx > 0 ? "border-t border-border/40" : ""} hover:bg-card/30`}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-7 w-7 rounded-md ${a.bg} ${a.border} border flex items-center justify-center`}>
                              <p.icon className={`h-3.5 w-3.5 ${a.text}`} />
                            </div>
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          <Link href={p.url} className="hover:text-foreground">{p.url}</Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.email}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.password}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Need help? Reach the platform team at{" "}
          <span className="font-mono text-foreground">support@memorialspace.com</span>
        </div>
      </section>
    </div>
  );
}
