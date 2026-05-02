import { useQuery, useMutation } from "@tanstack/react-query";

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

export type PublicMemorial = {
  code: string;
  title: string;
  deceasedName: string;
  bornDate: string | null;
  diedDate: string | null;
  burialDate: string | null;
  religion: string | null;
  biography: string | null;
  photos: string[];
  plotLabel: string | null;
  plotSection: string | null;
  plotRow: string | null;
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

export function usePublicMemorial(slug: string, code: string) {
  const qs = previewQS();
  return useQuery({
    queryKey: ["public-memorial", slug, code, qs],
    queryFn: () =>
      get<PublicMemorial>(
        `${BASE}/api/c/${encodeURIComponent(slug)}/memorial/${encodeURIComponent(code)}${qs}`,
      ),
    enabled: !!code,
  });
}

export type SubmitOrderPayload = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerNotes?: string | null;
  items: Array<{ productId: number; quantity: number }>;
};

export type SubmitOrderResponse = {
  orderNumber: string;
  total: number;
  items: OrderItemSnapshot[];
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
