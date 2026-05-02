/**
 * Platform-level administrators (Super Admin / Replit-side staff).
 * Distinct from `usersTable` which is per-organization. A platform admin is
 * not tenant-scoped and can manage every customer org.
 */
import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PLATFORM_ADMIN_ROLES = ["super_admin", "billing_admin", "support"] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const platformAdminsTable = pgTable("platform_admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: PLATFORM_ADMIN_ROLES }).notNull().default("super_admin"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlatformAdminSchema = createInsertSchema(platformAdminsTable, {
  email: z.string().email(),
  role: z.enum(PLATFORM_ADMIN_ROLES),
}).omit({ id: true, createdAt: true });
export type InsertPlatformAdmin = z.infer<typeof insertPlatformAdminSchema>;
export type PlatformAdmin = typeof platformAdminsTable.$inferSelect;
