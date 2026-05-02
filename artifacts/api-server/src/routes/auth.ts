import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  usersTable,
  platformAdminsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  findPlatformAdminByEmail,
  findUserByEmail,
  hashPassword,
  verifyPassword,
  type SessionUser,
} from "../lib/auth";

/**
 * Promise wrapper for `req.session.regenerate`. We regenerate the session ID
 * on every successful login to defeat session-fixation attacks: the new
 * authenticated session must not share an ID with whatever pre-auth session
 * the client (or an attacker) might have planted.
 */
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

/** Roles that map to a real B2B cemetery operator. */
const CEMETERY_ROLES = new Set(["owner", "admin", "manager", "staff"]);
/** Roles that map to a B2C family/customer login. */
const FAMILY_ROLES = new Set(["viewer"]);

const router = Router();

/**
 * Rate-limit credential endpoints to slow down password spraying / credential
 * stuffing. 20 requests per 15 minutes per IP is plenty for honest use and
 * meaningfully painful for attackers.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't count successful logins against the limit so a real user toggling
  // tabs / refreshing isn't punished.
  skipSuccessfulRequests: true,
  message: { error: "Too many sign-in attempts. Please try again in a few minutes." },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  // Determines which sign-in tier the credentials must satisfy. The frontend
  // sends this from the route the user is on (cemetery / family / admin).
  kind: z.enum(["cemetery", "family", "admin"]),
});

router.post("/auth/login", authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid email or password" });

      return;
    }
    const { email, password, kind } = parsed.data;

    if (kind === "admin") {
      const admin = await findPlatformAdminByEmail(email);
      if (!admin || !admin.isActive) {
        res.status(401).json({ error: "Invalid email or password" });

        return;
      }
      const ok = await verifyPassword(password, admin.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Invalid email or password" });

        return;
      }
      await db
        .update(platformAdminsTable)
        .set({ lastLoginAt: new Date() })
        .where(eq(platformAdminsTable.id, admin.id));
      const sessionUser: SessionUser = {
        kind: "admin",
        adminId: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      };
      await regenerateSession(req);
      req.session.user = sessionUser;
      res.json({ user: sessionUser, redirectTo: "/admin" });
      return;
    }

    // cemetery (B2B) and family (B2C) both live in usersTable. They are
    // distinguished by their team role: family/customer accounts use the
    // "viewer" role with no admin/owner permissions; cemetery operators use
    // owner/admin/manager/staff. The CLIENT-supplied `kind` is treated as a
    // hint only — we verify it server-side against the user's stored role so
    // a B2C user can't claim B2B permissions just by hitting the cemetery
    // sign-in route (and vice versa).
    const found = await findUserByEmail(email);
    if (!found || found.user.status === "suspended") {
      res.status(401).json({ error: "Invalid email or password" });

      return;
    }
    const ok = await verifyPassword(password, found.user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });

      return;
    }
    if (found.org.status === "suspended") {
      res.status(403).json({
        error: "Your organization is suspended. Please contact support.",
      });

      return;
    }

    // Server-derived tier: ignore client `kind` for authorization, only use
    // it to pick a redirect when the requested tier matches the role.
    const role = found.user.role;
    const isCemeteryRole = CEMETERY_ROLES.has(role);
    const isFamilyRole = FAMILY_ROLES.has(role);
    if (kind === "cemetery" && !isCemeteryRole) {
      res.status(403).json({
        error:
          "This account does not have access to the cemetery operator console.",
      });
      return;
    }
    if (kind === "family" && !isFamilyRole) {
      res.status(403).json({
        error:
          "This account is a cemetery operator. Please use the operator sign-in.",
      });
      return;
    }
    const serverKind: "cemetery" | "family" = isCemeteryRole
      ? "cemetery"
      : "family";

    await db
      .update(usersTable)
      .set({ lastActiveAt: new Date() })
      .where(eq(usersTable.id, found.user.id));

    const sessionUser: SessionUser = {
      kind: serverKind,
      userId: found.user.id,
      organizationId: found.org.id,
      email: found.user.email,
      name: found.user.name,
      role: found.user.role,
    };
    await regenerateSession(req);
    req.session.user = sessionUser;
    const redirectTo = serverKind === "family" ? "/account" : "/app";
    res.json({ user: sessionUser, redirectTo });
    return;
  } catch (err) {
    next(err);
  }
});

router.post("/auth/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("ms.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", (req, res) => {
  if (!req.session?.user) { res.status(401).json({ error: "Not signed in" }); return; }
  res.json({ user: req.session.user });
});

/**
 * Helper used by the seed script and admin team-invite flows. Accepts a raw
 * password and returns its bcrypt hash. Exposed only via the seed script,
 * never as a public endpoint.
 */
export { hashPassword };

export default router;
