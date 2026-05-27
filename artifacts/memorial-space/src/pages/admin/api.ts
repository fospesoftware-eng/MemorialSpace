/** Typed react-query hooks for the Super Admin module. */
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

import { ADMIN_API_BASE } from "./_shared";

export interface PlanRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingPeriod: "monthly" | "yearly";
  trialDays: number;
  maxUsers: number | null;
  maxPlots: number | null;
  maxStorageMb: number | null;
  features: Record<string, unknown>;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRow {
  id: number;
  organizationId: number;
  planId: number;
  status: "trialing" | "active" | "past_due" | "cancelled" | "suspended";
  billingPeriod: "monthly" | "yearly";
  seats: number;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  pricePerPeriodCents: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgAdminRow {
  id: number;
  name: string;
  slug: string;
  cemeteryType: string;
  cemeteryTypes: string[];
  enabledFeatures: Record<string, boolean>;
  featuresColumbarium: boolean;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  status: "active" | "trial" | "suspended" | "cancelled";
  suspendedAt: string | null;
  suspensionReason: string | null;
  internalNotes: string | null;
  totalPlots: number | null;
  createdAt: string;
  subscription: SubscriptionRow | null;
  plan: PlanRow | null;
  userCount: number;
  outstandingCents: number;
}

export interface InvoiceRow {
  id: number;
  organizationId: number;
  subscriptionId: number | null;
  invoiceNumber: string | null;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  periodStart: string;
  periodEnd: string;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  currency: string;
  description: string | null;
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number; lineTotalCents: number }>;
  notes: string | null;
  createdAt: string;
}

export interface PaymentRow {
  id: number;
  invoiceId: number;
  organizationId: number;
  amountCents: number;
  method: string;
  reference: string | null;
  paidAt: string;
  notes: string | null;
  createdAt: string;
}

export interface MetricsResponse {
  mrrCents: number;
  arrCents: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  cancelledSubscriptions: number;
  totalOrganizations: number;
  suspendedOrganizations: number;
  outstandingCents: number;
  collectedCents: number;
  planDistribution: Record<string, number>;
  monthly: Array<{ month: string; signups: number; mrrCents: number }>;
  recentInvoices: InvoiceRow[];
  recentPayments: PaymentRow[];
}

export interface AuditEntry {
  id: number;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  organizationId: number | null;
  summary: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    // Session expired or never started — kick the user back to the admin sign-in.
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-in")) {
      window.location.href = "/sign-in/admin";
    }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    const message =
      (parsed && typeof parsed === "object" && "error" in parsed && (parsed as { error: string }).error) ||
      `Request failed: ${res.status}`;
    throw new Error(String(message));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Metrics ----
export function useAdminMetrics(opts?: Partial<UseQueryOptions<MetricsResponse>>) {
  return useQuery<MetricsResponse>({
    queryKey: ["admin", "metrics"],
    queryFn: () => http<MetricsResponse>("/metrics"),
    refetchInterval: 30_000,
    ...opts,
  });
}

