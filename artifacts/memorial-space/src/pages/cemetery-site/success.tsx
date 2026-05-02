import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import type { PublicSite } from "./api";

type Props = { slug: string; site: PublicSite; orderNumber: string };

export function CemeterySiteSuccess({ slug, site, orderNumber }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };

  return (
    <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
      <CheckCircle2
        className="h-20 w-20 mx-auto mb-6"
        style={{ color: "hsl(var(--site-primary))" }}
      />
      <h1 style={headingFont} className="text-4xl md:text-5xl font-semibold mb-4">
        Thank you
      </h1>
      <p
        style={{ color: "hsl(var(--site-muted-fg))" }}
        className="text-lg mb-8 max-w-md mx-auto"
      >
        Your order request has been received. We'll be in touch within one business
        day to confirm details and arrange payment.
      </p>
      <div
        style={{
          background: "hsl(var(--site-card))",
          border: "1px solid hsl(var(--site-border))",
          borderRadius: "var(--site-radius)",
        }}
        className="inline-block px-6 py-4 mb-10"
        data-testid="order-confirmation"
      >
        <div
          className="text-xs uppercase tracking-widest font-semibold mb-1"
          style={{ color: "hsl(var(--site-muted-fg))" }}
        >
          Order number
        </div>
        <div
          className="text-2xl font-mono font-semibold"
          style={{ color: "hsl(var(--site-primary))" }}
          data-testid="order-number"
        >
          {orderNumber}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href={`/c/${slug}`}
          style={{
            background: "hsl(var(--site-primary))",
            color: "hsl(var(--site-primary-fg))",
            borderRadius: "var(--site-radius)",
          }}
          className="px-6 py-3 font-semibold hover:opacity-90 transition-opacity"
        >
          Back to home
        </Link>
        <Link
          href={`/c/${slug}/marketplace`}
          style={{
            border: "1px solid hsl(var(--site-border))",
            color: "hsl(var(--site-fg))",
            borderRadius: "var(--site-radius)",
          }}
          className="px-6 py-3 font-semibold hover:opacity-80 transition-opacity"
        >
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
