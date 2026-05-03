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
import { Flame, Flower2, Mic, Square, Send, Trash2, Heart, Play, Pause, X } from "lucide-react";
import {
  useMemorialRituals,
  useCreateRitual,
  type PublicRitual,
  type RitualType,
  type RitualTotals,
} from "./api";
import "./digital-rituals.css";

type Props = { slug: string; code: string; deceasedName: string | null };

type CandleColor = "white" | "gold" | "amber" | "rose";
const CANDLE_COLORS: { id: CandleColor; label: string; hex: string }[] = [
  { id: "white", label: "Pure white", hex: "#fff7e0" },
  { id: "gold", label: "Soft gold", hex: "#ffd479" },
  { id: "amber", label: "Warm amber", hex: "#ffae54" },
  { id: "rose", label: "Rose", hex: "#ffb1c4" },
];

type FlowerKind = "white-roses" | "lilies" | "sunflowers" | "chrysanthemums" | "mixed-bouquet";
const FLOWER_KINDS: { id: FlowerKind; label: string; emoji: string; color: string }[] = [
  { id: "white-roses", label: "White roses", emoji: "🌹", color: "#fce7e7" },
  { id: "lilies", label: "Lilies", emoji: "🌷", color: "#fdf6e3" },
  { id: "sunflowers", label: "Sunflowers", emoji: "🌻", color: "#ffe6a0" },
  { id: "chrysanthemums", label: "Chrysanthemums", emoji: "🌼", color: "#fff1c4" },
  { id: "mixed-bouquet", label: "Mixed bouquet", emoji: "💐", color: "#fde2f3" },
];

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
        </div>

        {/* Counter pills — read at-a-glance how many people have already left
            a ritual. Active ≠ all-time so a 24h-old candle still "counts"
            toward the lifetime total without crowding the wall. */}
        <RitualCounters totals={totals} active={tab} onChange={setTab} />

        {/* Compose CTA */}
        <div className="text-center mb-8">
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
        </div>

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
  // Stable per-candle flicker delay so the wall doesn't pulse in unison.
  const delay = (ritual.id % 13) * 137;
  return (
    <div
      data-testid={`ritual-candle-${ritual.id}`}
      className={`candle-cell flex flex-col items-center gap-2 ${highlight ? "candle-highlight" : ""}`}
      title={`Lit by ${ritual.visitorName ?? "Anonymous"} · ${timeAgo(ritual.createdAt)}`}
    >
      <div className="candle-stage" style={{ animationDelay: `${delay}ms` }}>
        <div className="flame" style={{ ["--flame-color" as string]: color.hex }} aria-hidden>
          <div className="flame-core" />
          <div className="flame-glow" />
        </div>
        <div className="wick" />
        <div className="candle-body" />
        <div className="candle-base" />
      </div>
      <div className="text-center">
        <div className="text-[11px] font-medium truncate max-w-[100px]" style={{ color: "hsl(var(--site-fg))" }}>
          {ritual.visitorName ?? "Anonymous"}
        </div>
        <div className="text-[10px] opacity-60" style={{ color: "hsl(var(--site-muted-fg))" }}>
          {timeAgo(ritual.createdAt)}
        </div>
      </div>
      {ritual.message ? (
        <div
          className="text-[10px] italic px-2 py-1 max-w-[120px] text-center"
          style={{
            color: "hsl(var(--site-muted-fg))",
            background: "hsl(var(--site-card) / 0.5)",
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
      className="candle-wall grid gap-x-4 gap-y-6 justify-items-center"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        background: "linear-gradient(180deg, transparent 0%, hsl(var(--site-card) / 0.4) 100%)",
        borderRadius: "var(--site-radius)",
        padding: "2.5rem 1.5rem 2rem",
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
  const kind = FLOWER_KINDS.find((k) => k.id === ritual.variant) ?? FLOWER_KINDS[4]!;
  return (
    <div
      data-testid={`ritual-flower-${ritual.id}`}
      className={`flower-cell ${highlight ? "flower-highlight" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${kind.color} 0%, hsl(var(--site-card)) 100%)`,
        border: "1px solid hsl(var(--site-border))",
        borderRadius: "var(--site-radius)",
      }}
    >
      <div className="flower-emoji" aria-hidden>{kind.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: "hsl(var(--site-fg))" }}>
          {ritual.visitorName ?? "Anonymous"}
        </div>
        <div className="text-[11px] opacity-70 mb-1" style={{ color: "hsl(var(--site-fg))" }}>
          {kind.label} · {timeAgo(ritual.createdAt)}
        </div>
        {ritual.message ? (
          <div className="text-xs italic line-clamp-2" style={{ color: "hsl(var(--site-fg))" }}>
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
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
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
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm transition"
                  >
                    <span className="text-xl" aria-hidden>{k.emoji}</span>
                    {k.label}
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
      setError(
        (e as Error)?.name === "NotAllowedError"
          ? "Microphone access was denied. You can still type your prayer above."
          : "Could not start recording.",
      );
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
          <div className="text-xs mt-2" style={{ color: "#c0392b" }}>{error}</div>
        ) : null}
      </div>
    </div>
  );
}
