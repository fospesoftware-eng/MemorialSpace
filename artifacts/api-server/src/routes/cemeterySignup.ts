import { Router, type IRouter, type Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod/v4";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  organizationsTable,
  usersTable,
  CEMETERY_TYPES,
  PLATFORM_FEATURES,
  DEFAULT_FEATURES_FOR_TYPE,
  type CemeteryType,
  type PlatformFeature,
} from "@workspace/db";
import { hashPassword, type SessionUser } from "../lib/auth";

const router: IRouter = Router();

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again later." },
});

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "cemetery";
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [existing] = await db
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `${root}-${Date.now()}`;
}

const signupSchema = z.object({
  cemeteryTypes: z.array(z.enum(CEMETERY_TYPES)).min(1).max(CEMETERY_TYPES.length),
  organization: z.object({
    name: z.string().min(2).max(120),
    city: z.string().max(120).optional().nullable(),
    country: z.string().max(120).optional().nullable(),
    address: z.string().max(240).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    website: z.string().max(240).optional().nullable(),
  }),
  owner: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(180),
    password: z.string().min(8).max(120),
    jobTitle: z.string().max(120).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
  }),
  features: z.record(z.enum(PLATFORM_FEATURES), z.boolean()).optional(),
});

router.post("/public/cemetery-signup", signupLimiter, async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid signup details", details: parsed.error.issues });
      return;
    }
    const { cemeteryTypes, organization, owner, features } = parsed.data;
    const normalizedEmail = owner.email.trim().toLowerCase();

    // If the email already belongs to a *cemetery operator* user, refuse
    // outright — sign-in instead. Family/viewer accounts on B2C are allowed
    // to sign up an org with the same email since they're a separate tier.
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.email, normalizedEmail),
          inArray(usersTable.role, ["owner", "admin", "manager", "staff"]),
        ),
      )
      .limit(1);
    if (existing) {
      res.status(409).json({
        error:
          "A cemetery operator account with this email already exists. Please sign in instead.",
      });
      return;
    }

    // Build the merged feature set: union of the per-type defaults plus any
    // explicit toggles the wizard sent. Wizard wins for explicit booleans.
    const merged: Partial<Record<PlatformFeature, boolean>> = {};
    for (const t of cemeteryTypes as CemeteryType[]) {
      for (const f of DEFAULT_FEATURES_FOR_TYPE[t]) merged[f] = true;
    }
    if (features) {
      for (const [k, v] of Object.entries(features)) {
        merged[k as PlatformFeature] = !!v;
      }
    }

    const slug = await uniqueSlug(organization.name);
    const passwordHash = await hashPassword(owner.password);
    const primaryType = cemeteryTypes[0] as CemeteryType;

    const result = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizationsTable)
        .values({
          name: organization.name.trim(),
          slug,
          cemeteryType: primaryType,
          cemeteryTypes: cemeteryTypes as CemeteryType[],
          enabledFeatures: merged,
          featuresColumbarium: !!merged.columbarium,
          address: organization.address ?? null,
          city: organization.city ?? null,
          country: organization.country ?? null,
          phone: organization.phone ?? null,
          website: organization.website ?? null,
          email: normalizedEmail,
          status: "trial",
        })
        .returning();
      const [user] = await tx
        .insert(usersTable)
        .values({
          organizationId: org.id,
          name: owner.name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: "owner",
          status: "active",
          jobTitle: owner.jobTitle ?? null,
          phone: owner.phone ?? null,
        })
        .returning();
      return { org, user };
    });

    const sessionUser: SessionUser = {
      kind: "cemetery",
      userId: result.user.id,
      organizationId: result.org.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    };
    await regenerateSession(req);
    req.session.user = sessionUser;

    res.status(201).json({
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
        cemeteryTypes: result.org.cemeteryTypes,
        enabledFeatures: result.org.enabledFeatures,
      },
      user: sessionUser,
      redirectTo: "/app",
    });
  } catch (err) {
    // Unique violation on email-per-org or slug — surface a clean message.
    const e = err as { code?: string; message?: string };
    if (e?.code === "23505") {
      res.status(409).json({ error: "That account or slug is already taken." });
      return;
    }
    next(err);
  }
});

export default router;
