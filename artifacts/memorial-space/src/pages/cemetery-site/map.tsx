import { useMemo, useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { MapPin, X, ArrowRight, ScanLine, Search } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicMap, type PublicMapPlot, type PublicSite } from "./api";
import { BurialDetails } from "@/components/burial-details";

type Props = { slug: string; site: PublicSite };

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  maintenance: "Maintenance",
};

// Per-status ring + dot colours that render legibly on every theme.
// We deliberately avoid theme.primary here so the map legend always
// reads the same regardless of which palette the operator picks.
function statusStyles(status: string) {
  switch (status) {
    case "available":
      return { bg: "rgb(220 252 231)", fg: "rgb(20 83 45)", dot: "rgb(34 197 94)" };
    case "reserved":
      return { bg: "rgb(254 249 195)", fg: "rgb(113 63 18)", dot: "rgb(234 179 8)" };
    case "occupied":
      return { bg: "rgb(229 231 235)", fg: "rgb(31 41 55)", dot: "rgb(75 85 99)" };
    case "maintenance":
      return { bg: "rgb(254 226 226)", fg: "rgb(127 29 29)", dot: "rgb(239 68 68)" };
    default:
      return { bg: "rgb(241 245 249)", fg: "rgb(51 65 85)", dot: "rgb(100 116 139)" };
  }
}

