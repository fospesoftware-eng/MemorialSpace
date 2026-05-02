/**
 * Computer-vision pipeline for cemetery section maps.
 *
 * Why a CV pipeline (and not "ask Claude harder"): vision LLMs cannot
 * pixel-accurately trace dozens of small grave outlines. Color-coded section
 * maps however are *ideal* for classical CV — every section is a distinct
 * color, every individual grave is a white-bordered cell inside it, and the
 * pixels themselves carry the geometry.
 *
 * Pipeline:
 *   1. Decode + downscale the image with `sharp` to bound CPU.
 *   2. Quantise pixels into a coarse color palette and merge near-duplicates
 *      → ~3-8 distinct "section colors" (excluding white background and dark
 *      text).
 *   3. For each palette color:
 *        a. Build a binary mask of pixels matching that color (loose).
 *        b. Dilate the mask so thin white grid lines stop disconnecting
 *           neighbouring cells of the SAME section → one big section blob.
 *        c. Find connected components → SECTIONS.
 *        d. Trace each section's outline with Moore-neighbor border tracing
 *           and simplify with Douglas-Peucker → polygon outline.
 *        e. Inside each section's bbox, run connected components on the
 *           ORIGINAL (un-dilated) tight color mask to recover the individual
 *           grave cells separated by white grid lines.
 *   4. Return sections (polygon outlines) + their child cells (axis-aligned
 *      rectangles) in NORMALISED 0..1 coordinates so the route handler can
 *      hand the result to the editor without further math.
 *
 * Claude is *not* used here for geometry — only to map detected colors to
 * the operator's plot type ids further up the stack.
 */

import sharp from "sharp";
import simplify from "simplify-js";

// ---- Tunables ------------------------------------------------------------

/**
 * Long-edge target for processing. 1200 is a sweet spot: big enough to
 * preserve individual grave cells (typically ~10-15px wide at this scale)
 * yet small enough that dilation can bridge thin (1-2px) anti-aliased white
 * grid lines for whole-section detection.
 */
const TARGET_LONG_EDGE = 1200;

/** Colour-quantization bucket size (RGB units). Smaller = more, finer buckets. */
const PALETTE_BUCKET_Q = 24;

/** Sample stride during palette extraction (every Nth pixel). */
const PALETTE_SAMPLE_STRIDE = 4;

/**
 * Two palette colours within this Euclidean RGB distance get merged. Kept
 * conservative — over-aggressive merging averages two distinct section
 * colours into a single mid-tone that matches NEITHER section's pixels.
 */
const COLOR_MERGE_DISTANCE = 32;

/** Max distinct section-colour candidates we'll consider. */
const MAX_PALETTE_COLORS = 10;

/**
 * Pixels within this RGB distance of a palette colour belong to the SECTION
 * mask (used for outline tracing). Loose-ish so anti-aliased section edges
 * are still claimed by the right section.
 */
const SECTION_COLOR_TOLERANCE = 38;

/**
 * Pixels within this distance count toward the CELL mask (used for individual
 * grave detection). Permissive — we rely on the GRID_LINE_LUMINANCE exclusion
 * (not on tight colour matching) to separate cells from grid lines.
 */
const CELL_COLOR_TOLERANCE = 36;

/**
 * A pixel above this luminance counts as a "grid line / background" and is
 * excluded from the cell mask even if it nominally matches the section color.
 * This is the single most important parameter for cell separation.
 */
const GRID_LINE_LUMINANCE = 198;

/**
 * Dilation radius applied to a section's color mask before finding connected
 * components. Bridges thin white grid lines inside a section so the whole
 * section comes back as one blob, not a thousand cells. Keep small or
 * neighbouring sections start to merge into each other.
 */
const SECTION_DILATE_RADIUS = 3;

/**
 * Erosion radius applied to the CELL mask before connected components. Pulls
 * the colored area back from the (anti-aliased) grid lines so cells separate
 * cleanly. We keep it at 0 because the GRID_LINE_LUMINANCE filter alone
 * does most of the separation, and erosion was murdering small cells.
 */