// ---- Plans ----
export function useAdminPlans() {
  return useQuery<PlanRow[]>({ queryKey: ["admin", "plans"], queryFn: () => http<PlanRow[]>("/plans") });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PlanRow>) => http<PlanRow>("/plans", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<PlanRow> & { id: number }) =>
      http<PlanRow>(`/plans/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http(`/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

// ---- Subscriptions ----
export interface SubscriptionWithJoins {
  sub: SubscriptionRow;
  plan: PlanRow | null;
  org: OrgAdminRow | null;
}
export function useAdminSubscriptions(filter?: { organizationId?: number; status?: string }) {
  const qs = new URLSearchParams();
  if (filter?.organizationId) qs.set("organizationId", String(filter.organizationId));
  if (filter?.status) qs.set("status", filter.status);
  const url = qs.toString() ? `/subscriptions?${qs}` : "/subscriptions";
  return useQuery<SubscriptionWithJoins[]>({
    queryKey: ["admin", "subscriptions", filter ?? {}],
    queryFn: () => http<SubscriptionWithJoins[]>(url),
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      organizationId: number;
      planId: number;
      billingPeriod?: "monthly" | "yearly";
      startTrial?: boolean;
      seats?: number;
      notes?: string;
    }) => http<SubscriptionRow>("/subscriptions", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<SubscriptionRow>) =>
      http<SubscriptionRow>(`/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, immediate }: { id: number; immediate?: boolean }) =>
      http<SubscriptionRow>(`/subscriptions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ immediate: !!immediate }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

// ---- Organizations (admin lens) ----
export function useAdminOrgs(filter?: { q?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (filter?.q) qs.set("q", filter.q);
  if (filter?.status) qs.set("status", filter.status);
  const url = qs.toString() ? `/organizations?${qs}` : "/organizations";
  return useQuery<OrgAdminRow[]>({
    queryKey: ["admin", "organizations", filter ?? {}],
    queryFn: () => http<OrgAdminRow[]>(url),
  });
}

export function useAdminOrgDetail(id: number | null) {
  return useQuery({
    queryKey: ["admin", "organization", id],
    enabled: id != null,
    queryFn: () =>
      http<{
        org: OrgAdminRow;
        subscriptions: Array<{ sub: SubscriptionRow; plan: PlanRow | null }>;
        invoices: InvoiceRow[];
        users: Array<{ id: number; name: string | null; email: string; role: string; status: string }>;
      }>(`/organizations/${id}`),
  });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<OrgAdminRow>) =>
      http<OrgAdminRow>(`/organizations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useSuspendOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      http<OrgAdminRow>(`/organizations/${id}/suspend`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useReactivateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http<OrgAdminRow>(`/organizations/${id}/reactivate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useDeleteOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http(`/organizations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

// ---- Platform invoices ----
export interface InvoiceWithOrg {
  inv: InvoiceRow;
  org: OrgAdminRow | null;
}
export function useAdminInvoices(filter?: { organizationId?: number; status?: string }) {
  const qs = new URLSearchParams();
  if (filter?.organizationId) qs.set("organizationId", String(filter.organizationId));
  if (filter?.status) qs.set("status", filter.status);
  const url = qs.toString() ? `/platform-invoices?${qs}` : "/platform-invoices";
  return useQuery<InvoiceWithOrg[]>({
    queryKey: ["admin", "invoices", filter ?? {}],
    queryFn: () => http<InvoiceWithOrg[]>(url),
  });
}

export function useAdminInvoice(id: number | null) {
  return useQuery({
    queryKey: ["admin", "invoice", id],
    enabled: id != null,
    queryFn: () =>
      http<{ invoice: InvoiceRow; organization: OrgAdminRow | null; payments: PaymentRow[] }>(
        `/platform-invoices/${id}`,
      ),
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      organizationId: number;
      subscriptionId?: number;
      periodStart: string;
      periodEnd: string;
      dueDate?: string;
      description?: string;
      notes?: string;
      lineItems: Array<{ description: string; quantity: number; unitPriceCents: number }>;
      taxCents?: number;
    }) =>
      http<InvoiceRow>("/platform-invoices", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http<InvoiceRow>(`/platform-invoices/${id}/issue`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function usePayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number;
      amountCents: number;
      method?: string;
      reference?: string;
      notes?: string;
    }) => http(`/platform-invoices/${id}/pay`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http<InvoiceRow>(`/platform-invoices/${id}/void`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

// ---- Audit log ----
export function useAuditLog(filter?: { organizationId?: number; action?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (filter?.organizationId) qs.set("organizationId", String(filter.organizationId));
  if (filter?.action) qs.set("action", filter.action);
  if (filter?.limit) qs.set("limit", String(filter.limit));
  const url = qs.toString() ? `/audit-log?${qs}` : "/audit-log";
  return useQuery<AuditEntry[]>({
    queryKey: ["admin", "audit", filter ?? {}],
    queryFn: () => http<AuditEntry[]>(url),
    refetchInterval: 15_000,
  });
}

// ---- Cross-org users ----
export interface AdminUserRow {
  user: {
    id: number;
    name: string | null;
    email: string;
    role: string;
    status: string;
    organizationId: number;
    jobTitle: string | null;
    lastActiveAt: string | null;
    createdAt: string;
  };
  org: { id: number; name: string; slug: string } | null;
}
export function useAdminUserSearch(q: string) {
  return useQuery<AdminUserRow[]>({
    queryKey: ["admin", "users", q],
    queryFn: () =>
      http<AdminUserRow[]>(`/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
}

// ---- AI Settings ----
export interface AiSettingsResponse {
  id: number;
  anthropicApiKey: string | null;
  hasKey: boolean;
  createdAt: string;
  updatedAt: string;
}
export function useAiSettings() {
  return useQuery<AiSettingsResponse>({
    queryKey: ["admin", "ai-settings"],
    queryFn: () => http<AiSettingsResponse>("/ai-settings"),
  });
}
export function useUpdateAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { anthropicApiKey?: string | null }) =>
      http<AiSettingsResponse>("/ai-settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "ai-settings"] }),
  });
}
export function useTestAiSettings() {
  return useMutation({
    mutationFn: () =>
      http<{ status: string; message: string }>("/ai-settings/test", { method: "POST" }),
  });
}
