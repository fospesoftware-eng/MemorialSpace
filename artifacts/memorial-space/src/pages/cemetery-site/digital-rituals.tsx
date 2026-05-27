/**
 * Digital Rituals — gamified memory experience for the public memorial page.
 *
 * Three rituals visitors can perform:
 *   - light a candle (flickering animated flame, 24h burn)
 *   - offer flowers (animated bouquet, picks among preset varieties)
 *   - leave a prayer (typed message + optional voice recording)
 *
 * Pure client component; talks to the public rituals API via hooks in
 * `./api.ts`. Themed via the existing `--site-*` CSS variables so it
 * blends seamlessly with whichever theme the cemetery has picked.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Flame, Flower2, Mic, Square, Send, Trash2, Heart, Play, Pause, X,
  ShoppingBag, ArrowRight, Sparkles,
} from "lucide-react";
import {
  useMemorialRituals,
  useCreateRitual,
  type PublicRitual,
  type RitualType,
  type RitualTotals,
  type PublicProduct,
} from "./api";
import "./digital-rituals.css";

type Props = { slug: string; code: string; deceasedName: string | null };

// Build the marketplace deep-link with the memorial context already attached.
// The marketplace page picks these up, persists them in the order context,
// and the cart submits the memorialCode with the order so it back-links to
// the burial server-side.
//
// IMPORTANT: this href is rendered inside wouter's `<Route path="/c/:slug" nest>`
// router, which already has base="/c/<slug>". Returning an absolute path like
// `/c/<slug>/marketplace/...` causes wouter to prepend the base again,
// producing a 404 at `/c/<slug>/c/<slug>/marketplace/...`. So we return the
// path *relative to the nest base* and let wouter resolve it. The `slug`
// argument is kept for API compatibility but is no longer used in the URL.
function marketplaceHref(opts: {
  slug: string;
  code: string;
  deceasedName: string | null;
  productSlug?: string;
}): string {
  const params = new URLSearchParams();
  params.set("for", opts.deceasedName ?? "Memorial");
  params.set("memorialCode", opts.code);
  const base = opts.productSlug
    ? `/marketplace/${opts.productSlug}`
    : `/marketplace`;
  return `${base}?${params.toString()}`;
}

type CandleColor = "white" | "gold" | "amber" | "rose";
type CandleSpec = {
  id: CandleColor;
  label: string;
  hex: string;
  // Jewel-toned card gradient (mirrors the flower-card pattern) so each
  // candle sits in its own little shrine box with the wax colour echoed
  // in the backdrop.
  bgFrom: string;
  bgTo: string;
  halo: string;
};
const CANDLE_COLORS: CandleSpec[] = [
  {
    id: "white",
    label: "Pure white",
    hex: "#fff7e0",
    bgFrom: "#1a1f2a",
    bgTo: "#2a3140",
    halo: "rgba(255, 240, 200, 0.35)",
  },
  {
    id: "gold",
    label: "Soft gold",
    hex: "#ffd479",
    bgFrom: "#2b2410",
    bgTo: "#4a3a18",
    halo: "rgba(255, 220, 130, 0.4)",
  },
  {
    id: "amber",
    label: "Warm amber",
    hex: "#ffae54",
    bgFrom: "#2b1810",
    bgTo: "#4a2818",
    halo: "rgba(255, 174, 84, 0.45)",
  },
  {
    id: "rose",
    label: "Rose",
    hex: "#ffb1c4",
    bgFrom: "#3a1620",
    bgTo: "#5a2030",
    halo: "rgba(255, 177, 196, 0.4)",
  },
];

// Cemetery-appropriate flowers only — these are the canonical Western funerary
// blooms (white roses for remembrance, lilies for restored innocence,
// chrysanthemums for mourning in Europe/Asia, carnations for pure love,
// forget-me-nots for "I will never forget you"). Each entry carries the
// petal/centre colours used by the SVG illustration so the bouquet looks
// hand-drawn rather than emoji-clipart.
type FlowerKind =
  | "white-roses"
  | "lilies"
  | "chrysanthemums"
  | "carnations"
  | "forget-me-nots";
type FlowerSpec = {
  id: FlowerKind;
  label: string;
  meaning: string;
  // Card gradient — a deep, jewel-toned backdrop chosen to make the petals
  // *pop* (we never want a near-white flower on a near-white card). The two
  // stops drive a 135° gradient on the .flower-cell.
  bgFrom: string;
  bgTo: string;
  // Inner radial halo painted *inside* the SVG, behind the bloom. Guarantees
  // contrast even if a host theme overrides the card background.
  halo: string;
  // Petals are rendered as a gradient (top → bottom) plus a stroke so light
  // blooms still have a visible silhouette.
  petalLight: string;
  petalDark: string;
  petalStroke: string;
  centre: string;
  centreGlow: string;
  shape: "rose" | "lily" | "mum" | "carnation" | "forget-me-not";
};
const FLOWER_KINDS: FlowerSpec[] = [
  {
    // White roses on a deep crimson velvet card — classic funeral palette.
    id: "white-roses",
    label: "White roses",
    meaning: "Remembrance & reverence",
    bgFrom: "#3a1620",
    bgTo: "#5a1d2c",
    halo: "rgba(255, 200, 210, 0.28)",
    petalLight: "#ffffff",
    petalDark: "#e9c8c9",
    petalStroke: "#a85f6b",
    centre: "#d4a85a",
    centreGlow: "#ffe28a",
    shape: "rose",
  },
  {
    // Lilies on dusk-blue — pearl petals with golden centre.
    id: "lilies",
    label: "Lilies",
    meaning: "Restored innocence",
    bgFrom: "#1f2b3d",
    bgTo: "#324a64",
    halo: "rgba(255, 240, 200, 0.32)",
    petalLight: "#fffbea",
    petalDark: "#e1cf99",
    petalStroke: "#a87f3a",
    centre: "#c97e2a",
    centreGlow: "#ffce6e",
    shape: "lily",
  },
  {
    // Chrysanthemums in their natural rich gold — the European mourning bloom.
    id: "chrysanthemums",
    label: "Chrysanthemums",
    meaning: "Honour & mourning",
    bgFrom: "#2b2410",
    bgTo: "#4a3a18",
    halo: "rgba(255, 220, 130, 0.32)",
    petalLight: "#ffe680",
    petalDark: "#d99a2a",
    petalStroke: "#7a5210",
    centre: "#5a3a10",
    centreGlow: "#ffb84a",
    shape: "mum",
  },
  {
    // Coral carnations — soft pink with deeper rose at the edges.
    id: "carnations",
    label: "Carnations",
    meaning: "Pure love",
    bgFrom: "#3a1d2a",
    bgTo: "#5a2a3c",
    halo: "rgba(255, 190, 200, 0.32)",
    petalLight: "#ffd5dc",
    petalDark: "#e07a93",
    petalStroke: "#8a3a52",
    centre: "#a83560",
    centreGlow: "#ff8aab",
    shape: "carnation",
  },
  {
    // Forget-me-nots in their iconic sky blue with a buttery centre.
    id: "forget-me-nots",
    label: "Forget-me-nots",
    meaning: "I will never forget you",
    bgFrom: "#142640",
    bgTo: "#1f3a64",
    halo: "rgba(190, 215, 255, 0.35)",
    petalLight: "#a8c8f0",
    petalDark: "#5a85c4",
    petalStroke: "#2a4a7a",
    centre: "#f4c84a",
    centreGlow: "#ffe690",
    shape: "forget-me-not",
  },
];

// Hand-drawn SVG flower used in place of emoji. Petal nodes are individually
// animated via CSS so each bloom "opens" on mount and sways with a slight
// per-petal delay, giving the wall a subtly organic feel.
function FlowerSvg({ spec, size = 64 }: { spec: FlowerSpec; size?: number }) {
  const { halo, petalLight, petalDark, petalStroke, centre, centreGlow, shape } = spec;
  // A unique gradient id per shape so two flowers on the same page don't
  // clash (they share spec but each <svg> root holds its own <defs>).
  const gid = `pg-${shape}`;
  const cid = `cg-${shape}`;
  const hid = `hg-${shape}`;

  const petalCount =
    shape === "lily" ? 6 :
    shape === "rose" ? 8 :
    shape === "carnation" ? 9 :
    shape === "forget-me-not" ? 5 : 14;
  const ry =
    shape === "lily" ? 22 :
    shape === "mum" ? 14 :
    shape === "rose" ? 13 :
    shape === "carnation" ? 15 : 10;
  const rx =
    shape === "lily" ? 6 :
    shape === "mum" ? 4 :
    shape === "rose" ? 8 :
    shape === "carnation" ? 5 : 9;
  const cy =
    shape === "lily" ? -20 :
    shape === "mum" ? -12 :
    shape === "rose" ? -11 :
    shape === "carnation" ? -12 : -10;

  const petals = Array.from({ length: petalCount }, (_, i) => {
    const angle = (360 / petalCount) * i;
    return (
      <ellipse
        key={i}
        className="flower-petal"
        cx="0"
        cy={cy}
        rx={rx}
        ry={ry}
        fill={`url(#${gid})`}
        stroke={petalStroke}
        strokeWidth="0.7"
        strokeOpacity="0.55"
        transform={`rotate(${angle})`}
        style={{ animationDelay: `${i * 45}ms`, transformOrigin: "0 0" }}
      />
    );
  });

  // Dense inner ring for chrysanthemums and carnations — gives the bloom the
  // layered, packed look these cemetery flowers have in real life.
  const inner =
    shape === "mum" || shape === "carnation"
      ? Array.from({ length: 10 }, (_, i) => {
          const angle = (360 / 10) * i + 18;
          return (
            <ellipse
              key={`inner-${i}`}
              className="flower-petal flower-petal-inner"
              cx="0"
              cy={shape === "mum" ? -7 : -6}
              rx="3"
              ry={shape === "mum" ? 8 : 7}
              fill={petalDark}
              stroke={petalStroke}
              strokeWidth="0.5"
              strokeOpacity="0.4"
              transform={`rotate(${angle})`}
              style={{ animationDelay: `${i * 30 + 250}ms`, transformOrigin: "0 0" }}
            />
          );
        })
      : null;

  // Sparkle dots that orbit a hovered bloom — six pre-positioned, animated
  // by CSS only when the parent .flower-cell is hovered. Cheap and decorative.
  const sparkles = Array.from({ length: 6 }, (_, i) => {
    const a = (360 / 6) * i;
    const r = 26;
    const x = Math.cos((a * Math.PI) / 180) * r;
    const y = Math.sin((a * Math.PI) / 180) * r;
    return (
      <circle
        key={`spk-${i}`}
        className="flower-sparkle"
        cx={x}
        cy={y}
        r="1.2"
        fill={centreGlow}
        style={{ animationDelay: `${i * 120}ms` }}
      />
    );
  });

  return (
    <svg
      viewBox="-36 -40 72 78"
      width={size}
      height={size}
      aria-hidden
      className="flower-svg"
    >
      <defs>
        {/* Petal gradient — light tip → dark base, gives each petal volume. */}
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={petalLight} />
          <stop offset="65%" stopColor={petalLight} stopOpacity="0.95" />
          <stop offset="100%" stopColor={petalDark} />
        </linearGradient>
        {/* Centre glow — bright pollen core. */}
        <radialGradient id={cid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={centreGlow} />
          <stop offset="60%" stopColor={centre} />
          <stop offset="100%" stopColor={centre} stopOpacity="0.6" />
        </radialGradient>
        {/* Backdrop halo — radial light that always sits behind the bloom. */}
        <radialGradient id={hid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={halo} />
          <stop offset="100%" stopColor={halo} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The halo guarantees contrast even on light cards. */}
      <circle cx="0" cy="-4" r="32" fill={`url(#${hid})`} className="flower-halo" />

      {/* Stem grows in on mount. */}
      <path
        d="M 0 30 Q 2 16 0 0"
        stroke="#3d6a3d"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        className="flower-stem"
      />
      {/* Pair of leaves for a fuller silhouette. */}
      <path
        d="M 0 16 Q 10 10 14 18 Q 6 18 0 18"
        fill="#4a8a3a"
        stroke="#2d5a25"
        strokeWidth="0.5"
        className="flower-leaf"
      />
      <path
        d="M 0 22 Q -9 17 -12 24 Q -5 24 0 24"
        fill="#5a9a48"
        stroke="#2d5a25"
        strokeWidth="0.5"
        className="flower-leaf flower-leaf-2"
      />

      <g className="flower-bloom">
        {petals}
        {inner}
        {/* Centre — radial gradient + a subtle pulsing dot on top. */}
        <circle
          cx="0"
          cy="-4"
          r={shape === "lily" ? 3.5 : 5}
          fill={`url(#${cid})`}
          className="flower-centre"
        />
        <circle
          cx="0"
          cy="-4"
          r={shape === "lily" ? 1.4 : 2}
          fill={centreGlow}
          className="flower-pollen"
        />
      </g>

      {/* Sparkle ring — only animates on hover via CSS. */}
      <g className="flower-sparkles">{sparkles}</g>
    </svg>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function DigitalRituals({ slug, code, deceasedName }: Props) {
  const { data, isLoading } = useMemorialRituals(slug, code);
  const create = useCreateRitual(slug, code);

  const [tab, setTab] = useState<RitualType>("candle");
  const [composeOpen, setComposeOpen] = useState(false);
  const [justAddedId, setJustAddedId] = useState<number | null>(null);

  const totals: RitualTotals = data?.totals ?? {
    candle: { active: 0, total: 0 },
    flower: { active: 0, total: 0 },
    prayer: { active: 0, total: 0 },
  };
  const rituals = data?.rituals ?? [];
  const filtered = rituals.filter((r) => r.type === tab);
  const marketplaceProducts = data?.marketplace?.products ?? { candle: [], flower: [], prayer: [] };
  const realOrderCount = data?.marketplace?.realOrderCount ?? 0;
  const tabProducts = marketplaceProducts[tab] ?? [];

  // Used to celebrate the visitor's own contribution with a brief glow ring.
  useEffect(() => {
    if (!justAddedId) return;
    const t = window.setTimeout(() => setJustAddedId(null), 4000);
    return () => window.clearTimeout(t);
  }, [justAddedId]);

  const ritualLabel = useMemo(
    () => (deceasedName ? `for ${deceasedName}` : "for this memorial"),
    [deceasedName],
  );

  return (
    <section
      data-testid="rituals-section"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--site-bg)) 0%, hsl(var(--site-muted)) 100%)",
        borderTop: "1px solid hsl(var(--site-border))",
        borderBottom: "1px solid hsl(var(--site-border))",
      }}
      className="rituals-root py-12 md:py-16"
    >
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center mb-8">
          <div
            className="text-xs uppercase tracking-widest font-semibold mb-2 inline-flex items-center gap-1.5"
            style={{ color: "hsl(var(--site-primary))" }}
          >
            <Heart className="h-3 w-3" />
            Digital Rituals
          </div>
          <h2
            style={{ fontFamily: "var(--site-font-heading, inherit)" }}
            className="text-3xl md:text-4xl font-semibold mb-2"
          >
            Leave a tribute {ritualLabel}
          </h2>
          <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-sm md:text-base">
            Light a candle, offer flowers, or leave a prayer. Your gesture is shared
            with everyone who visits this memorial.
          </p>

          {/* Real-order badge — surfaces tributes the cemetery has already
              fulfilled in person, integrating the digital wall with the
              cemetery's marketplace orders for this person. */}
          {realOrderCount > 0 ? (
            <div
              data-testid="rituals-real-order-badge"
              className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 text-xs font-semibold"
              style={{
                background: "hsl(var(--site-card))",
                color: "hsl(var(--site-fg))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "999px",
              }}
            >
              <ShoppingBag className="h-3 w-3" style={{ color: "hsl(var(--site-primary))" }} />
              <span>
                {realOrderCount} real {realOrderCount === 1 ? "tribute" : "tributes"} fulfilled by the cemetery
              </span>
            </div>
          ) : null}
        </div>

        {/* Counter pills — read at-a-glance how many people have already left
            a ritual. Active ≠ all-time so a 24h-old candle still "counts"
            toward the lifetime total without crowding the wall. */}
        <RitualCounters totals={totals} active={tab} onChange={setTab} />

        {/* Compose CTA + secondary "send a real one" CTA when the cemetery
            has matching products in their catalogue. */}
        <div className="text-center mb-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setComposeOpen(true)}
            data-testid="rituals-compose-open"
            style={{
              background: "hsl(var(--site-primary))",
              color: "hsl(var(--site-primary-fg))",
              borderRadius: "var(--site-radius)",
            }}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold hover:opacity-90 transition-all shadow-lg ritual-cta-glow"
          >
            {tab === "candle" ? <Flame className="h-4 w-4" /> : null}
            {tab === "flower" ? <Flower2 className="h-4 w-4" /> : null}
            {tab === "prayer" ? <Mic className="h-4 w-4" /> : null}
            {tab === "candle" ? "Light a candle" : tab === "flower" ? "Offer flowers" : "Leave a prayer"}
          </button>
          {tabProducts.length > 0 ? (
            <Link
              href={marketplaceHref({ slug, code, deceasedName, productSlug: tabProducts[0]!.slug })}
              data-testid="rituals-marketplace-cta"
              style={{
                background: "hsl(var(--site-card))",
                color: "hsl(var(--site-fg))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold hover:opacity-90 transition-all"
            >
              <Sparkles className="h-4 w-4" style={{ color: "hsl(var(--site-primary))" }} />
              Send a real {tab === "candle" ? "candle" : tab === "flower" ? "bouquet" : "service"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>

        {/* Real-product upsell strip — surfaces the cemetery's actual
            catalogue alongside the virtual wall. Tapping a card deep-links
            to product detail with the memorial code already attached. */}
        {tabProducts.length > 0 ? (
          <div
            data-testid="rituals-product-upsell"
            className="mb-8"
          >
            <div
              className="flex items-baseline justify-between mb-3 px-1"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--site-muted-fg))" }}>
                Or send a real {tab === "candle" ? "candle" : tab === "flower" ? "tribute" : "service"} from the cemetery
              </h3>
              <Link
                href={marketplaceHref({ slug, code, deceasedName })}
                style={{ color: "hsl(var(--site-primary))" }}
                className="text-xs hover:underline"
                data-testid="rituals-marketplace-link-all"
              >
                Browse all →
              </Link>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {tabProducts.map((p) => (
                <Link
                  key={p.id}
                  href={marketplaceHref({ slug, code, deceasedName, productSlug: p.slug })}
                  data-testid={`ritual-product-${p.slug}`}
                  style={{
                    background: "hsl(var(--site-card))",
                    border: "1px solid hsl(var(--site-border))",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 flex"
                >
                  <div
                    aria-hidden
                    style={{
                      width: 84,
                      height: 84,
                      flexShrink: 0,
                      background: p.photos[0]
                        ? `url(${p.photos[0]}) center/cover`
                        : "hsl(var(--site-muted))",
                    }}
                  />
                  <div className="p-3 flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-sm font-semibold truncate" style={{ color: "hsl(var(--site-fg))" }}>
                      {p.name}
                    </div>
                    <div className="text-xs opacity-70 truncate mb-1" style={{ color: "hsl(var(--site-muted-fg))" }}>
                      {p.type === "service" ? "Service" : "Product"}
                    </div>
                    <div className="text-sm font-semibold" style={{ color: "hsl(var(--site-primary))" }}>
                      ${p.price.toFixed(2)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* The wall — different layout per ritual type. */}
        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-10" style={{ color: "hsl(var(--site-muted-fg))" }}>
              <p className="text-sm">Lighting the wall…</p>
            </div>
          ) : tab === "candle" ? (
            <CandleWall rituals={filtered} highlightId={justAddedId} />
          ) : tab === "flower" ? (
            <FlowerGarden rituals={filtered} highlightId={justAddedId} />
          ) : (
            <PrayerWall rituals={filtered} highlightId={justAddedId} />
          )}
          {filtered.length === 0 && !isLoading ? (
            <div className="text-center py-10" style={{ color: "hsl(var(--site-muted-fg))" }}>
              <p className="text-sm italic">
                {tab === "candle"
                  ? "Be the first to light a candle."
                  : tab === "flower"
                  ? "No flowers yet — be the first to offer a bouquet."
                  : "No prayers yet — share the first."}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {composeOpen ? (
        <ComposeDialog
          type={tab}
          submitting={create.isPending}
          onClose={() => setComposeOpen(false)}
          onSubmit={async (payload) => {
            try {
              const result = await create.mutateAsync(payload);
              setJustAddedId(result.ritual.id);
              setComposeOpen(false);
            } catch {
              // Errors surface inside the dialog itself.
            }
          }}
          error={create.error as (Error & { status?: number }) | null}
        />
      ) : null}
    </section>
  );
}

// --- counters ---------------------------------------------------------------
function RitualCounters({
  totals,
  active,
  onChange,
}: {
  totals: RitualTotals;
  active: RitualType;
  onChange: (t: RitualType) => void;
}) {
  const pills: { id: RitualType; label: string; icon: React.ReactNode }[] = [
    { id: "candle", label: "Candles", icon: <Flame className="h-4 w-4" /> },
    { id: "flower", label: "Flowers", icon: <Flower2 className="h-4 w-4" /> },
    { id: "prayer", label: "Prayers", icon: <Mic className="h-4 w-4" /> },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mb-6" data-testid="ritual-counters">
      {pills.map((p) => {
        const t = totals[p.id];
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            data-testid={`ritual-tab-${p.id}`}
            style={{
              background: isActive ? "hsl(var(--site-primary))" : "hsl(var(--site-card))",
              color: isActive ? "hsl(var(--site-primary-fg))" : "hsl(var(--site-fg))",
              border: `1px solid ${isActive ? "hsl(var(--site-primary))" : "hsl(var(--site-border))"}`,
              borderRadius: "var(--site-radius)",
            }}
            className="px-3 py-3 text-center transition-all hover:opacity-90"
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              {p.icon}
              <span className="text-xs uppercase tracking-wider font-semibold">
                {p.label}
              </span>
            </div>
            <div className="text-2xl font-semibold tabular-nums" data-testid={`ritual-count-${p.id}`}>
              {t.active}
              {t.total > t.active ? (
                <span className="text-xs opacity-70 ml-1">/ {t.total} all time</span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// --- candle wall ------------------------------------------------------------
function Candle({ ritual, highlight }: { ritual: PublicRitual; highlight: boolean }) {
  const color = CANDLE_COLORS.find((c) => c.id === ritual.variant) ?? CANDLE_COLORS[0]!;
  // Stable per-candle flicker delay + ember drift so the wall flickers out
  // of phase. We derive both from the ritual id so they're deterministic
  // across renders (no jumpy SSR/CSR mismatch) but vary candle-to-candle.
  const delay = (ritual.id % 13) * 137;
  const seed = ((ritual.id * 73) % 2400) / 1000; // 0–2.4s
  const drift = (((ritual.id * 31) % 9) - 4) + "px"; // -4..+4 px ember drift
  return (
    <div
      data-testid={`ritual-candle-${ritual.id}`}
      className={`candle-cell flex flex-col items-center gap-2 ${highlight ? "candle-highlight" : ""}`}
      title={`Lit by ${ritual.visitorName ?? "Anonymous"} · ${timeAgo(ritual.createdAt)}`}
      style={{
        // Per-candle jewel-toned shrine box (mirrors the flower garden's
        // card pattern). Wax colour is echoed in the backdrop so each
        // candle reads as its own little altar.
        background: `linear-gradient(165deg, ${color.bgFrom} 0%, ${color.bgTo} 100%)`,
        border: `1px solid ${color.bgTo}`,
        borderRadius: "var(--site-radius)",
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.28)",
        ["--candle-card-halo" as string]: color.halo,
      }}
    >
      <div
        className="candle-stage"
        style={{
          animationDelay: `${delay}ms`,
          // Per-candle CSS-variable seed used by drip/smoke/ember keyframes.
          ["--candle-seed" as string]: `${seed}s`,
          ["--ember-drift" as string]: drift,
        }}
      >
        {/* Smoke wisps drifting up — two layers offset in time. */}
        <div className="candle-smoke" aria-hidden />
        <div className="candle-smoke candle-smoke-2" aria-hidden />
        {/* Tiny embers floating off the flame. */}
        <div className="candle-ember candle-ember-1" aria-hidden />
        <div className="candle-ember candle-ember-2" aria-hidden />
        <div className="candle-ember candle-ember-3" aria-hidden />
        <div className="flame" style={{ ["--flame-color" as string]: color.hex }} aria-hidden>
          <div className="flame-glow" />
          <div className="flame-outer" />
          <div className="flame-core" />
        </div>
        <div className="wick" />
        <div className="candle-body" />
        <div className="candle-base" />
      </div>
      <div className="text-center">
        <div className="text-[11px] font-medium truncate max-w-[100px]" style={{ color: "#fff" }}>
          {ritual.visitorName ?? "Anonymous"}
        </div>
        <div className="text-[10px] opacity-75" style={{ color: "#fff" }}>
          {timeAgo(ritual.createdAt)}
        </div>
      </div>
      {ritual.message ? (
        <div
          className="text-[10px] italic px-2 py-1 max-w-[120px] text-center"
          style={{
            color: "rgba(255, 255, 255, 0.85)",
            background: "rgba(0, 0, 0, 0.25)",
            borderRadius: "calc(var(--site-radius) / 2)",
          }}
        >
          "{ritual.message}"
        </div>
      ) : null}
    </div>
  );
}

function CandleWall({ rituals, highlightId }: { rituals: PublicRitual[]; highlightId: number | null }) {
  return (
    <div
      className="candle-wall grid gap-x-2 gap-y-4 sm:gap-x-4 sm:gap-y-6 justify-items-stretch"
      style={{
        // Tight 2-up on phones, growing to ~auto-fill on tablet+. Items
        // stretch so each shrine card has equal width per row. Padding
        // is owned by the .candle-wall CSS rule (mobile-first breakpoints).
        gridTemplateColumns: "repeat(auto-fill, minmax(min(140px, 100%), 1fr))",
        background: "linear-gradient(180deg, transparent 0%, hsl(var(--site-card) / 0.4) 100%)",
        borderRadius: "var(--site-radius)",
      }}
      data-testid="candle-wall"
    >
      {rituals.map((r) => (
        <Candle key={r.id} ritual={r} highlight={r.id === highlightId} />
      ))}
    </div>
  );
}

// --- flower garden ----------------------------------------------------------
function FlowerCard({ ritual, highlight }: { ritual: PublicRitual; highlight: boolean }) {
  // Fall back to white roses (the universal cemetery flower) if the stored
  // variant predates the cemetery-only picker (e.g. legacy "sunflowers").
  const kind = FLOWER_KINDS.find((k) => k.id === ritual.variant) ?? FLOWER_KINDS[0]!;
  return (
    <div
      data-testid={`ritual-flower-${ritual.id}`}
      className={`flower-cell ${highlight ? "flower-highlight" : ""}`}
      style={{
        // Per-flower jewel-toned gradient. Always dark behind the bloom so
        // even pale petals (white roses) stand out. Border picks up the
        // halo tint so the card feels colour-coordinated with the flower.
        background: `linear-gradient(135deg, ${kind.bgFrom} 0%, ${kind.bgTo} 100%)`,
        border: `1px solid ${kind.bgTo}`,
        borderRadius: "var(--site-radius)",
        // Used by CSS to draw the celebrate ring + sparkle tints.
        ["--flower-halo" as string]: kind.halo,
        ["--flower-glow" as string]: kind.centreGlow,
      }}
    >
      <div className="flower-art" aria-hidden>
        <FlowerSvg spec={kind} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: "#fff" }}>
          {ritual.visitorName ?? "Anonymous"}
        </div>
        <div className="text-[11px] opacity-80 mb-1" style={{ color: "#fff" }}>
          {kind.label} · {timeAgo(ritual.createdAt)}
        </div>
        {ritual.message ? (
          <div className="text-xs italic line-clamp-2" style={{ color: "rgba(255,255,255,0.85)" }}>
            "{ritual.message}"
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FlowerGarden({ rituals, highlightId }: { rituals: PublicRitual[]; highlightId: number | null }) {
  return (
    <div
      className="flower-garden grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))" }}
      data-testid="flower-garden"
    >
      {rituals.map((r) => (
        <FlowerCard key={r.id} ritual={r} highlight={r.id === highlightId} />
      ))}
    </div>
  );
}

// --- prayer wall ------------------------------------------------------------
function PrayerCard({ ritual, highlight }: { ritual: PublicRitual; highlight: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <div
      data-testid={`ritual-prayer-${ritual.id}`}
      className={`prayer-card ${highlight ? "prayer-highlight" : ""}`}
      style={{
        background: "hsl(var(--site-card))",
        border: "1px solid hsl(var(--site-border))",
        borderRadius: "var(--site-radius)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="prayer-avatar"
          style={{ background: "hsl(var(--site-primary))", color: "hsl(var(--site-primary-fg))" }}
          aria-hidden
        >
          {(ritual.visitorName ?? "A").trim().charAt(0).toUpperCase() || "A"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-sm font-semibold" style={{ color: "hsl(var(--site-fg))" }}>
              {ritual.visitorName ?? "Anonymous"}
            </div>
            <div className="text-[11px] opacity-60" style={{ color: "hsl(var(--site-muted-fg))" }}>
              {timeAgo(ritual.createdAt)}
            </div>
          </div>
          {ritual.message ? (
            <p
              className="text-sm leading-relaxed whitespace-pre-line italic"
              style={{ color: "hsl(var(--site-fg))" }}
            >
              "{ritual.message}"
            </p>
          ) : null}
          {ritual.audioDataUrl ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={togglePlay}
                data-testid={`ritual-prayer-play-${ritual.id}`}
                style={{
                  background: "hsl(var(--site-primary))",
                  color: "hsl(var(--site-primary-fg))",
                  borderRadius: "999px",
                }}
                className="h-8 w-8 inline-flex items-center justify-center hover:opacity-90"
                aria-label={playing ? "Pause prayer" : "Play prayer"}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <div className="prayer-waveform" aria-hidden>
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className={`bar ${playing ? "bar-active" : ""}`}
                    style={{ animationDelay: `${(i % 8) * 80}ms` }}
                  />
                ))}
              </div>
              <span className="text-[11px] tabular-nums opacity-70" style={{ color: "hsl(var(--site-muted-fg))" }}>
                {ritual.audioDurationMs ? `${Math.round(ritual.audioDurationMs / 1000)}s` : ""}
              </span>
              <audio
                ref={audioRef}
                src={ritual.audioDataUrl}
                onEnded={() => setPlaying(false)}
                onPause={() => setPlaying(false)}
                preload="none"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PrayerWall({ rituals, highlightId }: { rituals: PublicRitual[]; highlightId: number | null }) {
  return (
    <div className="flex flex-col gap-3 max-w-2xl mx-auto" data-testid="prayer-wall">
      {rituals.map((r) => (
        <PrayerCard key={r.id} ritual={r} highlight={r.id === highlightId} />
      ))}
    </div>
  );
}

// --- compose dialog ---------------------------------------------------------
type ComposeProps = {
  type: RitualType;
  submitting: boolean;
  onSubmit: (payload: {
    type: RitualType;
    variant?: string | null;
    visitorName?: string | null;
    message?: string | null;
    audioDataUrl?: string | null;
    audioDurationMs?: number | null;
  }) => Promise<void> | void;
  onClose: () => void;
  error: (Error & { status?: number }) | null;
};

function ComposeDialog(props: ComposeProps) {
  const { type, submitting, onSubmit, onClose, error } = props;
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<string>(
    type === "candle" ? "white" : type === "flower" ? "white-roses" : "",
  );
  const [audio, setAudio] = useState<{ dataUrl: string; durationMs: number } | null>(null);

  // Lock the page scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Friendly error messages for the most common failure modes.
  const errMsg = error
    ? error.status === 429
      ? "You're leaving rituals very fast — please pause for a moment."
      : error.status === 400 && type === "prayer" && !message && !audio
      ? "Please write a prayer or record one."
      : "Something went wrong. Please try again."
    : null;

  const submit = () => {
    void onSubmit({
      type,
      variant: variant || null,
      visitorName: name.trim() || null,
      message: message.trim() || null,
      audioDataUrl: audio?.dataUrl ?? null,
      audioDurationMs: audio?.durationMs ?? null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="ritual-compose"
    >
      <div
        className="ritual-compose-card w-full max-w-lg max-h-[92vh] overflow-y-auto"
        style={{
          background: "hsl(var(--site-card))",
          border: "1px solid hsl(var(--site-border))",
          borderRadius: "var(--site-radius)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid hsl(var(--site-border))" }}
        >
          <h3 className="text-lg font-semibold inline-flex items-center gap-2">
            {type === "candle" ? <Flame className="h-4 w-4" style={{ color: "#f59e0b" }} /> : null}
            {type === "flower" ? <Flower2 className="h-4 w-4" style={{ color: "#ec4899" }} /> : null}
            {type === "prayer" ? <Mic className="h-4 w-4" style={{ color: "hsl(var(--site-primary))" }} /> : null}
            {type === "candle" ? "Light a candle" : type === "flower" ? "Offer flowers" : "Leave a prayer"}
          </h3>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center hover:opacity-80"
            aria-label="Close"
            data-testid="ritual-compose-close"
            style={{ borderRadius: "999px" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Variant picker (candles + flowers) */}
          {type === "candle" ? (
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold mb-2 block opacity-70">
                Choose a flame
              </label>
              <div className="flex flex-wrap gap-2">
                {CANDLE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setVariant(c.id)}
                    data-testid={`candle-color-${c.id}`}
                    style={{
                      background: variant === c.id ? "hsl(var(--site-primary))" : "hsl(var(--site-muted))",
                      color: variant === c.id ? "hsl(var(--site-primary-fg))" : "hsl(var(--site-fg))",
                      border: `1px solid ${variant === c.id ? "hsl(var(--site-primary))" : "hsl(var(--site-border))"}`,
                      borderRadius: "999px",
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm transition"
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: c.hex, boxShadow: `0 0 8px ${c.hex}` }}
                    />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {type === "flower" ? (
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold mb-2 block opacity-70">
                Pick a bouquet
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FLOWER_KINDS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setVariant(k.id)}
                    data-testid={`flower-kind-${k.id}`}
                    style={{
                      background: variant === k.id ? "hsl(var(--site-primary))" : "hsl(var(--site-muted))",
                      color: variant === k.id ? "hsl(var(--site-primary-fg))" : "hsl(var(--site-fg))",
                      border: `1px solid ${variant === k.id ? "hsl(var(--site-primary))" : "hsl(var(--site-border))"}`,
                      borderRadius: "var(--site-radius)",
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm transition flower-pick"
                    title={k.meaning}
                  >
                    <span className="flower-pick-art" aria-hidden>
                      <FlowerSvg spec={k} />
                    </span>
                    <span className="flex flex-col items-start min-w-0">
                      <span className="font-semibold leading-tight truncate">{k.label}</span>
                      <span className="text-[10px] opacity-70 leading-tight truncate">{k.meaning}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Name */}
          <div>
            <label htmlFor="ritual-name" className="text-xs uppercase tracking-wider font-semibold mb-2 block opacity-70">
              Your name (optional)
            </label>
            <input
              id="ritual-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="Anonymous"
              data-testid="ritual-name-input"
              style={{
                background: "hsl(var(--site-muted))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
                color: "hsl(var(--site-fg))",
              }}
              className="w-full px-3 py-2 text-sm"
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="ritual-message" className="text-xs uppercase tracking-wider font-semibold mb-2 block opacity-70">
              {type === "prayer" ? "Your prayer" : type === "candle" ? "Dedication (optional)" : "Note (optional)"}
            </label>
            <textarea
              id="ritual-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              placeholder={
                type === "prayer"
                  ? "Words from the heart…"
                  : type === "candle"
                  ? "May they rest in peace…"
                  : "A few kind words…"
              }
              rows={3}
              data-testid="ritual-message-input"
              style={{
                background: "hsl(var(--site-muted))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
                color: "hsl(var(--site-fg))",
                resize: "vertical",
              }}
              className="w-full px-3 py-2 text-sm"
            />
            <div className="text-[10px] opacity-50 text-right mt-1">{message.length}/1000</div>
          </div>

          {/* Voice prayer recorder */}
          {type === "prayer" ? (
            <VoiceRecorder audio={audio} onChange={setAudio} />
          ) : null}

          {errMsg ? (
            <div
              className="text-sm px-3 py-2"
              style={{ color: "#c0392b", background: "rgba(192,57,43,0.08)", borderRadius: "var(--site-radius)" }}
              data-testid="ritual-error"
            >
              {errMsg}
            </div>
          ) : null}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: "1px solid hsl(var(--site-border))" }}
        >
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50"
            style={{ color: "hsl(var(--site-fg))" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            data-testid="ritual-submit"
            style={{
              background: "hsl(var(--site-primary))",
              color: "hsl(var(--site-primary-fg))",
              borderRadius: "var(--site-radius)",
            }}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting
              ? "Sending…"
              : type === "candle"
              ? "Light it"
              : type === "flower"
              ? "Offer them"
              : "Send prayer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- voice recorder ---------------------------------------------------------
// Records up to 60s using MediaRecorder + the browser's mic permission.
// Falls back to a plain "not supported" notice on browsers without
// MediaRecorder. We base64-encode the resulting blob into a data URL the
// API endpoint accepts directly — no object-storage round trip needed.
const MAX_RECORD_MS = 60_000;
const MAX_AUDIO_BYTES = 950_000; // server cap is ~1MB raw / ~1.4MB b64

function VoiceRecorder({
  audio,
  onChange,
}: {
  audio: { dataUrl: string; durationMs: number } | null;
  onChange: (a: { dataUrl: string; durationMs: number } | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  // True when the page is running inside an iframe (e.g. the Replit
  // workspace preview pane). The browser blocks getUserMedia in iframes
  // unless the parent set `allow="microphone"`, which third-party
  // previews rarely do — so we surface a hint that opening the link in
  // a new tab is required to record audio.
  const inIframe =
    typeof window !== "undefined" && window.self !== window.top;

  const cleanupTimers = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    if (stopTimeoutRef.current) { window.clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
  };

  // Force-stop recording + release the mic + clear timers if the component
  // unmounts mid-recording (e.g. visitor closes the dialog with Esc). Without
  // this the browser keeps the red "recording" indicator, the interval keeps
  // calling setState on an unmounted component, and the auto-stop timeout
  // can fire long after the dialog is gone.
  useEffect(() => {
    return () => {
      cleanupTimers();
      const r = recorderRef.current;
      if (r) {
        try {
          if (r.state === "recording") r.stop();
        } catch {
          // ignore — best-effort
        }
        // Stop any tracks the recorder is still holding so the mic indicator
        // disappears even if `onstop` never fires (e.g. component unmount
        // races with the stop event).
        try {
          r.stream?.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        cleanupTimers();
        // Always release the mic; otherwise the browser shows the recording
        // indicator forever and visitors get spooked.
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        if (blob.size === 0) {
          setError("No audio was captured. Please try again.");
          setRecording(false);
          return;
        }
        if (blob.size > MAX_AUDIO_BYTES) {
          setError("Recording is too long. Please keep it under 60 seconds.");
          setRecording(false);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result ?? "");
          if (!dataUrl) { setError("Could not encode audio."); return; }
          onChange({ dataUrl, durationMs: Date.now() - startedAtRef.current });
          setRecording(false);
        };
        reader.onerror = () => setError("Could not read audio.");
        reader.readAsDataURL(blob);
      };
      rec.start();
      startedAtRef.current = Date.now();
      setRecording(true);
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 100);
      // Hard cap — auto-stop at MAX_RECORD_MS so visitors can't accidentally
      // record a 10-minute soliloquy that fails the server size check.
      stopTimeoutRef.current = window.setTimeout(() => {
        try { rec.state === "recording" && rec.stop(); } catch { /* noop */ }
      }, MAX_RECORD_MS);
    } catch (e) {
      // Surface a *specific* reason so visitors know whether to grant
      // permission, plug in a mic, switch browsers, or open the page in a
      // new tab (iframe sandboxing is the most common gotcha when the
      // memorial is viewed inside the Replit workspace preview).
      const err = e as Error & { name?: string; message?: string };
      const name = err?.name ?? "";
      let msg = "Could not start recording. You can still type your prayer above.";
      if (name === "NotAllowedError" || name === "SecurityError") {
        msg = inIframe
          ? "Microphone is blocked inside this preview frame. Open the memorial in a new tab to record a voice prayer, or just type it above."
          : "Microphone access was denied. Allow microphone access in your browser, or just type your prayer above.";
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        msg = "No microphone was found on this device. You can still type your prayer above.";
      } else if (name === "NotReadableError") {
        msg = "Your microphone is busy in another app. Close it and try again, or type your prayer above.";
      } else if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
        msg = "Voice recording requires a secure (https://) connection. Type your prayer above instead.";
      }
      setError(msg);
    }
  };

  const stop = () => {
    const r = recorderRef.current;
    if (r && r.state === "recording") r.stop();
  };

  const clear = () => {
    onChange(null);
    setError(null);
    setElapsed(0);
  };

  if (!supported) {
    return (
      <div className="text-xs italic opacity-70" style={{ color: "hsl(var(--site-muted-fg))" }}>
        Voice recording isn't supported on this browser. Your written prayer will be sent on its own.
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs uppercase tracking-wider font-semibold mb-2 block opacity-70">
        Voice prayer (optional)
      </label>
      <div
        style={{
          background: "hsl(var(--site-muted))",
          border: "1px solid hsl(var(--site-border))",
          borderRadius: "var(--site-radius)",
        }}
        className="px-3 py-3"
      >
        {audio ? (
          <div className="flex items-center gap-3" data-testid="ritual-voice-recorded">
            <Mic className="h-4 w-4" style={{ color: "hsl(var(--site-primary))" }} />
            <span className="text-sm flex-1">
              Voice prayer recorded ({Math.round(audio.durationMs / 1000)}s)
            </span>
            <button
              onClick={clear}
              data-testid="ritual-voice-clear"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 hover:opacity-80"
              style={{ color: "#c0392b" }}
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </div>
        ) : recording ? (
          <div className="flex items-center gap-3" data-testid="ritual-voice-recording">
            <span className="record-dot" aria-hidden />
            <span className="text-sm flex-1 tabular-nums">
              Recording… {(elapsed / 1000).toFixed(1)}s / 60s
            </span>
            <button
              onClick={stop}
              data-testid="ritual-voice-stop"
              style={{
                background: "#c0392b",
                color: "white",
                borderRadius: "var(--site-radius)",
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold hover:opacity-90"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          </div>
        ) : (
          <button
            onClick={start}
            data-testid="ritual-voice-start"
            style={{
              background: "hsl(var(--site-card))",
              color: "hsl(var(--site-fg))",
              border: "1px dashed hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }}
            className="w-full inline-flex items-center justify-center gap-2 py-2 text-sm hover:opacity-90"
          >
            <Mic className="h-4 w-4" />
            Record a voice prayer
          </button>
        )}
        {error ? (
          <div
            className="text-xs mt-2"
            style={{ color: "#c0392b" }}
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
