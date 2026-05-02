import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { detectMap, type CvDetection } from "../lib/cvDetect";
import { detectGridPlots, type PdfTextItem } from "../lib/gridDetect";

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

/**
 * The new CV pipeline can produce hundreds of individual grave cells per
 * detected section, which is exactly what operators want — every grave as
 * its own clickable plot. Cap generously.
 */
const MAX_PLOTS = 2000;
const MAX_SPOTS = 30;
/**
 * Minimum number of valid polygon vertices we keep when emitting a section
 * outline. The pipeline already simplifies via Douglas-Peucker, this is just
 * a sanity floor.
 */
const MIN_SECTION_POLYGON_VERTICES = 3;

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

/**
 * Optional PDF text positions, when the source file is a vector PDF and the
 * client extracted text via pdfjs.getTextContent(). Coordinates are
 * normalised to [0..1] in the *rendered image* coordinate system (NOT raw
 * PDF user space). When present, the server runs the "grid" detection
 * pipeline (`gridDetect.ts`) instead of the colour-section pipeline, and
 * uses these text positions to label each detected plot with the names /
 * dates printed inside it.
 */
const PdfTextItemSchema = z.object({
  text: z.string().max(200),
  x: z.number().min(-0.05).max(1.05),
  y: z.number().min(-0.05).max(1.05),
  w: z.number().min(0).max(1.1),
  h: z.number().min(0).max(1.1),
});

