# Overview

This project, MemorialSpace, is a pnpm workspace monorepo designed as a comprehensive SaaS platform for cemetery management. It provides five user interfaces: a B2B marketing landing page, a B2C public site for grave search and obituaries, a customer dashboard, a B2B cemetery operator dashboard, and a SaaS super-admin console. Key features include an interactive map maker and an AI-powered tool to digitize physical cemetery maps. The business vision is to modernize cemetery management, enhance operational efficiency, and improve public accessibility, aiming to be a leading SaaS provider in the sector.

# User Preferences

I prefer iterative development with clear communication on major changes. Please ask before making any significant architectural decisions or modifications to core functionalities.

# System Architecture

The project is structured as a pnpm workspace monorepo using Node.js 24 and TypeScript 5.9.

## Core Technologies
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`) and `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild (CJS bundle)

## UI/UX Decisions
The platform features a premium dark green theme with a gold accent for admin and marketing elements. Both light and dark color palettes are available, managed by a `ThemeProvider` persisting user choice to `localStorage`. Sidebar elements remain dark.

## Feature Specifications

### Routing
The application uses `wouter` for routing, with distinct base paths for each of the five surfaces. Cross-surface navigation uses `~` prefix; internal navigation uses relative paths. Sign-in pages redirect to dashboards upon successful authentication via full page reload.

### Cemetery Configuration
Operators manage Plot Types, Burial Spot Types, and a Map Background Library. Configurations are stored in `localStorage` via a `useStored<T>` hook for persistence and synchronization.

### Plot Map Maker
A full-screen editor (`/app/map-maker`) for cemetery operators to create and manage digital maps.
- **Tools:** Select, Plot (rectangular), Circle (radial), Path (polyline), Spot (pins with icons and headstone image uploads).
- **Path Tool:** Click-to-place polyline with width adjustment.
- **Circle Tool:** Drag-to-draw radial plots with radius adjustment.
- **Polygon Tool:** Click-to-place vertices for closed, irregular filled shapes.
- **Outline-only Shapes (Rect Outline + Polygon Outline):** Two boundary-marker tools that draw the same geometry as their filled counterparts but render with `fill="none"` and a dashed stroke. Used to mark family-grave or section boundaries that contain individual plots inside without obscuring them. Persisted via a `Plot.outline` flag and survives save/load through `migrateDoc()`. Keyboard: Shift+R / Shift+G.
- **Per-type default shape:** `PlotType` carries an optional `defaultShape` to auto-switch canvas tools.
- **Layout:** Editor uses full viewport with collapsible panels and top toolbar for navigation, zoom, and display options.
- **Backgrounds:** Supports image uploads (downscaled to 1600px webp), drag-and-drop, and selection from a library.
- **Interactivity:** 2D/3D view toggle, zoom, "Fit to screen," save/load maps to `localStorage`, JSON export, and keyboard shortcuts. Pan tool for canvas scrolling. Plot labels toggleable, visible on hover or selection.
- **Implementation:** Uses `svg.getScreenCTM().inverse()` for pointer math, `useRef` for drag state, `lucide` icons, and `migrateDoc()` for backward compatibility.

### Cemetery Type & Columbarium Module
Organizations are tagged with `cemeteryType` (church, private, pet, municipality, columbarium) and a `featuresColumbarium` flag.
- **Columbarium Module (`/app/columbarium`):** Manages cinerary niche walls.
    - **Schema:** `columbaria` (id, name, rows, cols) and `niches` (id, row, col, occupant info, status, photo).
    - **API:** RESTful CRUD for walls; position-based niche upsert/delete.
    - **UI:** Grid of wall cards; detail view shows 2D SVG niche grid with status colors and occupant details. Clicking a niche opens an editor sheet.
    - **Creative 3D View:** Toggles perspective mode using CSS transforms for a "wall standing in front of you" preview.

### Mausoleum Module
Mirrors the Columbarium module but for above-ground casket structures.
- **Schema:** `mausoleums` (id, name, location, rows, cols) and `mausoleum_crypts` (id, row, col, crypt details, occupants, owner, status). Supports second occupants for companion/family crypts.
- **API:** RESTful CRUD for buildings; position-based crypt upsert/delete with org-scoped access control and concurrency-safe writes using `db.transaction` and `SELECT ... FOR UPDATE`.
- **UI:** Card grid of mausoleums; detail view shows 2D SVG marble wall with tier/position labels and status colors.
- **Crypt Editor Sheet:** Edits crypt details, supports dual occupants, owner records, and notes.
- **Interior 3D View:** Uses CSS transforms for a "standing in the chapel" perspective.

