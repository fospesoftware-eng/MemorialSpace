/**
 * Computer-vision pipeline for "grid view" cemetery plans.
 *
 * Use case: a vector PDF (typically from CorelDRAW/AutoCAD) that draws every
 * grave plot as a thin-bordered rectangle on white, with the owner's name and
 * birth/death dates printed inside. There are NO color sections — just
 * hundreds of small black-outlined boxes.
 *
 * The colour-section pipeline in `cvDetect.ts` is the wrong tool for these:
 * there are no flat colour fills to segment. Instead we:
 *
 *   1. Threshold dark pixels (the borders + text) → binary "ink" mask.
 *   2. Connected components on the LIGHT pixels (4-conn) → every bounded
 *      interior region is one candidate plot. The page background is also a
 *      huge connected component; we discard it by checking for image-edge
 *      contact and by size.
 *   3. Filter candidates by size, aspect ratio and fill ratio.
 *
 * This works because thin lines fully enclose each plot's interior, so each
 * interior is its own connected white region. No color is needed.
 *
 * If the caller has supplied PDF text positions (extracted client-side via
 * pdfjs from the original vector PDF), we then match each text word to the
 * detected plot rectangle whose bbox contains the word's centre, producing
 * pixel-perfect plot labels with NO OCR.
 */

import sharp from "sharp";

// ---- Tunables ------------------------------------------------------------

/**
 * Long-edge target for processing. Grid plot boxes are TINY (often only
 * 60-80px even at 2400 long-edge), so we process at higher resolution than
 * the colour-section pipeline. 2400 is a sweet spot: small plots stay
 * separable, total CPU is still ~1-2s.
 */
const TARGET_LONG_EDGE = 2400;

/**
 * Pixels darker than this luminance count as "ink" (border or text). 150
 * matches the value validated in standalone CV tests on the reference
 * Gresham PDF — going higher (170+) thickens borders enough to swallow the
 * smallest plot interiors.
 */
const INK_LUMINANCE_THRESHOLD = 150;

/**
 * Set to 0 by default — the natural anti-aliased border thickness in a
 * vector PDF render is already 2-3px, so further dilation tends to either
 * destroy small-plot interiors or merge text into the border. Increase to
 * 1 only for sources with broken / dotted borders.
 */
const INK_DILATE_RADIUS = 0;

/**
 * Min/max bounding box dimensions (in detection-image pixels) for a plot.
 * The lower bound rejects single letters / page noise; the upper bound
 * rejects huge regions like the title block, the big "BACKFILL AREA" shape,
 * or a whole survey-grid cell.
 */
const MIN_PLOT_DIM_PX = 12;
const MAX_PLOT_DIM_PX = 320;

/** Min/max plot area in detection pixels. */
const MIN_PLOT_AREA_PX = 200;
const MAX_PLOT_AREA_PX = 60_000;

/**
 * Fraction of a plot's bbox that must be its interior pixels. Genuine
 * rectangular plots come in around 0.7-0.95 (small dent for the text glyphs
 * sitting on top); text fragments and noise come in much lower because
 * their bbox includes lots of empty space. 0.55 keeps small plots that get
 * heavily glyph-eroded; raising to 0.6 drops 5-10% of borderline plots.
 */
const MIN_FILL_RATIO = 0.55;

/**
 * Aspect ratio limits. Most cemetery plots are 1:1 to ~4:1 wide-or-tall.
 * Very thin strips (>6:1) are usually grid-line gaps or text rows.
 */
const MAX_ASPECT_RATIO = 6.0;

/** Hard cap on how many plot candidates we'll emit. */
const MAX_PLOTS = 2000;

/** Words shorter than this are usually marker glyphs ("HC", "X") not labels. */
const SKIP_LABEL_WORDS = new Set(["HC", "SLAB", "X"]);

// ---- Types ---------------------------------------------------------------

