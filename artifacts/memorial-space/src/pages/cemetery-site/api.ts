import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export type PublicSite = {
  slug: string;
  organizationName: string;
  isPreview: boolean;
  theme: string;
  siteTitle: string;
  tagline: string | null;
  heroHeadline: string | null;
  heroSubheadline: string | null;
  heroImageUrl: string | null;
  aboutText: string | null;
  primaryColorOverride: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  openingHours: string | null;
  stripeAvailable: boolean;
};

export type PublicProduct = {
  id: number;
  organizationId: number;
  categoryId: number | null;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  type: "product" | "service";
  stockQuantity: number | null;
  photos: string[];
  isFeatured: boolean;
  isPublished: boolean;
  stripeEnabled: boolean;
  sortOrder: number;
};

export type PublicCategory = {
  id: number;
  organizationId: number;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
};

export type GraveResult = {
  id: number;
  name: string;
  bornYear: string | null;
  diedYear: string | null;
  religion: string | null;
  photoUrl: string | null;
  plotLabel: string;
};

export type PublicMapPlot = {
  id: number;
  plotNumber: string;
  section: string | null;
  row: string | null;
  status: string;
  type: string | null;
  burial: {
    id: number;
    name: string;
    bornYear: string | null;
    diedYear: string | null;
    photoUrl: string | null;
    memorialCode: string | null;
  } | null;
};

export type PublicMapData = {
  plots: PublicMapPlot[];
  sections: string[];
};

export type MemorialVisibility = "open" | "basic" | "private";
export type PublicMemorial = {
  code: string;
  memorialId: number | null;
  visibility: MemorialVisibility;
  // True when the visitor needs the PIN to see the rich content
  // (`private` without unlock → everything; `basic` without unlock → bio + photos).
  locked: boolean;
  title: string | null;
  deceasedName: string | null;
  bornDate: string | null;
  diedDate: string | null;
  burialDate: string | null;
  religion: string | null;
  biography: string | null;
  photos: string[];
  // YouTube video URLs the family has added. Stripped (empty array) for
  // PIN-locked memorials in the same way `photos` and `biography` are.
  videos: string[];
  plotLabel: string | null;
  plotSection: string | null;
  plotRow: string | null;
  plotLatitude: number | null;
  plotLongitude: number | null;
  cemeteryName: string | null;
  cemeteryAddress: string | null;
  canEdit: boolean;
};

