import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Map, QrCode, ShoppingBag, FileText, Calendar, Wrench,
  ArrowRight, Sparkles, Building2, BarChart3, FileCheck,
  Globe, Receipt, Boxes, ScanLine, Building, KeyRound,
  Database, Users2, ShieldCheck,
} from "lucide-react";

const sections = [
  {
    eyebrow: "Operations",
    title: "Run the memorial space from one console",
    desc: "Plots, burials, services, work orders — everything an operator touches in a day, in a single, calm interface.",
    items: [
      { icon: Map, title: "Plot mapping", desc: "Draw plots on top of an aerial photo or scanned map. Each plot has lifetime status: available / reserved / occupied / maintenance." },
      { icon: ScanLine, title: "AI map maker", desc: "Upload a hand-drawn or scanned memorial space map. Our AI extracts plot polygons and pre-classifies sections, so you skip weeks of CAD work." },
      { icon: Building, title: "Columbarium & mausoleum", desc: "First-class modules for niche walls and crypts — track tier, row, column, occupancy, and per-niche pricing." },
      { icon: Database, title: "Burial records", desc: "Searchable lifetime records with relationships, certificates, and source-document attachments. Full historical archive." },
      { icon: Calendar, title: "Bookings & scheduling", desc: "Service bookings, family appointments, and maintenance reminders on one shared calendar with crew assignments." },
      { icon: Wrench, title: "Work orders", desc: "Issue, assign, and track maintenance tickets against specific plots, with photos before and after." },
    ],
  },
  {
    eyebrow: "Family-facing",
    title: "Serve families anywhere they are",
    desc: "Modern, dignified family experiences out of the box — your brand, your domain, no developer required.",
    items: [
      { icon: QrCode, title: "QR memorial codes", desc: "Weatherproof QR codes link the gravesite to a digital memorial page. Visitors scan and instantly see photos, biography, and tributes." },
      { icon: FileText, title: "Obituaries & tributes", desc: "Publish obituaries, accept tribute submissions with moderation, and let loved ones share memories from anywhere in the world." },
      { icon: Globe, title: "Public memorial website", desc: "A turnkey website per memorial space: search a grave, browse obituaries, shop services. Hosted on your subdomain or your own domain." },
      { icon: ShoppingBag, title: "Marketplace & e-commerce", desc: "Sell flowers, urns, plaques, and recurring care services. Customers order directly from a memorial page or your shop." },
    ],
  },
  {
    eyebrow: "Business",
    title: "Run a real business, not a filing cabinet",
    desc: "Accounting, reporting, and roles tuned for memorial space economics — not generic small-business software.",
    items: [
      { icon: Receipt, title: "Accounting & invoicing", desc: "Quote, invoice, and accept payments for plots, services, and goods. Tax rates per jurisdiction. Customer ledger per family." },
      { icon: BarChart3, title: "Reports & analytics", desc: "Occupancy by section, revenue by service line, average ticket per family, and outstanding A/R — all updated in real time." },
      { icon: Boxes, title: "Inventory & products", desc: "Track plot inventory, niche inventory, and tangible goods (flowers, urns) with stock levels and reorder thresholds." },
      { icon: Users2, title: "Team roles", desc: "Owner, admin, manager, staff, and viewer roles with granular permissions. Invite by email, deactivate in one click." },
    ],
  },
  {
    eyebrow: "Enterprise",
    title: "Built for groups and municipalities",
    desc: "When you operate more than one cemetery — or steward public records — you need security, scale, and accountability.",
    items: [
      { icon: Building2, title: "Multi-site groups", desc: "One organization, many memorial spaces. Centralized billing and reporting, per-site branding and operations." },
      { icon: KeyRound, title: "SSO (SAML / OIDC)", desc: "Plug into Google Workspace, Okta, or Microsoft Entra so staff sign in with their corporate identity." },
      { icon: ShieldCheck, title: "Audit log", desc: "Every write action — billing, plot status, family records — is recorded with actor, timestamp, and a JSON detail blob." },
      { icon: FileCheck, title: "SLA & priority support", desc: "Named success manager, response-time SLAs, and a private Slack channel for production issues." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative pt-20 pb-16 px-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[1000px] rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary px-4 py-1">
            <Sparkles className="h-3 w-3 mr-2" />
            Features
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Every module a memorial space needs.<br />
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-[#d4a843] bg-clip-text text-transparent">
              Nothing it doesn't.
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            MemorialSpace replaces the patchwork of spreadsheets, paper ledgers, and one-off websites that most memorial spaces still run on — with a single, modern platform built specifically for this work.
          </p>
        </div>
      </section>

      {sections.map((section, idx) => (
        <section key={section.title} className={`py-20 px-4 ${idx % 2 === 1 ? "bg-card/30 border-y border-border/40" : ""}`}>
          <div className="container mx-auto max-w-6xl">
            <div className="max-w-2xl mb-12">
              <p className="text-sm uppercase tracking-widest text-primary font-semibold mb-3">{section.eyebrow}</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{section.title}</h2>
              <p className="text-lg text-muted-foreground">{section.desc}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {section.items.map((item) => (
                <Card key={item.title} className="border-border/60 bg-card hover:border-primary/40 transition-all">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-[#d4a843]/5">
            <CardContent className="relative p-12 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">See how it fits your memorial space</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">A 30-minute demo with a real product specialist — no sales pitch, just a walkthrough on your data.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 px-8">
                  <Link href="/contact">Book a demo<ArrowRight className="h-4 w-4 ml-2" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="px-8">
                  <Link href="/pricing">See pricing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
