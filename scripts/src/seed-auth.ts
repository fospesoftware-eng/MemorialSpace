/**
 * Seeds authentication credentials so the three sign-in tiers actually work
 * out of the box:
 *   1. A platform super admin (admin@memorialspace.com / SuperAdmin2026!).
 *   2. Hashes the demo cemetery operator password on every existing
 *      `users` row that doesn't already have a passwordHash.
 *   3. Ensures a demo "family" user exists at sarah.chen@email.com inside
 *      the first organization, so the family sign-in tier works against
 *      real data.
 *
 * Idempotent — safe to re-run.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-auth
 */
import bcrypt from "bcryptjs";
import {
  db,
  organizationsTable,
  usersTable,
  platformAdminsTable,
} from "@workspace/db";
import { eq, isNull } from "drizzle-orm";

const ADMIN_EMAIL = "admin@memorialspace.com";
const ADMIN_PASSWORD = "SuperAdmin2026!";
const CEMETERY_DEMO_EMAIL = "ops@riversidememorial.com";
const CEMETERY_DEMO_PASSWORD = "Cemetery2026!";
const FAMILY_DEMO_EMAIL = "sarah.chen@email.com";
const FAMILY_DEMO_PASSWORD = "Demo2026!";

async function main() {
  console.log("[seed-auth] starting");

  // 1) Platform admin
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const [existingAdmin] = await db
    .select()
    .from(platformAdminsTable)
    .where(eq(platformAdminsTable.email, ADMIN_EMAIL))
    .limit(1);
  if (existingAdmin) {
    await db
      .update(platformAdminsTable)
      .set({ passwordHash: adminHash, isActive: true })
      .where(eq(platformAdminsTable.id, existingAdmin.id));
    console.log(`[seed-auth] reset platform admin password for ${ADMIN_EMAIL}`);
  } else {
    await db.insert(platformAdminsTable).values({
      email: ADMIN_EMAIL,
      name: "Platform Admin",
      passwordHash: adminHash,
      role: "super_admin",
      isActive: true,
    });
    console.log(`[seed-auth] created platform admin ${ADMIN_EMAIL}`);
  }

  // 2) Hash a demo password into every B2B user row that has none yet. This
  //    means the cemetery sign-in form's preset email works for any existing
  //    seeded operator account, and team-invited users (who do have a hash)
  //    are left alone.
  const cemeteryHash = await bcrypt.hash(CEMETERY_DEMO_PASSWORD, 12);
  const updated = await db
    .update(usersTable)
    .set({ passwordHash: cemeteryHash })
    .where(isNull(usersTable.passwordHash))
    .returning({ id: usersTable.id, email: usersTable.email });
  console.log(`[seed-auth] hashed default password for ${updated.length} cemetery users`);

  // 2b) Cemetery operator demo user — the email shown on the sign-in form
  //     must always exist. We attach it to the first org so the dashboard
  //     has data to render.
  const [firstOrgForOps] = await db.select().from(organizationsTable).orderBy(organizationsTable.id).limit(1);
  if (firstOrgForOps) {
    const [existingOps] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, CEMETERY_DEMO_EMAIL))
      .limit(1);
    if (existingOps) {
      await db
        .update(usersTable)
        .set({ passwordHash: cemeteryHash, status: "active" })
        .where(eq(usersTable.id, existingOps.id));
      console.log(`[seed-auth] reset cemetery demo password for ${CEMETERY_DEMO_EMAIL}`);
    } else {
      await db.insert(usersTable).values({
        organizationId: firstOrgForOps.id,
        email: CEMETERY_DEMO_EMAIL,
        name: "Riverside Operations",
        role: "owner",
        status: "active",
        passwordHash: cemeteryHash,
      });
      console.log(`[seed-auth] created cemetery demo ${CEMETERY_DEMO_EMAIL}`);
    }
  }

  // 3) Family demo user — attached to the first org so the family portal
  //    has somewhere to land. Uses a distinct password.
  const [firstOrg] = await db.select().from(organizationsTable).orderBy(organizationsTable.id).limit(1);
  if (firstOrg) {
    const familyHash = await bcrypt.hash(FAMILY_DEMO_PASSWORD, 12);
    const [existingFamily] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, FAMILY_DEMO_EMAIL))
      .limit(1);
    if (existingFamily) {
      await db
        .update(usersTable)
        .set({ passwordHash: familyHash, status: "active" })
        .where(eq(usersTable.id, existingFamily.id));
      console.log(`[seed-auth] reset family demo password for ${FAMILY_DEMO_EMAIL}`);
    } else {
      await db.insert(usersTable).values({
        organizationId: firstOrg.id,
        email: FAMILY_DEMO_EMAIL,
        name: "Sarah Chen",
        role: "viewer",
        status: "active",
        passwordHash: familyHash,
      });
      console.log(`[seed-auth] created family demo ${FAMILY_DEMO_EMAIL}`);
    }
  } else {
    console.warn("[seed-auth] no organizations found — skipping family demo seed");
  }

  console.log("[seed-auth] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-auth] failed:", err);
    process.exit(1);
  });