const CELL_ERODE_RADIUS = 0;

/** A section must be at least this fraction of the (downscaled) image. */
const MIN_SECTION_AREA_FRACTION = 0.0025;

/** Douglas-Peucker tolerance in pixels for section outline simplification. */
const POLYGON_SIMPLIFY_TOLERANCE = 4;

/** Cap on polygon vertices we send back to the client. */
const MAX_POLYGON_VERTICES = 40;

/**
 * A grave cell must be at least this many (downscaled) pixels. Set well
 * below the typical small cemetery cell so we don't drop legitimate cells.
 */
const MIN_CELL_AREA_PX = 50;

/** A "cell" larger than this fraction of the section is the section itself, skip. */
const MAX_CELL_FRACTION_OF_SECTION = 0.18;

/** Skip cell components whose pixel coverage of their bbox is below this. */
const MIN_CELL_FILL_RATIO = 0.35;

/** Per-section cap on how many cells we emit (avoid pathological output). */
const MAX_CELLS_PER_SECTION = 400;

// ---- Public types --------------------------------------------------------

export interface DetectedCell {
  /** Normalised 0..1 (top-left origin). */
  x: number; y: number; w: number; h: number;
}

export interface DetectedSection {
  /** Polygon outline in normalised 0..1 coords (perimeter order). */
  points: [number, number][];
  /** Bounding box of `points`, normalised 0..1. */
  x: number; y: number; w: number; h: number;
  /** Average RGB of the section pixels (0..255). */
  color: { r: number; g: number; b: number };
  /** Fraction of the (downscaled) image area covered by this section. */
  area: number;
  /** Individual grave cells detected inside the section (normalised rects). */
  cells: DetectedCell[];
}

export interface CvDetection {
  imgWidth: number;
  imgHeight: number;
  sections: DetectedSection[];
  /** Diagnostic: the detected palette and which section colour each maps to. */
  palette: Array<{ r: number; g: number; b: number; coverage: number }>;
}

// ---- Helpers -------------------------------------------------------------

interface RGB { r: number; g: number; b: number }

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function colorDistanceSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

// ---- Step 1+2: decode + palette -----------------------------------------

interface RawImage {
  data: Buffer;        // RGB or RGBA tightly packed, channels-per-pixel
  width: number;
  height: number;
  channels: number;
}

async function loadAndResize(input: Buffer): Promise<{ raw: RawImage; origW: number; origH: number }> {
  const meta = await sharp(input).metadata();
  const origW = meta.width ?? 0;
  const origH = meta.height ?? 0;
  if (!origW || !origH) throw new Error("Image has no dimensions.");
  const longEdge = Math.max(origW, origH);
  const scale = Math.min(1, TARGET_LONG_EDGE / longEdge);
  const w = Math.max(1, Math.round(origW * scale));
  const h = Math.max(1, Math.round(origH * scale));
  const { data, info } = await sharp(input)
    // Flatten any transparency onto a white background so the algorithm sees
    // what an operator would see — transparent != "background".
    .flatten({ background: "#ffffff" })
    .resize(w, h, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    raw: { data, width: info.width, height: info.height, channels: info.channels },
    origW, origH,
  };
}

