import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { burialsTable } from "./burials";

// ---------------------------------------------------------------------------
// Cemetery Website Builder
// ---------------------------------------------------------------------------
//
// Each cemetery (organization) gets ONE configurable public website at
// `/c/:slug` — the slug comes from `organizations.slug` (already unique).
// `cemetery_sites` holds the per-cemetery design + content config; the
// marketplace tables below (cemetery_products, cemetery_categories,
// cemetery_orders) are all org-scoped so one cemetery can never see, edit,
// or order from another's catalogue.
//
// Why new tables and not reuse the existing `products`/`orders`? The legacy
// marketplace schema has no `organizationId`, so it can't power a
// per-tenant SaaS — extending it with a nullable column would silently mix
// rows across orgs during migration. New tables give us a clean,
// always-scoped baseline; the legacy schema and `/find` global directory
// stay untouched.
// ---------------------------------------------------------------------------

export const CEMETERY_THEMES = ["classic-marble", "modern-minimal", "heritage-garden"] as const;
export type CemeteryTheme = (typeof CEMETERY_THEMES)[number];

// One row per organization (1:1) — the "site config".
export const cemeterySitesTable = pgTable(
  "cemetery_sites",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    // Theme drives layout, font, and colour palette on the public site.
    theme: text("theme").notNull().default("classic-marble"),
    // The visible site title — usually the cemetery's display name, but
    // owners can override (e.g. add "Memorial Park" suffix).
    siteTitle: text("site_title").notNull(),
    tagline: text("tagline"),
    heroHeadline: text("hero_headline"),
    heroSubheadline: text("hero_subheadline"),
    // Hero background image — data URL (downscaled client-side) or external
    // URL. We size the column generously since data URLs can be 1–2MB.
    heroImageUrl: text("hero_image_url"),
    // About block — markdown-lite plain text, rendered with whitespace
    // preserved on the public page.
    aboutText: text("about_text"),
    // Optional primary-colour override (CSS `hsl()` triplet like
    // "150 45% 35%" — same format as our index.css vars). When null, the
    // theme's default primary is used.
    primaryColorOverride: text("primary_color_override"),
    // Contact card content. Phone/email/address are denormalized from the
    // org so owners can show a different "site contact" than their internal
    // operations contact (e.g. a public bookings desk).
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    contactAddress: text("contact_address"),
    // Free-form opening hours block. Kept as a single multiline string
    // rather than a structured weekly schedule because cemetery hours vary
    // wildly (seasonal, by section, by service).
    openingHours: text("opening_hours"),
    // Visibility gate. The public `/api/c/:slug` endpoints filter by this
    // so an unpublished cemetery never leaks before launch — the operator
    // gets a preview via `?preview=1` (gated server-side by orgId match).
    isPublished: boolean("is_published").notNull().default(false),
    // Inquiry routing — orders submitted via the public site dispatch a
    // notification to this address. Falls back to contactEmail when null.
    inquiryEmail: text("inquiry_email"),
    // Stripe Connect placeholder. v1 stores nothing live; the "Stripe
    // checkout" toggle on products is gated on this being non-null. Wiring
    // is a separate follow-up task.
    stripeAccountId: text("stripe_account_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // Enforce 1:1 with organization — each cemetery has exactly one site
    // config. PUT /api/cemetery-sites is an upsert keyed on this index.
    uniqueIndex("cemetery_sites_org_unique").on(t.organizationId),
  ],
);

// Per-cemetery product categories. Categories are NOT shared across orgs:
// "Flowers" at Riverside is a different row from "Flowers" at Oak Hill.
// The slug is unique per org so we can route /c/:slug/marketplace?cat=:catSlug.
export const cemeteryCategoriesTable = pgTable(
  "cemetery_categories",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // Optional Lucide icon name (e.g. "Flower", "Wrench"). The public site
    // looks this up from a small allow-list; unknown values fall back to
    // a generic Tag icon.
    icon: text("icon"),
    // Display ordering. Lower values render first.
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("cemetery_categories_org_slug_unique").on(t.organizationId, t.slug)],
);

export const PRODUCT_TYPES = ["product", "service"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

// Per-cemetery products / services. A "product" has a stockQuantity (or null
// for unlimited); a "service" is intangible (grave cleaning, flower
// placement) and stockQuantity is ignored / always null.
export const cemeteryProductsTable = pgTable(
  "cemetery_products",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => cemeteryCategoriesTable.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    // Price in USD as a real (matches the rest of the codebase — Accounting
    // module uses `real` for all money).
    price: real("price").notNull().default(0),
    // Optional "sale" / strikethrough price. Public site shows it only when
    // greater than the current price.
    compareAtPrice: real("compare_at_price"),
    type: text("type").notNull().default("product"),
    stockQuantity: integer("stock_quantity"),
    // Photos array (max 6, validated server-side). Each entry is a data URL
    // or external URL. JSONB so we can index/query later if needed.
    photos: jsonb("photos").$type<string[]>().notNull().default([]),
    // Show on the home page "Featured" carousel.
    isFeatured: boolean("is_featured").notNull().default(false),
    // Hidden from public listing without deleting (lets owners tweak before
    // relaunching a product).
    isPublished: boolean("is_published").notNull().default(true),
    // Stripe Checkout opt-in. v1 toggle is shown but stays "Coming soon"
    // until Stripe Connect is wired up. When false, the product is always
    // sold via the inquiry/order flow.
    stripeEnabled: boolean("stripe_enabled").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("cemetery_products_org_slug_unique").on(t.organizationId, t.slug),
    index("cemetery_products_org_idx").on(t.organizationId),
  ],
);

