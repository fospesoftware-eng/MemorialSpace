/**
 * Public B2C "digital rituals" endpoints.
 *
 * Visitors of a public memorial page can light a candle, offer flowers,
 * or leave a written / voice prayer. The QR `code` in the URL acts as the
 * read+write credential — same trust model as the public memorial editor:
 * if you've been handed the QR (the headstone or family share), you can
 * leave a tribute.
 *
 * Rituals are:
 *   - rate-limited per IP+code (8 / 10min) to keep the wall sincere,
 *   - capped in size (message ≤ 1000, audio data URL ≤ ~1.4MB / ~1MB raw),
 *   - bound to the burial via the QR (memorialId is optional — visitors
 *     can leave rituals even before the family has fleshed out the bio).
 *
 * Mounted on the public surface (no auth) in `routes/index.ts`. Caching is
 * disabled because the wall is live: a cached response would freeze new
 * candles for the next visitor's view.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  burialsTable,
  qrCodesTable,
  organizationsTable,
  memorialRitualsTable,
  RITUAL_TYPES,
  RITUAL_ACTIVE_MS,
  ritualTypeSchema,
  type MemorialRitual,
} from "@workspace/db";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

// --- rate limiter (per ip+code) ---------------------------------------------
// Keep this in-memory: rituals are inherently best-effort, and the cost of
// dropping a single tribute under heavy load is acceptable given the cost of
// not throttling at all (a bored visitor could spam the wall in seconds).
const ritualBuckets = new Map<string, number[]>();
const RITUAL_WINDOW_MS = 10 * 60 * 1000;
const RITUAL_MAX = 8;
function checkRitualRateLimit(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const cutoff = now - RITUAL_WINDOW_MS;
  const arr = (ritualBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RITUAL_MAX) {
    const earliest = arr[0]!;
    return { ok: false, retryAfter: Math.ceil((earliest + RITUAL_WINDOW_MS - now) / 1000) };
  }
  arr.push(now);
  ritualBuckets.set(key, arr);
  return { ok: true };
}
setInterval(() => {
  const cutoff = Date.now() - RITUAL_WINDOW_MS;
  for (const [k, arr] of ritualBuckets) {
    const filtered = arr.filter((t) => t > cutoff);
    if (filtered.length === 0) ritualBuckets.delete(k);
    else ritualBuckets.set(k, filtered);
  }
}, RITUAL_WINDOW_MS).unref?.();

// --- helpers ----------------------------------------------------------------
async function resolveBurialByCode(slug: string, rawCode: string) {
  const code = rawCode.toUpperCase();
  if (!/^[A-F0-9]{8,64}$/.test(code)) return null;
  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, slug));
  if (!org) return null;
  const [qr] = await db
    .select()
    .from(qrCodesTable)
    .where(and(eq(qrCodesTable.code, code), eq(qrCodesTable.organizationId, org.id)));
  if (!qr || qr.burialId == null) return null;
  const [burial] = await db
    .select()
    .from(burialsTable)
    .where(and(eq(burialsTable.id, qr.burialId), eq(burialsTable.organizationId, org.id)));
  if (!burial) return null;
  return { orgId: org.id, burial };
}

// Sanitize ritual rows for the public response — strip nothing for now,
// but keep a single shape so the FE doesn't depend on column names.
function publicRitual(r: MemorialRitual) {
  return {
    id: r.id,
    type: r.type as "candle" | "flower" | "prayer",
    variant: r.variant,
    visitorName: r.visitorName,
    message: r.message,
    audioDataUrl: r.audioDataUrl,
    audioDurationMs: r.audioDurationMs,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    isActive: r.expiresAt.getTime() > Date.now(),
  };
}

// --- GET: list rituals + counts ---------------------------------------------
// Returns up to `limit` (default 60) most recent active rituals plus
// aggregate counters (active + all-time per type). Active = expiresAt > now.
router.get("/c/:slug/memorial/:code/rituals", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, private");
  const ctx = await resolveBurialByCode(String(req.params.slug ?? ""), String(req.params.code ?? ""));
  if (!ctx) { res.status(404).json({ error: "Memorial not found" }); return; }

  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
  const now = new Date();

  // Active rituals — these are what we render on the live wall.
  const active = await db
    .select()
    .from(memorialRitualsTable)
    .where(and(
      eq(memorialRitualsTable.burialId, ctx.burial.id),
      gte(memorialRitualsTable.expiresAt, now),
    ))
    .orderBy(desc(memorialRitualsTable.createdAt))
    .limit(limit);

  // Aggregate counters split active / all-time, grouped by type. Single
  // round trip keeps the response snappy even when the wall is busy.
  const counts = await db
    .select({
      type: memorialRitualsTable.type,
      active: sql<number>`COUNT(*) FILTER (WHERE ${memorialRitualsTable.expiresAt} > NOW())`.mapWith(Number),
      total: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(memorialRitualsTable)
    .where(eq(memorialRitualsTable.burialId, ctx.burial.id))
    .groupBy(memorialRitualsTable.type);

  const totals: Record<string, { active: number; total: number }> = {
    candle: { active: 0, total: 0 },
    flower: { active: 0, total: 0 },
    prayer: { active: 0, total: 0 },
  };
  for (const row of counts) {
    if (row.type in totals) totals[row.type] = { active: row.active, total: row.total };
  }

  res.json({
    rituals: active.map(publicRitual),
    totals,
    types: RITUAL_TYPES,
  });
});

// --- POST: create ritual ----------------------------------------------------
// Audio is accepted as a base64 data URL (audio/webm;base64,...). We cap
// the string length so a single visitor can't stuff the DB with megabytes
// of audio per ritual. ~1.4 MB string ≈ ~1 MB raw audio, plenty for the
// 60-second voice prayer the FE allows.
const AUDIO_MAX = 1_400_000;
// Match `data:audio/<subtype>[;<param>=<value>]*;base64,<payload>`.
// Browsers commonly emit `audio/webm;codecs=opus` from MediaRecorder, and a
// strict regex without the `;codecs=...` parameter rejected those uploads.
// We allow zero-or-more `;param=value` pairs between the MIME and `;base64,`.
const AUDIO_DATA_URL_RE =
  /^data:audio\/(webm|ogg|mpeg|wav|mp4|mp3|x-m4a|aac)(?:;[a-zA-Z0-9-]+=[a-zA-Z0-9.\-+_/]+)*;base64,[A-Za-z0-9+/=]+$/;

const createRitualSchema = z.object({
  type: ritualTypeSchema,
  variant: z.string().trim().max(40).nullish(),
  visitorName: z.string().trim().max(80).nullish(),
  message: z.string().trim().max(1000).nullish(),
  audioDataUrl: z.string().max(AUDIO_MAX).regex(AUDIO_DATA_URL_RE).nullish(),
  audioDurationMs: z.number().int().min(0).max(120_000).nullish(),
});

router.post("/c/:slug/memorial/:code/rituals", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, private");
  const slug = String(req.params.slug ?? "");
  const code = String(req.params.code ?? "");
  const ctx = await resolveBurialByCode(slug, code);
  if (!ctx) { res.status(404).json({ error: "Memorial not found" }); return; }

  // Rate limit per (ip + code) — same shape used by the editor PIN gate.
  const rlKey = `${req.ip ?? "unknown"}:${code.toUpperCase()}`;
  const rl = checkRitualRateLimit(rlKey);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    res.status(429).json({ error: "You're leaving rituals very fast. Please pause for a moment." });
    return;
  }

  const parsed = createRitualSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ritual", details: parsed.error.issues });
    return;
  }
  const body = parsed.data;

  // Audio only makes sense on prayers — silently drop for candles/flowers
  // so a buggy client can't sneak audio into wrong types.
  const audioDataUrl = body.type === "prayer" ? body.audioDataUrl ?? null : null;
  const audioDurationMs = audioDataUrl ? body.audioDurationMs ?? null : null;

  // Trim visitor name; default to Anonymous so the FE always has something
  // human to render on the wall.
  const visitorName = (body.visitorName ?? "").trim() || "Anonymous";
  const message = (body.message ?? "").trim() || null;

  // Prayers must say *something*: a prayer ritual without text or audio is
  // empty noise on the wall.
  if (body.type === "prayer" && !message && !audioDataUrl) {
    res.status(400).json({ error: "Please write a prayer or record one." });
    return;
  }

  const expiresAt = new Date(Date.now() + RITUAL_ACTIVE_MS[body.type]);

  const [row] = await db
    .insert(memorialRitualsTable)
    .values({
      organizationId: ctx.orgId,
      burialId: ctx.burial.id,
      type: body.type,
      variant: body.variant ?? null,
      visitorName,
      message,
      audioDataUrl,
      audioDurationMs,
      expiresAt,
    })
    .returning();

  res.status(201).json({ ritual: publicRitual(row) });
});

export default router;
