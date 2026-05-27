/**
 * Single source of truth for the marketing-site pricing tiers. Mirrors the
 * three default plans seeded by `pnpm --filter @workspace/scripts run seed-saas`
 * (see `scripts/src/seed-saas-billing.ts`). When the real plans change, update
 * these constants — the homepage hero, the pricing page, and the comparison
 * table all read from this file.
 */

export type MarketingPlan = {
  slug: "starter" | "professional" | "enterprise";
  name: string;
  /** Display price in dollars; null = "Contact us". */
  priceUsd: number | null;
  cadence: string;
  tagline: string;
  description: string;
  /** Trial length in days (0 = no trial). */
  trialDays: number;
  /** Limits shown on cards. null/Infinity = "Unlimited". */
  maxUsers: number | null;
  maxPlots: number | null;
  maxStorageGb: number | null;
  /** Bullet points shown on the homepage card. */
  highlights: string[];
  /** Module flags; drives the comparison table. */
  modules: {
    plots: boolean;
    burials: boolean;
    bookings: boolean;
    qr: boolean;
    obituaries: boolean;
    marketplace: boolean;
    publicWebsite: boolean;
    accounting: boolean;
    aiMap: boolean;
    columbarium: boolean;
    mausoleum: boolean;
    multiTenant: boolean;
    sso: boolean;
    prioritySupport: boolean;
    customIntegrations: boolean;
    sla: boolean;
  };
  cta: { label: string; href: string };
  highlight: boolean;
  badge?: string;
};

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    slug: "starter",
    name: "Starter",
    priceUsd: 49,
    cadence: "/mo",
    tagline: "For small cemeteries getting digitized",
    description:
      "Replace your paper records with a clean, searchable digital archive. Everything a single small cemetery needs to go online.",
    trialDays: 14,
    maxUsers: 3,
    maxPlots: 500,
    maxStorageGb: 2,
    highlights: [
      "Up to 500 plots",
      "3 user accounts",
      "2 GB media storage",
      "Plot mapping & burial records",
      "QR memorial codes",
      "Public cemetery website",
      "Email support",
    ],
    modules: {
      plots: true,
      burials: true,
      bookings: true,
      qr: true,
      obituaries: true,
      marketplace: false,
      publicWebsite: true,
      accounting: false,
      aiMap: false,
      columbarium: false,
      mausoleum: false,
      multiTenant: false,
      sso: false,
      prioritySupport: false,
      customIntegrations: false,
      sla: false,
    },
    cta: { label: "Start 14-day free trial", href: "/sign-in/cemetery" },
    highlight: false,
  },
  {
    slug: "professional",
    name: "Professional",
    priceUsd: 149,
    cadence: "/mo",
    tagline: "Most popular for growing cemeteries",
    description:
      "The full module suite — accounting, AI-assisted map building, columbarium and mausoleum management — sized for cemeteries doing real volume.",
    trialDays: 14,
    maxUsers: 15,
    maxPlots: 5_000,
    maxStorageGb: 20,
    highlights: [
      "Up to 5,000 plots",
      "15 user accounts",
      "20 GB media storage",
      "Everything in Starter, plus:",
      "Accounting & invoicing",
      "AI map maker",
      "Columbarium & mausoleum modules",
      "Marketplace & e-commerce",
      "Bookings & work orders",
    ],
    modules: {
      plots: true,
      burials: true,
      bookings: true,
      qr: true,
      obituaries: true,
      marketplace: true,
      publicWebsite: true,
      accounting: true,
      aiMap: true,
      columbarium: true,
      mausoleum: true,
      multiTenant: false,
      sso: false,
      prioritySupport: false,
      customIntegrations: false,
      sla: false,
    },
    cta: { label: "Start 14-day free trial", href: "/sign-in/cemetery" },
    highlight: true,
    badge: "Most Popular",
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    priceUsd: 499,
    cadence: "/mo",
    tagline: "For multi-location operators and municipalities",
    description:
      "Unlimited everything, multi-cemetery groups, SSO, and a dedicated success manager. Built for operators running several sites under one roof.",
    trialDays: 30,
    maxUsers: null,
    maxPlots: null,
    maxStorageGb: null,
    highlights: [
      "Unlimited plots",
      "Unlimited users",
      "Unlimited storage",
      "Everything in Professional, plus:",
      "Multi-cemetery groups",
      "SSO (SAML / OIDC)",
      "Priority support & SLA",
      "Custom integrations",
      "Dedicated success manager",
    ],
    modules: {
      plots: true,
      burials: true,
      bookings: true,
      qr: true,
      obituaries: true,
      marketplace: true,
      publicWebsite: true,
      accounting: true,
      aiMap: true,
      columbarium: true,
      mausoleum: true,
      multiTenant: true,
      sso: true,
      prioritySupport: true,
      customIntegrations: true,
      sla: true,
    },
    cta: { label: "Talk to sales", href: "/contact" },
    highlight: false,
  },
];

export const COMPARISON_GROUPS: Array<{
  group: string;
  rows: Array<{ label: string; key: keyof MarketingPlan["modules"] }>;
}> = [
  {
    group: "Operations",
    rows: [
      { label: "Plot mapping", key: "plots" },
      { label: "Burial records", key: "burials" },
      { label: "Bookings & scheduling", key: "bookings" },
      { label: "Columbarium module", key: "columbarium" },
      { label: "Mausoleum module", key: "mausoleum" },
    ],
  },
  {
    group: "Family-facing",
    rows: [
      { label: "QR memorial codes", key: "qr" },
      { label: "Obituaries & tributes", key: "obituaries" },
      { label: "Public cemetery website", key: "publicWebsite" },
      { label: "Marketplace & e-commerce", key: "marketplace" },
    ],
  },
  {
    group: "Business",
    rows: [
      { label: "Accounting & invoicing", key: "accounting" },
      { label: "AI map maker", key: "aiMap" },
      { label: "Multi-cemetery groups", key: "multiTenant" },
    ],
  },
  {
    group: "Enterprise",
    rows: [
      { label: "SSO (SAML / OIDC)", key: "sso" },
      { label: "Priority support & SLA", key: "prioritySupport" },
      { label: "Custom integrations", key: "customIntegrations" },
      { label: "Dedicated success manager", key: "sla" },
    ],
  },
];
