/**
 * Payment gateway settings — Stripe configuration for both the platform
 * (super admin tier) and individual cemetery operators (B2B tier).
 *
 * Two distinct accounts:
 *   - **Platform** singleton: the SaaS company's own Stripe account, used to
 *     charge cemetery operators for their subscriptions.
 *   - **Per-org**: each cemetery operator brings their own Stripe account so
 *     funds from family/customer purchases settle directly to their bank.
 *     The platform never holds end-customer money.
 *
 * Secrets are stored in plaintext in MVP — all reads mask them and writes
 * never trust client-supplied masked values. See `maskSecret()` below.
 */
import { Router, type IRouter, type Request } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

import {
  db,
  platformPaymentSettingsTable,
  orgPaymentSettingsTable,
  PAYMENT_PROVIDERS,
  PAYMENT_MODES,
  type PaymentVerifyStatus,
} from "@workspace/db";
import {
  asyncHandler,
  requirePlatformAdmin,
  requireOrgUser,
} from "../lib/auth";
import type { Response } from "express";

// Roles allowed to *write* platform-level Stripe settings. `support` admins
// can read (via requirePlatformAdmin) but must not change billing credentials.
const PLATFORM_BILLING_WRITE_ROLES = new Set(["super_admin", "billing_admin"]);

function ensurePlatformBillingWrite(req: Request, res: Response): boolean {
  const role = req.session?.user?.role;
  if (!role || !PLATFORM_BILLING_WRITE_ROLES.has(role)) {
    res.status(403).json({
      error:
        "Only super admins and billing admins may change payment-gateway settings.",
    });
    return false;
  }
  return true;
}

/**
 * Fields whose change should invalidate any prior “Connected” verification
 * status — switching mode or rotating any credential means the cached
 * account info no longer reflects what the new keys would resolve to.
 */
const VERIFICATION_INVALIDATING_FIELDS = new Set([
  "mode",
  "secretKey",
  "publishableKey",
  "webhookSecret",
  "provider",
]);

function applyVerificationReset(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const touched = Object.keys(patch).some((k) =>
    VERIFICATION_INVALIDATING_FIELDS.has(k),
  );
  if (!touched) return patch;
  return {
    ...patch,
    lastVerifiedStatus: "untested",
    lastVerifiedAt: null,
    accountId: null,
    accountName: null,
    accountEmail: null,
    livemode: null,
  };
}

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mask a Stripe secret so we can return enough for the UI to display
 * "currently configured" without leaking the live value. Returns null when
 * unset so the UI can show an empty form.
 */
function maskSecret(v: string | null | undefined): string | null {
  if (!v) return null;
  const last4 = v.slice(-4);
  return `••••••••${last4}`;
}

const SettingsBody = z.object({
  provider: z.enum(PAYMENT_PROVIDERS).optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  enabled: z.boolean().optional(),
  publishableKey: z.string().max(500).nullable().optional(),
  // Secrets: empty string / null means "clear", a value starting with the
  // mask sentinel means "leave unchanged" (UI sends back what it displays).
  secretKey: z.string().max(500).nullable().optional(),
  webhookSecret: z.string().max(500).nullable().optional(),
  defaultCurrency: z
    .string()
    .min(3)
    .max(3)
    .regex(/^[A-Za-z]{3}$/, "Currency must be a 3-letter code")
    .optional(),
  statementDescriptor: z.string().max(22).nullable().optional(),
});

type SettingsPatch = z.infer<typeof SettingsBody>;

/**
 * Build the DB patch from a validated request, dropping masked secret values
 * so we never overwrite a real key with the placeholder shown in the UI.
 */
function buildPatch(input: SettingsPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (
      (k === "secretKey" || k === "webhookSecret" || k === "publishableKey") &&
      typeof v === "string" &&
      v.startsWith("••••")
    ) {
      // UI echoed back the masked placeholder — keep existing value.
      continue;
    }
    out[k] = v === "" ? null : v;
  }
  out.updatedAt = new Date();
  return out;
}

