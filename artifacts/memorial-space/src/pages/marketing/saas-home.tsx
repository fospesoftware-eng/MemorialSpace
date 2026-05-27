import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedHeroBackground } from "@/components/animated-hero-bg";
import {
  Map, QrCode, Users, ShoppingBag, FileText, Calendar,
  ArrowRight, Check, Sparkles, Building2, BarChart3,
  Heart, Search, Shield, Zap, Globe, Star,
} from "lucide-react";
import { MARKETING_PLANS } from "./_plans";

const features = [
  { icon: Map, title: "Interactive Plot Mapping", desc: "GeoJSON-powered cemetery maps with real-time status: available, reserved, occupied, maintenance.", color: "from-emerald-500/20 to-emerald-500/5" },
  { icon: Calendar, title: "Bookings & Scheduling", desc: "Service bookings, maintenance reminders, and family appointments — all in one calendar.", color: "from-amber-500/20 to-amber-500/5" },
  { icon: QrCode, title: "QR Memorial Codes", desc: "Generate weatherproof QR codes that link to digital memorial pages from the gravesite itself.", color: "from-violet-500/20 to-violet-500/5" },
  { icon: ShoppingBag, title: "Marketplace & E-commerce", desc: "Sell flowers, urns, and care services. Customers order directly from memorial pages.", color: "from-rose-500/20 to-rose-500/5" },
  { icon: FileText, title: "Obituaries & Tributes", desc: "Publish obituaries, collect family tributes, and let loved ones share memories from anywhere.", color: "from-sky-500/20 to-sky-500/5" },
  { icon: Users, title: "Burial Records & Genealogy", desc: "Searchable lifetime records with full burial history, family relationships, and historical archives.", color: "from-teal-500/20 to-teal-500/5" },
];

const stats = [
  { value: "320+", label: "Cemeteries trust us" },
  { value: "1.2M", label: "Memorial pages created" },
  { value: "98%", label: "Customer retention" },
  { value: "24/7", label: "Family portal access" },
];

const testimonials = [
  {
    quote: "We digitized 60 years of paper burial records in three months. Our families finally have closure searching for ancestors.",
    name: "Margaret Holloway",
    role: "Director, Greenwood Memorial Park",
    rating: 5,
  },
  {
    quote: "The QR codes on each headstone changed everything. Visitors scan and instantly see memorial pages with photos and tributes.",
    name: "James Okonkwo",
    role: "Operations Manager, Sunset Valley",
    rating: 5,
  },
  {
    quote: "Marketplace alone covered our subscription. Families order flowers for weekly delivery directly from the memorial page.",
    name: "Elena Vasquez",
    role: "Family Services, Pine Hill Cemetery",
    rating: 5,
  },
];

