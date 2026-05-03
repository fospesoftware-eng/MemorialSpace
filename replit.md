# Overview
MemorialSpace is a pnpm workspace monorepo project developing a comprehensive SaaS platform for cemetery management. It features five distinct user interfaces: a B2B marketing site, a B2C public site for grave search, a customer dashboard, a B2B cemetery operator dashboard, and a SaaS super-admin console. The platform aims to modernize cemetery operations, improve efficiency, and enhance public accessibility through features like an interactive map maker and AI-powered map digitization. The business vision is to become a leading SaaS provider in the cemetery sector.

# User Preferences
I prefer iterative development with clear communication on major changes. Please ask before making any significant architectural decisions or modifications to core functionalities.

# System Architecture
The project is structured as a pnpm workspace monorepo utilizing Node.js 24 and TypeScript 5.9.

## Core Technologies
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`) and `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild (CJS bundle)

## UI/UX Decisions
The platform employs a premium dark green theme with gold accents for admin and marketing, offering both light and dark palettes managed by a `ThemeProvider` that persists user choice. Sidebars maintain a dark appearance.

## Feature Specifications

### Routing
`wouter` handles routing, with distinct base paths for each of the five user surfaces. Cross-surface navigation uses a `~` prefix, while internal navigation uses relative paths. Successful sign-ins trigger a full page reload and redirect to the appropriate dashboard.

### Cemetery Configuration
Operators manage Plot Types, Burial Spot Types, and a Map Background Library. Configurations are stored locally using a `useStored<T>` hook for persistence and synchronization.

### Plot Map Maker
A full-screen editor (`/app/map-maker`) for cemetery operators to create and manage digital maps. Features include various drawing tools (Select, Plot, Circle, Path, Spot, Polygon, Outline-only shapes), background image support, 2D/3D view toggle, zoom, "Fit to screen," save/load, JSON export, and keyboard shortcuts. It uses `svg.getScreenCTM().inverse()` for pointer math and `migrateDoc()` for backward compatibility.

### Cemetery Type & Columbarium Module
Organizations are categorized by `cemeteryType` and a `featuresColumbarium` flag. The Columbarium Module (`/app/columbarium`) manages cinerary niche walls with CRUD operations and a 2D SVG niche grid UI, including a creative 3D view.

### Mausoleum Module
Similar to the Columbarium module, this manages above-ground casket structures. It features RESTful CRUD for buildings and position-based crypt management with concurrency-safe writes. The UI provides a card grid and a 2D SVG marble wall view, plus an interior 3D view using CSS transforms.

### Cemetery Map (read-only view)
The B2B `/map` page displays plots from `GET /api/plots/map/:orgId`. Clicking a plot lazy-loads and displays associated burial records.

### Accounting Module
A complete invoicing and accounts-receivable module under `/app/accounting/*`, scoped per organization. It includes `customers`, `taxRates`, `invoices`, `invoiceItems`, `payments` schemas. The API provides RESTful endpoints with concurrency control for invoice issuing. The frontend features dashboards, searchable tables, an invoice editor, and printable views.

### Cemetery Website Builder
Enables cemetery operators to publish branded public sites at `/c/:slug` with grave search, a marketplace, and order intake. It involves `cemetery_sites`, `cemetery_categories`, `cemetery_products`, and `cemetery_orders` schemas. The API supports org-scoped CRUD for operators and slug-based access for public content. The frontend provides a single-page builder for operators with a live preview and a public site with themed layouts and a cart system.

### Team & Access Module
Dedicated pages for team management (`/app/team`) and permission matrix (`/app/team/roles`). The `users` table includes roles and status, with unique email constraints per organization. APIs are org-scoped, including last-owner protection during demotion/suspension. The frontend features summary cards, a searchable member table, and a comprehensive permission matrix.

### AI Map Maker
A sub-feature within the Map Maker for converting raster or vector cemetery maps into digital, clickable maps. It processes uploaded images/PDFs using AI detection (`/api/ai/detect-map`). Detection modes include Grid Plan for vector PDFs (using `pdfjs.getTextContent()` and server-side pixel analysis) and Color Section for raster images (using Computer Vision and Claude Classification).

### Super Admin Module
A platform-operator console (`/admin/*`) for managing organizations and SaaS billing. The backend provides APIs for metrics, plans, subscriptions, organization management, platform invoices, and an audit log. The frontend includes a dashboard with KPIs, management interfaces, analytics, and cross-org user search.

### Family Linking
Allows connecting burial records within the same cemetery to visualize family relationships. It uses `burial_family_links` schema with unique edge indexes and `ON DELETE CASCADE`. The API provides org-scoped endpoints for retrieving family lists, creating links, deleting links, and generating a family tree. The frontend integrates a `BurialFamilyLinks` panel into detail sheets and a "Tree" dialog for SVG visualization.

### Marketplace (Vendor Lifecycle SaaS)
An end-to-end vendor surface offering a funeral lifecycle SaaS. It defines five canonical categories and extends `vendor_services` and `vendor_requests` schemas with pricing and payment details. Vendor APIs provide metrics, order management, and customer CRM data. The public marketplace features category filtering, and the vendor dashboard frontend displays KPIs, charts, and customer/order management interfaces.

### Authentication & Security
Features end-to-end authentication with `POST /api/auth/login` supporting different user kinds (cemetery, family, admin). Sessions are cookie-backed, stored in Postgres, and last 14 days. Middleware includes `requireAuth`, `requirePlatformAdmin`, `requireOrgUser`, `enforceOrgScope`, with tier verification from `usersTable.role`. Security measures include session fixation defense, rate limiting on login, and `helmet` for security headers. The frontend uses `AuthProvider`, `useAuth()`, and `RequireAuth` components, with all admin/app dashboard `fetch` calls including `credentials: "include"`.

# External Dependencies
-   **Monorepo:** pnpm workspaces
-   **Runtime:** Node.js, TypeScript
-   **API:** Express
-   **Database:** PostgreSQL, Drizzle ORM
-   **Validation:** Zod
-   **Frontend:** wouter (for routing)
-   **Image Processing (API Server):** `sharp`
-   **Geometry Simplification (API Server):** `simplify-js`
-   **PDF Handling (Client-side):** `pdfjs-dist`
-   **AI Integration:** Anthropic AI client (using `claude-sonnet-4-6`)