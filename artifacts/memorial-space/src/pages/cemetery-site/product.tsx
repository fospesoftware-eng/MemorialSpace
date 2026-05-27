import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Plus, Minus, ShoppingBag, CreditCard } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicProduct, type PublicSite } from "./api";
import { useCart } from "./cart-store";

type Props = { slug: string; site: PublicSite; productSlug: string };

export function CemeterySiteProduct({ slug, site, productSlug }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  const { data: product, isLoading, isError } = usePublicProduct(slug, productSlug);
  const { add } = useCart(slug);
  const [qty, setQty] = useState(1);
  const [activePhoto, setActivePhoto] = useState(0);
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-16 text-center">
        <p style={{ color: "hsl(var(--site-muted-fg))" }}>Loading…</p>
      </div>
    );
  }
  if (isError || !product) {
    return (
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-16 text-center">
        <h1 style={headingFont} className="text-3xl font-semibold mb-3">
          Product not found
        </h1>
        <Link
          href={`/marketplace`}
          style={{ color: "hsl(var(--site-primary))" }}
          className="hover:underline"
        >
          ← Back to marketplace
        </Link>
      </div>
    );
  }

  const photo = product.photos[activePhoto] ?? product.photos[0] ?? null;

  return (
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-12">
      <Link
        href={`/marketplace`}
        style={{ color: "hsl(var(--site-muted-fg))" }}
        className="inline-flex items-center gap-1 text-sm hover:opacity-80 mb-6"
        data-testid="link-back"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to marketplace
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <div
            style={{
              background: photo
                ? `url(${photo}) center/cover`
                : "hsl(var(--site-muted))",
              aspectRatio: "1",
              borderRadius: "var(--site-radius)",
              border: "1px solid hsl(var(--site-border))",
            }}
            data-testid="product-photo-main"
          />
          {product.photos.length > 1 ? (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {product.photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  style={{
                    background: `url(${p}) center/cover`,
                    width: "72px",
                    height: "72px",
                    borderRadius: "var(--site-radius)",
                    border:
                      i === activePhoto
                        ? "2px solid hsl(var(--site-primary))"
                        : "1px solid hsl(var(--site-border))",
                  }}
                  className="shrink-0"
                  data-testid={`product-thumb-${i}`}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <div
            className="text-xs uppercase tracking-widest font-semibold mb-3"
            style={{ color: "hsl(var(--site-primary))" }}
          >
            {product.type === "service" ? "Service" : "Product"}
          </div>
          <h1
            style={headingFont}
            className="text-3xl md:text-4xl font-semibold mb-4"
            data-testid="product-name"
          >
            {product.name}
          </h1>
          <div className="flex items-baseline gap-3 mb-6">
            <span
              className="text-3xl font-semibold"
              style={{ color: "hsl(var(--site-primary))" }}
              data-testid="product-price"
            >
              ${product.price.toFixed(2)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price ? (
              <span
                className="text-lg line-through"
                style={{ color: "hsl(var(--site-muted-fg))" }}
              >
                ${product.compareAtPrice.toFixed(2)}
              </span>
            ) : null}
          </div>
          {product.shortDescription ? (
            <p
              className="text-base mb-4"
              style={{ color: "hsl(var(--site-fg))" }}
            >
              {product.shortDescription}
            </p>
          ) : null}
          {product.description ? (
            <p
              className="text-sm leading-relaxed whitespace-pre-line mb-6"
              style={{ color: "hsl(var(--site-muted-fg))" }}
            >
              {product.description}
            </p>
          ) : null}

          <div
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <span style={{ color: "hsl(var(--site-muted-fg))" }} className="text-sm">
                Quantity
              </span>
              <div
                className="flex items-center"
                style={{ border: "1px solid hsl(var(--site-border))", borderRadius: "var(--site-radius)" }}
              >
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:opacity-70"
                  data-testid="button-qty-minus"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="px-4 font-semibold w-10 text-center" data-testid="text-qty">
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(99, q + 1))}
                  className="px-3 py-2 hover:opacity-70"
                  data-testid="button-qty-plus"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                add(
                  {
                    productId: product.id,
                    productSlug: product.slug,
                    name: product.name,
                    price: product.price,
                    photoUrl: product.photos[0] ?? null,
                  },
                  qty,
                );
                setLocation(`/cart`);
              }}
              data-testid="button-add-to-cart"
              style={{
                background: "hsl(var(--site-primary))",
                color: "hsl(var(--site-primary-fg))",
                borderRadius: "var(--site-radius)",
              }}
              className="w-full py-3 font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <ShoppingBag className="h-4 w-4" />
              Add to cart
            </button>
            {product.stripeEnabled && site.stripeAvailable ? null : product.stripeEnabled ? (
              <div
                className="text-xs flex items-center gap-2 px-3 py-2 rounded"
                style={{
                  background: "hsl(var(--site-muted))",
                  color: "hsl(var(--site-muted-fg))",
                }}
                data-testid="badge-stripe-coming-soon"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Online card payment coming soon — orders are confirmed by the cemetery.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
