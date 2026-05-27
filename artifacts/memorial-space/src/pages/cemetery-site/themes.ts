export type ThemeKey =
  | "classic-marble"
  | "modern-minimal"
  | "heritage-garden"
  | "celestial-night"
  | "japanese-zen";

// Each layout key drives a structurally-different memorial hero, lifespan
// strip, and photo gallery — not just a recolour. Memorial.tsx switches
// on this to render genuinely distinct page templates.
//   - split-formal     → portrait card LEFT, name/dates/actions RIGHT
//   - full-bleed       → photography-led hero, portrait fills the band
//   - editorial        → magazine cover, oversized display type centered
//   - monumental       → dark single-column with circular portrait + huge years
//   - vertical-zen     → asymmetric, sumi-e proportions with vertical accent line
export type HeroLayout =
  | "split-formal"
  | "full-bleed"
  | "editorial"
  | "monumental"
  | "vertical-zen";

export type ThemeDef = {
  key: ThemeKey;
  label: string;
  description: string;
  vars: Record<string, string>;
  fontHeading: string;
  fontBody: string;
  fontStack: { heading: string; body: string };
  swatch: { primary: string; background: string };
  heroOverlay: string;
  layout: HeroLayout;
};

export const THEMES: Record<ThemeKey, ThemeDef> = {
  "classic-marble": {
    key: "classic-marble",
    label: "Classic Marble",
    description: "Formal and timeless — deep green, ivory, and elegant serif type.",
    vars: {
      "--site-bg": "42 30% 96%",
      "--site-fg": "150 25% 12%",
      "--site-muted": "42 18% 90%",
      "--site-muted-fg": "150 12% 38%",
      "--site-card": "0 0% 100%",
      "--site-border": "42 18% 86%",
      "--site-primary": "150 45% 24%",
      "--site-primary-fg": "42 30% 97%",
      "--site-accent": "42 65% 52%",
      "--site-radius": "0.375rem",
    },
    fontHeading: "'Cormorant Garamond', 'Playfair Display', serif",
    fontBody: "'Source Serif Pro', Georgia, serif",
    fontStack: {
      heading: "Cormorant+Garamond:wght@500;600;700&family=Playfair+Display:wght@600;700",
      body: "Source+Serif+Pro:wght@400;600",
    },
    swatch: { primary: "hsl(150 45% 24%)", background: "hsl(42 30% 96%)" },
    heroOverlay: "linear-gradient(180deg, hsla(150,30%,8%,0.55), hsla(150,30%,8%,0.75))",
    layout: "split-formal",
  },
  "modern-minimal": {
    key: "modern-minimal",
    label: "Modern Minimal",
    description: "Clean, photography-led — generous whitespace and sharp sans-serif type.",
    vars: {
      "--site-bg": "0 0% 100%",
      "--site-fg": "0 0% 9%",
      "--site-muted": "0 0% 96%",
      "--site-muted-fg": "0 0% 45%",
      "--site-card": "0 0% 100%",
      "--site-border": "0 0% 90%",
      "--site-primary": "0 0% 9%",
      "--site-primary-fg": "0 0% 100%",
      "--site-accent": "210 95% 50%",
      "--site-radius": "0.125rem",
    },
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    fontStack: {
      heading: "Inter:wght@500;600;700;800",
      body: "Inter:wght@400;500",
    },
    swatch: { primary: "hsl(0 0% 9%)", background: "hsl(0 0% 100%)" },
    heroOverlay: "linear-gradient(180deg, hsla(0,0%,0%,0.25), hsla(0,0%,0%,0.55))",
    layout: "full-bleed",
  },
  "heritage-garden": {
    key: "heritage-garden",
    label: "Heritage Garden",
    description: "Warm and botanical — burgundy, cream, and a vintage editorial feel.",
    vars: {
      "--site-bg": "40 35% 94%",
      "--site-fg": "350 25% 14%",
      "--site-muted": "40 25% 88%",
      "--site-muted-fg": "350 12% 38%",
      "--site-card": "40 40% 98%",
      "--site-border": "40 22% 82%",
      "--site-primary": "350 55% 30%",
      "--site-primary-fg": "40 40% 96%",
      "--site-accent": "85 35% 38%",
      "--site-radius": "0.75rem",
    },
    fontHeading: "'Playfair Display', 'Cormorant Garamond', serif",
    fontBody: "'Lora', Georgia, serif",
    fontStack: {
      heading: "Playfair+Display:wght@500;600;700",
      body: "Lora:wght@400;500;600",
    },
    swatch: { primary: "hsl(350 55% 30%)", background: "hsl(40 35% 94%)" },
    heroOverlay: "linear-gradient(180deg, hsla(350,30%,12%,0.45), hsla(350,30%,12%,0.7))",
    layout: "editorial",
  },
  // Dark, ethereal theme — deep indigo background with warm gold accents
  // and a soft cream foreground. Designed for night-watch / starlit-vigil
  // feel; pairs especially well with portraits set against dark backdrops.
  "celestial-night": {
    key: "celestial-night",
    label: "Celestial Night",
    description: "Dark and ethereal — indigo, gold, and soft starlight type.",
    vars: {
      "--site-bg": "232 38% 10%",
      "--site-fg": "42 35% 92%",
      "--site-muted": "232 30% 16%",
      "--site-muted-fg": "42 18% 70%",
      "--site-card": "232 32% 14%",
      "--site-border": "232 25% 24%",
      "--site-primary": "42 75% 62%",
      "--site-primary-fg": "232 38% 10%",
      "--site-accent": "270 55% 70%",
      "--site-radius": "0.5rem",
    },
    fontHeading: "'Cinzel', 'Playfair Display', serif",
    fontBody: "'Cormorant Garamond', Georgia, serif",
    fontStack: {
      heading: "Cinzel:wght@500;600;700",
      body: "Cormorant+Garamond:wght@400;500;600",
    },
    swatch: { primary: "hsl(42 75% 62%)", background: "hsl(232 38% 10%)" },
    heroOverlay: "linear-gradient(180deg, hsla(232,40%,6%,0.55), hsla(232,40%,6%,0.85))",
    layout: "monumental",
  },
  // Calm, contemplative theme inspired by sumi-e ink and washi paper —
  // warm beige paper background, deep ink foreground, and a single
  // cherry-blossom accent. Calligraphic display type echoes the feel.
  "japanese-zen": {
    key: "japanese-zen",
    label: "Japanese Zen",
    description: "Calm and contemplative — washi paper, sumi ink, and a quiet sakura accent.",
    vars: {
      "--site-bg": "36 32% 92%",
      "--site-fg": "20 12% 14%",
      "--site-muted": "36 22% 86%",
      "--site-muted-fg": "20 8% 38%",
      "--site-card": "36 38% 96%",
      "--site-border": "30 14% 78%",
      "--site-primary": "20 12% 14%",
      "--site-primary-fg": "36 32% 95%",
      "--site-accent": "350 55% 72%",
      "--site-radius": "0rem",
    },
    fontHeading: "'Shippori Mincho', 'Noto Serif JP', serif",
    fontBody: "'Noto Serif JP', Georgia, serif",
    fontStack: {
      heading: "Shippori+Mincho:wght@500;600;700",
      body: "Noto+Serif+JP:wght@400;500",
    },
    swatch: { primary: "hsl(20 12% 14%)", background: "hsl(36 32% 92%)" },
    heroOverlay: "linear-gradient(180deg, hsla(20,15%,8%,0.4), hsla(20,15%,8%,0.7))",
    layout: "vertical-zen",
  },
};

export function isThemeKey(v: unknown): v is ThemeKey {
  return typeof v === "string" && v in THEMES;
}

export function applyPrimaryOverride(
  vars: Record<string, string>,
  override: string | null | undefined,
): Record<string, string> {
  if (!override) return vars;
  const trimmed = override.trim();
  if (!/^\d+\s+\d+%\s+\d+%$/.test(trimmed)) return vars;
  return { ...vars, "--site-primary": trimmed };
}

export function buildGoogleFontsHref(theme: ThemeDef): string {
  const families = new Set([theme.fontStack.heading, theme.fontStack.body]);
  const params = Array.from(families)
    .map((f) => `family=${f}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
