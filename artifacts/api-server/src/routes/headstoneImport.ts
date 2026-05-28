import { Router, type IRouter } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { and, eq } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import {
  burialsTable,
  db,
  platformAiSettingsTable,
  plotsTable,
} from "@workspace/db";
import { asyncHandler } from "../lib/auth";

const router: IRouter = Router();

const analyzeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many headstone AI scans. Please wait a few minutes and try again." },
});

const MAX_IMAGES = 40;
const MAX_SHEET_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const ImageInput = z.object({
  fileName: z.string().min(1).max(240),
  dataUrl: z.string().min(50),
});

const SheetInput = z.object({
  fileName: z.string().min(1).max(240),
  dataUrl: z.string().min(20),
});

const AnalyzeBody = z.object({
  images: z.array(ImageInput).min(1).max(MAX_IMAGES),
  sheet: SheetInput,
});

const PersonInput = z.object({
  name: z.string().min(1).max(240),
  dateOfBirth: z.string().max(40).nullable().optional(),
  dateOfDeath: z.string().max(40).nullable().optional(),
});

const CommitRow = z.object({
  imageFileName: z.string().min(1).max(240),
  plotNumber: z.string().min(1).max(120),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  isFamilyHeadstone: z.boolean().default(false),
  people: z.array(PersonInput).min(1).max(12),
  notes: z.string().max(2000).nullable().optional(),
});

const CommitBody = z.object({
  rows: z.array(CommitRow).min(1).max(500),
});

type SheetRow = {
  imageFileName: string;
  plotNumber: string;
  latitude: number | null;
  longitude: number | null;
  raw: Record<string, unknown>;
  rowNumber: number;
};

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

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getCell(row: Record<string, unknown>, candidates: string[]): unknown {
  const wanted = new Set(candidates.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeKey(key))) return value;
  }
  return undefined;
}

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeFileName(name: string): string {
  return name.trim().toLowerCase().replace(/^.*[\\/]/, "");
}

function stripExtension(name: string): string {
  return normalizeFileName(name).replace(/\.[^.]+$/, "");
}

function parseSheet(sheet: { fileName: string; dataUrl: string }): SheetRow[] {
  const { buffer, mediaType } = parseDataUrl(sheet.dataUrl);
  if (buffer.byteLength > MAX_SHEET_BYTES) {
    throw Object.assign(new Error("Spreadsheet is too large. Please keep it under 2MB."), { code: "BAD_REQUEST" });
  }

  let rows: Record<string, unknown>[];
  const isCsv = mediaType.includes("csv") || /\.csv$/i.test(sheet.fileName);
  if (isCsv) {
    const workbook = XLSX.read(buffer.toString("utf8"), { type: "string" });
    const first = workbook.SheetNames[0];
    if (!first) throw Object.assign(new Error("Spreadsheet has no worksheets."), { code: "BAD_REQUEST" });
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[first], { defval: "" }) as Record<string, unknown>[];
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const first = workbook.SheetNames[0];
    if (!first) throw Object.assign(new Error("Spreadsheet has no worksheets."), { code: "BAD_REQUEST" });
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[first], { defval: "" }) as Record<string, unknown>[];
  }

  const parsed: SheetRow[] = [];
  rows.forEach((row, idx) => {
    const imageFileName = asText(getCell(row, [
      "image file name",
      "image filename",
      "filename",
      "file name",
      "image",
      "photo",
      "headstone image",
    ]));
    const plotNumber = asText(getCell(row, [
      "spot number",
      "spot",
      "plot number",
      "plot",
      "grave number",
      "grave",
      "lot",
      "lot number",
    ]));
    const latitude = asNumber(getCell(row, ["lat", "latitude"]));
    const longitude = asNumber(getCell(row, ["lng", "long", "longitude", "lon"]));

    if (!imageFileName && !plotNumber) return;
    parsed.push({
      imageFileName,
      plotNumber,
      latitude,
      longitude,
      raw: row,
      rowNumber: idx + 2,
    });
  });

  return parsed;
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

function toDbDate(v: string | null | undefined): string | null {
  const s = asText(v);
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.valueOf())) return null;
  return d.toISOString().slice(0, 10);
}

