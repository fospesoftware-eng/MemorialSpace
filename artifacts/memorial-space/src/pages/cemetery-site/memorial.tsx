import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, MapPin, Calendar, ScanLine, ShoppingBag, ImageOff,
  Share2, Navigation, Pencil, Check, Copy, Lock, KeyRound,
} from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicMemorial, type PublicSite } from "./api";
import { DigitalRituals } from "./digital-rituals";
import { parseYouTubeId, youtubeEmbedUrl } from "./video-helpers";

type Props = { slug: string; site: PublicSite; code: string };

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.valueOf())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
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

// Build a Google Maps directions URL. Prefers exact lat/lng; falls back to
// the cemetery's street address. We use the universal "?api=1" form so it
// opens natively on iOS / Android maps apps and gracefully on desktop.
function directionsUrl(opts: { lat?: number | null; lng?: number | null; address?: string | null; cemeteryName?: string | null }): string | null {
  const { lat, lng, address, cemeteryName } = opts;
  if (typeof lat === "number" && typeof lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const target = [cemeteryName, address].filter(Boolean).join(", ");
  if (target) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
  }
  return null;
}

export function CemeterySiteMemorial({ slug, site, code }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  // PIN that the visitor types into the unlock prompt. We store it in
  // component state (not localStorage) — once unlocked, refresh re-prompts.
  // Threading the PIN into the query refetches with a fresh response.
  const [unlockPin, setUnlockPin] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [pinHint, setPinHint] = useState<string | null>(null);
  const { data: memorial, isLoading, isError, error } = usePublicMemorial(slug, code, unlockPin || undefined);
  const errorStatus = (error as Error & { status?: number } | undefined)?.status;
  const [activePhoto, setActivePhoto] = useState(0);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <p style={{ color: "hsl(var(--site-muted-fg))" }}>Loading memorial…</p>
      </div>
    );
  }

  if (isError || !memorial) {
    const tooMany = errorStatus === 429;
    return (
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
        <h1 style={headingFont} className="text-3xl md:text-4xl font-semibold mb-3">
          {tooMany ? "Too many PIN attempts" : "Memorial not found"}
        </h1>
        <p style={{ color: "hsl(var(--site-muted-fg))" }} className="mb-8">
          {tooMany
            ? "For everyone's safety we've paused PIN attempts on this memorial for a few minutes. Please try again shortly."
            : "This memorial may have been removed or the link may be incorrect."}
        </p>
        <Link
          href={`/find-grave`}
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

  // Submitting the unlock PIN — we just push it into state, react-query
  // refetches with the new key, and the response either flips `locked` to
  // false or keeps it true. We surface a "wrong PIN" hint when we tried a
  // PIN but the response is still locked.
  const submitUnlock = () => {
    const trimmed = pinDraft.trim();
    if (!trimmed) {
      setPinHint("Please enter the PIN issued by the cemetery.");
      return;
    }
    setUnlockPin(trimmed);
    setPinHint(null);
  };

  // Hard private gate — render a dedicated lock screen with the PIN input
  // and nothing else. We still expose the cemetery name so visitors know
  // they're at the right place; everything else is suppressed by the API.
  if (memorial.visibility === "private" && memorial.locked) {
    const triedPin = unlockPin.length > 0;
    return (
      <div className="container mx-auto max-w-md px-4 sm:px-6 py-16 md:py-24">
        <div
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-8 text-center"
          data-testid="memorial-private-gate"
        >
          <div
            style={{ background: "hsl(var(--site-muted))", color: "hsl(var(--site-primary))", borderRadius: "var(--site-radius)" }}
            className="h-14 w-14 mx-auto mb-4 flex items-center justify-center"
          >
            <Lock className="h-6 w-6" />
          </div>
          <h1 style={headingFont} className="text-2xl font-semibold mb-2">
            Private memorial
          </h1>
          <p className="text-sm mb-6" style={{ color: "hsl(var(--site-muted-fg))" }}>
            The family has chosen to keep this memorial private.
            {memorial.cemeteryName ? <> Enter the PIN issued by {memorial.cemeteryName} to view it.</> : <> Enter the PIN to continue.</>}
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={pinDraft}
            onChange={(e) => { setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 12)); setPinHint(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") submitUnlock(); }}
            placeholder="6-digit PIN"
            data-testid="memorial-unlock-pin"
            style={{
              background: "hsl(var(--site-muted))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
              color: "hsl(var(--site-fg))",
              letterSpacing: "0.2em",
            }}
            className="w-full px-4 py-3 text-base font-mono text-center mb-3"
          />
          <button
            onClick={submitUnlock}
            data-testid="memorial-unlock-submit"
            style={{
              background: "hsl(var(--site-primary))",
              color: "hsl(var(--site-primary-fg))",
              borderRadius: "var(--site-radius)",
            }}
            className="w-full px-4 py-2.5 text-sm font-semibold hover:opacity-90"
          >
            <KeyRound className="h-3.5 w-3.5 inline -mt-0.5 mr-1.5" />
            Unlock memorial
          </button>
          {pinHint ? (
            <p className="text-xs mt-3" style={{ color: "#c0392b" }}>{pinHint}</p>
          ) : triedPin ? (
            <p className="text-xs mt-3" style={{ color: "#c0392b" }} data-testid="memorial-unlock-error">
              That PIN doesn't match. Please double-check with the cemetery.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const bornDate = fmtDate(memorial.bornDate);
  const diedDate = fmtDate(memorial.diedDate);
  const buriedDate = fmtDate(memorial.burialDate);
  const age = fmtAge(memorial.bornDate, memorial.diedDate);
  const yearsLine = `${memorial.bornDate?.slice(0, 4) ?? "—"} – ${memorial.diedDate?.slice(0, 4) ?? "—"}`;
  // Soft gate — visibility is "basic" and the visitor hasn't supplied the
  // PIN, so the API stripped bio/photos. We render the basic info but show
  // an unlock card where the rich content would have been.
  const richLocked = memorial.locked && memorial.visibility === "basic";
  const triedPinRich = richLocked && unlockPin.length > 0;

  const heroPhoto = memorial.photos[activePhoto] ?? memorial.photos[0] ?? null;

  const orderHref = (() => {
    const params = new URLSearchParams();
    params.set("for", memorial.deceasedName ?? "Memorial");
    if (memorial.plotLabel) params.set("plotRef", memorial.plotLabel);
    // Pass the QR code so the cart can back-link the order to this burial
    // server-side — same code that resolves the memorial on this page.
    params.set("memorialCode", code);
    // Carry the deceased's dates so the marketplace can offer
    // "death anniversary" and "birthday" delivery options without an
    // extra API round-trip on the cart page.
    if (memorial.bornDate) params.set("bornDate", memorial.bornDate);
    if (memorial.diedDate) params.set("diedDate", memorial.diedDate);
    return `/marketplace?${params.toString()}`;
  })();

  const directions = directionsUrl({
    lat: memorial.plotLatitude,
    lng: memorial.plotLongitude,
    address: memorial.cemeteryAddress,
    cemeteryName: memorial.cemeteryName,
  });

  const shareTitle = `In memory of ${memorial.deceasedName ?? "a loved one"}`;
  const shareText = `${memorial.deceasedName ?? "Memorial"} (${yearsLine}) — visit their memorial page.`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignored
    }
  };

  // Shared bits used by every hero variant. Pulling them up here keeps
  // each layout's JSX focused on its arrangement, not the data wiring.
  const backLink = (
    <Link
      href={`/find-grave`}
      style={{ color: "hsl(var(--site-muted-fg))" }}
      className="inline-flex items-center gap-1.5 text-xs font-medium hover:opacity-80"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to find a grave
    </Link>
  );

  // Action toolbar — share / directions / edit. Rendered identically by
  // every layout but positioned differently, so we factor it out.
  const actions = (variant: "solid" | "ghost-on-image" = "solid") => {
    const primaryStyle =
      variant === "ghost-on-image"
        ? { background: "rgba(255,255,255,0.95)", color: "hsl(var(--site-fg))", borderRadius: "var(--site-radius)" }
        : { background: "hsl(var(--site-primary))", color: "hsl(var(--site-primary-fg))", borderRadius: "var(--site-radius)" };
    const secondaryStyle =
      variant === "ghost-on-image"
        ? { background: "rgba(0,0,0,0.45)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "var(--site-radius)" }
        : { background: "hsl(var(--site-card))", color: "hsl(var(--site-fg))", border: "1px solid hsl(var(--site-border))", borderRadius: "var(--site-radius)" };
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleShare}
          data-testid="memorial-share"
          style={primaryStyle}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {copied ? "Link copied" : "Share"}
        </button>
        {directions ? (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="memorial-directions"
            style={secondaryStyle}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold hover:opacity-90"
          >
            <Navigation className="h-3.5 w-3.5" />
            Get directions
          </a>
        ) : null}
        <Link
          href={`/memorial/${code}/edit`}
          data-testid="memorial-edit"
          style={secondaryStyle}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit memorial
        </Link>
      </div>
    );
  };

  // Plot / interred / religion meta strip. Rendered as inline pills or as
  // a centered row depending on the layout.
  const metaBadges = (align: "left" | "center" = "left") => (
    <div
      style={{ color: "hsl(var(--site-muted-fg))" }}
      className={`flex flex-wrap gap-x-5 gap-y-2 text-sm ${align === "center" ? "justify-center" : "justify-center md:justify-start"}`}
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
  );

  // -------- Per-layout hero renderers ----------------------------------
  // Each variant is responsible for rendering: the back link, the
  // portrait (carrying data-testid="memorial-portrait"), the name (with
  // data-testid="memorial-name"), the dates, the meta badges, and the
  // action toolbar. The structural arrangement is what differs.

  const renderHero = () => {
    switch (theme.layout) {
      // ----- 1. split-formal (Classic Marble) ---------------------------
      // Quiet muted band, portrait square LEFT, name/dates/actions RIGHT.
      case "split-formal":
        return (
          <section
            style={{
              background: "hsl(var(--site-muted))",
              borderBottom: "1px solid hsl(var(--site-border))",
            }}
            className="py-10 md:py-16"
          >
            <div className="container mx-auto max-w-5xl px-4 sm:px-6">
              <div className="mb-6">{backLink}</div>
              <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 items-center">
                <div
                  style={{
                    background: heroPhoto ? `url(${heroPhoto}) center/cover` : "hsl(var(--site-card))",
                    aspectRatio: "1 / 1",
                    border: "1px solid hsl(var(--site-border))",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="w-full max-w-[280px] mx-auto md:mx-0 flex items-center justify-center"
                  data-testid="memorial-portrait"
                >
                  {!heroPhoto ? (
                    <ImageOff className="h-12 w-12 opacity-30" style={{ color: "hsl(var(--site-muted-fg))" }} />
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
                  <h1 style={headingFont} className="text-4xl md:text-5xl font-semibold mb-3 leading-tight" data-testid="memorial-name">
                    {memorial.deceasedName}
                  </h1>
                  <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-lg md:text-xl mb-4">
                    {yearsLine}
                    {age != null ? <span className="opacity-70"> · {age} years</span> : null}
                  </p>
                  {metaBadges("left")}
                  <div className="mt-6 justify-center md:justify-start flex">{actions("solid")}</div>
                </div>
              </div>
            </div>
          </section>
        );

      // ----- 2. full-bleed (Modern Minimal) ----------------------------
      // Photography fills the whole hero band; name overlays bottom-left
      // in heavy sans-serif, actions overlay bottom-right.
      case "full-bleed":
        return (
          <section
            style={{
              minHeight: "70vh",
              background: heroPhoto
                ? `${theme.heroOverlay}, url(${heroPhoto}) center/cover`
                : "hsl(var(--site-muted))",
              borderBottom: "1px solid hsl(var(--site-border))",
              position: "relative",
            }}
            className="flex flex-col"
          >
            <div className="container mx-auto max-w-6xl px-4 sm:px-6 pt-6">
              {/* Back link gets light-on-dark treatment because of the overlay. */}
              <Link
                href={`/find-grave`}
                style={{ color: heroPhoto ? "rgba(255,255,255,0.85)" : "hsl(var(--site-muted-fg))" }}
                className="inline-flex items-center gap-1.5 text-xs font-medium hover:opacity-80"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to find a grave
              </Link>
            </div>
            {/* Hidden visual portrait to satisfy the testid contract — the
                portrait IS the hero background, but tests still expect a
                marker element. */}
            <div className="sr-only" data-testid="memorial-portrait" aria-hidden>
              {heroPhoto ? "Portrait shown as hero background" : "No portrait"}
            </div>
            <div className="flex-1 flex items-end">
              <div className="container mx-auto max-w-6xl px-4 sm:px-6 pb-10 md:pb-14 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
                <div>
                  <div
                    className="text-[11px] uppercase tracking-[0.25em] font-bold mb-3"
                    style={{ color: heroPhoto ? "rgba(255,255,255,0.9)" : "hsl(var(--site-primary))" }}
                  >
                    In Memory Of
                  </div>
                  <h1
                    style={{ ...headingFont, color: heroPhoto ? "#fff" : "hsl(var(--site-fg))" }}
                    className="text-5xl md:text-7xl font-extrabold leading-[0.95] tracking-tight mb-3"
                    data-testid="memorial-name"
                  >
                    {memorial.deceasedName}
                  </h1>
                  <p
                    className="text-lg md:text-2xl font-medium"
                    style={{ color: heroPhoto ? "rgba(255,255,255,0.85)" : "hsl(var(--site-muted-fg))" }}
                  >
                    {yearsLine}
                    {age != null ? <span className="opacity-80"> · {age} years</span> : null}
                  </p>
                </div>
                <div className="md:text-right">
                  {actions(heroPhoto ? "ghost-on-image" : "solid")}
                </div>
              </div>
            </div>
            <div
              className="container mx-auto max-w-6xl px-4 sm:px-6 py-4"
              style={{ borderTop: "1px solid hsl(var(--site-border))", background: "hsl(var(--site-bg))" }}
            >
              {metaBadges("left")}
            </div>
          </section>
        );

      // ----- 3. editorial (Heritage Garden) ----------------------------
      // Magazine cover — oversized centered display type, ornamental
      // rule, and a tall portrait below the name.
      case "editorial":
        return (
          <section
            style={{ background: "hsl(var(--site-bg))", borderBottom: "1px solid hsl(var(--site-border))" }}
            className="py-10 md:py-16"
          >
            <div className="container mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <div className="mb-8 text-left">{backLink}</div>
              {/* Decorative ornament rule (the editorial-style "fleuron"
                  is just a unicode mark to avoid loading a glyph font). */}
              <div className="flex items-center gap-3 justify-center mb-4" aria-hidden>
                <span style={{ height: 1, width: 48, background: "hsl(var(--site-border))" }} />
                <span style={{ color: "hsl(var(--site-accent))" }} className="text-lg">❦</span>
                <span style={{ height: 1, width: 48, background: "hsl(var(--site-border))" }} />
              </div>
              <div
                className="text-[11px] uppercase tracking-[0.4em] font-semibold mb-4"
                style={{ color: "hsl(var(--site-primary))" }}
              >
                In Loving Memory
              </div>
              <h1
                style={headingFont}
                className="text-5xl md:text-7xl font-semibold leading-[1.05] mb-5"
                data-testid="memorial-name"
              >
                {memorial.deceasedName}
              </h1>
              <div className="flex items-center gap-4 justify-center mb-8" style={{ color: "hsl(var(--site-muted-fg))" }}>
                <span style={{ height: 1, width: 40, background: "hsl(var(--site-border))" }} />
                <span style={headingFont} className="text-lg italic tracking-wide">
                  {yearsLine}
                  {age != null ? ` · ${age} years` : ""}
                </span>
                <span style={{ height: 1, width: 40, background: "hsl(var(--site-border))" }} />
              </div>
              <div
                style={{
                  background: heroPhoto ? `url(${heroPhoto}) center/cover` : "hsl(var(--site-card))",
                  aspectRatio: "3 / 4",
                  border: "1px solid hsl(var(--site-border))",
                  borderRadius: "var(--site-radius)",
                  boxShadow: "0 12px 40px -12px hsla(0,0%,0%,0.18)",
                }}
                className="w-full max-w-[320px] mx-auto mb-8 flex items-center justify-center"
                data-testid="memorial-portrait"
              >
                {!heroPhoto ? (
                  <ImageOff className="h-12 w-12 opacity-30" style={{ color: "hsl(var(--site-muted-fg))" }} />
                ) : null}
              </div>
              <div className="mb-6 flex justify-center">{actions("solid")}</div>
              {metaBadges("center")}
            </div>
          </section>
        );

      // ----- 4. monumental (Celestial Night) ---------------------------
      // Dark single-column with a circular portrait inside a gold ring,
      // plus a huge gold years line.
      case "monumental":
        return (
          <section
            style={{ background: "hsl(var(--site-bg))", borderBottom: "1px solid hsl(var(--site-border))" }}
            className="py-12 md:py-20"
          >
            <div className="container mx-auto max-w-3xl px-4 sm:px-6">
              <div className="mb-8">{backLink}</div>
              <div className="text-center">
                <div
                  data-testid="memorial-portrait"
                  style={{
                    width: 220,
                    height: 220,
                    borderRadius: "9999px",
                    background: heroPhoto ? `url(${heroPhoto}) center/cover` : "hsl(var(--site-card))",
                    border: "2px solid hsl(var(--site-primary))",
                    boxShadow:
                      "0 0 0 8px hsla(232,30%,16%,1), 0 0 60px -8px hsl(var(--site-primary))",
                  }}
                  className="mx-auto mb-8 flex items-center justify-center"
                >
                  {!heroPhoto ? (
                    <ImageOff className="h-12 w-12 opacity-30" style={{ color: "hsl(var(--site-muted-fg))" }} />
                  ) : null}
                </div>
                <div
                  className="text-[11px] uppercase tracking-[0.4em] font-semibold mb-4"
                  style={{ color: "hsl(var(--site-primary))" }}
                >
                  ✦ In Eternal Memory ✦
                </div>
                <h1
                  style={{ ...headingFont, letterSpacing: "0.08em" }}
                  className="text-3xl md:text-5xl font-semibold uppercase mb-6 leading-tight"
                  data-testid="memorial-name"
                >
                  {memorial.deceasedName}
                </h1>
                <p
                  style={{ ...headingFont, color: "hsl(var(--site-primary))" }}
                  className="text-5xl md:text-7xl font-bold tracking-wider mb-3"
                >
                  {yearsLine}
                </p>
                {age != null ? (
                  <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-base md:text-lg mb-8">
                    {age} years on this earth
                  </p>
                ) : <div className="mb-8" />}
                <div className="mb-6 flex justify-center">{actions("solid")}</div>
                {metaBadges("center")}
              </div>
            </div>
          </section>
        );

      // ----- 5. vertical-zen (Japanese Zen) -----------------------------
      // Asymmetric sumi-e composition. Tall portrait LEFT, vertical
      // accent line + name + meta on the RIGHT, lots of white space.
      case "vertical-zen":
        return (
          <section
            style={{ background: "hsl(var(--site-bg))", borderBottom: "1px solid hsl(var(--site-border))" }}
            className="py-12 md:py-20"
          >
            <div className="container mx-auto max-w-5xl px-4 sm:px-6">
              <div className="mb-10">{backLink}</div>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-10 md:gap-14">
                <div
                  style={{
                    background: heroPhoto ? `url(${heroPhoto}) center/cover` : "hsl(var(--site-muted))",
                    aspectRatio: "3 / 4",
                    border: "1px solid hsl(var(--site-fg))",
                    borderRadius: "0",
                  }}
                  className="w-full flex items-center justify-center"
                  data-testid="memorial-portrait"
                >
                  {!heroPhoto ? (
                    <ImageOff className="h-12 w-12 opacity-30" style={{ color: "hsl(var(--site-muted-fg))" }} />
                  ) : null}
                </div>
                <div className="relative pl-6 md:pl-10">
                  {/* The vertical sumi-e brush stroke. */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: "hsl(var(--site-fg))",
                    }}
                  />
                  <div
                    className="text-[11px] uppercase tracking-[0.35em] font-medium mb-6"
                    style={{ color: "hsl(var(--site-accent))" }}
                  >
                    祈 · A Quiet Memory
                  </div>
                  <h1
                    style={headingFont}
                    className="text-4xl md:text-6xl font-medium leading-[1.1] mb-8"
                    data-testid="memorial-name"
                  >
                    {memorial.deceasedName}
                  </h1>
                  <div className="space-y-3 mb-10" style={{ color: "hsl(var(--site-muted-fg))" }}>
                    <div className="flex items-baseline gap-3 text-sm">
                      <span className="text-xs uppercase tracking-widest" style={{ color: "hsl(var(--site-fg))" }}>Born</span>
                      <span style={{ ...headingFont }} className="text-lg">{bornDate ?? "—"}</span>
                    </div>
                    <div className="flex items-baseline gap-3 text-sm">
                      <span className="text-xs uppercase tracking-widest" style={{ color: "hsl(var(--site-fg))" }}>Passed</span>
                      <span style={{ ...headingFont }} className="text-lg">{diedDate ?? "—"}</span>
                    </div>
                    {age != null ? (
                      <div className="flex items-baseline gap-3 text-sm">
                        <span className="text-xs uppercase tracking-widest" style={{ color: "hsl(var(--site-fg))" }}>Lived</span>
                        <span style={{ ...headingFont }} className="text-lg">{age} years</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="mb-6">{actions("solid")}</div>
                  {metaBadges("left")}
                </div>
              </div>
            </div>
          </section>
        );
    }
  };

  // -------- Per-layout photo gallery renderer --------------------------
  // The thumb strip pattern only suits split-formal. The other themes
  // need their own gallery treatments (full grid, masonry, mosaic, scroll).
  const renderGallery = () => {
    if (memorial.photos.length <= 1) return null;
    const photos = memorial.photos;
    switch (theme.layout) {
      // Compact thumbnail row that drives the hero portrait swap.
      case "split-formal":
        return (
          <section className="container mx-auto max-w-5xl px-4 sm:px-6 py-10" data-testid="memorial-gallery">
            <div className="flex flex-wrap gap-2 justify-center">
              {photos.map((url, i) => (
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
        );
      // Crisp 4-up grid, sharp corners — feels like an editorial photo
      // essay sitting under the full-bleed hero.
      case "full-bleed":
        return (
          <section className="container mx-auto max-w-6xl px-4 sm:px-6 py-10 md:py-14" data-testid="memorial-gallery">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {photos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  onClick={() => setActivePhoto(i)}
                  data-testid={`memorial-photo-${i}`}
                  style={{
                    background: `url(${url}) center/cover`,
                    aspectRatio: "1 / 1",
                    borderRadius: 0,
                    border: "none",
                  }}
                  aria-label={`View photo ${i + 1}`}
                  className="w-full hover:opacity-90 transition-opacity"
                />
              ))}
            </div>
          </section>
        );
      // Two-column masonry-style — alternating tall/short cards give the
      // editorial layout a varied magazine rhythm.
      case "editorial":
        return (
          <section className="container mx-auto max-w-3xl px-4 sm:px-6 py-12" data-testid="memorial-gallery">
            <div className="text-center mb-6">
              <div className="text-[10px] uppercase tracking-[0.35em] font-semibold" style={{ color: "hsl(var(--site-primary))" }}>
                Photographs
              </div>
            </div>
            <div className="columns-2 gap-3 [column-fill:_balance]">
              {photos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  onClick={() => setActivePhoto(i)}
                  data-testid={`memorial-photo-${i}`}
                  style={{
                    background: `url(${url}) center/cover`,
                    aspectRatio: i % 3 === 0 ? "3 / 4" : i % 3 === 1 ? "1 / 1" : "4 / 5",
                    borderRadius: "var(--site-radius)",
                    border: "1px solid hsl(var(--site-border))",
                    boxShadow: "0 4px 16px -8px hsla(0,0%,0%,0.2)",
                  }}
                  aria-label={`View photo ${i + 1}`}
                  className="w-full block mb-3 break-inside-avoid hover:opacity-95"
                />
              ))}
            </div>
          </section>
        );
      // Dark mosaic with subtle gold border so the photos feel like
      // night-sky portraits set into a frame.
      case "monumental":
        return (
          <section className="container mx-auto max-w-4xl px-4 sm:px-6 py-12" data-testid="memorial-gallery">
            <div className="text-center mb-6">
              <div className="text-[10px] uppercase tracking-[0.4em] font-semibold" style={{ color: "hsl(var(--site-primary))" }}>
                ✦ Moments ✦
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  onClick={() => setActivePhoto(i)}
                  data-testid={`memorial-photo-${i}`}
                  style={{
                    background: `url(${url}) center/cover`,
                    aspectRatio: "1 / 1",
                    border: "1px solid hsla(42,75%,62%,0.4)",
                    borderRadius: "var(--site-radius)",
                    boxShadow: "0 0 0 1px hsla(232,30%,5%,0.6) inset, 0 6px 24px -10px hsla(42,75%,62%,0.4)",
                  }}
                  aria-label={`View photo ${i + 1}`}
                  className="w-full hover:opacity-95"
                />
              ))}
            </div>
          </section>
        );
      // Horizontal scroll strip — a hand-scroll, in keeping with sumi-e
      // tradition. Sharp corners, generous left/right padding.
      case "vertical-zen":
        return (
          <section className="py-12 md:py-16" data-testid="memorial-gallery">
            <div className="container mx-auto max-w-5xl px-4 sm:px-6 mb-5">
              <div className="text-[11px] uppercase tracking-[0.35em] font-medium" style={{ color: "hsl(var(--site-accent))" }}>
                記憶 · Memories
              </div>
            </div>
            <div
              className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-4"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {photos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  onClick={() => setActivePhoto(i)}
                  data-testid={`memorial-photo-${i}`}
                  style={{
                    background: `url(${url}) center/cover`,
                    width: 240,
                    height: 320,
                    flex: "0 0 auto",
                    border: "1px solid hsl(var(--site-fg))",
                    borderRadius: 0,
                    scrollSnapAlign: "start",
                  }}
                  aria-label={`View photo ${i + 1}`}
                  className="hover:opacity-95"
                />
              ))}
            </div>
          </section>
        );
    }
  };

  return (
    <div>
      {renderHero()}
      {renderGallery()}

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

        {richLocked ? (
          <div
            className="text-center"
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            data-testid="memorial-rich-locked"
          >
            <div className="p-6 md:p-8 max-w-md mx-auto">
              <div
                style={{ background: "hsl(var(--site-muted))", color: "hsl(var(--site-primary))", borderRadius: "var(--site-radius)" }}
                className="h-12 w-12 mx-auto mb-4 flex items-center justify-center"
              >
                <Lock className="h-5 w-5" />
              </div>
              <h2 style={headingFont} className="text-xl font-semibold mb-2">
                Their story is private
              </h2>
              <p className="text-sm mb-5" style={{ color: "hsl(var(--site-muted-fg))" }}>
                The family has kept the biography and photo gallery for visitors
                with the PIN. Enter it below to view the full memorial.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={pinDraft}
                onChange={(e) => { setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 12)); setPinHint(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") submitUnlock(); }}
                placeholder="6-digit PIN"
                data-testid="memorial-unlock-rich"
                style={{
                  background: "hsl(var(--site-muted))",
                  border: "1px solid hsl(var(--site-border))",
                  borderRadius: "var(--site-radius)",
                  color: "hsl(var(--site-fg))",
                  letterSpacing: "0.2em",
                }}
                className="w-full px-4 py-3 text-base font-mono text-center mb-3"
              />
              <button
                onClick={submitUnlock}
                style={{
                  background: "hsl(var(--site-primary))",
                  color: "hsl(var(--site-primary-fg))",
                  borderRadius: "var(--site-radius)",
                }}
                className="w-full px-4 py-2.5 text-sm font-semibold hover:opacity-90"
              >
                <KeyRound className="h-3.5 w-3.5 inline -mt-0.5 mr-1.5" />
                Unlock full memorial
              </button>
              {pinHint ? (
                <p className="text-xs mt-3" style={{ color: "#c0392b" }}>{pinHint}</p>
              ) : triedPinRich ? (
                <p className="text-xs mt-3" style={{ color: "#c0392b" }}>
                  That PIN doesn't match. Please check with the cemetery.
                </p>
              ) : null}
            </div>
          </div>
        ) : memorial.biography ? (
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
          <div className="text-center" data-testid="memorial-bio-empty">
            <p className="italic mb-4" style={{ color: "hsl(var(--site-muted-fg))" }}>
              A biography for {memorial.deceasedName ?? "this person"} hasn't been added yet.
            </p>
            <Link
              href={`/memorial/${code}/edit`}
              style={{
                background: "hsl(var(--site-primary))",
                color: "hsl(var(--site-primary-fg))",
                borderRadius: "var(--site-radius)",
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
            >
              <Pencil className="h-3.5 w-3.5" />
              Add their story
            </Link>
          </div>
        )}
      </section>

      {/* Video gallery — only rendered when the visitor is allowed to see
          rich content (mirrors the bio + photo gating logic). Each video
          gets its own iframe so visitors can play any tribute in place
          without leaving the memorial page. */}
      {!richLocked && memorial.videos.length > 0 ? (
        <section
          className="container mx-auto max-w-5xl px-4 sm:px-6 pb-10 md:pb-12"
          data-testid="memorial-video-gallery"
        >
          <h2 style={headingFont} className="text-2xl md:text-3xl font-semibold mb-5 text-center">
            Tribute videos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {memorial.videos
              .map((url) => ({ url, id: parseYouTubeId(url) }))
              .filter((v): v is { url: string; id: string } => v.id !== null)
              .map(({ url, id }, i) => (
                <div
                  key={`${url}-${i}`}
                  data-testid={`memorial-video-${i}`}
                  style={{
                    background: "hsl(var(--site-card))",
                    border: "1px solid hsl(var(--site-border))",
                    borderRadius: "var(--site-radius)",
                    aspectRatio: "16 / 9",
                    overflow: "hidden",
                  }}
                >
                  <iframe
                    src={youtubeEmbedUrl(id)}
                    title={`Tribute video ${i + 1} for ${memorial.deceasedName ?? "memorial"}`}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: "100%", height: "100%", border: 0, display: "block" }}
                  />
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {/* Gamified digital rituals — candles, flowers, voice prayers. We
          deliberately gate on `!memorial.locked`: rituals appear only when
          the visitor has been granted view access to the memorial content
          (visibility "open", or "basic"/"private" with the PIN unlocked).
          A locked memorial never reveals any tribute wall, so PIN-gated
          memorials remain truly private. */}
      {!memorial.locked ? (
        <DigitalRituals slug={slug} code={code} deceasedName={memorial.deceasedName} />
      ) : null}

      {/* Visit / location card */}
      {(memorial.cemeteryAddress || (memorial.plotLatitude && memorial.plotLongitude)) ? (
        <section
          style={{
            background: "hsl(var(--site-muted))",
            borderTop: "1px solid hsl(var(--site-border))",
            borderBottom: "1px solid hsl(var(--site-border))",
          }}
          className="py-10 md:py-12"
        >
          <div className="container mx-auto max-w-3xl px-4 sm:px-6">
            <div
              style={{
                background: "hsl(var(--site-card))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center"
            >
              <div
                style={{ background: "hsl(var(--site-primary))", color: "hsl(var(--site-primary-fg))", borderRadius: "var(--site-radius)" }}
                className="h-12 w-12 flex items-center justify-center shrink-0"
              >
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 style={headingFont} className="text-xl font-semibold mb-1">
                  Visit the gravesite
                </h3>
                <p className="text-sm" style={{ color: "hsl(var(--site-muted-fg))" }}>
                  {memorial.cemeteryName}
                  {memorial.cemeteryAddress ? <> · {memorial.cemeteryAddress}</> : null}
                  {memorial.plotLabel ? <> · Plot {memorial.plotLabel}</> : null}
                </p>
              </div>
              {directions ? (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="memorial-directions-card"
                  style={{
                    background: "hsl(var(--site-primary))",
                    color: "hsl(var(--site-primary-fg))",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold hover:opacity-90"
                >
                  <Navigation className="h-4 w-4" />
                  Open in Maps
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Order CTA */}
      <section
        style={{ background: "hsl(var(--site-muted))" }}
        className="py-12 md:py-16"
      >
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <h2 style={headingFont} className="text-2xl md:text-3xl font-semibold mb-3">
            Honour their memory
          </h2>
          <p style={{ color: "hsl(var(--site-muted-fg))" }} className="mb-8 max-w-xl mx-auto">
            Order a printed QR plaque, fresh flowers, headstone care, or a memorial service from {site.organizationName}. We'll be in touch to confirm details.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
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
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
              }}
              data-testid="memorial-copy-link"
              style={{
                background: "hsl(var(--site-card))",
                color: "hsl(var(--site-fg))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="inline-flex items-center gap-2 px-6 py-3 font-semibold hover:opacity-90"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
