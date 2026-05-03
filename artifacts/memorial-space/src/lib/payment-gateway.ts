/**
 * Shared types and helpers for the Stripe payment-gateway settings UI used
 * on both the Super Admin (platform) and B2B Cemetery Owner (per-org)
 * surfaces.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PaymentMode = "test" | "live";
export type PaymentVerifyStatus =
  | "ok"
  | "invalid_key"
  | "mismatched_mode"
  | "network_error"
  | "untested";

export interface PaymentSettings {
  id: number;
  provider: "stripe";
  mode: PaymentMode;
  enabled: boolean;
  // Secrets come back masked from the server (e.g. "••••••••sk_4242").
  publishableKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
  hasPublishableKey: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  defaultCurrency: string;
  statementDescriptor: string | null;
  lastVerifiedAt: string | null;
  lastVerifiedStatus: PaymentVerifyStatus | null;
  accountId: string | null;
  accountName: string | null;
  accountEmail: string | null;
  livemode: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSettingsPatch {
  provider?: "stripe";
  mode?: PaymentMode;
  enabled?: boolean;
  publishableKey?: string | null;
  secretKey?: string | null;
  webhookSecret?: string | null;
  defaultCurrency?: string;
  statementDescriptor?: string | null;
}

export interface VerifyResult {
  status: PaymentVerifyStatus;
  message?: string;
  account?: {
    id: string;
    name: string | null;
    email: string | null;
    livemode: boolean;
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export function usePaymentSettings(scope: "platform" | "org") {
  const path =
    scope === "platform"
      ? "/api/admin/payment-gateway"
      : "/api/orgs/me/payment-gateway";
  return useQuery<PaymentSettings>({
    queryKey: ["payment-gateway", scope],
    queryFn: () => api<PaymentSettings>(path),
  });
}

export function useUpdatePaymentSettings(scope: "platform" | "org") {
  const qc = useQueryClient();
  const path =
    scope === "platform"
      ? "/api/admin/payment-gateway"
      : "/api/orgs/me/payment-gateway";
  return useMutation({
    mutationFn: (patch: PaymentSettingsPatch) =>
      api<PaymentSettings>(path, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["payment-gateway", scope], data);
    },
  });
}

export function useTestPaymentGateway(scope: "platform" | "org") {
  const qc = useQueryClient();
  const path =
    scope === "platform"
      ? "/api/admin/payment-gateway/test"
      : "/api/orgs/me/payment-gateway/test";
  return useMutation({
    mutationFn: () =>
      api<PaymentSettings & { verification: VerifyResult }>(path, {
        method: "POST",
      }),
    onSuccess: ({ verification, ...settings }) => {
      qc.setQueryData(["payment-gateway", scope], settings);
      return verification;
    },
  });
}

export const VERIFY_STATUS_LABEL: Record<PaymentVerifyStatus, string> = {
  ok: "Connected",
  invalid_key: "Invalid key",
  mismatched_mode: "Key/mode mismatch",
  network_error: "Network error",
  untested: "Not tested",
};

export const VERIFY_STATUS_TONE: Record<PaymentVerifyStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  invalid_key: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  mismatched_mode: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  network_error: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  untested: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

/** Common ISO 4217 codes the cemetery industry typically transacts in. */
export const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "PHP",
  "SGD",
  "HKD",
  "MXN",
  "BRL",
  "INR",
  "ZAR",
  "JPY",
] as const;
