# Overview

This project is a pnpm workspace monorepo using TypeScript, designed to be a full SaaS platform for cemetery management called MemorialSpace. It aims to provide five distinct user surfaces: a B2B marketing landing page, a B2C public site for grave search and obituaries, a customer dashboard, a B2B cemetery operator dashboard, and a SaaS super-admin console. The platform includes advanced features like an interactive map maker for cemetery operators and an AI-powered tool to convert physical cemetery maps into digital, clickable ones.

The business vision is to modernize cemetery management through a comprehensive digital solution, improving operational efficiency for cemeteries and enhancing accessibility for the public. The project's ambition is to become a leading SaaS provider in the cemetery management sector.

# User Preferences

I prefer iterative development with clear communication on major changes. Please ask before making any significant architectural decisions or modifications to core functionalities.

# System Architecture

The project is structured as a pnpm workspace monorepo, utilizing Node.js 24 and TypeScript 5.9.

## Core Technologies:
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`) and `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild (CJS bundle)

## UI/UX Decisions:
The platform features a premium dark green theme with a gold accent (`#d4a843`) reserved for the admin surface and marketing elements. Both light and dark color palettes are available, managed by a `ThemeProvider` that persists the user's choice to `localStorage`. Sidebar elements retain a dark theme regardless of the main content area's palette.

## Feature Specifications:

### Routing:
The application uses `wouter` for routing, with each of the five surfaces having its own base path (e.g., `/find/*`, `/account/*`). Cross-surface navigation is handled by prefixing paths with `~` (e.g., `~/find`), while internal navigation uses relative paths. Sign-in pages are themed and redirect to their respective dashboards via a full page reload.

### Cemetery Configuration:
Operators can manage Plot Types, Burial Spot Types, and a Map Background Library. These configurations are stored in `localStorage` using a `useStored<T>` hook, which ensures data persistence and cross-component/tab synchronization. The `setStored` function handles persistence failures gracefully.

### Plot Map Maker:
A full-screen editor (`/app/map-maker`) allows cemetery operators to create and manage digital maps.
- **Tools:** Select, Plot (rectangular plots with customizable types), and Spot (pins with lucide icons for individual burial spots, including dossier panels for details and image uploads).
- **Layout:** The editor renders outside the main B2B layout to utilize the entire viewport, with collapsible side panels and a top toolbar for navigation, zoom, and display options.
- **Backgrounds:** Supports image uploads (downscaled to 1600px webp), drag-and-drop, and selection from a recent library. Uploads are added to the background library automatically.
- **Interactivity:** Includes 2D/3D view toggle, zoom functionality, "Fit to screen" option, save/load multiple maps to `localStorage`, JSON export, and keyboard shortcuts (V/R/S/H for Select/Plot/Spot/Pan tools, Delete/Backspace, Esc, F for fullscreen). The **Pan (Hand) tool** scrolls the canvas viewport on drag — useful for navigating dense imported maps without accidentally selecting plots. **Plot labels** are off by default (toggle with the toolbar "Labels" button); hovering any plot momentarily reveals its label with a white halo for legibility, and the selected plot's label is always shown.
- **Plot Type Palette:** The default palette covers cemetery sections (RC, CON, FC, MU) plus infrastructure features (PATH road, BLD building, COL columbarium, MAU mausoleum, WTR lake/water, BR bridge, GDN garden, PRK parking, GT gate). Each type has a distinct fill/stroke colour. All features are drawn with the existing Plot tool — long thin rectangles for roads/bridges, larger rectangles or AI-imported polygons for water bodies, gardens, columbaria, etc. New defaults ship via a per-version `PLOT_TYPE_MIGRATIONS` map keyed by `PLOT_TYPES_SEED_VERSION` so existing users get only the *newly added* ids merged into their stored list (deletions of older defaults are preserved, customisations are never overwritten).
- **Implementation:** Uses `svg.getScreenCTM().inverse()` for accurate pointer math, a `useRef` for drag state management, and `lucide` icons embedded as SVG children. It includes a `migrateDoc()` function for backward compatibility with legacy map data and supports polygon outlines for plots.

### AI Map Maker:
A sub-feature within the Map Maker that converts raster or vector cemetery maps into digital, clickable maps.
- **Pipeline:**
    1.  **Upload:** Accepts image (`JPG/PNG/WebP`) and PDF files, downscaling to 1600px webp. Multi-page PDFs support page selection.
    2.  **Analyze:** POSTs image data and plot/spot types to `/api/ai/detect-map`.
    3.  **Review & Open:** Displays detected polygons and cells for review.
    4.  **Hand-off:** Saves the generated `MapDoc` to `localStorage` and redirects to the Map Maker.
- **Detection Modes:**
    -   **Grid Plan:** Triggered by vector PDFs with extracted text (`pdfText`). The client extracts text positions via `pdfjs.getTextContent()` and renders the page at 2400px so the small plot rectangles stay separable. The server (`lib/gridDetect.ts`) thresholds dark pixels, runs 4-conn BFS on the light interior regions to find candidate plot rectangles, drops the largest edge-touching component as the page background (other edge-touching plots are kept), filters by size/area/fill/aspect, applies an **outer-boxes-only filter** (drops any plot whose bbox is contained inside a strictly larger plot's bbox, with a small tolerance — keeps section containers and discards the small grave cells inside them), and matches each remaining plot to PDF text words by spatial containment in a 32×32 bucket grid (multi-grave sections aggregate their inner graves' names into the section label). Pixel-perfect outlines, no AI vision call. **Fallback**: if grid finds <10 plots (`MIN_GRID_PLOTS_TO_TRUST`) the route falls through to the colour-section pipeline rather than returning empty, so colour-section PDFs that happen to contain some text still work.
    -   **Color Section:** Used for raster images without `pdfText`. Employs a two-stage process:
        -   **Stage 1 (Computer Vision):** Decodes, downscales, and extracts color palettes. It performs per-color section detection (using tolerant masks, dilation, BFS, boundary tracing, and Douglas-Peucker simplification) and grave-cell detection within sections.
        -   **Stage 2 (Claude Classification):** Utilizes Anthropic's Claude model (`claude-sonnet-4-6`) to classify the detected color sections based on visual cues and operator-defined plot types.
- **Constraints:** Optimized for flat-color cemetery plans. Rate-limited to 12 detections per 5 minutes per IP, with a body limit of 12 MB for uploads.

# External Dependencies

-   **Monorepo:** pnpm workspaces
-   **Runtime:** Node.js, TypeScript
-   **API:** Express
-   **Database:** PostgreSQL, Drizzle ORM
-   **Validation:** Zod
-   **Frontend:** wouter (for routing)
-   **Image Processing (API Server):** `sharp@0.34.5` (for image decode/downscale)
-   **Geometry Simplification (API Server):** `simplify-js@1.2.4` (for Douglas-Peucker algorithm)
-   **PDF Handling (Client-side):** `pdfjs-dist` (for rendering PDFs in AI Map Maker)
-   **AI Integration:** Anthropic AI client (configured with `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and `AI_INTEGRATIONS_ANTHROPIC_API_KEY`), specifically using `claude-sonnet-4-6`.