export const ORDER_STATUSES = [
  "new",
  "acknowledged",
  "in_progress",
  "fulfilled",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["inquiry", "stripe"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Order items snapshot at purchase time so historical orders stay accurate
// even if the operator later edits product names/prices.
export type CemeteryOrderItem = {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

// Customer-submitted orders. Always org-scoped — a public POST to
// /api/c/:slug/orders resolves the slug to an orgId server-side before
// inserting.
export const cemeteryOrdersTable = pgTable(
  "cemetery_orders",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    // Optional link to the burial the order is for. Set when the customer
    // arrived at the marketplace from a specific memorial page (the memorial
    // code is resolved server-side to a burial scoped to this org). Cascades
    // on burial delete so we don't keep dangling references; the order row
    // itself is preserved (org-scoped) when the burial link is just nulled
    // because we don't want to lose revenue history when a record is moved.
    burialId: integer("burial_id").references(() => burialsTable.id, {
      onDelete: "set null",
    }),
    // Display-friendly order number. Allocated server-side as
    // ORD-YYYYMMDD-NNNN where NNNN resets daily per org. Unique per org so
    // multiple cemeteries can share the same number on different days.
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    // Free-form note from the customer — special instructions, plot ID,
    // delivery date preferences, etc.
    customerNotes: text("customer_notes"),
    items: jsonb("items").$type<CemeteryOrderItem[]>().notNull().default([]),
    subtotal: real("subtotal").notNull().default(0),
    total: real("total").notNull().default(0),
    status: text("status").notNull().default("new"),
    paymentMethod: text("payment_method").notNull().default("inquiry"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    // Operator-only notes added after triage / fulfilment.
    operatorNotes: text("operator_notes"),
    // Stripe payment_intent id when paymentMethod = 'stripe'. Indexed
    // lightly via the order_number lookup; we don't need a dedicated index.
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("cemetery_orders_org_number_unique").on(t.organizationId, t.orderNumber),
    index("cemetery_orders_org_status_idx").on(t.organizationId, t.status),
    // Lets the rituals endpoint count "real orders for this burial" without
    // a sequential scan; also speeds up the burial detail screen later.
    index("cemetery_orders_burial_idx").on(t.burialId),
  ],
);

// ---------------------------------------------------------------------------
// Zod schemas (insert / upsert payloads)
// ---------------------------------------------------------------------------

// Photos are data URLs ⇒ allow up to ~1.5 MB each (matches columbarium).
const MAX_PHOTO_LEN = 2_000_000;
// 6 photos × ~1.5MB = 9MB upper bound — under our 12MB JSON body limit.
const MAX_PHOTOS = 6;

export const upsertCemeterySiteSchema = createInsertSchema(cemeterySitesTable, {
  theme: z.enum(CEMETERY_THEMES),
  siteTitle: z.string().min(1).max(200),
  tagline: z.string().max(200).nullable().optional(),
  heroHeadline: z.string().max(200).nullable().optional(),
  heroSubheadline: z.string().max(500).nullable().optional(),
  heroImageUrl: z.string().max(MAX_PHOTO_LEN).nullable().optional(),
  aboutText: z.string().max(5000).nullable().optional(),
  primaryColorOverride: z.string().max(40).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  contactEmail: z.string().max(200).nullable().optional(),
  contactAddress: z.string().max(500).nullable().optional(),
  openingHours: z.string().max(2000).nullable().optional(),
  inquiryEmail: z.string().max(200).nullable().optional(),
  stripeAccountId: z.string().max(80).nullable().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type UpsertCemeterySite = z.infer<typeof upsertCemeterySiteSchema>;
export type CemeterySite = typeof cemeterySitesTable.$inferSelect;

export const insertCemeteryCategorySchema = createInsertSchema(cemeteryCategoriesTable, {
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, and dashes only"),
  icon: z.string().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).omit({ id: true, createdAt: true });
export type InsertCemeteryCategory = z.infer<typeof insertCemeteryCategorySchema>;
export type CemeteryCategory = typeof cemeteryCategoriesTable.$inferSelect;

export const insertCemeteryProductSchema = createInsertSchema(cemeteryProductsTable, {
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, and dashes only"),
  shortDescription: z.string().max(300).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  price: z.number().min(0).max(1_000_000),
  compareAtPrice: z.number().min(0).max(1_000_000).nullable().optional(),
  type: z.enum(PRODUCT_TYPES),
  stockQuantity: z.number().int().min(0).max(1_000_000).nullable().optional(),
  photos: z.array(z.string().max(MAX_PHOTO_LEN)).max(MAX_PHOTOS).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCemeteryProduct = z.infer<typeof insertCemeteryProductSchema>;
export type CemeteryProduct = typeof cemeteryProductsTable.$inferSelect;

export const cemeteryOrderItemSchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().min(0).max(1_000_000),
  lineTotal: z.number().min(0).max(1_000_000),
});

// Public order-creation payload. Server recomputes lineTotal/subtotal/total
// from authoritative product prices — never trusts the client's numbers.
export const createCemeteryOrderSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerEmail: z.email().max(200),
  customerPhone: z.string().max(60).nullable().optional(),
  customerNotes: z.string().max(2000).nullable().optional(),
  // Optional QR memorial code linking this order to a specific burial. When
  // provided, the server resolves it to a burial within the same cemetery
  // and stores `burialId`. Treated as an opaque hint — invalid/foreign codes
  // are silently dropped rather than rejecting the order, because losing a
  // legitimate purchase would be a worse outcome than a missing back-link.
  memorialCode: z
    .string()
    .trim()
    .regex(/^[A-Fa-f0-9]{8,64}$/)
    .nullable()
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(50),
});
export type CreateCemeteryOrder = z.infer<typeof createCemeteryOrderSchema>;
export type CemeteryOrder = typeof cemeteryOrdersTable.$inferSelect;