### Cemetery Map (read-only view)
The B2B `/map` page displays a grid of plots from `GET /api/plots/map/:orgId`. Clicking a plot opens a sheet that lazy-loads burial records for that plot, displaying deceased's photo, name, lifespan, and interment details.

### Accounting Module
A complete invoicing and accounts-receivable module under `/app/accounting/*`, scoped per organization, with contract-first OpenAPI + Orval codegen.
- **Schema:** `customers`, `taxRates`, `invoices`, `invoiceItems`, `payments`. All amounts stored as `real` USD, quantities as `integer`.
- **API:** RESTful under `/api/{customers,tax-rates,invoices,payments,accounting}`. All endpoints are org-scoped. Invoices support draft, issued, partially paid, paid, voided states. Payments auto-update invoice status. `GET /accounting/summary` provides financial KPIs.
- **Server Helpers:** Centralized functions for `computeInvoiceTotals()`, `generateInvoiceNumber()`, `recomputeInvoicePayments()`, and `loadInvoiceWithItems()`.
- **Concurrency Model:** Invoice issuing uses `db.transaction` with `SELECT ... FOR UPDATE` and status-guarded updates to prevent race conditions.
- **Frontend Pages:** Overview dashboard, searchable tables for customers and tax rates, invoice list with status filter, full-page invoice editor, and printable invoice detail view with payment history.

### Cemetery Website Builder
Allows each cemetery operator to publish a branded public site at `/c/:slug` with grave search, marketplace, and order intake.
- **Schema:** `cemetery_sites` (theme, branding, contact info), `cemetery_categories`, `cemetery_products`, `cemetery_orders`. All tables are `organizationId` FK constrained.
- **API:** Operator API (org-scoped) for CRUD operations. Public API (slug-based) for site content, product listings, and order creation. Public `/find-grave` search returns limited PII. Order creation uses `db.transaction` for atomic processing.
- **Frontend - Operator:** Single-page builder (`/app/site-builder`) with Design, Catalogue, and Orders tabs. Features a live preview iframe.
- **Frontend - Public Site:** Themed layouts (`themes.ts`, `layout.tsx`), home page, grave search, marketplace with product details, and a cart system (`cart-store.ts` persisted in `localStorage`).

### Team & Access Module
Dedicated team management (`/app/team`) and permission matrix (`/app/team/roles`) pages.
- **Schema:** `users` table includes `role` enum (`owner | admin | manager | staff | viewer`), `status` enum (`active | invited | suspended`), `jobTitle`, `phone`, `lastActiveAt`, `invitedAt`. `unique(organizationId, email)` enforced.
- **API:** Org-scoped endpoints. `POST /users` rejects duplicate emails. `POST /users/:id/resend-invite` resets invite status. `GET /team-summary` for dashboard cards.
- **Last-Owner Protection:** Concurrency-safe owner demotion/suspension/removal within `db.transaction` prevents an organization from having zero owners.
- **Frontend - Members Page:** Summary cards, searchable/filterable member table with inline role changes, suspend/reactivate, and remove actions.
- **Frontend - Roles Page:** Five role overview cards and a full permission matrix grouped by capability families.
- **Backward-Compatibility:** `/app/users` acts as an alias to the new `TeamPage`.

### AI Map Maker
A sub-feature within the Map Maker for converting raster or vector cemetery maps into digital, clickable maps.
- **Pipeline:** Upload (images/PDFs), Analyze (AI detection via `/api/ai/detect-map`), Review & Open, Hand-off to Map Maker.
- **Detection Modes:**
    - **Grid Plan:** For vector PDFs with extracted text. Uses `pdfjs.getTextContent()` and server-side pixel analysis (`lib/gridDetect.ts`) to detect and label plots.
    - **Color Section:** For raster images. Uses a two-stage process: Computer Vision for section and grave-cell detection, followed by Claude Classification (`claude-sonnet-4-6`) to classify sections.
- **Constraints:** Optimized for flat-color cemetery plans. Rate-limited to 12 detections per 5 minutes per IP.