export function CemeterySiteMap({ slug, site }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  const { data, isLoading } = usePublicMap(slug);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);

  const plots = data?.plots ?? [];
  const sections = data?.sections ?? [];

  const filtered = useMemo(() => {
    return plots.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (sectionFilter && p.section !== sectionFilter) return false;
      return true;
    });
  }, [plots, statusFilter, sectionFilter]);

  // Group plots by section so the visual layout reflects how a visitor
  // would walk the cemetery. Plots without a section land in "General".
  const grouped = useMemo(() => {
    const map = new Map<string, PublicMapPlot[]>();
    for (const p of filtered) {
      const key = p.section || "General";
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const selected = plots.find((p) => p.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const c = { available: 0, reserved: 0, occupied: 0, maintenance: 0, total: plots.length };
    for (const p of plots) {
      if (p.status in c) (c as Record<string, number>)[p.status]++;
    }
    return c;
  }, [plots]);

  // When ordering from a plot, propagate context to the marketplace
  // so the cart can prefill notes ("[For Jane Doe — Plot A-12-007]").
  const orderHrefForPlot = (p: PublicMapPlot) => {
    const params = new URLSearchParams();
    if (p.burial?.name) params.set("for", p.burial.name);
    params.set("plotRef", p.plotNumber);
    return `/marketplace?${params.toString()}`;
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16">
      <div className="text-center mb-8">
        <div
          style={{ color: "hsl(var(--site-primary))" }}
          className="text-xs uppercase tracking-widest font-semibold mb-3"
        >
          Cemetery Map
        </div>
        <h1 style={headingFont} className="text-4xl md:text-5xl font-semibold mb-3">
          Visit the Grounds
        </h1>
        <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-lg max-w-xl mx-auto">
          Explore our sections, find a loved one's plot, and arrange flowers,
          maintenance, or a memorial QR plaque.
        </p>
      </div>

      {/* Legend + counts */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {(["available", "reserved", "occupied", "maintenance"] as const).map((s) => {
          const st = statusStyles(s);
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter((cur) => (cur === s ? null : s))}
              data-testid={`legend-${s}`}
              style={{
                background: active ? "hsl(var(--site-primary))" : st.bg,
                color: active ? "hsl(var(--site-primary-fg))" : st.fg,
                borderRadius: "var(--site-radius)",
                border: "1px solid hsl(var(--site-border))",
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: st.dot, boxShadow: "0 0 0 2px rgba(255,255,255,0.5)" }}
              />
              {STATUS_LABELS[s]}
              <span className="opacity-70">({(counts as Record<string, number>)[s] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* Section filter */}
      {sections.length > 1 ? (
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          <button
            onClick={() => setSectionFilter(null)}
            data-testid="section-all"
            style={{
              background: sectionFilter === null ? "hsl(var(--site-primary))" : "hsl(var(--site-card))",
              color: sectionFilter === null ? "hsl(var(--site-primary-fg))" : "hsl(var(--site-fg))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="px-3 py-1.5 text-xs font-medium"
          >
            All sections
          </button>
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setSectionFilter((cur) => (cur === s ? null : s))}
              data-testid={`section-${s}`}
              style={{
                background: sectionFilter === s ? "hsl(var(--site-primary))" : "hsl(var(--site-card))",
                color: sectionFilter === s ? "hsl(var(--site-primary-fg))" : "hsl(var(--site-fg))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="px-3 py-1.5 text-xs font-medium"
            >
              {/^section\b/i.test(s) ? s : `Section ${s}`}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-12 text-center"
        >
          <p style={{ color: "hsl(var(--site-muted-fg))" }}>Loading map…</p>
        </div>
      ) : plots.length === 0 ? (
        <div
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-16 text-center"
          data-testid="empty-map"
        >
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-40" style={{ color: "hsl(var(--site-muted-fg))" }} />
          <p style={{ color: "hsl(var(--site-muted-fg))" }}>
            The interactive map hasn't been published yet. Please check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([section, sectionPlots]) => (
            <section
              key={section}
              style={{
                background: "hsl(var(--site-card))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="p-5 md:p-6"
              data-testid={`map-section-${section}`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 style={headingFont} className="text-xl font-semibold">
                  {/^section\b/i.test(section) ? section : `Section ${section}`}
                </h2>
                <span
                  className="text-xs"
                  style={{ color: "hsl(var(--site-muted-fg))" }}
                >
                  {sectionPlots.length} plot{sectionPlots.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
                {sectionPlots.map((p) => {
                  const st = statusStyles(p.status);
                  const isSelected = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      data-testid={`plot-cell-${p.id}`}
                      title={`Plot ${p.plotNumber}${p.burial ? ` — ${p.burial.name}` : ""}`}
                      style={{
                        background: st.bg,
                        color: st.fg,
                        border: isSelected
                          ? "2px solid hsl(var(--site-primary))"
                          : "2px solid transparent",
                        borderRadius: "calc(var(--site-radius) * 0.6)",
                        aspectRatio: "1 / 1",
                      }}
                      className="text-[10px] font-semibold flex items-center justify-center hover:scale-110 transition-transform relative"
                    >
                      <span className="truncate px-0.5">{p.plotNumber}</span>
                      {p.burial?.memorialCode ? (
                        <ScanLine
                          className="h-2.5 w-2.5 absolute top-0.5 right-0.5 opacity-70"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Plot detail side panel */}
      {selected ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedId(null)}
            aria-hidden="true"
          />
          <aside
            data-testid="plot-detail-panel"
            style={{
              background: "hsl(var(--site-card))",
              borderLeft: "1px solid hsl(var(--site-border))",
              fontFamily: theme.fontBody,
            }}
            className="fixed inset-y-0 right-0 z-40 w-full sm:max-w-md overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b" style={{ background: "hsl(var(--site-card))", borderColor: "hsl(var(--site-border))" }}>
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "hsl(var(--site-primary))" }}>
                  Plot {selected.plotNumber}
                </div>
                <div className="text-xs" style={{ color: "hsl(var(--site-muted-fg))" }}>
                  {(() => {
                    const s = selected.section ?? "General";
                    return /^section\b/i.test(s) ? s : `Section ${s}`;
                  })()}
                  {selected.row ? ` · ${/^row\b/i.test(selected.row) ? selected.row : `Row ${selected.row}`}` : ""}
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="p-2 rounded hover:bg-black/5"
                style={{ color: "hsl(var(--site-fg))" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {(() => {
                const st = statusStyles(selected.status);
                return (
                  <span
                    style={{ background: st.bg, color: st.fg, borderRadius: "var(--site-radius)" }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: st.dot }} />
                    {STATUS_LABELS[selected.status] ?? selected.status}
                    <span className="opacity-70">· {selected.type ?? "standard"}</span>
                  </span>
                );
              })()}

              {selected.burial ? (
                <BurialDetails
                  variant="public"
                  siteSlug={slug}
                  burial={{
                    name: selected.burial.name,
                    dob: selected.burial.bornYear,
                    dod: selected.burial.diedYear,
                    photoUrl: selected.burial.photoUrl,
                    memorialCode: selected.burial.memorialCode,
                    qrImageUrl: selected.burial.qrImageUrl,
                  }}
                />
              ) : (
                <p
                  className="text-sm italic"
                  style={{ color: "hsl(var(--site-muted-fg))" }}
                >
                  This plot is currently {STATUS_LABELS[selected.status]?.toLowerCase() ?? selected.status}.
                </p>
              )}

              <div>
                <Link
                  href={orderHrefForPlot(selected)}
                  data-testid={`order-for-plot-${selected.id}`}
                  style={{
                    border: "1px solid hsl(var(--site-border))",
                    color: "hsl(var(--site-primary))",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-black/5 transition-colors"
                >
                  Order memorial services for this plot
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p
                  className="text-[11px] text-center mt-2"
                  style={{ color: "hsl(var(--site-muted-fg))" }}
                >
                  Flowers, maintenance, headstone services, QR plaque, and more.
                </p>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
