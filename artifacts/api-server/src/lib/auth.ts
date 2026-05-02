import type { Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  platformAdminsTable,
  organizationsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Session shape stored in the cookie-backed session.
 * - `kind` distinguishes the three sign-in tiers (B2B cemetery user, B2C
 *   family customer, platform-level super admin). Each tier sees a different
 *   set of routes.
 * - For B2B/B2C users, `userId` + `organizationId` scope every tenant query.
 * - For platform admins, `adminId` is set; `organizationId` is unset.
 */
export interface SessionUser {
  kind: "cemetery" | "family" | "admin";
  userId?: number; // usersTable.id
  adminId?: number; // platformAdminsTable.id
  organizationId?: number;
  email: string;
  name: string;
  role: string;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

const PgSessionStore = connectPgSimple(session);

/**
 * Build the express-session middleware. Sessions are stored in Postgres
 * (`session` table managed by `connect-pg-simple`) so they survive restarts
 * and scale across instances.
 */
export function buildSessionMiddleware(): RequestHandler {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is required. Set it via Replit Secrets before starting the API.",
    );
  }
  const isProd = process.env.NODE_ENV === "production";
  return session({
    name: "ms.sid",
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      // SameSite=Lax keeps the cookie on first-party navigations while still
      // blocking most CSRF vectors on cross-site POSTs.
      sameSite: "lax",
      // The Replit proxy terminates TLS, so secure cookies are appropriate
      // in production. In dev (non-https preview) keep them off.
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    },
    store: new PgSessionStore({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      // We manage the schema via Drizzle (see `lib/db/src/schema/sessions.ts`),
      // so do NOT auto-create the table here.
      createTableIfMissing: false,
      pruneSessionInterval: 60 * 60, // prune expired rows hourly
    }),
  });
}

/** Hash a plaintext password with bcrypt (cost 12). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/** Constant-time compare against a stored bcrypt hash. */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Look up a B2B/B2C user by email (case-insensitive) for sign-in. */
export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({
      user: usersTable,
      org: organizationsTable,
    })
    .from(usersTable)
    .innerJoin(
      organizationsTable,
      eq(usersTable.organizationId, organizationsTable.id),
    )
    .where(eq(usersTable.email, normalized))
    .limit(1);
  return row ?? null;
}

/** Look up a platform admin by email (case-insensitive). */
export async function findPlatformAdminByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(platformAdminsTable)
    .where(eq(platformAdminsTable.email, normalized))
    .limit(1);
  return row ?? null;
}

/** Express middleware: any authenticated session (any tier). */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session?.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
};

/** Express middleware: must be a platform admin (super_admin / billing_admin / support). */
export const requirePlatformAdmin: RequestHandler = (req, res, next) => {
  const u = req.session?.user;
  if (!u || u.kind !== "admin" || !u.adminId) {
    res.status(403).json({ error: "Platform admin required" });
    return;
  }
  next();
};

/** Express middleware: must be a B2B cemetery user with an organization. */
export const requireOrgUser: RequestHandler = (req, res, next) => {
  const u = req.session?.user;
  if (!u || u.kind !== "cemetery" || !u.organizationId) {
    res.status(403).json({ error: "Cemetery user required" });
    return;
  }
  next();
};

/**
 * Tenant-scope guard. If the user is signed in as a B2B cemetery user, force
 * `organizationId` on the request to come from the session — never trust
 * client-supplied values, since they were forgeable before.
 *
 * Applied globally; if there's no session it's a no-op so public routes still
 * work. Routes that *require* auth gate themselves separately.
 */
export const enforceOrgScope: RequestHandler = (req, _res, next) => {
  const u = req.session?.user;
  if (u?.kind === "cemetery" && u.organizationId) {
    if (req.query) {
      req.query.organizationId = String(u.organizationId);
      // Some routes also accept `orgId`. Keep them in sync.
      if ("orgId" in req.query) req.query.orgId = String(u.organizationId);
    }
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      // Only override if the route is plausibly tenant-scoped (i.e. has an
      // organizationId field already, or is a write that expects one).
      if ("organizationId" in req.body || req.method !== "GET") {
        (req.body as Record<string, unknown>).organizationId = u.organizationId;
      }
    }
  }
  next();
};

/** Async-safe wrapper so route handlers can `throw` without leaking unhandled rejections. */
export function asyncHandler<H extends (req: Request, res: Response, next: NextFunction) => unknown>(
  fn: H,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
