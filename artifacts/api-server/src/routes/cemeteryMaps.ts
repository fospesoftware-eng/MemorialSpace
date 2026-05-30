import { Router, type IRouter } from "express";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";

const authedRouter: IRouter = Router();
const publicRouter: IRouter = Router();

type MapPayload = {
  doc?: unknown;
  plotTypes?: unknown[];
  spotTypes?: unknown[];
  cemetery?: { id: number; name: string; slug: string };
  publishedAt?: number;
};

function publicRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith(path.join("artifacts", "api-server"))) {
    return path.resolve(cwd, "../memorial-space/public");
  }
  return path.resolve(cwd, "artifacts/memorial-space/public");
}

function mapFolder(organizationId: number): { absolute: string; publicBase: string } {
  const publicBase = `/uploads/cemeteries/${organizationId}/maps`;
  return {
    absolute: path.join(publicRoot(), publicBase),
    publicBase,
  };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function getOrganizationById(id: number) {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  return org ?? null;
}

async function getOrganizationBySlug(slug: string) {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, slug)).limit(1);
  return org ?? null;
}

function asPositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mapUrls(slug: string, projectId?: string) {
  const projectSuffix = projectId ? `?project=${encodeURIComponent(projectId)}` : "";
  const previewUrl = `/map-maker/preview/${encodeURIComponent(slug)}${projectSuffix}`;
  return {
    previewUrl,
    permanentUrl: previewUrl,
  };
}

function buildPayload(body: unknown, cemetery: { id: number; name: string; slug: string }, published = false): MapPayload {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return {
    doc: input.doc,
    plotTypes: Array.isArray(input.plotTypes) ? input.plotTypes : [],
    spotTypes: Array.isArray(input.spotTypes) ? input.spotTypes : [],
    cemetery,
    publishedAt: published ? Date.now() : undefined,
  };
}

function requestedCemeteryId(req: { query: Record<string, unknown> }): number | null {
  return asPositiveId(req.query.cemeteryId ?? req.query.organizationId ?? req.query.orgId);
}

function projectIdFromBody(body: unknown): string {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const doc = (input.doc && typeof input.doc === "object" ? input.doc : {}) as Record<string, unknown>;
  const raw = String(doc.projectId ?? input.projectId ?? "default").trim();
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "default";
}

authedRouter.get("/cemetery-maps", async (req, res) => {
  const organizationId = requestedCemeteryId(req);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const folder = mapFolder(org.id);
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "default";
  const draft = await readJson<MapPayload>(path.join(folder.absolute, `${projectId}-draft-map.json`))
    ?? await readJson<MapPayload>(path.join(folder.absolute, "draft-map.json"));
  const published = await readJson<MapPayload>(path.join(folder.absolute, `${projectId}-published-map.json`))
    ?? await readJson<MapPayload>(path.join(folder.absolute, "published-map.json"));
  res.json({
    organizationId: org.id,
    slug: org.slug,
    draft,
    published,
    ...mapUrls(org.slug, projectId),
  });
});

authedRouter.put("/cemetery-maps", async (req, res) => {
  const organizationId = requestedCemeteryId(req);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const folder = mapFolder(org.id);
  await mkdir(folder.absolute, { recursive: true });
  const cemetery = { id: org.id, name: org.name, slug: org.slug };
  const projectId = projectIdFromBody(req.body);
  const payload = buildPayload(req.body, cemetery, false);
  await writeFile(path.join(folder.absolute, `${projectId}-draft-map.json`), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(path.join(folder.absolute, "draft-map.json"), JSON.stringify(payload, null, 2), "utf8");
  res.json({ ok: true, organizationId: org.id, slug: org.slug, projectId, ...mapUrls(org.slug, projectId), publicBase: folder.publicBase });
});

authedRouter.post("/cemetery-maps/publish", async (req, res) => {
  const organizationId = requestedCemeteryId(req);
  if (!organizationId) {
    res.status(400).json({ error: "Valid organizationId is required." });
    return;
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const folder = mapFolder(org.id);
  await mkdir(folder.absolute, { recursive: true });
  const cemetery = { id: org.id, name: org.name, slug: org.slug };
  const projectId = projectIdFromBody(req.body);
  const payload = buildPayload(req.body, cemetery, true);
  await writeFile(path.join(folder.absolute, `${projectId}-draft-map.json`), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(path.join(folder.absolute, `${projectId}-published-map.json`), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(path.join(folder.absolute, "draft-map.json"), JSON.stringify(payload, null, 2), "utf8");
  await writeFile(path.join(folder.absolute, "published-map.json"), JSON.stringify(payload, null, 2), "utf8");
  res.json({ ok: true, organizationId: org.id, slug: org.slug, projectId, ...mapUrls(org.slug, projectId), publicBase: folder.publicBase });
});

publicRouter.get("/cemetery-maps/public/:slug", async (req, res) => {
  const org = await getOrganizationBySlug(req.params.slug);
  if (!org) {
    res.status(404).json({ error: "Cemetery not found." });
    return;
  }

  const folder = mapFolder(org.id);
  const projectId = typeof req.query.project === "string" ? req.query.project.replace(/[^a-zA-Z0-9_-]+/g, "-") : "";
  const published = projectId
    ? await readJson<MapPayload>(path.join(folder.absolute, `${projectId}-published-map.json`))
    : await readJson<MapPayload>(path.join(folder.absolute, "published-map.json"));
  const draft = published?.doc ? published : await readJson<MapPayload>(path.join(folder.absolute, "draft-map.json"));
  if (!draft?.doc) {
    res.status(404).json({ error: "Cemetery map not found. Save or publish the map first." });
    return;
  }
  res.json({
    ...draft,
    cemetery: { id: org.id, name: org.name, slug: org.slug },
    ...mapUrls(org.slug, projectId || undefined),
  });
});

export { publicRouter as cemeteryMapsPublicRouter };
export default authedRouter;
