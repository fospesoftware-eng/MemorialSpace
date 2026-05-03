import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workOrdersTable } from "./workOrders";
import { usersTable } from "./users";

export const workOrderCommentsTable = pgTable("work_order_comments", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").references(() => workOrdersTable.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => usersTable.id),
  authorName: text("author_name"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkOrderCommentSchema = createInsertSchema(workOrderCommentsTable).omit({ id: true, createdAt: true });
export type InsertWorkOrderComment = z.infer<typeof insertWorkOrderCommentSchema>;
export type WorkOrderComment = typeof workOrderCommentsTable.$inferSelect;