function extractPalette(raw: RawImage): RGB[] {
  const { data, width: W, height: H, channels: ch } = raw;
  // Bucket sampled pixels; each bucket accumulates true colour values.
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  const Q = PALETTE_BUCKET_Q;
  for (let y = 0; y < H; y += PALETTE_SAMPLE_STRIDE) {
    for (let x = 0; x < W; x += PALETTE_SAMPLE_STRIDE) {
      const i = (y * W + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = luminance(r, g, b);
      // Skip near-white background, very light tints (which are usually
      // anti-aliased section edges, not real section fills), and near-black
      // ink/text.
      if (lum > 220 || lum < 28) continue;
      const br = Math.round(r / Q) * Q;
      const bg = Math.round(g / Q) * Q;
      const bb = Math.round(b / Q) * Q;
      const key = `${br},${bg},${bb}`;
      const ex = buckets.get(key);
      if (ex) { ex.r += r; ex.g += g; ex.b += b; ex.count++; }
      else buckets.set(key, { r, g, b, count: 1 });
    }
  }

  // Buckets → averaged colours, sorted by frequency.
  const candidates = Array.from(buckets.values()).map((c) => ({
    r: c.r / c.count, g: c.g / c.count, b: c.b / c.count, count: c.count,
  })).sort((a, b) => b.count - a.count);

  // Merge near-duplicate colours.
  const mergeSq = COLOR_MERGE_DISTANCE * COLOR_MERGE_DISTANCE;
  const merged: typeof candidates = [];
  for (const c of candidates) {
    const dup = merged.find((m) => colorDistanceSq(m, c) < mergeSq);
    if (dup) {
      const tot = dup.count + c.count;
      dup.r = (dup.r * dup.count + c.r * c.count) / tot;
      dup.g = (dup.g * dup.count + c.g * c.count) / tot;
      dup.b = (dup.b * dup.count + c.b * c.count) / tot;
      dup.count = tot;
    } else {
      merged.push({ ...c });
    }
  }

  // Drop trace colours (likely text/noise) and cap.
  const totalSampled = merged.reduce((a, c) => a + c.count, 0);
  if (totalSampled === 0) return [];
  return merged
    .filter((c) => c.count / totalSampled >= 0.005)
    // Drop very-light tints — these are usually anti-aliased edges of section
    // colours, not real section fills.
    .filter((c) => luminance(c.r, c.g, c.b) <= 200)
    .slice(0, MAX_PALETTE_COLORS)
    .map((c) => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) }));
}

// ---- Step 2b: per-pixel nearest-palette label -------------------------

/**
 * Assign every pixel to the nearest palette colour, OR a sentinel if it's too
 * white, too dark, or too far from any palette colour. This guarantees masks
 * for different section colours never overlap (a pixel belongs to exactly one
 * section), which fixes a nasty failure mode where ambient anti-aliased edge
 * pixels were claimed by two sections at once and caused them to merge across
 * a boundary they shouldn't cross.
 *
 * Sentinel labels:
 *   255 — near-white background (or near-white grid line if `whiteCutoff` low)
 *   254 — near-black ink/text
 *   253 — colored but too far from any palette entry
 */
const LABEL_BACKGROUND = 255;
const LABEL_TEXT = 254;
const LABEL_UNCLASSIFIED = 253;
const PALETTE_ASSIGN_MAX_DISTANCE_SQ = 60 * 60;

function buildLabelImage(raw: RawImage, palette: RGB[], whiteCutoff: number): Uint8Array {
  const { data, width: W, height: H, channels: ch } = raw;
  const labels = new Uint8Array(W * H);
  const N = W * H;
  for (let p = 0; p < N; p++) {
    const i = p * ch;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = luminance(r, g, b);
    if (lum >= whiteCutoff) { labels[p] = LABEL_BACKGROUND; continue; }
    if (lum < 30) { labels[p] = LABEL_TEXT; continue; }
    let bestIdx = 0, bestDist = Infinity;
    for (let k = 0; k < palette.length; k++) {
      const c = palette[k];
      const dr = r - c.r, dg = g - c.g, db = b - c.b;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) { bestDist = d; bestIdx = k; }
    }
    labels[p] = bestDist <= PALETTE_ASSIGN_MAX_DISTANCE_SQ ? bestIdx : LABEL_UNCLASSIFIED;
  }
  return labels;
}

/** Mask = 1 wherever labels[i] == labelIndex. */
function maskFromLabel(labels: Uint8Array, labelIndex: number): Uint8Array {
  const N = labels.length;
  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (labels[i] === labelIndex) mask[i] = 1;
  return mask;
}

// ---- Step 3a: build colour mask -----------------------------------------

/**
 * @param excludeNearWhite if true, also rejects pixels brighter than
 *   GRID_LINE_LUMINANCE — used for the cell mask so anti-aliased grid lines
 *   can never be claimed as "section" pixels (which would bridge cells).
 */
