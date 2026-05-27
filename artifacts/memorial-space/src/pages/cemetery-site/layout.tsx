import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, ShoppingBag, Home, MapPin, Mail, Phone, Clock, Eye, Map as MapIcon } from "lucide-react";
import { THEMES, isThemeKey, applyPrimaryOverride, buildGoogleFontsHref, type ThemeKey } from "./themes";
import { useCart } from "./cart-store";
import type { PublicSite } from "./api";

type Props = {
  slug: string;
  site: PublicSite;
  children: React.ReactNode;
};

export function CemeterySiteLayout({ slug, site, children }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const vars = useMemo(
    () => applyPrimaryOverride(theme.vars, site.primaryColorOverride),
    [theme, site.primaryColorOverride],
  );
  const fontsHref = useMemo(() => buildGoogleFontsHref(theme), [theme]);
  const [location] = useLocation();
  const { totalQuantity } = useCart(slug);

  useEffect(() => {
    const id = "cemetery-site-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== fontsHref) link.href = fontsHref;
    document.title = `${site.siteTitle}`;
  }, [fontsHref, site.siteTitle]);

  const styleVars: React.CSSProperties = {
    ...(Object.fromEntries(Object.entries(vars)) as React.CSSProperties),
    backgroundColor: "hsl(var(--site-bg))",
    color: "hsl(var(--site-fg))",
    fontFamily: theme.fontBody,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  };

  const headingFont = { fontFamily: theme.fontHeading };

  const navItems = [
    { href: `/`, label: "Home", icon: Home },
    { href: `/find-grave`, label: "Find a Grave", icon: Search },
    { href: `/map`, label: "Cemetery Map", icon: MapIcon },
    { href: `/marketplace`, label: "Marketplace", icon: ShoppingBag },
  ];

  const isActive = (href: string) => {
    // `location` is relative to the cemetery-site nest base ("/c/<slug>"),
    // so it's "/", "/find-grave", "/marketplace", etc. Match exactly for
    // home; for sub-routes match either the exact path or the path
    // followed by "/" so "/map" never falsely flags "/map-foo".
    if (href === `/`) return location === "/" || location === "";
    return location === href || location.startsWith(href + "/");
  };

  return (
    <div data-cemetery-theme={themeKey} style={styleVars} className="cemetery-site">
      {site.isPreview ? (
        <div
          style={{
            background: "hsl(var(--site-primary))",
            color: "hsl(var(--site-primary-fg))",
            fontFamily: theme.fontBody,
          }}
          className="text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2"
        >
          <Eye className="h-3 w-3" />
          Preview mode — this site is not yet published.
        </div>
      ) : null}

      <header
        style={{
          background: "hsl(var(--site-card))",
          borderBottom: "1px solid hsl(var(--site-border))",
        }}
        className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-opacity-90"
      >
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link
              href={`/`}
              style={headingFont}
              className="text-xl font-semibold tracking-tight truncate"
            >
              {site.siteTitle}
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                    style={{
                      color: active ? "hsl(var(--site-primary))" : "hsl(var(--site-fg))",
                      borderRadius: "var(--site-radius)",
                    }}
                    className="px-3 py-2 text-sm font-medium hover:opacity-80 transition-opacity flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href={`/cart`}
                data-testid="nav-cart"
                style={{
                  background: "hsl(var(--site-primary))",
                  color: "hsl(var(--site-primary-fg))",
                  borderRadius: "var(--site-radius)",
                }}
                className="ml-2 px-4 py-2 text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <ShoppingBag className="h-4 w-4" />
                Cart
                {totalQuantity > 0 ? (
                  <span
                    style={{
                      background: "hsl(var(--site-primary-fg))",
                      color: "hsl(var(--site-primary))",
                    }}
                    className="text-xs font-bold rounded-full px-2 py-0.5 min-w-[1.5rem] text-center"
                  >
                    {totalQuantity}
                  </span>
                ) : null}
              </Link>
            </nav>
            <Link
              href={`/cart`}
              data-testid="nav-cart-mobile"
              style={{ color: "hsl(var(--site-primary))" }}
              className="md:hidden flex items-center gap-1.5 text-sm font-semibold"
            >
              <ShoppingBag className="h-5 w-5" />
              {totalQuantity > 0 ? <span>({totalQuantity})</span> : null}
            </Link>
          </div>
          <nav className="md:hidden flex items-center gap-1 pb-3 -mt-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    color: active ? "hsl(var(--site-primary))" : "hsl(var(--site-muted-fg))",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer
        style={{
          background: "hsl(var(--site-muted))",
          borderTop: "1px solid hsl(var(--site-border))",
          color: "hsl(var(--site-fg))",
          marginTop: "4rem",
        }}
      >
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div style={headingFont} className="text-lg font-semibold mb-3">
                {site.siteTitle}
              </div>
              {site.tagline ? (
                <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-sm">
                  {site.tagline}
                </p>
              ) : null}
            </div>
            <div>
              <div style={headingFont} className="text-sm font-semibold uppercase tracking-wider mb-3">
                Contact
              </div>
              <ul className="space-y-2 text-sm">
                {site.contactAddress ? (
                  <li className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--site-primary))" }} />
                    <span>{site.contactAddress}</span>
                  </li>
                ) : null}
                {site.contactPhone ? (
                  <li className="flex items-start gap-2">
                    <Phone className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--site-primary))" }} />
                    <a href={`tel:${site.contactPhone}`} className="hover:underline">
                      {site.contactPhone}
                    </a>
                  </li>
                ) : null}
                {site.contactEmail ? (
                  <li className="flex items-start gap-2">
                    <Mail className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--site-primary))" }} />
                    <a href={`mailto:${site.contactEmail}`} className="hover:underline">
                      {site.contactEmail}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
            <div>
              {site.openingHours ? (
                <>
                  <div style={headingFont} className="text-sm font-semibold uppercase tracking-wider mb-3">
                    Visiting Hours
                  </div>
                  <div className="text-sm whitespace-pre-line flex items-start gap-2">
                    <Clock className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--site-primary))" }} />
                    <span>{site.openingHours}</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid hsl(var(--site-border))",
              color: "hsl(var(--site-muted-fg))",
            }}
            className="mt-8 pt-6 text-xs text-center"
          >
            © {new Date().getFullYear()} {site.organizationName} · Powered by MemorialSpace
          </div>
        </div>
      </footer>
    </div>
  );
}
