/**
 * Checks whether the configured DATABASE_URL has the auth/session schema and
 * the known demo accounts with working passwords.
 *
 * Run in the same Replit shell/environment as the API:
 *   pnpm --filter @workspace/scripts run check-demo-auth
 */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import {
  db,
  organizationsTable,
  platformAdminsTable,
  usersTable,
} from "@workspace/db";

const DEMOS = [
  {
    kind: "cemetery",
    email: "ops@riversidememorial.com",
    password: "Cemetery2026!",
  },
  {
    kind: "family",
    email: "sarah.chen@email.com",
    password: "Demo2026!",
  },
] as const;

async function tableExists(name: string) {
  const result = await db.execute(sql`select to_regclass(${`public.${name}`}) as regclass`);
  return Boolean(result.rows[0]?.regclass);
}

async function main() {
  console.log("[check-demo-auth] checking active DATABASE_URL");

  const requiredTables = ["organizations", "users", "platform_admins", "session"];
  for (const table of requiredTables) {
    const exists = await tableExists(table);
    console.log(`[check-demo-auth] table ${table}: ${exists ? "ok" : "missing"}`);
  }

  const orgs = await db.select({ id: organizationsTable.id, name: organizationsTable.name, status: organizationsTable.status }).from(organizationsTable).limit(5);
  console.log(`[check-demo-auth] organizations found: ${orgs.length}`);
  for (const org of orgs) {
    console.log(`[check-demo-auth] org #${org.id}: ${org.name} (${org.status})`);
  }

  for (const demo of DEMOS) {
    const [row] = await db
      .select({
        email: usersTable.email,
        role: usersTable.role,
        status: usersTable.status,
        passwordHash: usersTable.passwordHash,
        organizationId: usersTable.organizationId,
      })
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${demo.email}`)
      .limit(1);
    if (!row) {
      console.log(`[check-demo-auth] ${demo.kind} ${demo.email}: missing`);
      continue;
    }
    const passwordOk = await bcrypt.compare(demo.password, row.passwordHash ?? "");
    console.log(
      `[check-demo-auth] ${demo.kind} ${demo.email}: role=${row.role}, status=${row.status}, org=${row.organizationId}, password=${passwordOk ? "ok" : "wrong"}`,
    );
  }

  const [admin] = await db
    .select({
      email: platformAdminsTable.email,
      role: platformAdminsTable.role,
      isActive: platformAdminsTable.isActive,
      passwordHash: platformAdminsTable.passwordHash,
    })
    .from(platformAdminsTable)
    .where(sql`lower(${platformAdminsTable.email}) = ${"admin@memorialspace.com"}`)
    .limit(1);
  if (!admin) {
    console.log("[check-demo-auth] admin admin@memorialspace.com: missing");
  } else {
    const passwordOk = await bcrypt.compare("SuperAdmin2026!", admin.passwordHash);
    console.log(
      `[check-demo-auth] admin ${admin.email}: role=${admin.role}, active=${admin.isActive}, password=${passwordOk ? "ok" : "wrong"}`,
    );
  }

  console.log("[check-demo-auth] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[check-demo-auth] failed:", err);
    process.exit(1);
  });
