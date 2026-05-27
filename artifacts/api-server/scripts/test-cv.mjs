// Quick smoke test: run the CV detector against the operator's sample map
// and dump a summary. Usage: node scripts/test-cv.mjs <path-to-image>
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

// Inline-import the TS source via tsx-like transpile is awkward; instead this
// script duplicates the public entry by importing the compiled JS once we run
// build, OR we run it via tsx. Simplest: use tsx in the command.
// We import directly from the source TypeScript via a relative path; the
// caller runs this through `tsx`.
const { detectMap } = await import("../src/lib/cvDetect.ts");

const imgPath = process.argv[2];
if (!imgPath) {
  console.error("usage: tsx scripts/test-cv.mjs <image-path>");
  process.exit(1);
}
const buf = readFileSync(imgPath);
console.time("detect");
const result = await detectMap(buf);
console.timeEnd("detect");

console.log(`Image: ${result.imgWidth}x${result.imgHeight}`);
console.log(`Palette: ${result.palette.length} colors`);
for (const p of result.palette) {
  console.log(`  rgb(${p.r}, ${p.g}, ${p.b}) covering ${(p.coverage * 100).toFixed(1)}%`);
}
console.log(`Sections detected: ${result.sections.length}`);
let totalCells = 0;
for (const s of result.sections) {
  totalCells += s.cells.length;
  console.log(
    `  - rgb(${s.color.r},${s.color.g},${s.color.b}) ` +
    `area=${(s.area * 100).toFixed(1)}% verts=${s.points.length} cells=${s.cells.length}`,
  );
}
console.log(`Total grave cells: ${totalCells}`);

// Render an overlay PNG so we can eyeball accuracy.
const meta = await sharp(buf).metadata();
const W = meta.width, H = meta.height;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
for (const s of result.sections) {
  const pts = s.points.map(([x, y]) => `${x * W},${y * H}`).join(" ");
  const fill = `rgba(${s.color.r},${s.color.g},${s.color.b},0.45)`;
  const stroke = `rgb(${Math.max(0, s.color.r - 50)},${Math.max(0, s.color.g - 50)},${Math.max(0, s.color.b - 50)})`;
  svg += `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  for (const c of s.cells) {
    svg += `<rect x="${c.x * W}" y="${c.y * H}" width="${c.w * W}" height="${c.h * H}" `
        + `fill="rgba(255,255,255,0.0)" stroke="rgba(255,0,0,0.7)" stroke-width="1"/>`;
  }
}
svg += `</svg>`;
const overlayPath = imgPath.replace(/\.\w+$/, "") + ".cv-overlay.png";
await sharp(Buffer.from(svg)).png().toFile(overlayPath);
console.log(`Overlay written to: ${overlayPath}`);

const composedPath = imgPath.replace(/\.\w+$/, "") + ".cv-composed.png";
await sharp(buf)
  .flatten({ background: "#ffffff" })
  .composite([{ input: Buffer.from(svg) }])
  .png()
  .toFile(composedPath);
console.log(`Composed PNG written to: ${composedPath}`);
