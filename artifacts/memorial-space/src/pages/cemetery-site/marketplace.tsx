import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ShoppingBag, Tag, MapPin, Heart, X } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicProducts, type PublicSite } from "./api";

type Props = { slug: string; site: PublicSite };

// Order context propagated from the cemetery map / memorial pages via
// query string. We persist it to sessionStorage so it survives drilling
// into a product detail page and back, and the cart picks it up to
// prefill the customer notes ("[For Jane Doe — Plot A-12-007] …").
const ORDER_CONTEXT_KEY = (slug: string) => `cemetery-order-context:${slug}`;

type OrderContext = { for?: string; plotRef?: string; memorialCode?: string };

function readOrderContext(slug: string): OrderContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORDER_CONTEXT_KEY(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as OrderContext;
  } catch {
    /* ignore */
  }
  return null;
}

function writeOrderContext(slug: string, ctx: OrderContext | null) {
  if (typeof window === "undefined") return;
  try {
    if (ctx === null) {
      window.sessionStorage.removeItem(ORDER_CONTEXT_KEY(slug));
    } else {
      window.sessionStorage.setItem(ORDER_CONTEXT_KEY(slug), JSON.stringify(ctx));
    }
  } catch {
    /* ignore — storage disabled, context simply doesn't persist */
  }
}

export function CemeterySiteMarketplace({ slug, site }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  const [category, setCategory] = useState<string | null>(null);
  const { data, isLoading } = usePublicProducts(slug, category);
  const products = data?.products ?? [];
  const categories = data?.categories ?? [];

  // On first mount: pull `?for=` and `?plotRef=` off the URL into
  // sessionStorage. We strip them from the URL afterwards so a back/refresh
  // doesn't repaint the banner stale-y when the user has cleared it.
  const [orderCtx, setOrderCtx] = useState<OrderContext | null>(() =>
    readOrderContext(slug),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const forName = params.get("for");
    const plotRef = params.get("plotRef");
    // Memorial code lets the cart back-link the order to a specific burial
    // server-side, so the cemetery's CRM sees all tributes (virtual + real)
    // for one person in a single view.
    const memorialCode = params.get("memorialCode");
    if (forName || plotRef || memorialCode) {
      const ctx: OrderContext = {
        for: forName ?? undefined,
        plotRef: plotRef ?? undefined,
        memorialCode: memorialCode ?? undefined,
      };
      writeOrderContext(slug, ctx);
      setOrderCtx(ctx);
      params.delete("for");
      params.delete("plotRef");
      params.delete("memorialCode");
      const next = params.toString();
      const url = window.location.pathname + (next ? `?${next}` : "");
      window.history.replaceState({}, "", url);
    }
  }, [slug]);

  const clearOrderCtx = () => {
    writeOrderContext(slug, null);
    setOrderCtx(null);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16">
      <div className="text-center mb-10">
        <div
          style={{ color: "hsl(var(--site-primary))" }}
          className="text-xs uppercase tracking-widest font-semibold mb-3"
        >
          Marketplace
        </div>
        <h1 style={headingFont} className="text-4xl md:text-5xl font-semibold mb-3">
          Memorial Services & Products
        </h1>
        <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-lg max-w-xl mx-auto">
          Browse our offerings. Submit an order request and we'll be in touch.
        </p>
      </div>

      {orderCtx && (orderCtx.for || orderCtx.plotRef) ? (
        <div
          data-testid="order-context-banner"
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-primary))",
            borderRadius: "var(--site-radius)",
          }}
          className="max-w-2xl mx-auto mb-8 p-4 flex items-start gap-3"
        >
          <Heart
            className="h-5 w-5 mt-0.5 shrink-0"
            style={{ color: "hsl(var(--site-primary))" }}
          />
          <div className="flex-1 min-w-0">
            <div
              style={{ color: "hsl(var(--site-primary))" }}
              className="text-xs uppercase tracking-wider font-semibold mb-1"
            >
              Ordering for a loved one
            </div>
            <div className="text-sm" style={{ color: "hsl(var(--site-fg))" }}>
              {orderCtx.for ? <strong>{orderCtx.for}</strong> : null}
              {orderCtx.for && orderCtx.plotRef ? " · " : null}
              {orderCtx.plotRef ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Plot {orderCtx.plotRef}
                </span>
              ) : null}
            </div>
            <p
              className="text-xs mt-1"
              style={{ color: "hsl(var(--site-muted-fg))" }}
            >
              We'll add this to your order notes so the cemetery team knows
              who and where this is for.
            </p>
          </div>
          <button
            onClick={clearOrderCtx}
            aria-label="Clear order context"
            className="p-1 rounded hover:bg-black/5 shrink-0"
            style={{ color: "hsl(var(--site-muted-fg))" }}
            data-testid="clear-order-context"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {categories.length > 0 ? (
        <div
          className="flex flex-wrap gap-2 justify-center mb-10"
          data-testid="category-filter"
        >
          <button
            onClick={() => setCategory(null)}
            data-testid="category-all"
            style={{
              background: category === null ? "hsl(var(--site-primary))" : "hsl(var(--site-card))",
              color:
                category === null
                  ? "hsl(var(--site-primary-fg))"
                  : "hsl(var(--site-fg))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.slug)}
              data-testid={`category-${c.slug}`}
              style={{
                background:
                  category === c.slug ? "hsl(var(--site-primary))" : "hsl(var(--site-card))",
                color:
                  category === c.slug
                    ? "hsl(var(--site-primary-fg))"
                    : "hsl(var(--site-fg))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Tag className="h-3.5 w-3.5" />
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-center py-12">
          Loading…
        </p>
      ) : products.length === 0 ? (
        <div
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-16 text-center"
          data-testid="empty-marketplace"
        >
          <ShoppingBag
            className="h-12 w-12 mx-auto mb-4 opacity-40"
            style={{ color: "hsl(var(--site-muted-fg))" }}
          />
          <p style={{ color: "hsl(var(--site-muted-fg))" }}>
            No items available in this category yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/marketplace/${p.slug}`}
              data-testid={`product-card-${p.slug}`}
              style={{
                background: "hsl(var(--site-card))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="group overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5 flex flex-col"
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
                <div
                  className="text-xs uppercase tracking-wider mb-2"
                  style={{ color: "hsl(var(--site-muted-fg))" }}
                >
                  {p.type === "service" ? "Service" : "Product"}
                </div>
                <h3 style={headingFont} className="text-lg font-semibold mb-2">
                  {p.name}
                </h3>
                {p.shortDescription ? (
                  <p
                    style={{ color: "hsl(var(--site-muted-fg))" }}
                    className="text-sm mb-4 flex-1 line-clamp-2"
                  >
                    {p.shortDescription}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-lg font-semibold"
                    style={{ color: "hsl(var(--site-primary))" }}
                  >
                    ${p.price.toFixed(2)}
                  </span>
                  {p.compareAtPrice && p.compareAtPrice > p.price ? (
                    <span
                      className="text-sm line-through"
                      style={{ color: "hsl(var(--site-muted-fg))" }}
                    >
                      ${p.compareAtPrice.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
