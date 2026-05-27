import { db, memorialsTable, tributesTable, burialsTable, usersTable, organizationsTable, plotsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const familyUsers = await db.select().from(usersTable).where(eq(usersTable.kind, "family")).limit(5);
  console.log("Family users:", JSON.stringify(familyUsers, null, 2));

  const orgs = await db.select().from(organizationsTable).limit(5);
  console.log("Orgs:", JSON.stringify(orgs, null, 2));

  const burials = await db.select().from(burialsTable).limit(10);
  console.log("Burials:", JSON.stringify(burials, null, 2));

  const memorials = await db.select().from(memorialsTable).limit(10);
  console.log("Memorials:", JSON.stringify(memorials, null, 2));

  const tributes = await db.select().from(tributesTable).limit(10);
  console.log("Tributes:", JSON.stringify(tributes, null, 2));

  const plots = await db.select().from(plotsTable).limit(10);
  console.log("Plots:", JSON.stringify(plots, null, 2));
}

main().catch(console.error);
