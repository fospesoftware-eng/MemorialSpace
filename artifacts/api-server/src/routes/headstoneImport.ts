import { Router, type IRouter } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, platformAiSettingsTable, plotsTable, burialsTable } from "@workspace/db";
import { asyncHandler } from "../lib/auth";

const router: IRouter = Router();

const analyzeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many headstone AI scans. Please wait a few minutes and try again." },
});

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const ImageInput = z.object({
  fileName: z.string().min(1).max(500),
  dataUrl: z.string().min(20),
});

const AnalyzeBody = z.object({
  images: z.array(ImageInput).min(1).max(MAX_IMAGES),
});

const PersonInput = z.object({
  name: z.string().max(500),
  dateOfBirth: z.string().max(120).nullable().optional(),
  dateOfDeath: z.string().max(120).nullable().optional(),
});

const VerifiedRow = z.object({
  imageFileName: z.string().min(1).max(500),
  storedPath: z.string().min(1).max(1200),
  isFamilyHeadstone: z.boolean().default(false),
  people: z.array(PersonInput).max(12),
  inscriptionText: z.string().max(10000).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string().max(1000)).max(20).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const VerifyBody = z.object({
  rows: z.array(VerifiedRow).min(1).max(500),
});

type AiPerson = {
  name: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
};

type AiResult = {
  inscriptionText: string;
  isFamilyHeadstone: boolean;
  people: AiPerson[];
  confidence: number;
  warnings: string[];
};

async function getAnthropicClient(): Promise<Anthropic | null> {
  const [row] = await db
    .select()
    .from(platformAiSettingsTable)
    .where(eq(platformAiSettingsTable.id, 1))
    .limit(1);
  const key = row?.anthropicApiKey;
  if (!key) return null;
  return new Anthropic({ apiKey: key, maxRetries: 1, timeout: 45000 });
}

function parseDataUrl(dataUrl: string): { mediaType: string; buffer: Buffer; base64: string } {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/i.exec(dataUrl);
  if (!match) throw Object.assign(new Error("Expected a base64 data URL."), { code: "BAD_REQUEST" });
  const mediaType = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  return { mediaType, buffer, base64 };
}

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function safeOriginalFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").trim();
  const cleaned = base.replace(/[\u0000-\u001f\u007f/\\:]+/g, "_");
  return cleaned || "headstone-image";
}

function publicRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith(path.join("artifacts", "api-server"))) {
    return path.resolve(cwd, "../memorial-space/public");
  }
  return path.resolve(cwd, "artifacts/memorial-space/public");
}

function headstoneFolder(organizationId: number): { absolute: string; publicBase: string } {
  const publicBase = `/uploads/cemeteries/${organizationId}/headstones`;
  return {
    absolute: path.join(publicRoot(), publicBase),
    publicBase,
  };
}

function selectedCemeteryId(req: { body?: unknown; query?: Record<string, unknown>; session?: { user?: { organizationId?: number } } }): number | null {
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const raw = body.cemeteryId ?? req.query?.cemeteryId ?? req.session?.user?.organizationId;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function storeHeadstoneImage(organizationId: number, image: z.infer<typeof ImageInput>): Promise<string> {
  const { mediaType, buffer } = parseDataUrl(image.dataUrl);
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowed.has(mediaType)) {
    throw Object.assign(new Error(`Unsupported image type for ${image.fileName}.`), { code: "BAD_REQUEST" });
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error(`${image.fileName} is too large after compression.`), { code: "BAD_REQUEST" });
  }

  const folder = headstoneFolder(organizationId);
  await mkdir(folder.absolute, { recursive: true });
  const fileName = safeOriginalFileName(image.fileName);
  await writeFile(path.join(folder.absolute, fileName), buffer);
  return `${folder.publicBase}/${encodeURIComponent(fileName)}`;
}

function dateOrNull(value: unknown): string | null {
  const s = asText(value);
  if (!s || /^unknown$/i.test(s)) return null;
  return s;
}

function cleanAiResult(raw: unknown): AiResult {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const peopleRaw = Array.isArray(obj.people) ? obj.people : [];
  const people: AiPerson[] = peopleRaw
    .map((p) => {
      const po = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      return {
        name: asText(po.name),
        dateOfBirth: dateOrNull(po.dateOfBirth ?? po.dob),
        dateOfDeath: dateOrNull(po.dateOfDeath ?? po.dod),
      };
    })
    .filter((p) => p.name.length > 0);

  return {
    inscriptionText: asText(obj.inscriptionText),
    isFamilyHeadstone: obj.isFamilyHeadstone === true || people.length > 1,
    people,
    confidence: Math.max(0, Math.min(1, Number(obj.confidence ?? 0))),
    warnings: Array.isArray(obj.warnings) ? obj.warnings.map(asText).filter(Boolean).slice(0, 8) : [],
  };
}

