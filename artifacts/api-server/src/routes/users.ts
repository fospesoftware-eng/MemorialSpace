import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, TEAM_ROLES, TEAM_STATUSES, type TeamRole } from "@workspace/db";
import { and, count, eq, ne, sql } from "drizzle-orm";

const router = Router();

function readOrgId(req: Request, res: Response): number | null {
  const raw = req.query.organizationId ?? req.query.orgId;
  if (raw == null || raw === "") {
    res.status(400).json({ error: "organizationId query parameter is required" });
    return null;
  }
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "organizationId must be a number" });
    return null;
  }
  return id;
}

function isValidRole(v: unknown): v is TeamRole {
  return typeof v === "string" && (TEAM_ROLES as readonly string[]).includes(v);
}
function isValidStatus(v: unknown): boolean {
  return typeof v === "string" && (TEAM_STATUSES as readonly string[]).includes(v);
}

router.get("/users", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId == null) return;
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.organizationId, orgId))
    .orderBy(usersTable.createdAt);
  res.json(users);
});

router.get("/users/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId == null) return;
  const id = Number(req.params.id);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.organizationId, orgId)))
    .limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.post("/users", async (req, res) => {
  const body = req.body ?? {};
  const orgId = Number(body.organizationId);
  if (!Number.isFinite(orgId)) {
    res.status(400).json({ error: "organizationId is required in body" });
    return;
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }
  const role = isValidRole(body.role) ? body.role : "viewer";
  const status = isValidStatus(body.status) ? body.status : "invited";

  // Email must be unique within the org
  const dupe = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.email, email)))
    .limit(1);
  if (dupe.length > 0) {
    res.status(409).json({ error: "A team member with that email already exists" });
    return;
  }

  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        organizationId: orgId,
        name,
        email,
        role,
        status,
        jobTitle: typeof body.jobTitle === "string" ? body.jobTitle : null,
        phone: typeof body.phone === "string" ? body.phone : null,
        avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : null,
        invitedAt: status === "invited" ? new Date() : null,
      })
      .returning();
    res.status(201).json(user);
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e?.code === "23505") {
      res.status(409).json({ error: "A team member with that email already exists" });
      return;
    }
    res.status(500).json({ error: e?.message ?? "Failed to create user" });
  }
});

router.put("/users/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId == null) return;
  const id = Number(req.params.id);
  const body = req.body ?? {};

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.organizationId, orgId)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "User not found" }); return; }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.jobTitle === "string" || body.jobTitle === null) patch.jobTitle = body.jobTitle;
  if (typeof body.phone === "string" || body.phone === null) patch.phone = body.phone;
  if (typeof body.avatarUrl === "string" || body.avatarUrl === null) patch.avatarUrl = body.avatarUrl;
  if (typeof body.email === "string") {
    const newEmail = body.email.trim().toLowerCase();
    if (newEmail !== existing.email) {
      const dupe = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.organizationId, orgId),
            eq(usersTable.email, newEmail),
            ne(usersTable.id, id),
          ),
        )
        .limit(1);
      if (dupe.length > 0) {
        res.status(409).json({ error: "Another team member already uses that email" });
        return;
      }
      patch.email = newEmail;
    }
  }

  if (body.role !== undefined && !isValidRole(body.role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  if (body.status !== undefined && !isValidStatus(body.status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  if (
    body.status === "suspended" &&
    existing.role === "owner" &&
    body.role === undefined
  ) {
    res.status(409).json({ error: "Cannot suspend the cemetery owner" });
    return;
  }

  // Wrap the role-demotion / owner-suspension paths in a transaction with
  // a FOR UPDATE row lock so two concurrent demotions cannot both pass the
  // owner-count check and leave the org ownerless.
  const willDemoteOwner =
    existing.role === "owner" && body.role !== undefined && body.role !== "owner";
  const willSuspendOwner =
    existing.role === "owner" && body.status === "suspended";

  try {
    const updated = await db.transaction(async (tx) => {
      if (willDemoteOwner || willSuspendOwner) {
        // Lock this user's row so a concurrent demotion of another owner
        // sees a consistent view of who is still an owner.
        await tx.execute(
          sql`SELECT id FROM users WHERE id = ${id} AND organization_id = ${orgId} FOR UPDATE`,
        );
        const [owners] = await tx
          .select({ c: count() })
          .from(usersTable)
          .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.role, "owner")));
        if ((owners?.c ?? 0) <= 1) {
          throw new LastOwnerError(
            willSuspendOwner
              ? "Cannot suspend the last owner — promote another member to owner first"
              : "Cannot demote the last owner — promote another member to owner first",
          );
        }
      }
      if (body.role !== undefined) patch.role = body.role;
      if (body.status !== undefined) patch.status = body.status;
      if (Object.keys(patch).length === 0) return existing;
      const [user] = await tx
        .update(usersTable)
        .set(patch)
        .where(and(eq(usersTable.id, id), eq(usersTable.organizationId, orgId)))
        .returning();
      return user;
    });
    res.json(updated);
  } catch (err: unknown) {
    if (err instanceof LastOwnerError) {
      res.status(409).json({ error: err.message });
      return;
    }
    const e = err as { code?: string; message?: string };
    if (e?.code === "23505") {
      res.status(409).json({ error: "Another team member already uses that email" });
      return;
    }
    res.status(500).json({ error: e?.message ?? "Failed to update user" });
  }
});

