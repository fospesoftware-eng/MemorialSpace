/**
 * AI Settings API — platform-level Anthropic configuration for the AI Map Maker.
 *
 * Super admins (and billing admins) set the API key here; it is stored in the
 * database and used dynamically by the `/ai/detect-map` endpoint instead of
 * relying on a hardcoded environment variable.
 *
 * Reads mask the secret key; writes drop masked round-tripped values.
 */
import { Router, type IRouter, type Request } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

import {
  db,
  platformAiSettingsTable,
} from "@workspace/db";
import {
  asyncHandler,
  requirePlatformAdmin,
} from "../lib/auth";

const router: IRouter = Router();

// Only super_admin / billing_admin may WRITE; support admin may read.
const PLATFORM_BILLING_WRITE_ROLES = new Set(["super_admin", "billing_admin"]);

function ensurePlatformBillingWrite(req: Request, res: import("express").Response): boolean {
  const role = req.session?.user?.role;
  if (!role || !PLATFORM_BILLING_WRITE_ROLES.has(role)) {
    res.status(403).json({ error: "Only super admins and billing admins may change AI settings." });
    return false;
  }
  return true;
}

function maskSecret(v: string | null | undefined): string | null {
  if (!v) return null;
  const last4 = v.slice(-4);
  return `••••••••${last4}`;
}

function buildPatch(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (k === "anthropicApiKey" && typeof v === "string" && v.startsWith("••••")) {
      // UI echoed back the masked placeholder — keep existing value.
      continue;
    }
    out[k] = v === "" ? null : v;
  }
  out.updatedAt = new Date();
  return out;
}

// ---------------------------------------------------------------------------
// GET /admin/ai-settings
// ---------------------------------------------------------------------------

async function getOrCreateRow() {
  const [existing] = await db
    .select()
    .from(platformAiSettingsTable)
    .where(eq(platformAiSettingsTable.id, 1))
    .limit(1);
  if (existing) return existing;
  // Upsert to avoid unique-key race under concurrent first access.
  const [created] = await db
    .insert(platformAiSettingsTable)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Another request won the race; fetch the winner.
  const [winner] = await db
    .select()
    .from(platformAiSettingsTable)
    .where(eq(platformAiSettingsTable.id, 1))
    .limit(1);
  return winner!;
}

router.get(
  "/admin/ai-settings",
  requirePlatformAdmin,
  asyncHandler(async (_req, res) => {
    const row = await getOrCreateRow();
    res.json({
      ...row,
      anthropicApiKey: maskSecret(row.anthropicApiKey),
      hasKey: Boolean(row.anthropicApiKey),
    });
  }),
);

// ---------------------------------------------------------------------------
// PUT /admin/ai-settings
// ---------------------------------------------------------------------------

const SettingsBody = z.object({
  anthropicApiKey: z.string().max(500).nullable().optional(),
});

router.put(
  "/admin/ai-settings",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    if (!ensurePlatformBillingWrite(req, res)) return;
    const parsed = SettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }
    await getOrCreateRow();
    const patch = buildPatch(parsed.data);
    const [row] = await db
      .update(platformAiSettingsTable)
      .set(patch)
      .where(eq(platformAiSettingsTable.id, 1))
      .returning();
    res.json({
      ...row,
      anthropicApiKey: maskSecret(row.anthropicApiKey),
      hasKey: Boolean(row.anthropicApiKey),
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /admin/ai-settings/test
// ---------------------------------------------------------------------------

router.post(
  "/admin/ai-settings/test",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    if (!ensurePlatformBillingWrite(req, res)) return;
    const row = await getOrCreateRow();
    const key = row.anthropicApiKey;
    if (!key) {
      res.json({ status: "no_key", message: "No API key configured." });
      return;
    }
    try {
      const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 8000 });
      // A lightweight models.list call that exercises authentication without
      // burning tokens or credits.
      const models = await client.models.list();
      // Verify we actually got usable data back (not just a 200 on auth).
      const hasModels = models.data && models.data.length > 0;
      res.json({
        status: hasModels ? "ok" : "limited",
        message: hasModels
          ? `Connected. Anthropic has ${models.data.length} model(s) available.`
          : "Authenticated but model list was empty — the account may be restricted.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("api key")) {
        res.json({ status: "invalid_key", message: msg });
      } else {
        res.json({ status: "network_error", message: msg });
      }
    }
  }),
);

export default router;
