/**
 * React-query hooks for the marketplace-vendor surface. Mirrors the routes
 * in `artifacts/api-server/src/routes/vendors.ts`. Cookie-based auth — every
 * call goes through `credentials: "include"` so the session cookie is sent.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

export type VendorRequestStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

export interface Vendor {
  id: number;
  email: string;
  slug: string;
  businessName: string;
  description: string | null;
  logoUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  categories: string[];
  serviceAreas: string[];
  isPublished: boolean;
  status: "active" | "suspended";
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicVendorListItem {
  id: number;
  slug: string;
  businessName: string;
  description: string | null;
  logoUrl: string | null;
  categories: string[];
  serviceAreas: string[];
  contactPhone: string | null;
  websiteUrl: string | null;
}

export interface VendorService {
  id: number;
  vendorId: number;
  name: string;
  description: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  category: string | null;
  photos: string[];
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorRequestRow {
  id: number;
  vendorId: number;
  serviceId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  deceasedName: string | null;
  serviceLocation: string | null;
  message: string;
  status: VendorRequestStatus;
  vendorNotes: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...(init ?? {}),
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

// ---------------- vendor (authed) ----------------

export function useVendorMe(opts?: Partial<UseQueryOptions<{ vendor: Vendor }>>) {
  return useQuery<{ vendor: Vendor }>({
    queryKey: ["vendor-me"],
    queryFn: () => api("/vendor/me"),
    retry: false,
    ...(opts ?? {}),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Vendor>) =>
      api<{ vendor: Vendor }>("/vendor/me", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendor-me"] });
    },
  });
}

export function useVendorServices() {
  return useQuery<{ services: VendorService[] }>({
    queryKey: ["vendor-services"],
    queryFn: () => api("/vendor/services"),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<VendorService, "id" | "vendorId" | "createdAt" | "updatedAt">) =>
      api<{ service: VendorService }>("/vendor/services", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["vendor-services"] }); },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<VendorService> }) =>
      api<{ service: VendorService }>(`/vendor/services/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["vendor-services"] }); },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/vendor/services/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["vendor-services"] }); },
  });
}

export function useVendorRequests(status?: VendorRequestStatus) {
  return useQuery<{ requests: VendorRequestRow[] }>({
    queryKey: ["vendor-requests", status ?? "all"],
    queryFn: () => api(`/vendor/requests${status ? `?status=${status}` : ""}`),
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { status?: VendorRequestStatus; vendorNotes?: string | null } }) =>
      api<{ request: VendorRequestRow }>(`/vendor/requests/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendor-requests"] });
      void qc.invalidateQueries({ queryKey: ["vendor-metrics"] });
    },
  });
}

export interface VendorMetrics {
  requestCounts: Record<VendorRequestStatus, number>;
  total: number;
  servicesCount: number;
  recentRequests: VendorRequestRow[];
}

export function useVendorMetrics() {
  return useQuery<VendorMetrics>({
    queryKey: ["vendor-metrics"],
    queryFn: () => api("/vendor/metrics"),
  });
}

// ---------------- public ----------------

export function useVendorSignup() {
  return useMutation({
    mutationFn: (payload: {
      email: string;
      password: string;
      businessName: string;
      contactName?: string;
      contactPhone?: string;
      description?: string;
      categories?: string[];
      serviceAreas?: string[];
    }) => api<{ user: unknown; vendor: Vendor; redirectTo: string }>("/vendor/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  });
}

export function usePublicVendors(filters: { q?: string; category?: string; area?: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.area) params.set("area", filters.area);
  const qs = params.toString();
  return useQuery<{ vendors: PublicVendorListItem[] }>({
    queryKey: ["public-vendors", qs],
    queryFn: () => api(`/vendors${qs ? `?${qs}` : ""}`),
  });
}

export function usePublicVendor(slug: string) {
  return useQuery<{ vendor: Vendor; services: VendorService[] }>({
    queryKey: ["public-vendor", slug],
    queryFn: () => api(`/vendors/${encodeURIComponent(slug)}`),
    enabled: !!slug,
    retry: false,
  });
}

export function useSubmitVendorRequest(slug: string) {
  return useMutation({
    mutationFn: (payload: {
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      deceasedName?: string;
      serviceLocation?: string;
      message: string;
      serviceId?: number;
    }) => api<{ ok: true; requestId: number; createdAt: string }>(
      `/vendors/${encodeURIComponent(slug)}/requests`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  });
}
