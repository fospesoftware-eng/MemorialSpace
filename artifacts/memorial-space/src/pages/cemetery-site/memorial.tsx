import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, MapPin, Calendar, ScanLine, ShoppingBag, ImageOff } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicMemorial, type PublicSite } from "./api";

type Props = { slug: string; site: PublicSite; code: string };

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.valueOf())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtAge(dob: string | null | undefined, dod: string | null | undefined): number | null {
  if (!dob || !dod) return null;
  const start = new Date(dob);
  const end = new Date(dod);
  if (isNaN(start.valueOf()) || isNaN(end.valueOf())) return null;
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}

export function CemeterySiteMemorial({ slug, site, code }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  const { data: memorial, isLoading, isError } = usePublicMemorial(slug, code);
  const [activePhoto, setActivePhoto] = useState(0);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <p style={{ color: "hsl(var(--site-muted-fg))" }}>Loading memorial…</p>
      </div>
    );
  }

  if (isError || !memorial) {
    return (
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
        <h1 style={headingFont} className="text-3xl md:text-4xl font-semibold mb-3">
          Memorial not found
        </h1>
        <p style={{ color: "hsl(var(--site-muted-fg))" }} className="mb-8">
          This memorial may have been removed or the link may be incorrect.
        </p>
        <Link
          href={`/c/${slug}/find-grave`}
          style={{
            background: "hsl(var(--site-primary))",
            color: "hsl(var(--site-primary-fg))",
            borderRadius: "var(--site-radius)",
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          Search for a grave
        </Link>
      </div>
    );
  }

  const bornDate = fmtDate(memorial.bornDate);
  const diedDate = fmtDate(memorial.diedDate);
  const buriedDate = fmtDate(memorial.burialDate);
  const age = fmtAge(memorial.bornDate, memorial.diedDate);
  const yearsLine = `${memorial.bornDate?.slice(0, 4) ?? "—"} – ${memorial.diedDate?.slice(0, 4) ?? "—"}`;

  const heroPhoto = memorial.photos[activePhoto] ?? memorial.photos[0] ?? null;

  // Pre-fill the marketplace context so a "Order a QR Plaque" tap lands
  // on the marketplace with a banner and a notes prefill on the cart.
  const orderHref = (() => {
    const params = new URLSearchParams();
    params.set("for", memorial.deceasedName);
    if (memorial.plotLabel) params.set("plotRef", memorial.plotLabel);
    return `/c/${slug}/marketplace?${params.toString()}`;
  })();

  return (
    <div>
      {/* Hero */}
      <section
        style={{
          background: "hsl(var(--site-muted))",
          borderBottom: "1px solid hsl(var(--site-border))",
        }}
        className="py-10 md:py-16"
      >
        <div className="container mx-auto max-w-5xl px-4 sm:px-6">
          <Link
            href={`/c/${slug}/find-grave`}
            style={{ color: "hsl(var(--site-muted-fg))" }}
            className="inline-flex items-center gap-1.5 text-xs font-medium mb-6 hover:opacity-80"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to find a grave
          </Link>
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 items-center">
            <div
              style={{
                background: heroPhoto
                  ? `url(${heroPhoto}) center/cover`
                  : "hsl(var(--site-card))",
                aspectRatio: "1 / 1",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="w-full max-w-[280px] mx-auto md:mx-0 flex items-center justify-center"
              data-testid="memorial-portrait"
            >
              {!heroPhoto ? (
                <ImageOff
                  className="h-12 w-12 opacity-30"
                  style={{ color: "hsl(var(--site-muted-fg))" }}
                />
              ) : null}
            </div>
            <div className="text-center md:text-left">
              <div
                className="text-xs uppercase tracking-widest font-semibold mb-3 inline-flex items-center gap-1.5"
                style={{ color: "hsl(var(--site-primary))" }}
              >
                <ScanLine className="h-3 w-3" />
                In Memory Of
              </div>
              <h1
                style={headingFont}
                className="text-4xl md:text-5xl font-semibold mb-3 leading-tight"
                data-testid="memorial-name"
              >
                {memorial.deceasedName}
              </h1>
              <p
                style={{ color: "hsl(var(--site-muted-fg))" }}
                className="text-lg md:text-xl mb-4"
              >
                {yearsLine}
                {age != null ? <span className="opacity-70"> · {age} years</span> : null}
              </p>
              <div
                style={{ color: "hsl(var(--site-muted-fg))" }}
                className="flex flex-wrap gap-x-5 gap-y-2 text-sm justify-center md:justify-start"
              >
                {memorial.plotLabel ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Plot {memorial.plotLabel}
                    {memorial.plotSection
                      ? ` · ${/^section\b/i.test(memorial.plotSection) ? memorial.plotSection : `Section ${memorial.plotSection}`}`
                      : ""}
                  </span>
                ) : null}
                {buriedDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Interred {buriedDate}
                  </span>
                ) : null}
                {memorial.religion ? (
                  <span
                    className="capitalize inline-flex items-center gap-1.5 px-2 py-0.5 text-xs"
                    style={{
                      background: "hsl(var(--site-card))",
                      border: "1px solid hsl(var(--site-border))",
                      borderRadius: "var(--site-radius)",
                    }}
                  >
                    {memorial.religion}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photo gallery */}
      {memorial.photos.length > 1 ? (
        <section className="container mx-auto max-w-5xl px-4 sm:px-6 py-10">
          <div className="flex flex-wrap gap-2 justify-center">
            {memorial.photos.map((url, i) => (
              <button
                key={`${url}-${i}`}
                onClick={() => setActivePhoto(i)}
                data-testid={`memorial-photo-${i}`}
                style={{
                  background: `url(${url}) center/cover`,
                  border:
                    activePhoto === i
                      ? "2px solid hsl(var(--site-primary))"
                      : "2px solid hsl(var(--site-border))",
                  borderRadius: "var(--site-radius)",
                  width: "72px",
                  height: "72px",
                }}
                aria-label={`View photo ${i + 1}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Lifespan + biography */}
      <section className="container mx-auto max-w-3xl px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="p-5"
          >
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "hsl(var(--site-primary))" }}>
              Born
            </div>
            <div style={headingFont} className="text-base font-semibold">
              {bornDate ?? "—"}
            </div>
          </div>
          <div
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="p-5"
          >
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "hsl(var(--site-primary))" }}>
              Passed
            </div>
            <div style={headingFont} className="text-base font-semibold">
              {diedDate ?? "—"}
            </div>
          </div>
          <div
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="p-5"
          >
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "hsl(var(--site-primary))" }}>
              Resting
            </div>
            <div style={headingFont} className="text-base font-semibold">
              {memorial.plotLabel ? `Plot ${memorial.plotLabel}` : "—"}
            </div>
          </div>
        </div>

        {memorial.biography ? (
          <article data-testid="memorial-biography">
            <h2 style={headingFont} className="text-2xl md:text-3xl font-semibold mb-5 text-center">
              Their Story
            </h2>
            <p
              className="whitespace-pre-line leading-relaxed text-base md:text-lg"
              style={{ color: "hsl(var(--site-fg))" }}
            >
              {memorial.biography}
            </p>
          </article>
        ) : (
          <p
            className="text-center italic"
            style={{ color: "hsl(var(--site-muted-fg))" }}
          >
            A biography for {memorial.deceasedName} hasn't been added yet.
          </p>
        )}
      </section>

      {/* Order CTA — encourages QR plaque + memorial-services purchases */}
      <section
        style={{
          background: "hsl(var(--site-muted))",
          borderTop: "1px solid hsl(var(--site-border))",
        }}
        className="py-12 md:py-16"
      >
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <h2 style={headingFont} className="text-2xl md:text-3xl font-semibold mb-3">
            Honour their memory
          </h2>
          <p
            style={{ color: "hsl(var(--site-muted-fg))" }}
            className="mb-8 max-w-xl mx-auto"
          >
            Order a printed QR plaque, fresh flowers, headstone care, or a
            memorial service from {site.organizationName}. We'll be in touch
            to confirm details.
          </p>
          <Link
            href={orderHref}
            data-testid="order-from-memorial"
            style={{
              background: "hsl(var(--site-primary))",
              color: "hsl(var(--site-primary-fg))",
              borderRadius: "var(--site-radius)",
            }}
            className="inline-flex items-center gap-2 px-6 py-3 font-semibold hover:opacity-90 transition-opacity"
          >
            <ShoppingBag className="h-4 w-4" />
            Browse memorial marketplace
          </Link>
        </div>
      </section>
    </div>
  );
}
