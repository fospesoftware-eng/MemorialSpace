import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category", { enum: ["flowers", "urns", "services", "other"] }).notNull(),
  price: real("price").notNull(),
  imageUrl: text("image_url"),
  inStock: boolean("in_stock").default(true),
  stockCount: integer("stock_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  items: text("items").notNull(),
  totalAmount: real("total_amount").notNull(),
  status: text("status", { enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