const DetectMapBody = z.object({
  image: z.string().min(50, "image must be a non-empty data URL"),
  imgWidth: z.number().int().positive(),
  imgHeight: z.number().int().positive(),
  plotTypes: z.array(PlotTypeSchema).min(1).max(50),
  spotTypes: z.array(SpotTypeSchema).max(50).optional(),
  /**
   * If present (typically only for vector PDFs), routes detection through
   * the grid-style pipeline. We cap at 5000 items to keep payloads bounded
   * — large cemetery PDFs land around 1000-2000 items.
   */
  pdfText: z.array(PdfTextItemSchema).max(5000).optional(),
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
  // in the editor instead of a plain bounding box, so non-rectangular sections
  // (curved sections, angled blocks, irregular plots) keep their shape.
  // Up to 40 normalised vertices in perimeter order.
  points: z.array(Point01).min(3).max(40).optional(),
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

// -------- Claude classification step --------
//
// The CV pipeline knows the SHAPE of every section (and every grave inside it)
// but not what each section colour MEANS. Claude is great at this small task:
// it sees the original map, the legend, and the detected colours, and assigns
// each detected colour to one of the operator's configured plot types.
//
// We send only:
//   - the image (so Claude can read the legend / labels),
//   - the list of detected colours, and
//   - the operator's plot type ids.
// We do NOT ask Claude for any geometry — that's what makes this approach
// reliable instead of fragile.

interface ColorClassification {
  /** colorIndex (into the detection's palette) → plot typeId. */
  colorTypeMap: Record<number, string>;
  notes: string;
}

async function classifyPaletteColors(args: {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  palette: CvDetection["palette"];
  plotTypes: { id: string; code: string; name: string }[];
  imgWidth: number;
  imgHeight: number;
}): Promise<ColorClassification> {
  const { base64, mediaType, palette, plotTypes, imgWidth, imgHeight } = args;

  const colorList = palette
    .map((c, i) => `  ${i}: rgb(${c.r}, ${c.g}, ${c.b}) — covers ${(c.coverage * 100).toFixed(1)}% of the map`)
    .join("\n");
  const plotTypeList = plotTypes
    .map((t) => `  - id="${t.id}", code="${t.code}", name="${t.name}"`)
    .join("\n");

  const systemPrompt = `You are classifying detected colour regions on a cemetery map.

A computer-vision pipeline has already extracted the distinct fill colours used on this map and what fraction of the map each one covers. Your job is to look at the map (especially its legend, if any, and any visible labels like "RC", "CON", "FC", "MU", "Lawn", "Path") and decide which of the operator's configured plot types each colour represents.

Detected palette colours (index → RGB → coverage):
${colorList}

Available plot type ids (use ONLY these ids, exactly):
${plotTypeList}

Rules:
- Map each detected colour index to exactly ONE plot type id, by matching legend swatches and on-map labels to colour. If a colour clearly does NOT correspond to a real burial section (e.g. an arrow / road accent / building accent), pick the closest applicable type or the type that best represents "other / non-burial".
- Use ONLY the plot type ids listed above — do not invent ids.
- Coverage % is just a hint about which colours are dominant.

Reply with ONLY a single JSON object (no prose, no markdown), shape:

{
  "colorTypeMap": { "0": "<plot-type-id>", "1": "<plot-type-id>", ... },
  "notes": "1-2 sentence summary of what you saw."
}

Image dimensions: ${imgWidth} x ${imgHeight} pixels.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Classify the detected colours and return the JSON object exactly as specified." },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

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
      raw = JSON.parse(jsonText.slice(firstBrace, lastBrace + 1));
    } else {
      throw new Error("Claude classification returned non-JSON content.");
    }
  }

  const r = (raw ?? {}) as { colorTypeMap?: Record<string, unknown>; notes?: unknown };
  const validIds = new Set(plotTypes.map((t) => t.id));
  const colorTypeMap: Record<number, string> = {};
  if (r.colorTypeMap && typeof r.colorTypeMap === "object") {
    for (const [k, v] of Object.entries(r.colorTypeMap)) {
      const idx = Number(k);
      if (!Number.isInteger(idx) || idx < 0 || idx >= palette.length) continue;
      if (typeof v !== "string" || !validIds.has(v)) continue;
      colorTypeMap[idx] = v;
    }
  }
  return {
    colorTypeMap,
    notes: typeof r.notes === "string" ? r.notes.slice(0, 500) : "",
  };
}

/** Find the palette colour index that best matches a detected section's averaged colour. */
function nearestPaletteIndex(
  sectionColor: { r: number; g: number; b: number },
  palette: CvDetection["palette"],
): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i];
    const dr = c.r - sectionColor.r, dg = c.g - sectionColor.g, db = c.b - sectionColor.b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

/**
 * Minimum number of plots the grid pipeline must find to be considered
 * "real". Below this we treat grid as a false-positive (e.g. the user
 * uploaded a colour-section PDF that *also* has some incidental text) and
 * fall back to the colour-section pipeline instead of returning an empty
 * result. Cemetery grid plans typically yield hundreds of plots; a vector
 * PDF that finds <10 boxes is almost certainly not a grid plan.
 */
const MIN_GRID_PLOTS_TO_TRUST = 10;

/**
 * Run the grid-style detection pipeline (vector PDF plans). No Claude call
 * needed: PDF text gives us labels directly, and we default every plot to
 * the first plot type (operators can re-classify in the editor).
 *
 * Returns `true` when the response was sent (grid succeeded or a hard
 * error occurred). Returns `false` when grid was too weak to trust and
 * the caller should fall through to the colour-section pipeline.
 */
async function runGridDetection(args: {
  imageBuffer: Buffer;
  pdfText: PdfTextItem[];
  fallbackPlotId: string;
  req: Parameters<Parameters<typeof router.post>[1]>[0];
  res: Parameters<Parameters<typeof router.post>[1]>[1];
}): Promise<boolean> {
  const { imageBuffer, pdfText, fallbackPlotId, req, res } = args;

  let grid;
  try {
    grid = await detectGridPlots(imageBuffer, pdfText);
  } catch (err) {
    // A hard CV failure (e.g. corrupt image buffer) is worth surfacing —
    // colour-section would fail on the same buffer. End the request here.
    req.log.error({ err: err instanceof Error ? err.message : String(err) }, "grid detection failed");
    res.status(500).json({
      error: "cv_failed",
      detail: "Could not analyse the PDF map. Try a sharper render of the same page, or draw plots manually in the editor.",
    });
    return true;
  }

  // Too few plots → this probably wasn't a grid plan. Fall through to the
  // colour-section pipeline instead of returning an empty result.
  if (grid.plots.length < MIN_GRID_PLOTS_TO_TRUST) {
    req.log.info(
      { gridPlots: grid.plots.length, rawCandidates: grid.diagnostics.rawCandidateCount },
      "grid detection too weak; falling back to colour-section pipeline",
    );
    return false;
  }

  const plots: z.infer<typeof DetectedPlot>[] = [];
  for (const p of grid.plots) {
    if (plots.length >= MAX_PLOTS) break;
    const x = clamp01(p.x);
    const y = clamp01(p.y);
    const w = Math.max(0, Math.min(1 - x, clamp01(p.w)));
    const h = Math.max(0, Math.min(1 - y, clamp01(p.h)));
    if (w <= 0 || h <= 0) continue;
    const parsed = DetectedPlot.safeParse({
      label: p.label.slice(0, 200),
      typeId: fallbackPlotId,
      status: "available",
      x, y, w, h,
    });
    if (parsed.success) plots.push(parsed.data);
  }

  const matched = plots.filter((p) => p.label).length;
  const result = DetectionResult.parse({
    plots,
    spots: [],
    notes:
      `Grid plan: detected ${plots.length} plot${plots.length === 1 ? "" : "s"}` +
      ` (${matched} labelled from PDF text).` +
      ` All plots default to your first plot type — re-classify in the editor as needed.`,
  });

  req.log.info(
    {
      mode: "grid",
      plots: plots.length,
      matched,
      raw: grid.diagnostics.rawCandidateCount,
      detection: `${grid.diagnostics.detectionWidth}x${grid.diagnostics.detectionHeight}`,
    },
    "ai-map detection complete",
  );
  res.json(result);
  return true;
}

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
  const { image, imgWidth, imgHeight, plotTypes, spotTypes: _spotTypes = [], pdfText } = parsed.data;

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

  const imageBuffer = Buffer.from(base64, "base64");
  const fallbackPlotId = plotTypes[0]?.id ?? "_unknown";

  // ---- Mode selection ----
  // If the client extracted PDF text positions, the source is most likely a
  // vector grid plan (each plot is a thin-bordered rectangle with name +
  // dates printed inside). Try the grid pipeline first — it's faster,
  // cheaper (no Claude call), and produces pixel-perfect labelled plots.
  // If grid comes back too weak (<10 plots), fall through to the
  // colour-section pipeline below — colour-section PDFs occasionally have
  // some embedded text too, and we don't want to falsely commit to grid
  // mode and return nothing.
  if (pdfText && pdfText.length > 0) {
    const handled = await runGridDetection({
      imageBuffer,
      pdfText: pdfText as PdfTextItem[],
      fallbackPlotId,
      req, res,
    });
    if (handled) return;
  }

  // ---- Step 1: server-side computer-vision detection (color-section mode) ----
  let detection: CvDetection;
  try {
    detection = await detectMap(imageBuffer);
  } catch (err) {
    req.log.error({ err: err instanceof Error ? err.message : String(err) }, "cv detection failed");
    res.status(500).json({
      error: "cv_failed",
      detail: "Could not analyse the map image. Try a clearer image (PNG or high-quality JPG/WebP).",
    });
    return;
  }

  if (detection.sections.length === 0 || detection.palette.length === 0) {
    // CV found nothing recognisable. Tell the client clearly so they can
    // fall back to manual editing instead of pretending we found something.
    req.log.warn({ palette: detection.palette.length }, "cv detection returned no sections");
    res.json({
      plots: [],
      spots: [],
      notes:
        "We couldn't auto-detect any coloured sections on this map. " +
        "Try a sharper image where each section type has a distinct flat fill colour, " +
        "or draw plots manually in the editor.",
    });
    return;
  }

  // ---- Step 2: ask Claude what each detected colour represents ----
  let classification: ColorClassification;
  try {
    classification = await classifyPaletteColors({
      base64, mediaType,
      palette: detection.palette,
      plotTypes: plotTypes.map((t) => ({ id: t.id, code: t.code, name: t.name })),
      imgWidth, imgHeight,
    });
  } catch (err) {
    req.log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "claude classification failed; defaulting all sections to first plot type",
    );
    classification = { colorTypeMap: {}, notes: "" };
  }

  // ---- Step 3: turn detected sections into plot records ----
  const plots: z.infer<typeof DetectedPlot>[] = [];

  // Emit BOTH the section outline AND every grave cell inside it. The user
  // explicitly wants both: sections as a whole AND each individual grave as
  // its own clickable plot. Sections come FIRST so they render below the
  // cells in the editor's z-order (section polygon as boundary, cells as
  // the actual interactive plots stacked on top).
  let sectionsEmitted = 0;
  let cellsEmitted = 0;

  for (const section of detection.sections) {
    if (plots.length >= MAX_PLOTS) break;

    const colorIdx = nearestPaletteIndex(section.color, detection.palette);
    const typeId = classification.colorTypeMap[colorIdx] ?? fallbackPlotId;

    // (a) Section outline polygon — draws the section boundary.
    const points = section.points
      .slice(0, 40)
      .map(([px, py]) => [clamp01(px), clamp01(py)] as [number, number]);
    if (points.length >= MIN_SECTION_POLYGON_VERTICES) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const w = Math.max(0, Math.min(1 - x, Math.max(...xs) - x));
      const h = Math.max(0, Math.min(1 - y, Math.max(...ys) - y));
      if (w > 0 && h > 0) {
        const parsed = DetectedPlot.safeParse({
          label: "", typeId, status: "available", x, y, w, h, points,
        });
        if (parsed.success) {
          plots.push(parsed.data);
          sectionsEmitted++;
        }
      }
    }

    // (b) Individual grave cells inside this section — each is its own plot.
    for (const cell of section.cells) {
      if (plots.length >= MAX_PLOTS) break;
      const x = clamp01(cell.x);
      const y = clamp01(cell.y);
      const w = Math.max(0, Math.min(1 - x, clamp01(cell.w)));
      const h = Math.max(0, Math.min(1 - y, clamp01(cell.h)));
      if (w <= 0 || h <= 0) continue;
      const parsed = DetectedPlot.safeParse({
        label: "", typeId, status: "available", x, y, w, h,
      });
      if (parsed.success) {
        plots.push(parsed.data);
        cellsEmitted++;
      }
    }
  }

  const summaryParts = [
    `Detected ${sectionsEmitted} section outline${sectionsEmitted === 1 ? "" : "s"}` +
      ` and ${cellsEmitted} individual grave plot${cellsEmitted === 1 ? "" : "s"}` +
      ` (${plots.length} total).`,
    classification.notes ? classification.notes : null,
  ].filter(Boolean);

  const result = DetectionResult.parse({
    plots,
    spots: [],
    notes: summaryParts.join(". "),
  });
  req.log.info(
    { plots: result.plots.length, sections: detection.sections.length, palette: detection.palette.length },
    "ai-map detection complete",
  );
  res.json(result);
});

export default router;