### Super Admin Module
Platform-operator console (`/admin/*`) for managing organizations and SaaS billing.
- **Backend:** `artifacts/api-server/src/routes/admin.ts` provides APIs for metrics (MRR, ARR, active counts), plans CRUD, subscriptions CRUD (with concurrency-safe creation and status mirroring to organizations), organization management (suspend, reactivate, delete), platform invoices (money in cents, race-safe numbering, payment recording), and an audit log. Cross-org user search is available for support.
- **DB:** `saasBilling.ts` schema includes `subscription_plans`, `subscriptions`, `platform_invoices`, `platform_payments`, `audit_log`. `organizationsTable` extended with `status` and suspension details.
- **Frontend:** Dashboard with KPIs, plans/subscriptions/invoices management, analytics (charts for revenue, signups, plan distribution), live audit log, and cross-org user search.

### Marketplace (Vendor Lifecycle SaaS)
End-to-end vendor surface that turns the marketplace into a full funeral
lifecycle SaaS rather than a simple request board.
- **Five canonical categories:** `funeral-services`, `religious`, `maintenance` (subscription grave care), `headstone`, `remembrance` (annual remembrance). Defined once in `lib/db/src/marketplace.ts` (`FUNERAL_CATEGORIES`) and re-exported to clients via `GET /api/marketplace/categories`.
- **Schema (additive on `vendor_services` + `vendor_requests`):**
    - `vendor_services.pricing_model` (`fixed | range | subscription | quote`), `price_amount`, `billing_cadence` (`monthly | quarterly | annually`).
    - `vendor_requests.quoted_amount`, `paid_amount`, `payment_status` (`unpaid | invoiced | paid | refunded`), `scheduled_for`, `is_recurring`.
- **Vendor APIs (`/api/vendor/*`, gated by `requireVendor`):**
    - `GET /metrics` — request counts, services count, **totalRevenue**, **monthRevenue**, **customerCount**, **monthlyTrend** (last 6 months), **topServices** (revenue + orders), recent requests.
    - `GET /orders` — accepted/completed requests with joined service rows.
    - `GET /customers` — distinct CRM rollup (totals, last order, status mix) keyed by lower-cased email.
    - `PATCH /requests/:id` accepts `quotedAmount`, `paidAmount`, `paymentStatus`, `scheduledFor`, `isRecurring` alongside the existing status workflow.
- **Public marketplace:** `GET /api/vendors?category=…` filters by canonical key. `vendors-directory` page is a hero category grid (5 cards with Lucide icons + accent gradients) plus chip filter, replacing the old text-input category search.
- **Vendor dashboard frontend:** revenue / monthly / customers / services KPI cards, 6-month area chart (recharts), top-services table, recurring badges. New `/vendor/orders` (revenue table) and `/vendor/customers` (CRM list with totals + status mix). Sidebar exposes Orders + Customers.
- **Seed:** `pnpm --filter @workspace/scripts run seed-vendors` provisions 5 vendors (Solace Funeral, Father Aldridge, Evergreen Memorial Care, Heritage Stoneworks, Everbloom Florals) — one per category, each with 4 services (mix of fixed + subscription + quote) and 5–9 historical requests carrying paid amounts spread across the last 0–5 months. Password: `Vendor2026!`. Idempotent: re-runs upsert by email and remove stale slug collisions.

### Authentication & Security
Implemented end-to-end real authentication.
- **Backend:** `POST /api/auth/login` supports `cemetery`, `family`, `admin` kinds, using bcrypt for password hashing. `POST /api/auth/logout` destroys sessions. `GET /api/auth/me` returns current `SessionUser`. Cookie-backed sessions (14-day rolling) stored in Postgres. Middleware includes `requireAuth`, `requirePlatformAdmin`, `requireOrgUser`, `enforceOrgScope`. Tier verification derived from `usersTable.role`. Session fixation defense via `req.session.regenerate()`. Rate limiting (20 req / 15 min) on login. `helmet` for security headers.
- **Frontend:** `AuthProvider`, `useAuth()`, `RequireAuth` component. All admin and app dashboard `fetch` calls include `credentials: "include"`. Sign-in forms route users to correct dashboards. `/app/*`, `/admin/*`, `/account/*` routes are wrapped in `RequireAuth`.

# External Dependencies

-   **Monorepo:** pnpm workspaces
-   **Runtime:** Node.js, TypeScript
-   **API:** Express
-   **Database:** PostgreSQL, Drizzle ORM
-   **Validation:** Zod
-   **Frontend:** wouter (for routing)
-   **Image Processing (API Server):** `sharp@0.34.5`
-   **Geometry Simplification (API Server):** `simplify-js@1.2.4`
-   **PDF Handling (Client-side):** `pdfjs-dist`
-   **AI Integration:** Anthropic AI client (using `claude-sonnet-4-6`)