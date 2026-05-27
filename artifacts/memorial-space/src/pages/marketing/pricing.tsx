import { Fragment } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Minus, ArrowRight, Sparkles, Shield } from "lucide-react";
import { MARKETING_PLANS, COMPARISON_GROUPS } from "./_plans";

const faqs = [
  {
    q: "Is there really a free trial?",
    a: "Yes. Starter and Professional come with a 14-day free trial; Enterprise comes with a 30-day pilot. No credit card required to start, and you can cancel any time before the trial ends without being charged.",
  },
  {
    q: "What happens when I exceed a plan's spot or user limit?",
    a: "We'll send a friendly heads-up and give you a 30-day grace window to either upgrade or trim back. We don't lock you out of records you've already entered — your data is always yours.",
  },
  {
    q: "Can I switch plans later?",
    a: "Of course. Upgrade and downgrade are both self-serve from the cemetery dashboard. Upgrades are prorated; downgrades take effect at the next billing period.",
  },
  {
    q: "Do you charge per user or per spot?",
    a: "No per-user, no per-spot fees within plan limits. The price you see is the price you pay each month.",
  },
  {
    q: "How does data import work?",
    a: "On every plan, our team imports your existing burial records, spot inventory, and any historical photos at no extra charge. Typical onboarding is 2–3 weeks from kickoff to launch.",
  },
  {
    q: "What about data ownership and exports?",
    a: "You own your data. Export every record (spots, burials, families, invoices, media) to CSV or JSON at any time, no questions asked.",
  },
  {
    q: "Do you offer a non-profit or municipality discount?",
    a: "Yes. Reach out via the sales form — we offer meaningful discounts for non-profit memorial spaces and municipal operators.",
  },
];

function Cell({ value }: { value: boolean }) {
  const label = value ? "Included" : "Not included";
  return (
    <>
      <span className="sr-only">{label}</span>
      {value ? (
        <Check aria-hidden="true" className="h-4 w-4 text-primary mx-auto" />
      ) : (
        <Minus aria-hidden="true" className="h-4 w-4 text-muted-foreground/40 mx-auto" />
      )}
    </>
  );
}

export default function PricingPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative pt-20 pb-12 px-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[1000px] rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary px-4 py-1">
            <Sparkles className="h-3 w-3 mr-2" />
            Pricing
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            One transparent price.<br />
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-[#d4a843] bg-clip-text text-transparent">
              Every module included.
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            No per-user fees. No per-spot fees. No surprise overages. Pick a plan based on your memorial space's size, and unlock the modules that match how you actually work.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
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
                  <p className="text-sm text-muted-foreground mb-6 min-h-10">{t.tagline}</p>
                  <div className="mb-2">
                    {t.priceUsd !== null ? (
                      <>
                        <span className="text-5xl font-bold">${t.priceUsd}</span>
                        <span className="text-muted-foreground">{t.cadence}</span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold">Custom</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">
                    {t.trialDays > 0 ? `${t.trialDays}-day free trial · ` : ""}Cancel anytime
                  </p>
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
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 px-4 bg-card/30 border-y border-border/40">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Compare every feature</h2>
            <p className="text-muted-foreground">Side-by-side breakdown of what's in each plan.</p>
          </div>
          <Card className="border-border/60 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  MemorialSpace plan comparison: Starter, Professional, and Enterprise.
                </caption>
                <thead className="bg-muted/30 border-b border-border/60">
                  <tr>
                    <th scope="col" className="text-left px-6 py-4 font-semibold w-1/2">Feature</th>
                    {MARKETING_PLANS.map((p) => (
                      <th scope="col" key={p.slug} className="px-6 py-4 font-semibold text-center">
                        <div>{p.name}</div>
                        <div className="text-xs font-normal text-muted-foreground mt-1">
                          {p.priceUsd !== null ? `$${p.priceUsd}${p.cadence}` : "Custom"}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Limits row group */}
                  <tr className="border-b border-border/40 bg-muted/10">
                    <th scope="colgroup" colSpan={4} className="text-left px-6 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Limits
                    </th>
                  </tr>
                  <tr className="border-b border-border/40">
                    <th scope="row" className="text-left font-normal px-6 py-3">Cemetery maps</th>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.slug} className="px-6 py-3 text-center">
                        {p.maxMaps === null ? "Unlimited" : p.maxMaps}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/40">
                    <th scope="row" className="text-left font-normal px-6 py-3">Spots</th>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.slug} className="px-6 py-3 text-center">
                        {p.maxSpots === null ? "Unlimited" : p.maxSpots.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/40">
                    <th scope="row" className="text-left font-normal px-6 py-3">Columbariums</th>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.slug} className="px-6 py-3 text-center">
                        {p.maxColumbariums === null ? "Unlimited" : p.maxColumbariums}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/40">
                    <th scope="row" className="text-left font-normal px-6 py-3">Mausoleums</th>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.slug} className="px-6 py-3 text-center">
                        {p.maxMausoleums === null ? "Unlimited" : p.maxMausoleums}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/40">
                    <th scope="row" className="text-left font-normal px-6 py-3">Users</th>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.slug} className="px-6 py-3 text-center">
                        {p.maxUsers === null ? "Unlimited" : p.maxUsers}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/40">
                    <th scope="row" className="text-left font-normal px-6 py-3">Media storage</th>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.slug} className="px-6 py-3 text-center">
                        {p.maxStorageGb === null ? "Unlimited" : `${p.maxStorageGb} GB`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/40">
                    <th scope="row" className="text-left font-normal px-6 py-3">Free trial</th>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.slug} className="px-6 py-3 text-center">
                        {p.trialDays > 0 ? (
                          `${p.trialDays} days`
                        ) : (
                          <>
                            <span className="sr-only">Not available</span>
                            <X aria-hidden="true" className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          </>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Module groups */}
                  {COMPARISON_GROUPS.map((group) => (
                    <Fragment key={group.group}>
                      <tr className="border-b border-border/40 bg-muted/10">
                        <th scope="colgroup" colSpan={4} className="text-left px-6 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.group}
                        </th>
                      </tr>
                      {group.rows.map((row) => (
                        <tr key={row.key} className="border-b border-border/40 last:border-b-0">
                          <th scope="row" className="text-left font-normal px-6 py-3">{row.label}</th>
                          {MARKETING_PLANS.map((p) => (
                            <td key={p.slug} className="px-6 py-3 text-center">
                              <Cell value={p.modules[row.key]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Frequently asked questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((f) => (
              <Card key={f.q} className="border-border/60 bg-card">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">{f.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-12 px-4 bg-card/30 border-y border-border/40">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row items-center gap-6 justify-center text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> SOC 2 Type II in progress</div>
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Daily encrypted backups</div>
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Data export, anytime</div>
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> 99.9% uptime target</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Still have questions?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Our team has helped over 300 memorial spaces digitize. We've probably seen your situation before — and we can usually quote and onboard within a week.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 px-8">
              <Link href="/contact">Talk to sales<ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-8">
              <Link href="/sign-in/cemetery">Start free trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