export default function SaasHome() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative pt-20 pb-32 px-4">
        <AnimatedHeroBackground />
        {/* Seamless header-to-hero blend: darkest at top, green-tinged at bottom */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.88) 18%, hsl(var(--background) / 0.55) 40%, hsl(160 32% 9% / 0.25) 60%, hsl(160 38% 11% / 0.65) 85%, hsl(160 35% 13% / 0.85) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 container mx-auto max-w-6xl text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary px-4 py-1">
            <Sparkles className="h-3 w-3 mr-2" />
            The cemetery operating system, reimagined
          </Badge>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Honor every life.<br />
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-[#d4a843] bg-clip-text text-transparent">
              Manage every detail.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            MemorialSpace is the all-in-one platform for cemeteries to digitize plots, sell services online, publish memorial pages, and serve families with the dignity they deserve.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 px-8 h-12 text-base shadow-lg shadow-primary/20" data-testid="cta-trial">
              <Link href="/sign-in/cemetery">Start 14-day free trial<ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base" data-testid="cta-demo">
              <Link href="/contact">Book a demo</Link>
            </Button>
          </div>

          {/* Portal selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
            <Link href="/sign-in/cemetery" data-testid="portal-cemetery" className="group rounded-xl border border-border bg-card/50 backdrop-blur p-4 hover:border-primary/40 hover:bg-card transition-all text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Cemetery Portal</p>
                  <p className="text-xs text-muted-foreground">Operations dashboard</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
            <Link href="/sign-in/family" data-testid="portal-family" className="group rounded-xl border border-border bg-card/50 backdrop-blur p-4 hover:border-primary/40 hover:bg-card transition-all text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                  <Heart className="h-5 w-5 text-rose-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Family Portal</p>
                  <p className="text-xs text-muted-foreground">Manage memorials</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
            <Link href="/sign-in/admin" data-testid="portal-admin" className="group rounded-xl border border-border bg-card/50 backdrop-blur p-4 hover:border-[#d4a843]/40 hover:bg-card transition-all text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#d4a843]/10 flex items-center justify-center group-hover:bg-[#d4a843]/20 transition-colors">
                  <Shield className="h-5 w-5 text-[#d4a843]" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Platform Admin</p>
                  <p className="text-xs text-muted-foreground">Super admin console</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/40 bg-card/30">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Everything you need</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">A modern OS for sacred spaces</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">From plot-level inventory to family-facing services — built for the realities of cemetery operations today.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <Card key={f.title} className="group relative overflow-hidden border-border/60 bg-card hover:border-primary/40 transition-all duration-300">
                <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <CardContent className="relative p-6">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button asChild variant="outline" size="lg">
              <Link href="/features">See every feature in detail<ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-card/30 border-y border-border/40">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">From paper records to a living digital archive</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Onboard in weeks, not years. We handle the heavy lifting.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: "01", icon: Search, title: "Discover & import", desc: "We scan your existing burial records, import them into the platform, and reconcile with your physical map." },
              { n: "02", icon: Zap, title: "Configure & launch", desc: "Your team gets trained in days. Custom branding, plot status, marketplace, and payments — live in 2 weeks." },
              { n: "03", icon: Globe, title: "Serve families anywhere", desc: "Families search graves, leave tributes, and order services from any device. Your team manages everything from one console." },
            ].map((step) => (
              <div key={step.n} className="relative">
                <div className="text-7xl font-bold text-primary/10 leading-none mb-4">{step.n}</div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-xl mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Trusted by directors</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">Stories from the field</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-border/60 bg-card">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-[#d4a843] text-[#d4a843]" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6 leading-relaxed">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {t.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 bg-card/30 border-y border-border/40">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">Simple, transparent plans</h2>
            <p className="text-lg text-muted-foreground">Start free. Cancel anytime. No credit card required.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MARKETING_PLANS.map((t) => (
              <Card key={t.slug} className={`relative border-border/60 bg-card transition-all ${t.highlight ? "border-primary/60 shadow-2xl shadow-primary/10 md:scale-105" : "hover:border-primary/30"}`}>
                {t.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground border-none">{t.badge}</Badge>
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold mb-1">{t.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{t.tagline}</p>
                  <div className="mb-6">
                    {t.priceUsd !== null ? (
                      <>
                        <span className="text-5xl font-bold">${t.priceUsd}</span>
                        <span className="text-muted-foreground">{t.cadence}</span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold">Custom</span>
                    )}
                  </div>
                  <Button asChild className={`w-full mb-6 ${t.highlight ? "bg-primary hover:bg-primary/90" : ""}`} variant={t.highlight ? "default" : "outline"} data-testid={`pricing-${t.slug}`}>
                    <Link href={t.cta.href}>{t.cta.label}</Link>
                  </Button>
                  <ul className="space-y-3">
                    {t.highlights.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button asChild variant="outline">
              <Link href="/pricing">Compare every feature side by side<ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-[#d4a843]/5">
            <div className="absolute inset-0 -z-0">
              <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#d4a843]/10 blur-3xl" />
            </div>
            <CardContent className="relative p-12 text-center">
              <BarChart3 className="h-12 w-12 text-primary mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to honor lives at scale?</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">Join hundreds of cemeteries already running on MemorialSpace. Set up takes 2 weeks. ROI takes 2 months.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 px-8">
                  <Link href="/sign-in/cemetery">Get started free</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="px-8">
                  <Link href="/contact">Talk to sales</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