export type OrderItemSnapshot = {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

function previewQS(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const previewOrgId = params.get("previewOrgId");
  return previewOrgId ? `?previewOrgId=${encodeURIComponent(previewOrgId)}` : "";
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json() as Promise<T>;
}

export function usePublicSite(slug: string) {
  return useQuery({
    queryKey: ["public-site", slug, previewQS()],
    queryFn: () => get<PublicSite>(`${BASE}/api/c/${encodeURIComponent(slug)}${previewQS()}`),
    retry: 1,
  });
}

export function usePublicProducts(slug: string, category?: string | null) {
  const cat = category ? `&category=${encodeURIComponent(category)}` : "";
  const qs = previewQS();
  const sep = qs ? "&" : "?";
  return useQuery({
    queryKey: ["public-products", slug, category ?? null, qs],
    queryFn: () =>
      get<{ products: PublicProduct[]; categories: PublicCategory[] }>(
        `${BASE}/api/c/${encodeURIComponent(slug)}/products${qs}${cat ? sep + cat.slice(1) : ""}`,
      ),
  });
}

export function usePublicProduct(slug: string, productSlug: string) {
  return useQuery({
    queryKey: ["public-product", slug, productSlug, previewQS()],
    queryFn: () =>
      get<PublicProduct>(
        `${BASE}/api/c/${encodeURIComponent(slug)}/products/${encodeURIComponent(productSlug)}${previewQS()}`,
      ),
    enabled: !!productSlug,
  });
}

export function usePublicGraveSearch(slug: string, q: string) {
  return useQuery({
    queryKey: ["public-grave-search", slug, q, previewQS()],
    queryFn: () => {
      const qs = previewQS();
      const sep = qs ? "&" : "?";
      return get<{ results: GraveResult[] }>(
        `${BASE}/api/c/${encodeURIComponent(slug)}/find-grave${qs}${sep}q=${encodeURIComponent(q)}`,
      );
    },
    enabled: q.trim().length >= 2,
  });
}

export function usePublicMap(slug: string) {
  const qs = previewQS();
  return useQuery({
    queryKey: ["public-map", slug, qs],
    queryFn: () =>
      get<PublicMapData>(
        `${BASE}/api/c/${encodeURIComponent(slug)}/map${qs}`,
      ),
  });
}

export function usePublicMemorial(slug: string, code: string, pin?: string) {
  // The unlock PIN doubles as the edit credential, so we deliberately keep
  // it OUT of the URL/query string to avoid leaking it into server access
  // logs, proxy logs, and observability traces. We send it via the
  // `x-edit-pin` header instead. react-query keys on the PIN string so
  // locked and unlocked responses don't share a cache slot.
  const qs = previewQS();
  return useQuery({
    queryKey: ["public-memorial", slug, code, qs, pin ?? ""],
    queryFn: async () => {
      const url = `${BASE}/api/c/${encodeURIComponent(slug)}/memorial/${encodeURIComponent(code)}${qs}`;
      const headers: Record<string, string> = {};
      if (pin) headers["x-edit-pin"] = pin;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(`${res.status} ${res.statusText} ${body}`.trim()) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return res.json() as Promise<PublicMemorial>;
    },
    enabled: !!code,
    // 429 / 5xx — don't hammer the rate limiter further
    retry: false,
  });
}

export type UpdatePublicMemorialPayload = {
  editPin: string;
  title?: string;
  biography?: string | null;
  photos?: string[];
  // YouTube video URLs the family wants on the memorial. Server validates
  // the format; client also pre-validates so we never POST a bad URL.
  videos?: string[];
  visibility?: MemorialVisibility;
};

export function useUpdatePublicMemorial(slug: string, code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePublicMemorialPayload) => {
      const qs = previewQS();
      const res = await fetch(
        `${BASE}/api/c/${encodeURIComponent(slug)}/memorial/${encodeURIComponent(code)}/edit${qs}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // Preserve the status so the UI can distinguish "wrong PIN" (401)
        // from "memorial not found" (404) and other failures.
        const err = new Error(body || `${res.status}`);
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["public-memorial", slug, code] });
    },
  });
}

// --- Digital rituals (gamified memory experience) -------------------------
export type RitualType = "candle" | "flower" | "prayer";

export type PublicRitual = {
  id: number;
  type: RitualType;
  variant: string | null;
  visitorName: string | null;
  message: string | null;
  audioDataUrl: string | null;
  audioDurationMs: number | null;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
};

export type RitualTotals = Record<RitualType, { active: number; total: number }>;

export type RitualsResponse = {
  rituals: PublicRitual[];
  totals: RitualTotals;
  types: readonly RitualType[];
  marketplace: {
    products: { candle: PublicProduct[]; flower: PublicProduct[]; prayer: PublicProduct[] };
    realOrderCount: number;
  };
};

export function useMemorialRituals(slug: string, code: string) {
  return useQuery({
    queryKey: ["memorial-rituals", slug, code],
    queryFn: () =>
      get<RitualsResponse>(
        `${BASE}/api/c/${encodeURIComponent(slug)}/memorial/${encodeURIComponent(code)}/rituals`,
      ),
    enabled: !!slug && !!code,
    // Live wall — refetch periodically so visitors see candles as they're lit.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export type CreateRitualPayload = {
  type: RitualType;
  variant?: string | null;
  visitorName?: string | null;
  message?: string | null;
  audioDataUrl?: string | null;
  audioDurationMs?: number | null;
};

export function useCreateRitual(slug: string, code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRitualPayload) => {
      const res = await fetch(
        `${BASE}/api/c/${encodeURIComponent(slug)}/memorial/${encodeURIComponent(code)}/rituals`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(body || `${res.status}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return res.json() as Promise<{ ritual: PublicRitual }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memorial-rituals", slug, code] });
    },
  });
}

export type SubmitOrderPayload = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerNotes?: string | null;
  // Optional QR memorial code — when present, the order is back-linked to
  // the corresponding burial server-side so the cemetery's CRM can see all
  // tributes (virtual + real) for one person in a single view.
  memorialCode?: string | null;
  // Optional scheduled-delivery date (YYYY-MM-DD). Null/omitted means
  // "deliver as soon as possible". `scheduleOccasion` is a short label
  // describing why this date matters (e.g. "death_anniversary"); set to
  // "custom" when the customer typed a free date.
  scheduledFor?: string | null;
  scheduleOccasion?: string | null;
  recurringYearly?: boolean;
  items: Array<{ productId: number; quantity: number }>;
};

export type SubmitOrderResponse = {
  orderNumber: string;
  total: number;
  items: OrderItemSnapshot[];
  scheduledFor?: string | null;
  scheduleOccasion?: string | null;
  recurringYearly?: boolean;
};

export function useSubmitOrder(slug: string) {
  return useMutation({
    mutationFn: async (payload: SubmitOrderPayload): Promise<SubmitOrderResponse> => {
      const res = await fetch(`${BASE}/api/c/${encodeURIComponent(slug)}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status} ${body}`.trim());
      }
      return res.json();
    },
  });
}