class LastOwnerError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "LastOwnerError";
  }
}

router.delete("/users/:id", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId == null) return;
  const id = Number(req.params.id);

  try {
    await db.transaction(async (tx) => {
      // Lock the row first so a concurrent owner demotion cannot race past
      // the count check below.
      const locked = await tx.execute(
        sql`SELECT id, role FROM users WHERE id = ${id} AND organization_id = ${orgId} FOR UPDATE`,
      );
      const row = (locked.rows ?? [])[0] as { id: number; role: string } | undefined;
      if (!row) return; // 204 — no-op for cross-tenant or already-deleted

      if (row.role === "owner") {
        const [owners] = await tx
          .select({ c: count() })
          .from(usersTable)
          .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.role, "owner")));
        if ((owners?.c ?? 0) <= 1) {
          throw new LastOwnerError(
            "Cannot remove the last owner — promote another member to owner first",
          );
        }
      }

      await tx
        .delete(usersTable)
        .where(and(eq(usersTable.id, id), eq(usersTable.organizationId, orgId)));
    });
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof LastOwnerError) {
      res.status(409).json({ error: err.message });
      return;
    }
    const e = err as { message?: string };
    res.status(500).json({ error: e?.message ?? "Failed to delete user" });
  }
});

// Resend invite — bumps invitedAt timestamp (placeholder for future email send)
router.post("/users/:id/resend-invite", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId == null) return;
  const id = Number(req.params.id);
  const [user] = await db
    .update(usersTable)
    .set({ invitedAt: new Date(), status: "invited" })
    .where(and(eq(usersTable.id, id), eq(usersTable.organizationId, orgId)))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

// Team summary — counts by role and status, owner email for ownership transfer awareness
router.get("/team-summary", async (req, res) => {
  const orgId = readOrgId(req, res);
  if (orgId == null) return;
  const rows = await db
    .select({
      role: usersTable.role,
      status: usersTable.status,
      total: count(),
    })
    .from(usersTable)
    .where(eq(usersTable.organizationId, orgId))
    .groupBy(usersTable.role, usersTable.status);

  const byRole: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byRole[r.role] = (byRole[r.role] ?? 0) + Number(r.total);
    byStatus[r.status] = (byStatus[r.status] ?? 0) + Number(r.total);
    total += Number(r.total);
  }
  res.json({ total, byRole, byStatus });
});

export default router;