export interface PdfTextItem {
  /** Raw text string. */
  text: string;
  /** Bounding box in normalised image coordinates [0..1]. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridPlot {
  /** Bounding box in normalised image coordinates [0..1]. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Concatenated text label from PDF text matching, "" if none matched. */
  label: string;
}

export interface GridDetection {
  /** All detected plots. */
  plots: GridPlot[];
  /** Diagnostic info — the route uses these to build a status note. */
  diagnostics: {
    detectionWidth: number;
    detectionHeight: number;
    rawCandidateCount: number;
    filteredPlotCount: number;
    matchedLabelCount: number;
    /** Plots dropped because they sit inside a larger plot (outer-only filter). */
    droppedAsInnerCount: number;
  };
}

// ---- Helpers -------------------------------------------------------------

/** Dilate a binary mask (1 = ink) by a Manhattan radius via two 1-D passes. */
function dilateMask(mask: Uint8Array, w: number, h: number, radius: number): void {
  if (radius <= 0) return;
  const tmp = new Uint8Array(mask.length);
  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      for (let i = x0; i <= x1; i++) {
        if (mask[row + i]) { v = 1; break; }
      }
      tmp[row + x] = v;
    }
  }
  // Vertical pass back into mask
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      for (let i = y0; i <= y1; i++) {
        if (tmp[i * w + x]) { v = 1; break; }
      }
      mask[y * w + x] = v;
    }
  }
}

// ---- Main entry ----------------------------------------------------------

/**
 * Run grid-style plot detection on a raster image of a vector cemetery plan.
 *
 * `pdfText` is optional — when present, each detected plot is labelled with
 * the words whose centres fall inside it (sorted top-to-bottom, joined by
 * spaces). When absent, plots come back unlabelled.
 */