async function analyzeHeadstone(args: {
  image: z.infer<typeof ImageInput>;
  anthropicClient: Anthropic;
}): Promise<AiResult> {
  const { mediaType, buffer, base64 } = parseDataUrl(args.image.dataUrl);
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowed.has(mediaType)) {
    throw Object.assign(new Error(`Unsupported image type for ${args.image.fileName}.`), { code: "BAD_REQUEST" });
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error(`${args.image.fileName} is too large after compression.`), { code: "BAD_REQUEST" });
  }

  const message = await args.anthropicClient.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    temperature: 0,
    system: `You extract cemetery headstone inscriptions from images.

Return ONLY JSON. Do not include markdown.

Schema:
{
  "inscriptionText": "all readable inscription text, line breaks allowed",
  "isFamilyHeadstone": true,
  "people": [
    { "name": "Full name", "dateOfBirth": "YYYY-MM-DD or YYYY or null", "dateOfDeath": "YYYY-MM-DD or YYYY or null" }
  ],
  "confidence": 0.0,
  "warnings": ["short uncertainty notes"]
}

Rules:
- Identify family headstones when multiple people, a shared surname marker, parents/children, or family plot wording appears.
- Add one people[] entry per person visible on the stone.
- Preserve uncertainty in warnings, but do not invent names or dates.
- Normalize obvious dates to YYYY-MM-DD when day/month/year are clear; otherwise use YYYY or null.`,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 } },
          { type: "text", text: `Extract the deceased names and dates from this headstone image. Filename: ${args.image.fileName}` },
        ],
      },
    ],
  });

  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    return cleanAiResult(JSON.parse(text));
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) return cleanAiResult(JSON.parse(text.slice(first, last + 1)));
    throw new Error("Anthropic returned non-JSON headstone extraction output.");
  }
}

router.post(
  "/headstone-import/analyze",
  analyzeLimiter,
  asyncHandler(async (req, res) => {
    const parsed = AnalyzeBody.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      res.status(400).json({
        error: issue
          ? `Invalid import payload: ${issue.path.join(".") || "request"} ${issue.message}`
          : "Invalid import payload",
        details: parsed.error.issues,
      });
      return;
    }

    const anthropicClient = await getAnthropicClient();
    if (!anthropicClient) {
      res.status(400).json({ error: "Anthropic API key is not configured in AI Settings." });
      return;
    }

    const organizationId = selectedCemeteryId(req);
    if (!organizationId) {
      res.status(400).json({ error: "Select a cemetery before scanning headstone images." });
      return;
    }

    const results = [];
    for (const image of parsed.data.images) {
      const storedPath = await storeHeadstoneImage(organizationId, image);
      const ai = await analyzeHeadstone({ image, anthropicClient });
      results.push({
        imageFileName: safeOriginalFileName(image.fileName),
        storedPath,
        status: ai.people.length > 0 ? "ready" : "needs_review",
        isFamilyHeadstone: ai.isFamilyHeadstone,
        people: ai.people,
        confidence: ai.confidence,
        inscriptionText: ai.inscriptionText,
        warnings: ai.warnings,
      });
    }

    res.json({ rows: results, imageCount: parsed.data.images.length, folder: headstoneFolder(organizationId).publicBase });
  }),
);

router.post(
  "/headstone-import/verify",
  asyncHandler(async (req, res) => {
    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      res.status(400).json({
        error: issue
          ? `Invalid verified rows: ${issue.path.join(".") || "request"} ${issue.message}`
          : "Invalid verified rows",
        details: parsed.error.issues,
      });
      return;
    }
    const organizationId = selectedCemeteryId(req);
    if (!organizationId) {
      res.status(400).json({ error: "Cannot save headstones without a cemetery organization." });
      return;
    }
    const folder = headstoneFolder(organizationId);
    await mkdir(folder.absolute, { recursive: true });
    const verifiedRows = parsed.data.rows.map((row) => ({
      ...row,
      imageFileName: safeOriginalFileName(row.imageFileName),
      people: row.people.filter((person) => asText(person.name)),
      status: row.people.some((person) => asText(person.name)) ? "verified" : "needs_manual_entry",
      verifiedAt: new Date().toISOString(),
    }));
    const manifest = {
      organizationId,
      folder: folder.publicBase,
      updatedAt: new Date().toISOString(),
      images: verifiedRows,
    };
    await writeFile(
      path.join(folder.absolute, "headstone-manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    res.json({
      verifiedCount: verifiedRows.filter((row) => row.status === "verified").length,
      needsManualEntryCount: verifiedRows.filter((row) => row.status === "needs_manual_entry").length,
      imageCount: verifiedRows.length,
      folder: folder.publicBase,
      manifestPath: `${folder.publicBase}/headstone-manifest.json`,
    });
  }),
);

