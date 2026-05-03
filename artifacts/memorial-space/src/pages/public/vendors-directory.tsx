/**
 * Public funeral marketplace at `/vendors`. Hero with the 5 lifecycle
 * categories on top, then a chip filter + vendor grid. Replaces the v1
 * free-text category filter with a curated taxonomy.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Store, MapPin, Phone, Globe, ArrowRight, Sparkles, X } from "lucide-react";
import { usePublicVendors } from "../vendor/api";
import {
  FUNERAL_CATEGORIES,
  CATEGORY_BY_KEY,
  categoryLabel,
  type FuneralCategory,
} from "../vendor/categories";

export default function VendorsDirectory() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<FuneralCategory | "">("");
  const [area, setArea] = useState("");
  const { data, isLoading } = usePublicVendors({ q, category, area });
  const vendors = data?.vendors ?? [];

  const clearFilters = () => { setQ(""); setCategory(""); setArea(""); };
  const hasFilters = Boolean(q || category || area);
  const activeCategoryMeta = category ? CATEGORY_BY_KEY[category] : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-gradient-to-b from-card/40 to-transparent">
        <div className="container mx-auto max-w-7xl px-6 pt-12 pb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a843]/30 bg-[#d4a843]/5 px-3 py-1 text-[11px] uppercase tracking-widest font-semibold text-[#d4a843] mb-4">
                <Sparkles className="h-3 w-3" /> Funeral marketplace
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Every step, one trusted network</h1>
              <p className="text-muted-foreground mt-3 max-w-2xl">
                From the funeral itself through years of remembrance — vetted vendors for every part
                of the journey. Browse a category to begin.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="border-[#d4a843]/40 text-[#d4a843] hover:bg-[#d4a843]/10 self-start md:self-auto">
              <a href="/vendor/signup"><Store className="h-3.5 w-3.5 mr-1.5" />List your business</a>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="category-grid">
            {FUNERAL_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = category === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setCategory(active ? "" : c.key)}
                  data-testid={`category-card-${c.key}`}
                  className={`relative text-left rounded-xl border p-4 transition-all overflow-hidden ${
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-lg"
                      : "border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/70"
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.accent} pointer-events-none ${active ? "opacity-100" : "opacity-50 group-hover:opacity-80"}`} />
                  <div className="relative">
                    <div className="h-9 w-9 rounded-lg bg-background/50 backdrop-blur-sm flex items-center justify-center mb-2">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-sm leading-tight">{c.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{c.blurb}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
        <Card className="border-border/60">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business or description" className="pl-9" data-testid="input-search" />
            </div>
            <div className="md:col-span-4">
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Service area (e.g. Seattle)" data-testid="input-area" />
            </div>
            {hasFilters ? (
              <div className="md:col-span-12 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {activeCategoryMeta ? (
                    <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
                      {activeCategoryMeta.label}
                    </Badge>
                  ) : null}
                  {area ? <Badge variant="outline">{area}</Badge> : null}
                  {q ? <Badge variant="outline">"{q}"</Badge> : null}
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-3.5 w-3.5 mr-1" />Clear filters
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading vendors…</p>
        ) : vendors.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground" data-testid="empty-vendors">
              <Store className="h-12 w-12 mx-auto opacity-40 mb-3" />
              <p className="font-medium">No vendors match your filters.</p>
              <p className="text-sm mt-1">Try a broader search or clear the filters above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.map((v) => (
              <Card key={v.id} className="border-border/60 hover:border-primary/40 transition-colors flex flex-col" data-testid={`vendor-card-${v.slug}`}>
                <CardContent className="p-5 flex flex-col flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    {v.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.logoUrl} alt="" className="h-12 w-12 rounded-md object-cover border border-border/40 shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Store className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{v.businessName}</h3>
                      {v.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {v.categories.slice(0, 3).map((c) => (
                            <Badge key={c} variant="secondary" className="text-[10px]">{categoryLabel(c)}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {v.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{v.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic flex-1">No description provided.</p>
                  )}
                  <div className="space-y-1 mt-3 text-xs text-muted-foreground">
                    {v.serviceAreas.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{v.serviceAreas.slice(0, 4).join(" · ")}</span>
                      </div>
                    ) : null}
                    {v.contactPhone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{v.contactPhone}</span>
                      </div>
                    ) : null}
                    {v.websiteUrl ? (
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3 w-3 shrink-0" />
                        <a href={v.websiteUrl} target="_blank" rel="noreferrer" className="truncate hover:text-foreground">{v.websiteUrl.replace(/^https?:\/\//, "")}</a>
                      </div>
                    ) : null}
                  </div>
                  <Button asChild className="mt-4 bg-primary hover:bg-primary/90" data-testid={`button-view-${v.slug}`}>
                    <Link href={`/vendors/${v.slug}`}>View &amp; request<ArrowRight className="h-3.5 w-3.5 ml-2" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