function buildColorMask(raw: RawImage, color: RGB, tolerance: number, excludeNearWhite = false): Uint8Array {
  const { data, width: W, height: H, channels: ch } = raw;
  const tolSq = tolerance * tolerance;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (excludeNearWhite && luminance(r, g, b) > GRID_LINE_LUMINANCE) continue;
      const dr = r - color.r;
      const dg = g - color.g;
      const db = b - color.b;
      if (dr * dr + dg * dg + db * db <= tolSq) {
        mask[y * W + x] = 1;
      }
    }
  }
  return mask;
}

// ---- Step 3b: dilate ----------------------------------------------------

function dilate(src: Uint8Array, W: number, H: number, radius: number): Uint8Array {
  let cur = src;
  for (let r = 0; r < radius; r++) {
    const next = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const yw = y * W;
      for (let x = 0; x < W; x++) {
        const i = yw + x;
        if (cur[i]) { next[i] = 1; continue; }
        if (x > 0 && cur[i - 1]) { next[i] = 1; continue; }
        if (x < W - 1 && cur[i + 1]) { next[i] = 1; continue; }
        if (y > 0 && cur[i - W]) { next[i] = 1; continue; }
        if (y < H - 1 && cur[i + W]) { next[i] = 1; continue; }
      }
    }
    cur = next;
  }
  return cur;
}

/** Inverse of dilate — pixels stay set only if all 4-neighbours are also set. */
function erode(src: Uint8Array, W: number, H: number, radius: number): Uint8Array {
  let cur = src;
  for (let r = 0; r < radius; r++) {
    const next = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const yw = y * W;
      for (let x = 0; x < W; x++) {
        const i = yw + x;
        if (!cur[i]) continue;
        // On the image border, treat outside as 0 so we don't create false
        // cells that touch the edge.
        if (x === 0 || x === W - 1 || y === 0 || y === H - 1) continue;
        if (!cur[i - 1] || !cur[i + 1] || !cur[i - W] || !cur[i + W]) continue;
        next[i] = 1;
      }
    }
    cur = next;
  }
  return cur;
}

// ---- Step 3c: connected components --------------------------------------

interface Component {
  pixels: Int32Array;     // packed indices, length = count
  count: number;
  minX: number; maxX: number; minY: number; maxY: number;
}

function findConnectedComponents(
  mask: Uint8Array, W: number, H: number, minSize: number,
  bbox?: { minX: number; minY: number; maxX: number; maxY: number },
): Component[] {
  const visited = new Uint8Array(W * H);
  const out: Component[] = [];
  const queue = new Int32Array(W * H);
  const x0 = bbox?.minX ?? 0;
  const y0 = bbox?.minY ?? 0;
  const x1 = bbox?.maxX ?? W - 1;
  const y1 = bbox?.maxY ?? H - 1;

  for (let y = y0; y <= y1; y++) {
    const yw = y * W;
    for (let x = x0; x <= x1; x++) {
      const start = yw + x;
      if (mask[start] === 0 || visited[start]) continue;
      let head = 0, tail = 0;
      queue[tail++] = start;
      visited[start] = 1;
      // Reuse a growing buffer for component pixels via dynamic Int32Array.
      const compPix: number[] = [];
      let mnx = x, mxx = x, mny = y, mxy = y;
      while (head < tail) {
        const p = queue[head++];
        compPix.push(p);
        const px = p % W;
        const py = (p - px) / W;
        if (px < mnx) mnx = px;
        if (px > mxx) mxx = px;
        if (py < mny) mny = py;
        if (py > mxy) mxy = py;
        // 4-connectivity, restricted to the optional bbox.
        if (px > x0) {
          const n = p - 1;
          if (mask[n] && !visited[n]) { visited[n] = 1; queue[tail++] = n; }
        }
        if (px < x1) {
          const n = p + 1;
          if (mask[n] && !visited[n]) { visited[n] = 1; queue[tail++] = n; }
        }
        if (py > y0) {
          const n = p - W;
          if (mask[n] && !visited[n]) { visited[n] = 1; queue[tail++] = n; }
        }
        if (py < y1) {
          const n = p + W;
          if (mask[n] && !visited[n]) { visited[n] = 1; queue[tail++] = n; }
        }
      }
      if (compPix.length >= minSize) {
        out.push({
          pixels: Int32Array.from(compPix), count: compPix.length,
          minX: mnx, maxX: mxx, minY: mny, maxY: mxy,
        });
      }
    }
  }
  return out;
}

