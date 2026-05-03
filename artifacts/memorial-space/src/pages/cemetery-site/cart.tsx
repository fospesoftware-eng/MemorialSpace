import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { useCart } from "./cart-store";
import { useSubmitOrder, type PublicSite } from "./api";

type Props = { slug: string; site: PublicSite };

// Mirrors the marketplace's order-context storage. We read it here to
// prefill the customer-notes textarea so the operator immediately knows
// which plot/loved-one this order is for.
const ORDER_CONTEXT_KEY = (slug: string) => `cemetery-order-context:${slug}`;

function readOrderContext(slug: string): { for?: string; plotRef?: string; memorialCode?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORDER_CONTEXT_KEY(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function buildContextPrefill(ctx: { for?: string; plotRef?: string } | null): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.for) parts.push(`For ${ctx.for}`);
  if (ctx.plotRef) parts.push(`Plot ${ctx.plotRef}`);
  return parts.length ? `[${parts.join(" — ")}] ` : "";
}

export function CemeterySiteCart({ slug, site }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  const { items, setQuantity, remove, clear, subtotal } = useCart(slug);
  const submit = useSubmitOrder(slug);
  const [, setLocation] = useLocation();

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerNotes: "",
  });

  // Prefill notes from the order context exactly once. Guarded by both
  // a ref-style flag and an emptiness check on the existing notes so
  // we never overwrite something the visitor already typed.
  const [hasPrefilled, setHasPrefilled] = useState(false);
  useEffect(() => {
    if (hasPrefilled) return;
    const ctx = readOrderContext(slug);
    const prefill = buildContextPrefill(ctx);
    if (prefill) {
      setForm((f) =>
        f.customerNotes.trim().length === 0 ? { ...f, customerNotes: prefill } : f,
      );
    }
    setHasPrefilled(true);
  }, [slug, hasPrefilled]);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    background: "hsl(var(--site-bg))",
    color: "hsl(var(--site-fg))",
    border: "1px solid hsl(var(--site-border))",
    borderRadius: "var(--site-radius)",
    fontFamily: theme.fontBody,
  };

  const isValid =
    form.customerName.trim().length >= 1 &&
    /.+@.+\..+/.test(form.customerEmail) &&
    items.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValid) return;
    // Pull the memorial code out of the persisted order context so the
    // server can back-link this order to the burial. We prefer the freshly
    // read value over a stale closure capture.
    const ctx = readOrderContext(slug);
    submit.mutate(
      {
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim() || null,
        customerNotes: form.customerNotes.trim() || null,
        memorialCode: ctx?.memorialCode ?? null,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      },
      {
        onSuccess: (data) => {
          clear();
          setLocation(`/order/${data.orderNumber}`);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to submit order");
        },
      },
    );
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
        <ShoppingBag
          className="h-16 w-16 mx-auto mb-6 opacity-40"
          style={{ color: "hsl(var(--site-muted-fg))" }}
        />
        <h1 style={headingFont} className="text-3xl md:text-4xl font-semibold mb-3">
          Your cart is empty
        </h1>
        <p style={{ color: "hsl(var(--site-muted-fg))" }} className="mb-8">
          Browse our marketplace to find services and products.
        </p>
        <Link
          href={`/marketplace`}
          style={{
            background: "hsl(var(--site-primary))",
            color: "hsl(var(--site-primary-fg))",
            borderRadius: "var(--site-radius)",
          }}
          className="inline-flex items-center gap-2 px-6 py-3 font-semibold hover:opacity-90 transition-opacity"
        >
          Browse marketplace
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <h1 style={headingFont} className="text-3xl md:text-4xl font-semibold mb-8">
        Your Order
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div
              key={item.productId}
              data-testid={`cart-item-${item.productId}`}
              style={{
                background: "hsl(var(--site-card))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="p-4 flex gap-4 items-center"
            >
              <div
                style={{
                  background: item.photoUrl
                    ? `url(${item.photoUrl}) center/cover`
                    : "hsl(var(--site-muted))",
                  width: "72px",
                  height: "72px",
                  borderRadius: "var(--site-radius)",
                }}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div style={headingFont} className="font-semibold truncate">
                  {item.name}
                </div>
                <div style={{ color: "hsl(var(--site-muted-fg))" }} className="text-sm">
                  ${item.price.toFixed(2)} each
                </div>
              </div>
              <div
                className="flex items-center"
                style={{ border: "1px solid hsl(var(--site-border))", borderRadius: "var(--site-radius)" }}
              >
                <button
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  className="px-2.5 py-2 hover:opacity-70"
                  data-testid={`button-qty-minus-${item.productId}`}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="px-3 font-semibold w-8 text-center text-sm">
                  {item.quantity}
                </span>
                <button
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  className="px-2.5 py-2 hover:opacity-70"
                  data-testid={`button-qty-plus-${item.productId}`}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="text-right hidden sm:block w-20">
                <div className="font-semibold" style={{ color: "hsl(var(--site-primary))" }}>
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => remove(item.productId)}
                className="p-2 hover:opacity-70"
                style={{ color: "hsl(var(--site-muted-fg))" }}
                aria-label="Remove"
                data-testid={`button-remove-${item.productId}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-6 space-y-4 self-start"
        >
          <h2 style={headingFont} className="text-xl font-semibold">
            Your Details
          </h2>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              Full name <span style={{ color: "hsl(var(--site-primary))" }}>*</span>
            </label>
            <input
              required
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              data-testid="input-customer-name"
              style={inputStyle}
              className="w-full h-10 px-3 outline-none focus:ring-2 focus:ring-offset-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              Email <span style={{ color: "hsl(var(--site-primary))" }}>*</span>
            </label>
            <input
              required
              type="email"
              value={form.customerEmail}
              onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
              data-testid="input-customer-email"
              style={inputStyle}
              className="w-full h-10 px-3 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Phone</label>
            <input
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              data-testid="input-customer-phone"
              style={inputStyle}
              className="w-full h-10 px-3 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Notes</label>
            <textarea
              value={form.customerNotes}
              onChange={(e) => setForm((f) => ({ ...f, customerNotes: e.target.value }))}
              data-testid="input-customer-notes"
              style={inputStyle}
              rows={3}
              className="w-full px-3 py-2 outline-none"
              placeholder="Plot ID, delivery date, special instructions…"
            />
          </div>

          <div
            className="pt-4 mt-4 space-y-2"
            style={{ borderTop: "1px solid hsl(var(--site-border))" }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: "hsl(var(--site-muted-fg))" }}>Subtotal</span>
              <span data-testid="cart-subtotal">${subtotal.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between text-lg font-semibold"
              style={{ color: "hsl(var(--site-primary))" }}
            >
              <span>Total</span>
              <span data-testid="cart-total">${subtotal.toFixed(2)}</span>
            </div>
          </div>

          {error ? (
            <div
              className="text-sm p-3 rounded"
              style={{ background: "rgba(220, 38, 38, 0.1)", color: "rgb(185, 28, 28)" }}
              data-testid="error-message"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!isValid || submit.isPending}
            data-testid="button-submit-order"
            style={{
              background: "hsl(var(--site-primary))",
              color: "hsl(var(--site-primary-fg))",
              borderRadius: "var(--site-radius)",
              opacity: !isValid || submit.isPending ? 0.6 : 1,
              cursor: !isValid || submit.isPending ? "not-allowed" : "pointer",
            }}
            className="w-full py-3 font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          >
            {submit.isPending ? "Submitting…" : "Submit order request"}
          </button>
          <p
            className="text-xs text-center"
            style={{ color: "hsl(var(--site-muted-fg))" }}
          >
            We'll review your request and contact you to confirm and arrange payment.
          </p>
        </form>
      </div>
    </div>
  );
}
