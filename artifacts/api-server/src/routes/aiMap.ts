import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

// ---- Simple in-memory per-IP rate limit ----
// /api/ai/detect-map triggers paid Anthropic vision calls, so we cap how often
// any single IP can hit it. This is best-effort (per-process, resets on restart),
// not a substitute for an auth + per-org quota system, but it stops trivial abuse.
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 12;                  // 12 calls per IP per window
const rateLimitBuckets = new Map<string, number[]>();
function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = (rateLimitBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.max(1, Math.ceil((arr[0] + RATE_LIMIT_WINDOW_MS - now) / 1000));
    rateLimitBuckets.set(ip, arr);
    return { ok: false, retryAfterSec };
  }
  arr.push(now);
  rateLimitBuckets.set(ip, arr);
  return { ok: true };
}
// Periodic cleanup so the Map doesn't grow unboundedly across distinct IPs.
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, arr] of rateLimitBuckets) {
    const filtered = arr.filter((t) => t > cutoff);
    if (filtered.length === 0) rateLimitBuckets.delete(ip);
    else rateLimitBuckets.set(ip, filtered);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

const MAX_PLOTS = 60;
const MAX_SPOTS = 30;

const clamp01 = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(1, v));
};

const PlotTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});

const SpotTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const DetectMapBody = z.object({
  image: z.string().min(50, "image must be a non-empty data URL"),
  imgWidth: z.number().int().positive(),
  imgHeight: z.number().int().positive(),
  plotTypes: z.array(PlotTypeSchema).min(1).max(50),
  spotTypes: z.array(SpotTypeSchema).max(50).optional(),
});

const Point01 = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

const DetectedPlot = z.object({
  label: z.string().default(""),
  typeId: z.string(),
  status: z.enum(["available", "reserved", "occupied"]).default("available"),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  // Optional polygon outline of the region. When present we render a polygon
  // in the editor instead of a plain bounding box, so non-rectangular plots
  // (curved sections, angled blocks, irregular plots) keep their shape.
  // 3-32 normalised vertices.
  points: z.array(Point01).min(3).max(32).optional(),
});