// ---- Step 3d: trace boundary --------------------------------------------

/** Build a fast O(1) "is this pixel in the component" lookup. */
function buildCompMask(comp: Component, W: number, H: number): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let i = 0; i < comp.count; i++) m[comp.pixels[i]] = 1;
  return m;
}

/**
 * Moore-neighbor border tracing. Starts at the topmost-leftmost pixel and
 * walks the boundary clockwise, returning a closed polygon.
 */
function traceBoundary(compMask: Uint8Array, W: number, H: number, comp: Component): [number, number][] {
  // Find topmost-leftmost pixel.
  let startIdx = comp.pixels[0];
  for (let i = 1; i < comp.count; i++) {
    if (comp.pixels[i] < startIdx) startIdx = comp.pixels[i];
  }
  const startX = startIdx % W;
  const startY = (startIdx - startX) / W;

  // Moore neighbours clockwise: E, SE, S, SW, W, NW, N, NE
  const NX = [1, 1, 0, -1, -1, -1, 0, 1];
  const NY = [0, 1, 1, 1, 0, -1, -1, -1];

  const boundary: [number, number][] = [[startX, startY]];
  let curX = startX, curY = startY;
  // Initial backtrack direction: came from west (4).
  let backtrack = 4;

  // Hard cap to prevent infinite loops on pathological masks.
  const cap = comp.count * 8 + 16;
  for (let iter = 0; iter < cap; iter++) {
    let found = false;
    for (let i = 1; i <= 8; i++) {
      const dir = (backtrack + i) % 8;
      const nx = curX + NX[dir];
      const ny = curY + NY[dir];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nIdx = ny * W + nx;
      if (compMask[nIdx]) {
        if (nx === startX && ny === startY) return boundary;
        boundary.push([nx, ny]);
        backtrack = (dir + 4) % 8;
        curX = nx; curY = ny;
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  return boundary;
}

// ---- Step 3d: simplify polygon ------------------------------------------

function simplifyPolygon(points: [number, number][], tolerance: number, maxVertices: number): [number, number][] {
  if (points.length < 4) return points;
  let tol = tolerance;
  let result = simplify(points.map(([x, y]) => ({ x, y })), tol, true);
  // If we still have too many vertices, ramp up tolerance and try again.
  let iterations = 0;
  while (result.length > maxVertices && iterations++ < 6) {
    tol *= 1.7;
    result = simplify(points.map(([x, y]) => ({ x, y })), tol, true);
  }
  return result.map((p) => [p.x, p.y] as [number, number]);
}

// ---- Step 3e: detect grave cells inside a section ----------------------

function detectCellsInSection(
  cellMask: Uint8Array, W: number, H: number, section: Component,
): DetectedCell[] {
  const sectionArea = (section.maxX - section.minX + 1) * (section.maxY - section.minY + 1);
  // 4-connectivity, restricted to the section's bounding box. The cell mask
  // has already been (a) filtered to exclude near-white grid lines and (b)
  // eroded by 1px so anti-aliased edges don't bridge neighbouring cells.
  const components = findConnectedComponents(cellMask, W, H, MIN_CELL_AREA_PX, {
    minX: section.minX, minY: section.minY, maxX: section.maxX, maxY: section.maxY,
  });
  const cells: DetectedCell[] = [];
  for (const c of components) {
    const cw = c.maxX - c.minX + 1;
    const ch = c.maxY - c.minY + 1;
    const bboxArea = cw * ch;
    // Reject anything that effectively IS the section (cells didn't separate),
    // very thin slivers (anti-aliased noise), and low-fill components.
    if (bboxArea > sectionArea * MAX_CELL_FRACTION_OF_SECTION) continue;
    if (cw < 4 || ch < 4) continue;
    if (c.count / bboxArea < MIN_CELL_FILL_RATIO) continue;
    cells.push({ x: c.minX, y: c.minY, w: cw, h: ch });
  }
  // If only 0-1 cells survived the filter, that means the section is a
  // homogeneous region (lawn/road/chapel) with no grid → emit no cells so
  // the caller falls back to the section polygon.
  if (cells.length < 2) return [];
  // Sort by reading order (top-down, left-right) and cap.
  cells.sort((a, b) => a.y - b.y || a.x - b.x);
  return cells.slice(0, MAX_CELLS_PER_SECTION);
}

// ---- Public entry point -------------------------------------------------

export async function detectMap(imageBuffer: Buffer): Promise<CvDetection> {
  const { raw, origW, origH } = await loadAndResize(imageBuffer);
  const { width: W, height: H } = raw;

  const palette = extractPalette(raw);
  if (palette.length === 0) {
    return { imgWidth: origW, imgHeight: origH, sections: [], palette: [] };
  }

  const minSectionPx = Math.max(50, Math.floor(W * H * MIN_SECTION_AREA_FRACTION));
  const totalPx = W * H;

  const sections: DetectedSection[] = [];
  const paletteWithCoverage: Array<{ r: number; g: number; b: number; coverage: number }> = [];

  for (const color of palette) {
    // Two masks per color, used for very different things:
    //   - SECTION mask (loose tolerance, includes anti-aliased edges) →
    //     drives section outline detection. Then dilated to bridge thin
    //     grid lines so the whole section comes back as one blob.
    //   - CELL mask (loose tolerance BUT pixels above GRID_LINE_LUMINANCE
    //     are excluded) → drives individual grave detection so neighbouring
    //     cells stay separated by the now-empty grid lines.
    const sectionMask = buildColorMask(raw, color, SECTION_COLOR_TOLERANCE, false);
    const cellMaskRaw = buildColorMask(raw, color, CELL_COLOR_TOLERANCE, true);
    const cellMask = CELL_ERODE_RADIUS > 0 ? erode(cellMaskRaw, W, H, CELL_ERODE_RADIUS) : cellMaskRaw;

    // Coverage of this color across the image (used by Claude classification).
    let coverage = 0;
    for (let i = 0; i < sectionMask.length; i++) coverage += sectionMask[i];
    paletteWithCoverage.push({ ...color, coverage: coverage / totalPx });

    const dilated = dilate(sectionMask, W, H, SECTION_DILATE_RADIUS);
    const comps = findConnectedComponents(dilated, W, H, minSectionPx);

    for (const comp of comps) {
      const compMask = buildCompMask(comp, W, H);
      const boundaryPx = traceBoundary(compMask, W, H, comp);
      if (boundaryPx.length < 4) continue;
      const simplified = simplifyPolygon(boundaryPx, POLYGON_SIMPLIFY_TOLERANCE, MAX_POLYGON_VERTICES);
      if (simplified.length < 3) continue;

      const cells = detectCellsInSection(cellMask, W, H, comp);

      // Bbox in pixel space (we already have it on the component, but recompute
      // from the simplified polygon for consistency).
      let minX = simplified[0][0], maxX = minX, minY = simplified[0][1], maxY = minY;
      for (const [px, py] of simplified) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }

      sections.push({
        points: simplified.map(([x, y]) => [x / W, y / H] as [number, number]),
        x: minX / W,
        y: minY / H,
        w: Math.max(0, (maxX - minX) / W),
        h: Math.max(0, (maxY - minY) / H),
        color,
        area: comp.count / totalPx,
        cells: cells.map((c) => ({
          x: c.x / W, y: c.y / H, w: c.w / W, h: c.h / H,
        })),
      });
    }
  }

  // Sort sections largest-first so the editor renders big regions underneath
  // smaller ones (and the operator sees them first in any list).
  sections.sort((a, b) => b.area - a.area);

  return { imgWidth: origW, imgHeight: origH, sections, palette: paletteWithCoverage };
}