router.get(
  "/headstone-import/library",
  asyncHandler(async (req, res) => {
    const organizationId = selectedCemeteryId(req);
    if (!organizationId) {
      res.status(400).json({ error: "Select a cemetery to view its headstone library." });
      return;
    }
    const folder = headstoneFolder(organizationId);

    // Load manifest if it exists
    type ManifestImage = {
      imageFileName: string;
      storedPath: string;
      people: Array<{ name: string; dateOfBirth?: string | null; dateOfDeath?: string | null }>;
      isFamilyHeadstone?: boolean;
      inscriptionText?: string;
      confidence?: number;
      status?: string;
      verifiedAt?: string;
    };
    let manifestImages: ManifestImage[] = [];
    try {
      const raw = await readFile(path.join(folder.absolute, "headstone-manifest.json"), "utf8");
      const parsed = JSON.parse(raw) as { images?: ManifestImage[] };
      manifestImages = parsed.images ?? [];
    } catch {
      // No manifest yet — fall through to folder scan
    }

    // Discover image files in the folder (supplement manifest with any unprocessed files)
    const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
    let folderFiles: string[] = [];
    try {
      const entries = await readdir(folder.absolute);
      folderFiles = entries.filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    } catch {
      // Folder doesn't exist yet
    }

    const manifestSet = new Set(manifestImages.map((m) => m.imageFileName));
    const unprocessed = folderFiles
      .filter((f) => !manifestSet.has(f))
      .map((f) => ({
        imageFileName: f,
        storedPath: `${folder.publicBase}/${encodeURIComponent(f)}`,
        people: [],
        status: "unprocessed" as const,
      }));

    const allImages = [...manifestImages, ...unprocessed];

    // Join with burial spots — match by imagePath / imageFileName stored in plots.geoJson
    const plots = await db.select().from(plotsTable).where(eq(plotsTable.organizationId, organizationId));
    const burials = await db.select().from(burialsTable).where(eq(burialsTable.organizationId, organizationId));
    const burialByPlot = new Map(burials.map((b) => [b.plotId, b]));

    // Build lookup: filename → plot+burial
    const plotByFilename = new Map<string, { plot: typeof plots[number]; burial: typeof burials[number] | null }>();
    for (const plot of plots) {
      let geo: Record<string, unknown> = {};
      try { if (plot.geoJson) geo = JSON.parse(plot.geoJson); } catch { /**/ }
      const fn = (geo.imageFileName as string | undefined) ?? (geo.imagePath as string | undefined);
      if (fn) {
        const base = fn.replace(/^.*[\\/]/, "");
        plotByFilename.set(base.toLowerCase(), { plot, burial: burialByPlot.get(plot.id) ?? null });
      }
    }
    // Also match on burial.photoUrl filename
    for (const burial of burials) {
      if (!burial.photoUrl) continue;
      const base = burial.photoUrl.replace(/^.*[\\/]/, "").replace(/\?.*$/, "");
      if (!plotByFilename.has(base.toLowerCase())) {
        const plot = plots.find((p) => p.id === burial.plotId) ?? null;
        if (plot) plotByFilename.set(base.toLowerCase(), { plot, burial });
      }
    }

    const enriched = allImages.map((img) => {
      const linked = plotByFilename.get(img.imageFileName.toLowerCase()) ?? null;
      return {
        ...img,
        storedPath: img.storedPath ?? `${folder.publicBase}/${encodeURIComponent(img.imageFileName)}`,
        linkedPlot: linked
          ? {
              plotId: linked.plot.id,
              plotNumber: linked.plot.plotNumber,
              section: linked.plot.section,
              row: linked.plot.row,
              status: linked.plot.status,
            }
          : null,
        linkedBurial: linked?.burial
          ? {
              burialId: linked.burial.id,
              deceasedName: linked.burial.deceasedName,
              deceasedDob: linked.burial.deceasedDob,
              deceasedDod: linked.burial.deceasedDod,
            }
          : null,
      };
    });

    res.json({
      organizationId,
      folder: folder.publicBase,
      totalImages: enriched.length,
      linkedCount: enriched.filter((i) => i.linkedPlot).length,
      images: enriched,
    });
  }),
);

export default router;