router.post(
  "/headstone-import/analyze",
  analyzeLimiter,
  asyncHandler(async (req, res) => {
    const parsed = AnalyzeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid import payload", details: parsed.error.issues });
      return;
    }

    const anthropicClient = await getAnthropicClient();
    if (!anthropicClient) {
      res.status(400).json({ error: "Anthropic API key is not configured in AI Settings." });
      return;
    }

    const sheetRows = parseSheet(parsed.data.sheet);
    const imageByName = new Map<string, z.infer<typeof ImageInput>>();
    for (const image of parsed.data.images) {
      imageByName.set(normalizeFileName(image.fileName), image);
      imageByName.set(stripExtension(image.fileName), image);
    }

    const results = [];
    for (const row of sheetRows) {
      const image = imageByName.get(normalizeFileName(row.imageFileName)) ?? imageByName.get(stripExtension(row.imageFileName));
      if (!row.plotNumber || !row.imageFileName || !image) {
        results.push({
          ...row,
          status: "needs_review",
          isFamilyHeadstone: false,
          people: [],
          confidence: 0,
          inscriptionText: "",
          warnings: [
            !row.plotNumber ? `Spreadsheet row ${row.rowNumber} is missing a plot/spot number.` : "",
            !row.imageFileName ? `Spreadsheet row ${row.rowNumber} is missing an image filename.` : "",
            row.imageFileName && !image ? `No uploaded image matched "${row.imageFileName}".` : "",
          ].filter(Boolean),
        });
        continue;
      }

      const ai = await analyzeHeadstone({ image, anthropicClient });
      results.push({
        ...row,
        status: ai.people.length > 0 ? "ready" : "needs_review",
        isFamilyHeadstone: ai.isFamilyHeadstone,
        people: ai.people,
        confidence: ai.confidence,
        inscriptionText: ai.inscriptionText,
        warnings: ai.warnings,
      });
    }

    res.json({ rows: results, imageCount: parsed.data.images.length, sheetRowCount: sheetRows.length });
  }),
);

router.post(
  "/headstone-import/commit",
  asyncHandler(async (req, res) => {
    const parsed = CommitBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid reviewed rows", details: parsed.error.issues });
      return;
    }
    const organizationId = req.session!.user!.organizationId!;
    let plotsCreated = 0;
    let plotsUpdated = 0;
    let burialsCreated = 0;
    let burialsUpdated = 0;

    for (const row of parsed.data.rows) {
      const [existingPlot] = await db
        .select()
        .from(plotsTable)
        .where(and(eq(plotsTable.organizationId, organizationId), eq(plotsTable.plotNumber, row.plotNumber)))
        .limit(1);

      const plotPatch = {
        organizationId,
        plotNumber: row.plotNumber,
        status: "occupied" as const,
        type: row.isFamilyHeadstone ? "family" as const : "standard" as const,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        notes: [
          row.notes ?? "",
          `AI headstone import: ${row.imageFileName}`,
        ].filter(Boolean).join("\n"),
      };

      const plot = existingPlot
        ? (await db.update(plotsTable).set(plotPatch).where(eq(plotsTable.id, existingPlot.id)).returning())[0]
        : (await db.insert(plotsTable).values(plotPatch).returning())[0];
      if (existingPlot) plotsUpdated += 1;
      else plotsCreated += 1;

      for (const person of row.people) {
        const [existingBurial] = await db
          .select()
          .from(burialsTable)
          .where(and(
            eq(burialsTable.organizationId, organizationId),
            eq(burialsTable.plotId, plot.id),
            eq(burialsTable.deceasedName, person.name),
          ))
          .limit(1);

        const burialPatch = {
          organizationId,
          plotId: plot.id,
          deceasedName: person.name,
          deceasedDob: toDbDate(person.dateOfBirth),
          deceasedDod: toDbDate(person.dateOfDeath),
          notes: [
            row.isFamilyHeadstone ? "Family headstone" : "",
            row.notes ?? "",
            `Imported from headstone image: ${row.imageFileName}`,
          ].filter(Boolean).join("\n"),
        };

        if (existingBurial) {
          await db.update(burialsTable).set(burialPatch).where(eq(burialsTable.id, existingBurial.id));
          burialsUpdated += 1;
        } else {
          await db.insert(burialsTable).values(burialPatch);
          burialsCreated += 1;
        }
      }
    }

    res.json({ plotsCreated, plotsUpdated, burialsCreated, burialsUpdated });
  }),
);

export default router;
