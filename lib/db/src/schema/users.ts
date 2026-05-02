import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const TEAM_ROLES = ["owner", "admin", "manager", "staff", "viewer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_STATUSES = ["active", "invited", "suspended"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizationsTable.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: TEAM_ROLES }).notNull().default("viewer"),
    status: text("status", { enum: TEAM_STATUSES }).notNull().default("active"),
    jobTitle: text("job_title"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    lastActiveAt: timestamp("last_active_at"),
    invitedAt: timestamp("invited_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    emailPerOrg: uniqueIndex("users_org_email_unique").on(t.organizationId, t.email),
  }),
);

export const insertUserSchema = createInsertSchema(usersTable, {
  role: z.enum(TEAM_ROLES),
  status: z.enum(TEAM_STATUSES),
  email: z.string().email(),
}).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