const DetectedSpot = z.object({
  label: z.string().default(""),
  spotTypeId: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const DetectionResult = z.object({
  plots: z.array(DetectedPlot).default([]),
  spots: z.array(DetectedSpot).default([]),
  notes: z.string().optional(),
});

router.post("/ai/detect-map", async (req, res) => {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").toString();
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfterSec));
    res.status(429).json({
      error: "rate_limited",
      detail: `Too many AI map detections from this client. Try again in ~${limit.retryAfterSec}s.`,
    });
    return;
  }

  const parsed = DetectMapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", detail: parsed.error.flatten() });
    return;
  }
  const { image, imgWidth, imgHeight, plotTypes, spotTypes = [] } = parsed.data;

  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: "invalid_image", detail: "image must be a base64 data URL (data:image/...;base64,...)" });
    return;
  }
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const base64 = match[2];
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(mediaType)) {
    res.status(400).json({ error: "invalid_image_type", detail: `Unsupported image type: ${mediaType}` });
    return;
  }

  const plotTypeList = plotTypes
    .map((t) => `  - id="${t.id}", code="${t.code}", name="${t.name}"`)
    .join("\n");
  const spotTypeList = spotTypes.length
    ? spotTypes.map((t) => `  - id="${t.id}", name="${t.name}"`).join("\n")
    : "  (none — return spots:[])";

  const systemPrompt = `You are a cemetery cartography assistant. You analyse scanned or photographed cemetery maps and convert them into a structured digital representation that PRESERVES the actual shape of every region, not just rough rectangles.

Your job: identify every clearly-distinguishable burial section, plot block, lawn, path/road, garden and building shown in the image. For EACH region return BOTH:
  (a) "points": a polygon outline that traces the region's true outline as drawn on the map (4-12 vertices typically, up to 32 if needed for curves), AND
  (b) "x","y","w","h": the axis-aligned bounding box of those points.

Coordinate system: ALL numbers are NORMALISED 0..1 — x = pixel_x / imgWidth, y = pixel_y / imgHeight. (0,0) is the top-left, (1,1) is the bottom-right. Every coordinate must lie inside [0,1].

CRITICAL — match the actual shape, not a rough rectangle:
- If a section is rectangular and axis-aligned, polygon = its 4 corners (still include points).
- If it is rotated/angled (very common on real cemetery plans), polygon = its 4 rotated corners — DO NOT snap it back to axis-aligned, the bounding box will be larger than the section.
- If it is curved (e.g. along a road, around a chapel, or a "lawn" / "garden of remembrance"), use 6-12 points to approximate the curve.
- If it is L-shaped, T-shaped or otherwise non-convex, return the full outline (5-12 points) — DO NOT split into multiple boxes and DO NOT collapse into a single rectangle.
- Vertices must be in order around the perimeter (either clockwise or counter-clockwise), no self-intersections.
- Make polygons TIGHT to the printed boundary; do not pad with whitespace. Different sections must not overlap each other.

Classification:
- Match each region to ONE of the available plot type ids below by reading visible labels, shading, color and legend hints. Paths/roads → the path/road id; buildings/chapels → the building id; lawns/gardens → the lawn or garden id if available, otherwise the closest match.
- Status: most regions on a printed plan are "available" unless visually marked as occupied (shaded with names) or reserved.
- Label: copy any visible section name/letter/number ("A", "Sec 12", "RC-3"). If none, leave as "".

Available plot type ids (use ONLY these ids, exactly):
${plotTypeList}

Available burial spot type ids (use ONLY these ids):
${spotTypeList}

Burial spots: only return individual burial markers if the map clearly shows pin-style icons or distinct named graves. For overview/plan maps without per-grave detail, return spots:[].

Reply with ONLY a single JSON object, no prose, no markdown, matching this TypeScript type:

{
  "plots": Array<{
    "label": string,
    "typeId": string,        // must be one of the plot type ids above
    "status": "available" | "reserved" | "occupied",
    "points": [[number, number], ...],  // 3-32 vertices, each [x,y] in 0..1, in perimeter order
    "x": number, "y": number, "w": number, "h": number   // bounding box of "points", all in 0..1
  }>,
  "spots": Array<{
    "label": string,
    "spotTypeId": string,    // must be one of the spot type ids above
    "x": number, "y": number   // 0..1
  }>,
  "notes": string            // 1-2 sentence summary of what you saw
}

Image dimensions for context: ${imgWidth} x ${imgHeight} pixels. Return at most 60 plots and 30 spots — focus on the largest / most clearly defined regions and prefer fewer, accurate polygons over many sloppy ones.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "Analyse this cemetery map and return the JSON object exactly as specified. Do not include any text outside the JSON.",
            },
          ],
        },
      ],
    });

    // Concatenate every text block in the response — Claude can interleave
    // tool/thinking blocks, so we shouldn't assume content[0] is text.
    const text = message.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) {
      res.status(502).json({ error: "empty_response", detail: "AI returned no text content." });
      return;
    }

    // Strip ```json ... ``` fences if present
    const jsonText = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      const firstBrace = jsonText.indexOf("{");
      const lastBrace = jsonText.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try { raw = JSON.parse(jsonText.slice(firstBrace, lastBrace + 1)); }
        catch {
          res.status(502).json({ error: "invalid_ai_json", detail: "AI did not return valid JSON.", raw: text.slice(0, 500) });
          return;
        }
      } else {
        res.status(502).json({ error: "invalid_ai_json", detail: "AI did not return valid JSON.", raw: text.slice(0, 500) });
        return;
      }
    }

    const validPlotIds = new Set(plotTypes.map((t) => t.id));
    const validSpotIds = new Set(spotTypes.map((t) => t.id));
    const fallbackPlotId = plotTypes[0]?.id ?? "_unknown";
    const fallbackSpotId = spotTypes[0]?.id ?? "_unknown";

    const r = (raw ?? {}) as { plots?: unknown[]; spots?: unknown[]; notes?: unknown };

    // Pre-clamp coordinates into [0,1] before Zod parse. The model occasionally
    // emits 1.02 or -0.001 due to rounding; we'd rather snap-fit a near-valid
    // detection than drop it for being a percent point outside the unit square.
    const rawPlots = Array.isArray(r.plots) ? r.plots.slice(0, MAX_PLOTS) : [];
    const rawSpots = Array.isArray(r.spots) ? r.spots.slice(0, MAX_SPOTS) : [];

    const sanitised = {
      plots: rawPlots
        .map((p) => {
          const o = (p ?? {}) as Record<string, unknown>;

          // Sanitise the polygon outline if present: clamp every vertex to [0,1],
          // drop degenerate ones, cap to 32 points.
          let points: [number, number][] | undefined;
          if (Array.isArray(o.points)) {
            const cleaned: [number, number][] = [];
            for (const pt of o.points.slice(0, 32)) {
              if (Array.isArray(pt) && pt.length >= 2) {
                cleaned.push([clamp01(pt[0]), clamp01(pt[1])]);
              }
            }
            if (cleaned.length >= 3) points = cleaned;
          }

          // If we have points, derive the bbox from them — that's far more
          // reliable than trusting a separately-emitted x/y/w/h that often
          // disagrees with the polygon. Otherwise fall back to model bbox.
          let x: number, y: number, w: number, h: number;
          if (points && points.length >= 3) {
            const xs = points.map((q) => q[0]);
            const ys = points.map((q) => q[1]);
            x = Math.min(...xs);
            y = Math.min(...ys);
            w = Math.max(0, Math.min(1 - x, Math.max(...xs) - x));
            h = Math.max(0, Math.min(1 - y, Math.max(...ys) - y));
          } else {
            x = clamp01(o.x);
            y = clamp01(o.y);
            w = Math.max(0, Math.min(1 - x, clamp01(o.w)));
            h = Math.max(0, Math.min(1 - y, clamp01(o.h)));
          }
          return DetectedPlot.safeParse({
            label: typeof o.label === "string" ? o.label : "",
            typeId: typeof o.typeId === "string" ? o.typeId : "",
            status: typeof o.status === "string" ? o.status : "available",
            x, y, w, h, points,
          });
        })
        .filter((p): p is { success: true; data: z.infer<typeof DetectedPlot> } => p.success)
        .map((p) => ({
          ...p.data,
          typeId: validPlotIds.has(p.data.typeId) ? p.data.typeId : fallbackPlotId,
        })),
      spots: rawSpots
        .map((s) => {
          const o = (s ?? {}) as Record<string, unknown>;
          return DetectedSpot.safeParse({
            label: typeof o.label === "string" ? o.label : "",
            spotTypeId: typeof o.spotTypeId === "string" ? o.spotTypeId : "",
            x: clamp01(o.x), y: clamp01(o.y),
          });
        })
        .filter((s): s is { success: true; data: z.infer<typeof DetectedSpot> } => s.success)
        .map((s) => ({
          ...s.data,
          spotTypeId: validSpotIds.has(s.data.spotTypeId) ? s.data.spotTypeId : fallbackSpotId,
        })),
      notes: typeof r.notes === "string" ? r.notes.slice(0, 500) : undefined,
    };

    const result = DetectionResult.parse(sanitised);
    req.log.info({ plots: result.plots.length, spots: result.spots.length }, "ai-map detection complete");
    res.json(result);
  } catch (err) {
    req.log.error({ err: err instanceof Error ? err.message : String(err) }, "ai-map detection failed");
    const status = err instanceof Error && /rate.?limit/i.test(err.message) ? 429 : 502;
    res.status(status).json({
      error: "ai_call_failed",
      detail: err instanceof Error ? err.message : "Unknown error calling AI service.",
    });
  }
});

export default router;
