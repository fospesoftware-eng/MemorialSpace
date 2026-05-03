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
  // Year-only locals reused across the more typographic layouts (the
  // diptych timeline, full-bleed stat row, monumental gold banner).
  const bornYear = memorial.bornDate?.slice(0, 4) ?? null;
  const diedYear = memorial.diedDate?.slice(0, 4) ?? null;
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
      // =================================================================
      // 1. split-formal (Classic Marble) → DIPTYCH ELEGANT
      //    Editorial diptych with a vertical "in loving memory" rubric
      //    rotated up the left edge, double-framed portrait, hairline
      //    gold accent under the name, and a typographic born→passed
      //    timeline. Subtle marble-paper gradient on the section.
      // =================================================================
      case "split-formal":
        return (
          <section
            style={{
              background: `linear-gradient(135deg, hsl(var(--site-muted)) 0%, hsl(var(--site-bg)) 100%)`,
              borderBottom: "1px solid hsl(var(--site-border))",
              position: "relative",
              overflow: "hidden",
            }}
            className="py-12 md:py-20"
          >
            {/* Volume mark in the corner — like a published edition's
                rubric. Pure decoration. */}
            <div
              aria-hidden
              className="absolute top-6 right-6 hidden md:flex flex-col items-end text-[10px] uppercase tracking-[0.35em]"
              style={{ color: "hsl(var(--site-primary))" }}
            >
              <span style={headingFont} className="text-3xl leading-none">№</span>
              <span className="opacity-70 mt-1">{bornYear ?? ""}</span>
            </div>
            <div className="container mx-auto max-w-6xl px-4 sm:px-6 relative">
              <div className="mb-8">{backLink}</div>
              <div className="grid grid-cols-1 md:grid-cols-[auto_320px_1fr] gap-8 md:gap-12 items-center">
                {/* Vertical rubric — rotated to read bottom-up. */}
                <div
                  aria-hidden
                  className="hidden md:block"
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    color: "hsl(var(--site-primary))",
                    letterSpacing: "0.5em",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  In Loving Memory · {diedYear ?? ""}
                </div>
                {/* Portrait inside a subtle outer hairline frame, with a
                    soft hover lift. */}
                <div className="relative" style={{ padding: 8 }}>
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      border: "1px solid hsl(var(--site-primary))",
                      opacity: 0.4,
                      borderRadius: "var(--site-radius)",
                    }}
                  />
                  <div
                    style={{
                      background: heroPhoto ? `url(${heroPhoto}) center/cover` : "hsl(var(--site-card))",
                      aspectRatio: "4 / 5",
                      border: "1px solid hsl(var(--site-border))",
                      borderRadius: "var(--site-radius)",
                      boxShadow: "0 30px 60px -30px hsla(0,0%,0%,0.35), 0 0 0 6px hsl(var(--site-bg))",
                      transition: "transform 600ms cubic-bezier(.2,.7,.2,1)",
                    }}
                    className="w-full flex items-center justify-center hover:[transform:translateY(-4px)]"
                    data-testid="memorial-portrait"
                  >
                    {!heroPhoto ? (
                      <ImageOff className="h-12 w-12 opacity-30" style={{ color: "hsl(var(--site-muted-fg))" }} />
                    ) : null}
                  </div>
                </div>
                {/* Name + dates column. */}
                <div className="text-center md:text-left">
                  <div
                    className="text-[10px] uppercase tracking-[0.4em] font-semibold mb-4 inline-flex items-center gap-2 md:hidden"
                    style={{ color: "hsl(var(--site-primary))" }}
                  >
                    <span style={{ width: 24, height: 1, background: "hsl(var(--site-primary))" }} />
                    In Loving Memory
                  </div>
                  <h1
                    style={headingFont}
                    className="text-5xl md:text-6xl font-semibold mb-5 leading-[1.05]"
                    data-testid="memorial-name"
                  >
                    {memorial.deceasedName}
                  </h1>
                  {/* Hairline gold underline accent. */}
                  <div
                    aria-hidden
                    className="mb-7 mx-auto md:mx-0"
                    style={{ width: 80, height: 2, background: "hsl(var(--site-primary))", opacity: 0.85 }}
                  />
                  {/* Born → passed typographic timeline. */}
                  <div className="flex items-center gap-4 mb-7 justify-center md:justify-start" style={{ color: "hsl(var(--site-fg))" }}>
                    <div className="text-center">
                      <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 mb-1">Born</div>
                      <div style={headingFont} className="text-2xl">{bornYear ?? "—"}</div>
                    </div>
                    <div aria-hidden className="flex items-center gap-1.5 px-2 opacity-50">
                      <span style={{ width: 18, height: 1, background: "currentColor" }} />
                      <span className="w-1 h-1 rounded-full" style={{ background: "currentColor" }} />
                      <span style={{ width: 18, height: 1, background: "currentColor" }} />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 mb-1">Passed</div>
                      <div style={headingFont} className="text-2xl">{diedYear ?? "—"}</div>
                    </div>
                    {age != null ? (
                      <div className="ml-3 pl-4 hidden sm:block" style={{ borderLeft: "1px solid hsl(var(--site-border))" }}>
                        <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 mb-1">Lived</div>
                        <div style={headingFont} className="text-2xl">{age}<span className="text-sm opacity-60"> yrs</span></div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mb-5 flex justify-center md:justify-start">{actions("solid")}</div>
                  {metaBadges("left")}
                </div>
              </div>
            </div>
          </section>
        );

      // =================================================================
      // 2. full-bleed (Modern Minimal) → CINEMATIC IMMERSIVE
      //    100vh fixed-attachment image, layered cinematic gradient,
      //    floating frosted-glass back-pill, massive display name with
      //    text-shadow lift, two-line stat row with thin gold rules,
      //    and an animated scroll-cue at the bottom.
      // =================================================================
      case "full-bleed":
        return (
          <section
            style={{
              minHeight: "100vh",
              background: heroPhoto
                ? `linear-gradient(180deg, hsla(0,0%,0%,0.45) 0%, hsla(0,0%,0%,0.1) 35%, hsla(0,0%,0%,0.85) 100%), url(${heroPhoto}) center/cover`
                : "linear-gradient(180deg, hsl(var(--site-muted)) 0%, hsl(var(--site-bg)) 100%)",
              // We avoid background-attachment:fixed because it causes
              // jank/paint cost on mobile (especially iOS Safari).
              borderBottom: "1px solid hsl(var(--site-border))",
              position: "relative",
            }}
            className="flex flex-col"
          >
            {/* Frosted-glass back pill. */}
            <div className="container mx-auto max-w-6xl px-4 sm:px-6 pt-6 flex items-center justify-between">
              <Link
                href={`/find-grave`}
                style={{
                  background: heroPhoto ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.04)",
                  backdropFilter: "blur(14px) saturate(140%)",
                  WebkitBackdropFilter: "blur(14px) saturate(140%)",
                  border: heroPhoto ? "1px solid rgba(255,255,255,0.2)" : "1px solid hsl(var(--site-border))",
                  color: heroPhoto ? "#fff" : "hsl(var(--site-fg))",
                  borderRadius: 999,
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:opacity-80 transition-opacity"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to find a grave
              </Link>
            </div>
            {/* The portrait IS the hero — keep an sr-only marker for the
                test contract. */}
            <div className="sr-only" data-testid="memorial-portrait" aria-hidden>
              {heroPhoto ? "Portrait shown as cinematic hero" : "No portrait"}
            </div>
            <div className="flex-1 flex items-end">
              <div className="container mx-auto max-w-6xl px-4 sm:px-6 pb-16 md:pb-24 w-full">
                <div
                  className="text-[10px] uppercase tracking-[0.45em] font-bold mb-6 inline-flex items-center gap-3"
                  style={{ color: heroPhoto ? "rgba(255,255,255,0.85)" : "hsl(var(--site-primary))" }}
                >
                  <span style={{ width: 32, height: 1, background: "currentColor" }} />
                  In Memory Of
                </div>
                <h1
                  style={{
                    ...headingFont,
                    color: heroPhoto ? "#fff" : "hsl(var(--site-fg))",
                    textShadow: heroPhoto ? "0 2px 32px rgba(0,0,0,0.5)" : "none",
                  }}
                  className="text-6xl md:text-8xl lg:text-9xl font-extrabold leading-[0.92] tracking-[-0.02em] mb-8 max-w-5xl"
                  data-testid="memorial-name"
                >
                  {memorial.deceasedName}
                </h1>
                {/* Stat row with thin connecting rules. */}
                <div
                  className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-8"
                  style={{ color: heroPhoto ? "rgba(255,255,255,0.9)" : "hsl(var(--site-muted-fg))" }}
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-70">Born</span>
                    <span className="text-xl md:text-2xl font-semibold">{bornYear ?? "—"}</span>
                  </div>
                  <span aria-hidden className="hidden md:block w-12 h-px opacity-40" style={{ background: "currentColor" }} />
                  <div className="flex items-baseline gap-3">
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-70">Passed</span>
                    <span className="text-xl md:text-2xl font-semibold">{diedYear ?? "—"}</span>
                  </div>
                  {age != null ? (
                    <>
                      <span aria-hidden className="hidden md:block w-12 h-px opacity-40" style={{ background: "currentColor" }} />
                      <div className="flex items-baseline gap-3">
                        <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-70">Lived</span>
                        <span className="text-xl md:text-2xl font-semibold">{age} yrs</span>
                      </div>
                    </>
                  ) : null}
                </div>
                <div>{actions(heroPhoto ? "ghost-on-image" : "solid")}</div>
              </div>
            </div>
            {/* Animated scroll cue. */}
            <div
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 bottom-4 flex flex-col items-center gap-1.5 mh-scroll-cue"
              style={{ color: heroPhoto ? "rgba(255,255,255,0.65)" : "hsl(var(--site-muted-fg))" }}
            >
              <span className="text-[10px] uppercase tracking-[0.3em] font-semibold">Scroll</span>
              <span className="block w-px h-6" style={{ background: "currentColor" }} />
            </div>
            <div
              className="container mx-auto max-w-6xl px-4 sm:px-6 py-4"
              style={{ borderTop: "1px solid hsl(var(--site-border))", background: "hsl(var(--site-bg))" }}
            >
              {metaBadges("left")}
            </div>
          </section>
        );

      // =================================================================
      // 3. editorial (Heritage Garden) → MAGAZINE SPREAD
      //    Two-column magazine spread with a masthead row, a serif
      //    drop-cap initial, a pull-quote of the years between rules,
      //    and a portrait in an art-deco double-frame with corner
      //    diamond ornaments.
      // =================================================================
      case "editorial":
        return (
          <section
            style={{
              background: "hsl(var(--site-bg))",
              borderBottom: "1px solid hsl(var(--site-border))",
              backgroundImage:
                "radial-gradient(circle at 8% 12%, hsla(0,0%,0%,0.04) 1px, transparent 1px), radial-gradient(circle at 92% 88%, hsla(0,0%,0%,0.04) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
            className="py-10 md:py-16"
          >
            <div className="container mx-auto max-w-6xl px-4 sm:px-6">
              {/* Masthead row. */}
              <div
                className="flex items-center justify-between mb-10 pb-4 gap-4 flex-wrap"
                style={{ borderBottom: "2px double hsl(var(--site-border))" }}
              >
                {backLink}
                <div
                  className="text-[10px] uppercase tracking-[0.4em] font-semibold flex items-center gap-3"
                  style={{ color: "hsl(var(--site-primary))" }}
                >
                  <span>Volume {age ?? "—"}</span>
                  <span aria-hidden style={{ width: 1, height: 12, background: "currentColor" }} />
                  <span>{bornYear ?? ""} · {diedYear ?? ""}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-16 items-start">
                {/* Left column: rubric + drop-cap name + pull-quote dates. */}
                <div>
                  <div className="flex items-center gap-3 mb-6" aria-hidden>
                    <span style={{ height: 1, width: 64, background: "hsl(var(--site-primary))" }} />
                    <span style={{ color: "hsl(var(--site-accent))" }} className="text-xl">❦</span>
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.45em] font-bold mb-5"
                    style={{ color: "hsl(var(--site-primary))" }}
                  >
                    In Loving Memory
                  </div>
                  {/* Display name with a serif drop-cap initial that
                      floats next to the rest of the name. */}
                  <h1
                    style={headingFont}
                    className="text-5xl md:text-7xl font-semibold leading-[1.02] mb-8 break-words"
                    data-testid="memorial-name"
                  >
                    <span
                      className="float-left mr-3 mt-1"
                      style={{
                        ...headingFont,
                        fontSize: "clamp(5rem, 11vw, 9rem)",
                        lineHeight: 0.85,
                        color: "hsl(var(--site-primary))",
                      }}
                    >
                      {(memorial.deceasedName ?? "").charAt(0)}
                    </span>
                    {(memorial.deceasedName ?? "").slice(1)}
                  </h1>
                  {/* Pull-quote with years between two rules. */}
                  <blockquote
                    className="my-8 py-6 px-6 italic"
                    style={{
                      ...headingFont,
                      borderTop: "1px solid hsl(var(--site-border))",
                      borderBottom: "1px solid hsl(var(--site-border))",
                      color: "hsl(var(--site-fg))",
                    }}
                  >
                    <span className="text-2xl md:text-3xl block mb-1">{yearsLine}</span>
                    {age != null ? (
                      <span className="text-sm not-italic uppercase tracking-[0.3em] opacity-60">
                        {age} years of grace
                      </span>
                    ) : null}
                  </blockquote>
                  <div className="mb-6">{actions("solid")}</div>
                  {metaBadges("left")}
                </div>
                {/* Right column: portrait in an art-deco double-frame. */}
                <div className="relative" style={{ padding: 14 }}>
                  <div aria-hidden style={{ position: "absolute", inset: 0, border: "1px solid hsl(var(--site-primary))", opacity: 0.6 }} />
                  <div aria-hidden style={{ position: "absolute", inset: 6, border: "1px solid hsl(var(--site-primary))", opacity: 0.3 }} />
                  {(["tl","tr","bl","br"] as const).map((c) => (
                    <span
                      key={c}
                      aria-hidden
                      className="absolute w-3 h-3"
                      style={{
                        top: c.startsWith("t") ? -4 : "auto",
                        bottom: c.startsWith("b") ? -4 : "auto",
                        left: c.endsWith("l") ? -4 : "auto",
                        right: c.endsWith("r") ? -4 : "auto",
                        background: "hsl(var(--site-primary))",
                        transform: "rotate(45deg)",
                      }}
                    />
                  ))}
                  <div
                    style={{
                      background: heroPhoto ? `url(${heroPhoto}) center/cover` : "hsl(var(--site-card))",
                      aspectRatio: "3 / 4",
                      borderRadius: 0,
                      boxShadow: "0 24px 64px -24px hsla(0,0%,0%,0.4)",
                    }}
                    className="w-full flex items-center justify-center"
                    data-testid="memorial-portrait"
                  >
                    {!heroPhoto ? (
                      <ImageOff className="h-12 w-12 opacity-30" style={{ color: "hsl(var(--site-muted-fg))" }} />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );

      // =================================================================
      // 4. monumental (Celestial Night) → STELLAR VIGIL
      //    Animated parallax starfield, oval cameo portrait with golden
      //    SVG filigree corners, constellation rule under the name, and
      //    a glowing gold-leaf banner around the years.
      // =================================================================
      case "monumental":
        return (
          <section
            style={{
              background: "hsl(var(--site-bg))",
              borderBottom: "1px solid hsl(var(--site-border))",
              position: "relative",
              overflow: "hidden",
            }}
            className="py-16 md:py-24"
          >
            {/* Two parallax layers of stars + central vignette. */}
            <div aria-hidden className="absolute inset-0 mh-stars-1" />
            <div aria-hidden className="absolute inset-0 mh-stars-2" />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, transparent 0%, hsla(232,40%,6%,0.6) 80%)" }}
            />
            <div className="container mx-auto max-w-3xl px-4 sm:px-6 relative">
              <div className="mb-10">{backLink}</div>
              <div className="text-center">
                {/* Cameo portrait with filigree corner ornaments. */}
                <div className="relative inline-block mb-10">
                  {(["tl","tr","bl","br"] as const).map((pos) => {
                    const flipX = pos.endsWith("r") ? "scaleX(-1)" : "";
                    const flipY = pos.startsWith("b") ? "scaleY(-1)" : "";
                    return (
                      <svg
                        key={pos}
                        aria-hidden
                        width="44" height="44" viewBox="0 0 44 44"
                        style={{
                          position: "absolute",
                          top: pos.startsWith("t") ? -12 : "auto",
                          bottom: pos.startsWith("b") ? -12 : "auto",
                          left: pos.endsWith("l") ? -12 : "auto",
                          right: pos.endsWith("r") ? -12 : "auto",
                          transform: `${flipX} ${flipY}`,
                          color: "hsl(var(--site-primary))",
                        }}
                      >
                        <path d="M2 22 Q2 2, 22 2" stroke="currentColor" strokeWidth="1.2" fill="none" />
                        <path d="M8 22 Q8 8, 22 8" stroke="currentColor" strokeWidth="0.7" fill="none" opacity="0.6" />
                        <circle cx="22" cy="2" r="1.6" fill="currentColor" />
                        <circle cx="2" cy="22" r="1.6" fill="currentColor" />
                      </svg>
                    );
                  })}
                  <div
                    data-testid="memorial-portrait"
                    style={{
                      width: 220,
                      height: 280,
                      borderRadius: "50% / 45%",
                      background: heroPhoto ? `url(${heroPhoto}) center/cover` : "hsl(var(--site-card))",
                      border: "2px solid hsl(var(--site-primary))",
                      boxShadow:
                        "0 0 0 6px hsla(232,30%,16%,1), 0 0 80px -10px hsl(var(--site-primary)), inset 0 0 40px hsla(232,40%,6%,0.4)",
                    }}
                    className="flex items-center justify-center"
                  >
                    {!heroPhoto ? (
                      <ImageOff className="h-12 w-12 opacity-30" style={{ color: "hsl(var(--site-muted-fg))" }} />
                    ) : null}
                  </div>
                </div>
                <div
                  className="text-[10px] uppercase tracking-[0.5em] font-semibold mb-5 inline-flex items-center gap-3"
                  style={{ color: "hsl(var(--site-primary))" }}
                >
                  <span aria-hidden style={{ width: 24, height: 1, background: "currentColor" }} />
                  ✦ In Eternal Memory ✦
                  <span aria-hidden style={{ width: 24, height: 1, background: "currentColor" }} />
                </div>
                <h1
                  style={{ ...headingFont, letterSpacing: "0.12em" }}
                  className="text-3xl md:text-5xl font-semibold uppercase mb-7 leading-[1.15]"
                  data-testid="memorial-name"
                >
                  {memorial.deceasedName}
                </h1>
                {/* Constellation rule under the name. */}
                <div
                  aria-hidden
                  className="flex items-center justify-center gap-2 mb-8"
                  style={{ color: "hsl(var(--site-primary))" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
                  <span style={{ width: 40, height: 1, background: "currentColor", opacity: 0.6 }} />
                  <span className="w-2 h-2 rounded-full" style={{ background: "currentColor" }} />
                  <span style={{ width: 40, height: 1, background: "currentColor", opacity: 0.6 }} />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
                </div>
                {/* Gold banner with the years. */}
                <div
                  className="inline-block px-8 md:px-14 py-5 mb-2"
                  style={{
                    background: "linear-gradient(180deg, hsla(42,75%,62%,0.15), hsla(42,75%,62%,0.05))",
                    border: "1px solid hsla(42,75%,62%,0.4)",
                    boxShadow: "0 0 40px -10px hsla(42,75%,62%,0.5)",
                  }}
                >
                  <p
                    style={{ ...headingFont, color: "hsl(var(--site-primary))" }}
                    className="text-5xl md:text-7xl font-bold tracking-[0.05em]"
                  >
                    {yearsLine}
                  </p>
                  {age != null ? (
                    <p style={{ color: "hsl(var(--site-primary))" }} className="text-[10px] uppercase tracking-[0.4em] mt-2 opacity-80">
                      {age} years among the stars
                    </p>
                  ) : null}
                </div>
                <div className="mt-10 mb-6 flex justify-center">{actions("solid")}</div>
                {metaBadges("center")}
              </div>
            </div>
          </section>
        );

      // =================================================================
      // 5. vertical-zen (Japanese Zen) → MA · KAKEJIKU
      //    Hanging-scroll (kakejiku) frame for the portrait — twin ink
      //    rods top and bottom, a red hanko seal, vertical Japanese
      //    rubric, and a sumi-e timeline with dotted underlines.
      //    Generous "ma" (negative space).
      // =================================================================
      case "vertical-zen":
        return (
          <section
            style={{ background: "hsl(var(--site-bg))", borderBottom: "1px solid hsl(var(--site-border))", position: "relative" }}
            className="py-16 md:py-24"
          >
            {/* Subtle washi-paper texture. */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 10%, hsla(20,15%,8%,0.03) 1px, transparent 1px), radial-gradient(circle at 80% 70%, hsla(20,15%,8%,0.03) 1px, transparent 1px)",
                backgroundSize: "24px 24px, 32px 32px",
              }}
            />
            <div className="container mx-auto max-w-5xl px-4 sm:px-6 relative">
              <div className="mb-12">{backLink}</div>
              <div className="grid grid-cols-1 md:grid-cols-[5fr_7fr] gap-12 md:gap-16 items-start">
                {/* Kakejiku hanging-scroll frame around the portrait. */}
                <div className="relative max-w-[340px] mx-auto md:mx-0 w-full">
                  <div aria-hidden style={{ height: 14, background: "hsl(var(--site-fg))", borderRadius: "2px 2px 0 0" }} />
                  <div aria-hidden style={{ height: 6, background: "hsl(var(--site-muted))", marginBottom: 4 }} />
                  <div
                    style={{
                      background: heroPhoto ? `url(${heroPhoto}) center/cover` : "hsl(var(--site-muted))",
                      aspectRatio: "3 / 4",
                      borderLeft: "1px solid hsl(var(--site-fg))",
                      borderRight: "1px solid hsl(var(--site-fg))",
                      borderRadius: 0,
                      position: "relative",
                    }}
                    className="w-full flex items-center justify-center"
                    data-testid="memorial-portrait"
                  >
                    {!heroPhoto ? (
                      <ImageOff className="h-12 w-12 opacity-30" style={{ color: "hsl(var(--site-muted-fg))" }} />
                    ) : null}
                    {/* Red hanko seal — the kanji 永 reads "eien" (eternity). */}
                    <div
                      aria-hidden
                      className="absolute bottom-3 right-3 flex items-center justify-center"
                      style={{
                        width: 44, height: 44,
                        background: "hsl(var(--site-accent))",
                        color: "#fff",
                        fontFamily: "serif",
                        fontWeight: 700,
                        fontSize: 22,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        transform: "rotate(-4deg)",
                      }}
                    >
                      永
                    </div>
                  </div>
                  <div aria-hidden style={{ height: 6, background: "hsl(var(--site-muted))", marginTop: 4 }} />
                  <div aria-hidden style={{ height: 14, background: "hsl(var(--site-fg))", borderRadius: "0 0 2px 2px" }} />
                  {/* Tassels under the bottom rod. */}
                  <div aria-hidden className="flex justify-center gap-1 mt-1">
                    <span className="block w-px h-4" style={{ background: "hsl(var(--site-fg))", opacity: 0.6 }} />
                    <span className="block w-px h-3" style={{ background: "hsl(var(--site-fg))", opacity: 0.5 }} />
                    <span className="block w-px h-4" style={{ background: "hsl(var(--site-fg))", opacity: 0.6 }} />
                  </div>
                </div>
                {/* Right side: vertical accent + name + meta. */}
                <div className="relative pl-8 md:pl-14 pt-2">
                  <div
                    aria-hidden
                    style={{
                      position: "absolute", left: 0, top: 8, bottom: 8,
                      width: 2,
                      background: "linear-gradient(180deg, transparent 0%, hsl(var(--site-fg)) 12%, hsl(var(--site-fg)) 88%, transparent 100%)",
                    }}
                  />
                  <div
                    aria-hidden
                    className="hidden md:block absolute -left-1 top-2"
                    style={{
                      writingMode: "vertical-rl",
                      color: "hsl(var(--site-accent))",
                      fontSize: 11,
                      letterSpacing: "0.5em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    永遠 · Eien
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.4em] font-medium mb-8"
                    style={{ color: "hsl(var(--site-accent))" }}
                  >
                    祈 · A Quiet Memory
                  </div>
                  <h1
                    style={headingFont}
                    className="text-5xl md:text-7xl font-medium leading-[1.05] mb-12"
                    data-testid="memorial-name"
                  >
                    {memorial.deceasedName}
                  </h1>
                  {/* Lifespan rows with dotted underlines. */}
                  <div className="space-y-5 mb-12 max-w-md" style={{ color: "hsl(var(--site-fg))" }}>
                    {[
                      { label: "Born", value: bornDate },
                      { label: "Passed", value: diedDate },
                      ...(age != null ? [{ label: "Lived", value: `${age} years` }] : []),
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-[80px_1fr] items-baseline gap-4 pb-3"
                        style={{ borderBottom: "1px dotted hsl(var(--site-border))" }}
                      >
                        <span className="text-[10px] uppercase tracking-[0.35em] opacity-60">{row.label}</span>
                        <span style={headingFont} className="text-xl">{row.value ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mb-8">{actions("solid")}</div>
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
      // Polaroid strip with subtle hover-tilt. Compact, intimate.
      case "split-formal":
        return (
          <section className="container mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16" data-testid="memorial-gallery">
            <div className="flex items-center gap-4 mb-6">
              <span style={{ width: 32, height: 1, background: "hsl(var(--site-primary))" }} />
              <h3 style={headingFont} className="text-xl md:text-2xl">A life in photographs</h3>
              <span aria-hidden className="flex-1 h-px" style={{ background: "hsl(var(--site-border))" }} />
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-60">{photos.length} pieces</span>
            </div>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              {photos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  onClick={() => setActivePhoto(i)}
                  data-testid={`memorial-photo-${i}`}
                  style={{
                    background: `url(${url}) center/cover`,
                    border: activePhoto === i ? "2px solid hsl(var(--site-primary))" : "1px solid hsl(var(--site-border))",
                    borderRadius: "var(--site-radius)",
                    width: 110, height: 130,
                    boxShadow: "0 8px 18px -10px hsla(0,0%,0%,0.3)",
                    transition: "transform 300ms ease",
                  }}
                  className="hover:[transform:translateY(-3px)_rotate(-1deg)]"
                  aria-label={`View photo ${i + 1}`}
                />
              ))}
            </div>
          </section>
        );
      // Cinematic bento — first photo features at 2x2, the rest fall
      // into a flowing 4-col grid with a hover ring micro-interaction.
      case "full-bleed":
        return (
          <section className="container mx-auto max-w-6xl px-4 sm:px-6 py-14 md:py-20" data-testid="memorial-gallery">
            <div className="flex items-end justify-between mb-6">
              <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight">Moments.</h3>
              <span className="text-xs uppercase tracking-[0.3em] opacity-60">{photos.length} captured</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 auto-rows-[140px] md:auto-rows-[180px] gap-1.5">
              {photos.map((url, i) => {
                const featured = i === 0;
                return (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => setActivePhoto(i)}
                    data-testid={`memorial-photo-${i}`}
                    style={{
                      background: `url(${url}) center/cover`,
                      gridColumn: featured ? "span 2" : "span 1",
                      gridRow: featured ? "span 2" : "span 1",
                      border: "none",
                      borderRadius: 0,
                    }}
                    aria-label={`View photo ${i + 1}`}
                    className="w-full h-full hover:opacity-95 transition-all hover:[outline:3px_solid_hsl(var(--site-fg))]"
                  />
                );
              })}
            </div>
          </section>
        );
      // Magazine "contact sheet" — a dark photo strip with film
      // perforations along the edges and frame numbers under each photo.
      case "editorial":
        return (
          <section className="container mx-auto max-w-5xl px-4 sm:px-6 py-14" data-testid="memorial-gallery">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-2" aria-hidden>
                <span style={{ height: 1, width: 56, background: "hsl(var(--site-border))" }} />
                <span style={{ color: "hsl(var(--site-accent))" }} className="text-lg">❦</span>
                <span style={{ height: 1, width: 56, background: "hsl(var(--site-border))" }} />
              </div>
              <div className="text-[11px] uppercase tracking-[0.45em] font-semibold" style={{ color: "hsl(var(--site-primary))" }}>
                The Photo Archive
              </div>
            </div>
            <div
              className="p-4 md:p-5 relative"
              style={{ background: "hsl(var(--site-fg))", borderRadius: "var(--site-radius)" }}
            >
              {/* Film perforations along the top and bottom edges. */}
              {(["top", "bottom"] as const).map((edge) => (
                <div
                  key={edge}
                  aria-hidden
                  className="absolute left-0 right-0 flex justify-around opacity-40"
                  style={{ [edge]: 6 } as React.CSSProperties}
                >
                  {Array.from({ length: 18 }).map((_, n) => (
                    <span key={n} style={{ width: 8, height: 6, background: "hsl(var(--site-bg))", borderRadius: 1 }} />
                  ))}
                </div>
              ))}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-6">
                {photos.map((url, i) => (
                  <div key={`${url}-${i}`} className="text-center">
                    <button
                      onClick={() => setActivePhoto(i)}
                      data-testid={`memorial-photo-${i}`}
                      style={{
                        background: `url(${url}) center/cover`,
                        aspectRatio: "1 / 1",
                        border: "1px solid hsl(var(--site-bg))",
                        borderRadius: 2,
                        outline: "1px solid hsla(0,0%,100%,0.05)",
                      }}
                      aria-label={`View photo ${i + 1}`}
                      className="w-full hover:opacity-90 transition-opacity"
                    />
                    <div
                      className="text-[10px] mt-1.5 font-mono uppercase tracking-widest"
                      style={{ color: "hsl(var(--site-bg))", opacity: 0.7 }}
                    >
                      № {String(i + 1).padStart(2, "0")} · A
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      // Constellation mosaic on a dark band with a starfield overlay.
      // Cards lift and the gold glow intensifies on hover.
      case "monumental":
        return (
          <section
            className="py-14 md:py-20 relative"
            style={{
              background: "hsl(var(--site-muted))",
              borderTop: "1px solid hsla(42,75%,62%,0.2)",
              borderBottom: "1px solid hsla(42,75%,62%,0.2)",
            }}
            data-testid="memorial-gallery"
          >
            <div aria-hidden className="absolute inset-0 mh-stars-1 opacity-50" />
            <div className="container mx-auto max-w-5xl px-4 sm:px-6 relative">
              <div className="text-center mb-8">
                <div
                  className="text-[11px] uppercase tracking-[0.5em] font-semibold inline-flex items-center gap-3"
                  style={{ color: "hsl(var(--site-primary))" }}
                >
                  <span style={{ width: 28, height: 1, background: "currentColor" }} />
                  ✦ Constellation of Moments ✦
                  <span style={{ width: 28, height: 1, background: "currentColor" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => setActivePhoto(i)}
                    data-testid={`memorial-photo-${i}`}
                    style={{
                      background: `url(${url}) center/cover`,
                      aspectRatio: i % 5 === 0 ? "3 / 4" : "1 / 1",
                      border: "1px solid hsla(42,75%,62%,0.4)",
                      borderRadius: "var(--site-radius)",
                      boxShadow: "0 0 0 1px hsla(232,30%,5%,0.6) inset, 0 6px 30px -8px hsla(42,75%,62%,0.5)",
                      transition: "transform 350ms ease, box-shadow 350ms ease",
                    }}
                    className="w-full hover:[transform:scale(1.03)] hover:[box-shadow:0_0_0_1px_hsla(232,30%,5%,0.6)_inset,_0_10px_50px_-6px_hsla(42,75%,62%,0.85)]"
                    aria-label={`View photo ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      // Shoji-grid — the photos sit behind thin black gridlines like a
      // paper screen. Sharp, calm, paper-dark.
      case "vertical-zen":
        return (
          <section className="py-16 md:py-20" data-testid="memorial-gallery">
            <div className="container mx-auto max-w-5xl px-4 sm:px-6">
              <div
                className="flex items-baseline justify-between mb-8 pb-3"
                style={{ borderBottom: "1px solid hsl(var(--site-fg))" }}
              >
                <h3 style={headingFont} className="text-2xl md:text-3xl">記憶 · Memories</h3>
                <span className="text-[10px] uppercase tracking-[0.35em] opacity-60">{photos.length} frames</span>
              </div>
              <div
                className="grid grid-cols-2 md:grid-cols-3 gap-px p-px"
                style={{ background: "hsl(var(--site-fg))" }}
              >
                {photos.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => setActivePhoto(i)}
                    data-testid={`memorial-photo-${i}`}
                    style={{
                      background: `url(${url}) center/cover, hsl(var(--site-bg))`,
                      aspectRatio: "1 / 1",
                      border: "none",
                      borderRadius: 0,
                    }}
                    aria-label={`View photo ${i + 1}`}
                    className="w-full hover:opacity-95 transition-opacity"
                  />
                ))}
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <div>
      {/* Layout-scoped keyframes & decorative classes. Inline so each
          theme can opt in without forcing a global stylesheet. Honors
          prefers-reduced-motion so we never animate against the user. */}
      <style>{`
        @keyframes mh-drift-1 { from { transform: translateY(0); } to { transform: translateY(-200px); } }
        @keyframes mh-drift-2 { from { transform: translateY(0); } to { transform: translateY(-100px); } }
        @keyframes mh-bounce { 0%,100% { transform: translateY(0); opacity: 0.6; } 50% { transform: translateY(6px); opacity: 1; } }
        .mh-stars-1 {
          background-image:
            radial-gradient(1.2px 1.2px at 12% 18%, rgba(255,235,180,0.9), transparent 60%),
            radial-gradient(1px 1px at 28% 64%, rgba(255,255,255,0.7), transparent 60%),
            radial-gradient(1.5px 1.5px at 41% 12%, rgba(255,235,180,0.85), transparent 60%),
            radial-gradient(1px 1px at 56% 78%, rgba(255,255,255,0.6), transparent 60%),
            radial-gradient(1.2px 1.2px at 70% 30%, rgba(255,235,180,0.9), transparent 60%),
            radial-gradient(1px 1px at 84% 56%, rgba(255,255,255,0.7), transparent 60%),
            radial-gradient(1.5px 1.5px at 92% 18%, rgba(255,235,180,0.85), transparent 60%),
            radial-gradient(1px 1px at 8% 88%, rgba(255,255,255,0.6), transparent 60%);
          background-size: 100% 200%;
          animation: mh-drift-1 60s linear infinite;
          pointer-events: none;
        }
        .mh-stars-2 {
          background-image:
            radial-gradient(0.8px 0.8px at 17% 24%, rgba(255,255,255,0.5), transparent 60%),
            radial-gradient(0.8px 0.8px at 33% 71%, rgba(255,235,180,0.6), transparent 60%),
            radial-gradient(0.8px 0.8px at 49% 35%, rgba(255,255,255,0.5), transparent 60%),
            radial-gradient(0.8px 0.8px at 64% 62%, rgba(255,235,180,0.6), transparent 60%),
            radial-gradient(0.8px 0.8px at 79% 22%, rgba(255,255,255,0.5), transparent 60%),
            radial-gradient(0.8px 0.8px at 94% 88%, rgba(255,235,180,0.6), transparent 60%);
          background-size: 100% 200%;
          animation: mh-drift-2 90s linear infinite;
          pointer-events: none;
        }
        .mh-scroll-cue { animation: mh-bounce 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mh-stars-1, .mh-stars-2, .mh-scroll-cue { animation: none !important; }
        }
      `}</style>
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