/** Detect whether a Stripe key string matches the configured mode. */
function keyMatchesMode(
  key: string,
  mode: "test" | "live",
): boolean {
  // sk_test_…, sk_live_…, rk_test_…, rk_live_…
  if (mode === "test") return /^(sk|rk)_test_/.test(key);
  return /^(sk|rk)_live_/.test(key);
}

/**
 * Try to call `stripe.accounts.retrieve()` with the given secret. Returns a
 * structured verification result we can persist.
 */
async function verifyStripeKey(
  secretKey: string | null | undefined,
  mode: "test" | "live",
): Promise<{
  status: PaymentVerifyStatus;
  message?: string;
  account?: {
    id: string;
    name: string | null;
    email: string | null;
    livemode: boolean;
  };
}> {
  if (!secretKey) {
    return { status: "untested", message: "No secret key configured." };
  }
  if (!keyMatchesMode(secretKey, mode)) {
    return {
      status: "mismatched_mode",
      message: `Key prefix doesn't match the selected mode (${mode}).`,
    };
  }
  try {
    const stripe = new Stripe(secretKey, {
      maxNetworkRetries: 1,
      timeout: 8000,
    });
    // Calling /v1/account (no id) returns the account associated with the
    // secret key — the standard Stripe pattern for verifying credentials.
    const acct = (await (
      stripe.accounts as unknown as {
        retrieve(): Promise<Stripe.Account>;
      }
    ).retrieve()) as Stripe.Account;
    return {
      status: "ok",
      account: {
        id: acct.id,
        name:
          acct.business_profile?.name ??
          acct.settings?.dashboard?.display_name ??
          null,
        email: acct.email ?? null,
        livemode: mode === "live",
      },
    };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      return { status: "invalid_key", message: err.message };
    }
    if (err instanceof Stripe.errors.StripeConnectionError) {
      return { status: "network_error", message: err.message };
    }
    return {
      status: "invalid_key",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function shapeReadResponse<
  T extends {
    publishableKey: string | null;
    secretKey: string | null;
    webhookSecret: string | null;
  },
>(row: T) {
  return {
    ...row,
    // Publishable keys are technically safe to expose, but we still mask in
    // the same way so the UI rendering is uniform; the UI sends the masked
    // value back unchanged when the user only edits other fields.
    publishableKey: maskSecret(row.publishableKey),
    secretKey: maskSecret(row.secretKey),
    webhookSecret: maskSecret(row.webhookSecret),
    hasPublishableKey: Boolean(row.publishableKey),
    hasSecretKey: Boolean(row.secretKey),
    hasWebhookSecret: Boolean(row.webhookSecret),
  };
}

// ---------------------------------------------------------------------------
// Platform-level (super admin)
// ---------------------------------------------------------------------------

const PLATFORM_ID = 1;

async function getOrCreatePlatformRow() {
  const [existing] = await db
    .select()
    .from(platformPaymentSettingsTable)
    .where(eq(platformPaymentSettingsTable.id, PLATFORM_ID))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(platformPaymentSettingsTable)
    .values({ id: PLATFORM_ID })
    .returning();
  return created;
}

router.get(
  "/admin/payment-gateway",
  requirePlatformAdmin,
  asyncHandler(async (_req: Request, res) => {
    const row = await getOrCreatePlatformRow();
    res.json(shapeReadResponse(row));
  }),
);

router.put(
  "/admin/payment-gateway",
  requirePlatformAdmin,
  asyncHandler(async (req: Request, res) => {
    if (!ensurePlatformBillingWrite(req, res)) return;
    const parsed = SettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }
    await getOrCreatePlatformRow();
    const patch = applyVerificationReset(buildPatch(parsed.data));
    const [row] = await db
      .update(platformPaymentSettingsTable)
      .set(patch)
      .where(eq(platformPaymentSettingsTable.id, PLATFORM_ID))
      .returning();
    res.json(shapeReadResponse(row));
  }),
);

router.post(
  "/admin/payment-gateway/test",
  requirePlatformAdmin,
  asyncHandler(async (req: Request, res) => {
    if (!ensurePlatformBillingWrite(req, res)) return;
    const row = await getOrCreatePlatformRow();
    const result = await verifyStripeKey(
      row.secretKey,
      row.mode as "test" | "live",
    );
    const update: Record<string, unknown> = {
      lastVerifiedStatus: result.status,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    };
    if (result.account) {
      update.accountId = result.account.id;
      update.accountName = result.account.name;
      update.accountEmail = result.account.email;
      update.livemode = result.account.livemode;
    }
    const [updated] = await db
      .update(platformPaymentSettingsTable)
      .set(update)
      .where(eq(platformPaymentSettingsTable.id, PLATFORM_ID))
      .returning();
    res.json({
      ...shapeReadResponse(updated),
      verification: result,
    });
  }),
);

// ---------------------------------------------------------------------------
// Per-organization (cemetery owner / admin)
// ---------------------------------------------------------------------------

async function getOrCreateOrgRow(orgId: number) {
  const [existing] = await db
    .select()
    .from(orgPaymentSettingsTable)
    .where(eq(orgPaymentSettingsTable.organizationId, orgId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(orgPaymentSettingsTable)
    .values({ organizationId: orgId })
    .returning();
  return created;
}

/**
 * Only org owners and admins may edit payment settings. Managers/staff/
 * viewers can read so the rest of the app can know whether checkout is
 * available, but secrets are masked anyway.
 */
function ensureOrgWriteRole(req: Request, res: import("express").Response) {
  const u = req.session?.user;
  if (!u || u.kind !== "cemetery") {
    res.status(403).json({ error: "Cemetery user required" });
    return false;
  }
  if (u.role !== "owner" && u.role !== "admin") {
    res
      .status(403)
      .json({ error: "Only owners and admins may edit payment settings." });
    return false;
  }
  return true;
}

router.get(
  "/orgs/me/payment-gateway",
  requireOrgUser,
  asyncHandler(async (req: Request, res) => {
    const orgId = req.session!.user!.organizationId!;
    const row = await getOrCreateOrgRow(orgId);
    res.json(shapeReadResponse(row));
  }),
);

router.put(
  "/orgs/me/payment-gateway",
  requireOrgUser,
  asyncHandler(async (req: Request, res) => {
    if (!ensureOrgWriteRole(req, res)) return;
    const parsed = SettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }
    const orgId = req.session!.user!.organizationId!;
    await getOrCreateOrgRow(orgId);
    const patch = applyVerificationReset(buildPatch(parsed.data));
    const [row] = await db
      .update(orgPaymentSettingsTable)
      .set(patch)
      .where(eq(orgPaymentSettingsTable.organizationId, orgId))
      .returning();
    res.json(shapeReadResponse(row));
  }),
);

router.post(
  "/orgs/me/payment-gateway/test",
  requireOrgUser,
  asyncHandler(async (req: Request, res) => {
    if (!ensureOrgWriteRole(req, res)) return;
    const orgId = req.session!.user!.organizationId!;
    const row = await getOrCreateOrgRow(orgId);
    const result = await verifyStripeKey(
      row.secretKey,
      row.mode as "test" | "live",
    );
    const update: Record<string, unknown> = {
      lastVerifiedStatus: result.status,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    };
    if (result.account) {
      update.accountId = result.account.id;
      update.accountName = result.account.name;
      update.accountEmail = result.account.email;
      update.livemode = result.account.livemode;
    }
    const [updated] = await db
      .update(orgPaymentSettingsTable)
      .set(update)
      .where(eq(orgPaymentSettingsTable.organizationId, orgId))
      .returning();
    res.json({
      ...shapeReadResponse(updated),
      verification: result,
    });
  }),
);

export default router;