export async function detectGridPlots(
  imageBuffer: Buffer,
  pdfText: PdfTextItem[] = [],
): Promise<GridDetection> {
  // 1. Decode + downscale to processing resolution.
  const meta = await sharp(imageBuffer).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (srcW <= 0 || srcH <= 0) {
    throw new Error("Could not read image dimensions for grid detection.");
  }
  const longEdge = Math.max(srcW, srcH);
  const scale = longEdge > TARGET_LONG_EDGE ? TARGET_LONG_EDGE / longEdge : 1;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  // Flatten alpha onto white (so transparent PDFs/PNGs don't read as "ink"),
  // grayscale, raw 1-byte-per-pixel buffer.
  const { data: gray } = await sharp(imageBuffer)
    .resize(w, h, { kernel: "lanczos3" })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 2. Build ink mask + dilate to close 1px border gaps.
  const N = w * h;
  const ink = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (gray[i] < INK_LUMINANCE_THRESHOLD) ink[i] = 1;
  }
  dilateMask(ink, w, h, INK_DILATE_RADIUS);

  // 3. Connected components on LIGHT (non-ink) pixels with 4-connectivity.
  //    Use a single shared Int32Array as the BFS queue — this is the dominant
  //    allocation cost on big images.
  const label = new Int32Array(N);
  const queue = new Int32Array(N);
  type Comp = { sz: number; minX: number; minY: number; maxX: number; maxY: number; touchesEdge: boolean };
  const comps: Comp[] = [];
  let nextLabel = 1;

  for (let i = 0; i < N; i++) {
    if (ink[i] || label[i]) continue;
    const lbl = nextLabel++;
    let qHead = 0;
    let qTail = 0;
    queue[qTail++] = i;
    label[i] = lbl;
    let minX = w, minY = h, maxX = 0, maxY = 0, sz = 0, touchesEdge = false;
    while (qHead < qTail) {
      const p = queue[qHead++];
      const px = p % w;
      const py = (p / w) | 0;
      if (px === 0 || py === 0 || px === w - 1 || py === h - 1) touchesEdge = true;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      sz++;
      if (px > 0 && !ink[p - 1] && !label[p - 1]) { label[p - 1] = lbl; queue[qTail++] = p - 1; }
      if (px < w - 1 && !ink[p + 1] && !label[p + 1]) { label[p + 1] = lbl; queue[qTail++] = p + 1; }
      if (py > 0 && !ink[p - w] && !label[p - w]) { label[p - w] = lbl; queue[qTail++] = p - w; }
      if (py < h - 1 && !ink[p + w] && !label[p + w]) { label[p + w] = lbl; queue[qTail++] = p + w; }
    }
    comps.push({ sz, minX, minY, maxX, maxY, touchesEdge });
  }
  const rawCandidateCount = comps.length;

  // 4. Filter candidates. The page background also shows up here as a single
  //    huge edge-touching component — find the largest edge-touching one and
  //    drop ONLY that. Smaller edge-touching components that pass the size /
  //    shape filters are legitimate plots straddling the page boundary, so
  //    we keep them.
  let bgLabel = -1;
  let bgArea = 0;
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    if (!c.touchesEdge) continue;
    if (c.sz > bgArea) { bgArea = c.sz; bgLabel = i; }
  }
  const plots: GridPlot[] = [];
  for (let i = 0; i < comps.length; i++) {
    if (plots.length >= MAX_PLOTS) break;
    if (i === bgLabel) continue;
    const c = comps[i];
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    if (bw < MIN_PLOT_DIM_PX || bh < MIN_PLOT_DIM_PX) continue;
    if (bw > MAX_PLOT_DIM_PX || bh > MAX_PLOT_DIM_PX) continue;
    const bboxArea = bw * bh;
    if (bboxArea < MIN_PLOT_AREA_PX || bboxArea > MAX_PLOT_AREA_PX) continue;
    const fillRatio = c.sz / bboxArea;
    if (fillRatio < MIN_FILL_RATIO) continue;
    const aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
    if (aspect > MAX_ASPECT_RATIO) continue;

    plots.push({
      // Normalise back to [0..1]. We use the +1 inclusive bbox so trailing
      // edges aren't clipped.
      x: c.minX / w,
      y: c.minY / h,
      w: bw / w,
      h: bh / h,
      label: "",
    });
  }

  // 4b. Outer-boxes-only filter. Some plans group small grave cells inside
  //     a larger section/block rectangle — the operator only wants the
  //     OUTER container, not every individual cell. Drop any plot whose
  //     bbox is contained inside a strictly larger plot's bbox.
  //
  //     Implementation: sort by area desc and walk top-down. For each
  //     candidate we test whether any *already-kept* plot encloses it
  //     (with a small tolerance to absorb 1-2px border noise from BFS).
  //     Quadratic in the worst case but n is typically <500 so this
  //     runs in well under a millisecond.
  const CONTAINMENT_TOL = 3 / Math.max(w, h); // ~3px in normalised coords
  plots.sort((a, b) => b.w * b.h - a.w * a.h);
  const outerOnly: GridPlot[] = [];
  for (const p of plots) {
    const px2 = p.x + p.w;
    const py2 = p.y + p.h;
    let containedBy = -1;
    for (let i = 0; i < outerOnly.length; i++) {
      const q = outerOnly[i];
      const qx2 = q.x + q.w;
      const qy2 = q.y + q.h;
      if (
        p.x >= q.x - CONTAINMENT_TOL &&
        p.y >= q.y - CONTAINMENT_TOL &&
        px2 <= qx2 + CONTAINMENT_TOL &&
        py2 <= qy2 + CONTAINMENT_TOL &&
        // strictly smaller (don't drop near-duplicates of the same box)
        p.w * p.h < q.w * q.h * 0.95
      ) { containedBy = i; break; }
    }
    if (containedBy === -1) outerOnly.push(p);
  }
  const droppedAsInner = plots.length - outerOnly.length;
  // Replace the working set with outers only for the rest of the pipeline.
  plots.length = 0;
  for (const p of outerOnly) plots.push(p);

  // 5. Match PDF text words → plots by spatial containment.
  //    For each plot we collect words whose centres fall inside its bbox,
  //    sort top-to-bottom (then left-to-right), and join with " " (newlines
  //    between visually-distinct lines).
  let matchedLabelCount = 0;
  if (pdfText.length > 0 && plots.length > 0) {
    // Pre-compute word centres + filter junk once.
    interface WordHit {
      text: string;
      cx: number;
      cy: number;
      h: number;
    }
    const words: WordHit[] = [];
    for (const t of pdfText) {
      const text = t.text.trim();
      if (!text) continue;
      if (SKIP_LABEL_WORDS.has(text.toUpperCase())) continue;
      // Drop the survey-grid letters/numbers ("A", "B", "1", "2", …) that
      // sit OUTSIDE every plot box anyway — they'll naturally fail the
      // containment test, but skipping them up-front is cheap.
      if (text.length === 1 && /[A-Za-z0-9]/.test(text)) continue;
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      words.push({ text, cx, cy, h: t.h });
    }

    // Bucket words into a coarse spatial grid for an O(plots × wordsPerCell)
    // matching pass instead of O(plots × all-words). The grid is normalised
    // [0..1], cells are 32×32 by default which keeps lookups under ~50 words.
    const GRID = 32;
    const buckets = new Map<number, WordHit[]>();
    const bucketKey = (gx: number, gy: number) => gy * GRID + gx;
    for (const word of words) {
      const gx = Math.max(0, Math.min(GRID - 1, Math.floor(word.cx * GRID)));
      const gy = Math.max(0, Math.min(GRID - 1, Math.floor(word.cy * GRID)));
      const key = bucketKey(gx, gy);
      let bucket = buckets.get(key);
      if (!bucket) { bucket = []; buckets.set(key, bucket); }
      bucket.push(word);
    }

    for (const plot of plots) {
      const x0 = plot.x;
      const y0 = plot.y;
      const x1 = plot.x + plot.w;
      const y1 = plot.y + plot.h;
      const gx0 = Math.max(0, Math.min(GRID - 1, Math.floor(x0 * GRID)));
      const gy0 = Math.max(0, Math.min(GRID - 1, Math.floor(y0 * GRID)));
      const gx1 = Math.max(0, Math.min(GRID - 1, Math.floor(x1 * GRID)));
      const gy1 = Math.max(0, Math.min(GRID - 1, Math.floor(y1 * GRID)));
      const hits: WordHit[] = [];
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const bucket = buckets.get(bucketKey(gx, gy));
          if (!bucket) continue;
          for (const word of bucket) {
            if (word.cx >= x0 && word.cx <= x1 && word.cy >= y0 && word.cy <= y1) {
              hits.push(word);
            }
          }
        }
      }
      if (hits.length === 0) continue;
      // Sort top-to-bottom, then left-to-right within a line. Two words are
      // considered to be on the same visual line when their vertical centres
      // are within half the larger word's height.
      hits.sort((a, b) => {
        const lineGap = Math.max(a.h, b.h) * 0.5;
        if (Math.abs(a.cy - b.cy) > lineGap) return a.cy - b.cy;
        return a.cx - b.cx;
      });
      // Group into lines, join lines with newlines so the editor can format
      // multi-word labels nicely.
      const lines: string[] = [];
      let current: WordHit[] = [];
      for (const word of hits) {
        if (current.length === 0) { current.push(word); continue; }
        const last = current[current.length - 1];
        const lineGap = Math.max(last.h, word.h) * 0.5;
        if (Math.abs(word.cy - last.cy) > lineGap) {
          lines.push(current.map((w) => w.text).join(" "));
          current = [word];
        } else {
          current.push(word);
        }
      }
      if (current.length > 0) lines.push(current.map((w) => w.text).join(" "));
      const label = lines.join("\n").slice(0, 200);
      if (label) {
        plot.label = label;
        matchedLabelCount++;
      }
    }
  }

  return {
    plots,
    diagnostics: {
      detectionWidth: w,
      detectionHeight: h,
      rawCandidateCount,
      filteredPlotCount: plots.length,
      matchedLabelCount,
      droppedAsInnerCount: droppedAsInner,
    },
  };
}
