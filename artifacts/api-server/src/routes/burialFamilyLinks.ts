/**
 * Family-link routes — let cemetery operators connect burial records
 * within the same cemetery and visualise the resulting family tree.
 *
 * Mounted under the org-scoped `orgRouter` in `routes/index.ts` so every
 * request already has `requireOrgUser` + `enforceOrgScope` applied. Org
 * scope on this router is therefore implicit: we trust
 * `req.session.user.organizationId` and reject burials that don't match.
 */
import { Router, type Request } from "express";
import { db } from "@workspace/db";
import {
  burialFamilyLinksTable,
  burialsTable,
  FAMILY_RELATIONSHIPS,
  familyRelationshipSchema,
  type Burial,
  type BurialFamilyLink,
  type FamilyRelationship,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

/** Inverse role of `to` relative to `from`. e.g. if to is from's parent
 * (relationship="parent"), then from is to's child. We use this when
 * walking edges from an arbitrary direction during tree traversal. */
function inverseRelationship(rel: FamilyRelationship): FamilyRelationship {
  switch (rel) {
    case "parent": return "child";
    case "child":  return "parent";
    case "spouse": return "spouse";
    case "sibling": return "sibling";
    default: return "other";
  }
}

function orgIdOf(req: Request): number {
  const u = req.session?.user;
  if (!u || u.kind !== "cemetery" || !u.organizationId) {
    throw new Error("Cemetery user required"); // requireOrgUser already guarded
  }
  return u.organizationId;
}

async function loadBurialOwnedByOrg(id: number, orgId: number): Promise<Burial | null> {
  const [b] = await db
    .select()
    .from(burialsTable)
    .where(and(eq(burialsTable.id, id), eq(burialsTable.organizationId, orgId)))
    .limit(1);
  return b ?? null;
}

/**
 * GET /burials/:id/family
 * List every family link directly attached to this burial — both the
 * outgoing ones (rows where this burial is `from`) and the incoming ones
 * (rows where it is `to`, exposed with the inverted relationship so the
 * UI can render a uniform list of "X is my Y").
 */
router.get("/burials/:id/family", async (req, res, next) => {
  try {
    const orgId = orgIdOf(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(404).json({ error: "Burial not found" });
      return;
    }
    const burial = await loadBurialOwnedByOrg(id, orgId);
    if (!burial) { res.status(404).json({ error: "Burial not found" }); return; }

    const rows = await db
      .select()
      .from(burialFamilyLinksTable)
      .where(
        and(
          eq(burialFamilyLinksTable.organizationId, orgId),
          or(
            eq(burialFamilyLinksTable.fromBurialId, id),
            eq(burialFamilyLinksTable.toBurialId, id),
          ),
        ),
      );

    const relatedIds = Array.from(new Set(
      rows.flatMap((r) => [r.fromBurialId, r.toBurialId]).filter((x) => x !== id),
    ));
    const relatedBurials = relatedIds.length
      ? await db
          .select()
          .from(burialsTable)
          .where(
            and(
              eq(burialsTable.organizationId, orgId),
              inArray(burialsTable.id, relatedIds),
            ),
          )
      : [];
    const byId = new Map(relatedBurials.map((b) => [b.id, b]));

    // Project each row from the burial's POV so the UI doesn't care about
    // edge direction — `relationship` is always the role of `relatedBurial`
    // relative to the requested burial.
    const links = rows
      .map((r) => {
        const isOutgoing = r.fromBurialId === id;
        const relatedId = isOutgoing ? r.toBurialId : r.fromBurialId;
        const related = byId.get(relatedId);
        if (!related) return null;
        const relationship = isOutgoing
          ? (r.relationship as FamilyRelationship)
          : inverseRelationship(r.relationship as FamilyRelationship);
        return {
          linkId: r.id,
          relationship,
          notes: r.notes,
          relatedBurial: related,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    res.json({ burial, links });
  } catch (err) { next(err); }
});

const createLinkSchema = z.object({
  relatedBurialId: z.number().int().positive(),
  relationship: familyRelationshipSchema,
  notes: z.string().trim().max(500).nullish(),
});

/**
 * POST /burials/:id/family
 * Create a family link from this burial to another. Both burials must
 * belong to the requester's organization. Self-links and duplicate edges
 * are rejected.
 */
router.post("/burials/:id/family", async (req, res, next) => {
  try {
    const orgId = orgIdOf(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(404).json({ error: "Burial not found" });
      return;
    }
    const parsed = createLinkSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid link", details: parsed.error.issues });
      return;
    }
    const { relatedBurialId, relationship, notes } = parsed.data;
    if (relatedBurialId === id) {
      res.status(400).json({ error: "Cannot link a burial to itself" });
      return;
    }
    const [from, to] = await Promise.all([
      loadBurialOwnedByOrg(id, orgId),
      loadBurialOwnedByOrg(relatedBurialId, orgId),
    ]);
    if (!from) { res.status(404).json({ error: "Burial not found" }); return; }
    if (!to) {
      // Either non-existent or belongs to another cemetery — same opaque
      // 400 either way so we don't leak cross-org existence.
      res.status(400).json({ error: "Related burial must be in the same cemetery" });
      return;
    }
    // Reject *semantically* equivalent edges that the DB unique index alone
    // wouldn't catch. The unique index is `(from, to, relationship)`, so it
    // catches the literal duplicate of what we're about to insert. We also
    // need to catch the equivalent reverse edge:
    //   - parent ↔ child:   `A→B parent` ≡ `B→A child`
    //   - spouse / sibling: symmetric, so `A→B spouse` ≡ `B→A spouse`
    //   - other:            treated as symmetric for de-dup purposes
    // `inverseRelationship` already encodes this mapping, so checking for
    // `(to, from, inverse(rel))` covers every case.
    const inverseRel = inverseRelationship(relationship);
    const [existingInverse] = await db
      .select({ id: burialFamilyLinksTable.id })
      .from(burialFamilyLinksTable)
      .where(
        and(
          eq(burialFamilyLinksTable.organizationId, orgId),
          eq(burialFamilyLinksTable.fromBurialId, relatedBurialId),
          eq(burialFamilyLinksTable.toBurialId, id),
          eq(burialFamilyLinksTable.relationship, inverseRel),
        ),
      )
      .limit(1);
    if (existingInverse) {
      res.status(409).json({ error: "This relationship already exists" });
      return;
    }
    try {
      const [link] = await db
        .insert(burialFamilyLinksTable)
        .values({
          organizationId: orgId,
          fromBurialId: id,
          toBurialId: relatedBurialId,
          relationship,
          notes: notes ?? null,
        })
        .returning();
      res.status(201).json({ link });
    } catch (err: unknown) {
      // Unique-edge violation → already linked with this relationship.
      // Drizzle wraps pg errors in `DrizzleQueryError` whose `cause` carries
      // the real `code`, so unwrap one level before matching.
      const code =
        (err as { code?: string })?.code ??
        ((err as { cause?: { code?: string } })?.cause?.code);
      if (code === "23505") {
        res.status(409).json({ error: "This relationship already exists" });
        return;
      }
      throw err;
    }
  } catch (err) { next(err); }
});

/** DELETE /burials/family-links/:linkId — org-scoped. */
router.delete("/burials/family-links/:linkId", async (req, res, next) => {
  try {
    const orgId = orgIdOf(req);
    const linkId = Number(req.params.linkId);
    if (!Number.isFinite(linkId) || linkId <= 0) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    const result = await db
      .delete(burialFamilyLinksTable)
      .where(
        and(
          eq(burialFamilyLinksTable.id, linkId),
          eq(burialFamilyLinksTable.organizationId, orgId),
        ),
      )
      .returning({ id: burialFamilyLinksTable.id });
    if (result.length === 0) { res.status(404).json({ error: "Link not found" }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

/**
 * GET /burials/:id/family-tree
 * BFS up to 3 hops from the requested burial. Returns the discovered
 * burial nodes plus the edges connecting them so the FE can render a
 * graph/tree without a second round-trip per person.
 */
router.get("/burials/:id/family-tree", async (req, res, next) => {
  try {
    const orgId = orgIdOf(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(404).json({ error: "Burial not found" });
      return;
    }
    const root = await loadBurialOwnedByOrg(id, orgId);
    if (!root) { res.status(404).json({ error: "Burial not found" }); return; }

    const MAX_HOPS = 3;
    const MAX_NODES = 100;
    const seenNodes = new Map<number, Burial>([[id, root]]);
    const seenEdges = new Map<number, BurialFamilyLink>(); // linkId → edge
    let frontier: number[] = [id];

    for (let hop = 0; hop < MAX_HOPS && frontier.length && seenNodes.size < MAX_NODES; hop++) {
      const rows = await db
        .select()
        .from(burialFamilyLinksTable)
        .where(
          and(
            eq(burialFamilyLinksTable.organizationId, orgId),
            or(
              inArray(burialFamilyLinksTable.fromBurialId, frontier),
              inArray(burialFamilyLinksTable.toBurialId, frontier),
            ),
          ),
        );
      const nextIds = new Set<number>();
      for (const r of rows) {
        if (!seenEdges.has(r.id)) seenEdges.set(r.id, r);
        for (const candidate of [r.fromBurialId, r.toBurialId]) {
          if (!seenNodes.has(candidate)) nextIds.add(candidate);
        }
      }
      if (nextIds.size === 0) break;
      const nodeRows = await db
        .select()
        .from(burialsTable)
        .where(
          and(
            eq(burialsTable.organizationId, orgId),
            inArray(burialsTable.id, Array.from(nextIds)),
          ),
        );
      for (const b of nodeRows) {
        if (seenNodes.size >= MAX_NODES) break;
        seenNodes.set(b.id, b);
      }
      frontier = nodeRows.map((b) => b.id);
    }

    res.json({
      rootId: id,
      nodes: Array.from(seenNodes.values()),
      edges: Array.from(seenEdges.values()).filter(
        (e) => seenNodes.has(e.fromBurialId) && seenNodes.has(e.toBurialId),
      ),
      relationships: FAMILY_RELATIONSHIPS,
    });
  } catch (err) { next(err); }
});

export default router;
