import { Link } from "wouter";
import { Search, ShoppingBag, ArrowRight, Map as MapIcon, ScanLine } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicProducts, type PublicSite } from "./api";

type Props = { slug: string; site: PublicSite };

export function CemeterySiteHome({ slug, site }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  const { data } = usePublicProducts(slug);
  const featured = (data?.products ?? []).filter((p) => p.isFeatured).slice(0, 6);

  return (
    <div>
      <section
        style={{
          minHeight: "min(80vh, 640px)",
          backgroundImage: site.heroImageUrl
            ? `${theme.heroOverlay}, url(${site.heroImageUrl})`
            : `${theme.heroOverlay}, linear-gradient(135deg, hsl(var(--site-primary)), hsl(var(--site-fg)))`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "white",
        }}
        className="relative flex items-center"
        data-testid="hero-section"
      >
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            {site.tagline ? (
              <div
                style={{ color: "white", borderColor: "rgba(255,255,255,0.3)" }}
                className="inline-block px-3 py-1 text-xs uppercase tracking-widest border rounded-full mb-6 backdrop-blur-sm"
              >
                {site.tagline}
              </div>
            ) : null}
            <h1
              style={headingFont}
              className="text-4xl md:text-6xl font-semibold leading-tight mb-6"
              data-testid="hero-headline"
            >
              {site.heroHeadline ?? `Welcome to ${site.siteTitle}`}
            </h1>
            {site.heroSubheadline ? (
              <p className="text-lg md:text-xl opacity-90 mb-8 max-w-xl leading-relaxed">
                {site.heroSubheadline}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/find-grave`}
                style={{
                  background: "hsl(var(--site-primary))",
                  color: "hsl(var(--site-primary-fg))",
                  borderRadius: "var(--site-radius)",
                }}
                className="inline-flex items-center gap-2 px-6 py-3 font-semibold hover:opacity-90 transition-opacity"
                data-testid="hero-cta-find"
              >
                <Search className="h-4 w-4" />
                Find a Grave
              </Link>
              <Link
                href={`/marketplace`}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.4)",
                  borderRadius: "var(--site-radius)",
                  backdropFilter: "blur(8px)",
                }}
                className="inline-flex items-center gap-2 px-6 py-3 font-semibold hover:bg-white/25 transition-colors"
                data-testid="hero-cta-shop"
              >
                <ShoppingBag className="h-4 w-4" />
                Browse Marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="container mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div
                style={{ color: "hsl(var(--site-primary))" }}
                className="text-xs uppercase tracking-widest font-semibold mb-2"
              >
                Featured
              </div>
              <h2 style={headingFont} className="text-3xl md:text-4xl font-semibold">
                Memorial Services & Products
              </h2>
            </div>
            <Link
              href={`/marketplace`}
              style={{ color: "hsl(var(--site-primary))" }}
              className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold hover:opacity-80"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((p) => (
              <Link
                key={p.id}
                href={`/marketplace/${p.slug}`}
                data-testid={`featured-product-${p.slug}`}
                style={{
                  background: "hsl(var(--site-card))",
                  border: "1px solid hsl(var(--site-border))",
                  borderRadius: "var(--site-radius)",
                }}
                className="group overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
              >
                <div
                  style={{
                    background: p.photos[0]
                      ? `url(${p.photos[0]}) center/cover`
                      : "hsl(var(--site-muted))",
                    aspectRatio: "4/3",
                  }}
                />
                <div className="p-5 flex flex-col flex-1">
                  <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "hsl(var(--site-muted-fg))" }}>
                    {p.type === "service" ? "Service" : "Product"}
                  </div>
                  <h3 style={headingFont} className="text-lg font-semibold mb-2">
                    {p.name}
                  </h3>
                  {p.shortDescription ? (
                    <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-sm mb-4 flex-1">
                      {p.shortDescription}
                    </p>
                  ) : null}
                  <div className="text-lg font-semibold" style={{ color: "hsl(var(--site-primary))" }}>
                    ${p.price.toFixed(2)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Interactive map + QR memorial discovery cards. These two surfaces
          are how visitors navigate from a name or a phone-scan into the
          orderable parts of the site (flowers, headstone care, QR plaque). */}
      <section className="container mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href={`/map`}
            data-testid="discover-map"
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="group p-7 md:p-8 hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-start gap-5"
          >
            <div
              style={{
                background: "hsl(var(--site-primary))",
                color: "hsl(var(--site-primary-fg))",
                borderRadius: "var(--site-radius)",
              }}
              className="h-12 w-12 shrink-0 flex items-center justify-center"
            >
              <MapIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                style={{ color: "hsl(var(--site-primary))" }}
                className="text-[10px] uppercase tracking-widest font-semibold mb-2"
              >
                Visit the grounds
              </div>
              <h3 style={headingFont} className="text-xl md:text-2xl font-semibold mb-2">
                Interactive cemetery map
              </h3>
              <p
                style={{ color: "hsl(var(--site-muted-fg))" }}
                className="text-sm md:text-base leading-relaxed mb-3"
              >
                Browse our sections, see plot availability, and order flowers,
                maintenance, or memorial services for any plot.
              </p>
              <span
                style={{ color: "hsl(var(--site-primary))" }}
                className="inline-flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all"
              >
                Open the map <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
          <div
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="p-7 md:p-8 flex items-start gap-5"
            data-testid="discover-qr"
          >
            <div
              style={{
                background: "hsl(var(--site-muted))",
                color: "hsl(var(--site-primary))",
                borderRadius: "var(--site-radius)",
              }}
              className="h-12 w-12 shrink-0 flex items-center justify-center"
            >
              <ScanLine className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                style={{ color: "hsl(var(--site-primary))" }}
                className="text-[10px] uppercase tracking-widest font-semibold mb-2"
              >
                Memorial QR codes
              </div>
              <h3 style={headingFont} className="text-xl md:text-2xl font-semibold mb-2">
                A scannable tribute at every grave
              </h3>
              <p
                style={{ color: "hsl(var(--site-muted-fg))" }}
                className="text-sm md:text-base leading-relaxed mb-3"
              >
                Each headstone can carry a weatherproof QR plaque. A scan opens
                the loved one's photos, life story, and lifespan — anytime, in
                any language. Order a plaque from our marketplace.
              </p>
              <Link
                href={`/marketplace`}
                style={{ color: "hsl(var(--site-primary))" }}
                className="inline-flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
              >
                Order a QR plaque <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {site.aboutText ? (
        <section
          style={{ background: "hsl(var(--site-muted))" }}
          className="py-16"
          data-testid="about-section"
        >
          <div className="container mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <div
              style={{ color: "hsl(var(--site-primary))" }}
              className="text-xs uppercase tracking-widest font-semibold mb-3"
            >
              About
            </div>
            <h2 style={headingFont} className="text-3xl md:text-4xl font-semibold mb-6">
              Our Heritage
            </h2>
            <p
              style={{ color: "hsl(var(--site-fg))" }}
              className="text-lg leading-relaxed whitespace-pre-line"
            >
              {site.aboutText}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
