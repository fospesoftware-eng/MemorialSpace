# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## MemorialSpace Artifact (`artifacts/memorial-space`)

Full SaaS platform for cemetery management. Five distinct surfaces, each with its own layout and nested wouter `Router base="..."`:

| Path        | Surface                          | Layout                       |
|-------------|----------------------------------|------------------------------|
| `/`         | SaaS marketing landing (B2B sales) | `saas-marketing-layout.tsx`   |
| `/find/*`   | B2C public site (grave search, obituaries, marketplace) | `public-layout.tsx` |
| `/account/*`| Customer (B2C) dashboard         | `customer-layout.tsx`         |
| `/app/*`    | B2B cemetery operator dashboard  | `b2b-layout.tsx`              |
| `/admin/*`  | SaaS super-admin console         | `admin-layout.tsx`            |
| `/sign-in`, `/sign-in/{cemetery,family,admin}` | Auth pages (no surface layout) | `pages/auth/sign-in-form.tsx` |

### Sign-in pages

Three themed sign-in pages share `SignInForm` (theme: green/rose/gold), each redirecting to its dashboard via `window.location.href` (full reload to escape any nested wouter base). `/sign-in` is a hub that links to all three. Sign-out buttons in each surface point to the matching `/sign-in/<portal>`.

### Routing rules (important)

- Each surface mounts its routes inside `<WouterRouter base="/find" | "/account" | ...>`.
- **Inside** a base scope, `<Link href="/orders">` resolves to `/<base>/orders`. Use relative paths.
- **To navigate cross-surface** (e.g. from `/account` to `/find`), prefix with `~` to escape base: `<Link href="~/find">`.
- Plain `<a href="...">` works anywhere (full reload).
- The marketing surface (`/`) has no base, so absolute paths like `/app/dashboard` are fine there.

### Theming

Premium dark green (deep forest greens + near-black). Gold accent `#d4a843` is reserved for the admin surface (Super Admin branding) and select marketing accents.

Both light and dark color palettes are defined in `index.css` (`:root` and `.dark`). The `ThemeProvider` in `App.tsx` toggles a class on `<html>` and persists choice to `localStorage` (`memorial-space-theme`). A compact `<ThemeToggle variant="sidebar" />` component (Sun / Monitor / Moon) is mounted in all three dashboard sidebars (`b2b-layout`, `customer-layout`, `admin-layout`) above Sign Out. The sidebar itself uses dedicated `--sidebar-*` tokens that stay dark in both themes — only the main content area / cards / charts / inputs swap palettes.

### Cemetery Configuration (`/app/cemetery-setup`)

Settings page where operators CRUD the data that powers the Map Maker. Three sections:
- **Plot Types** — sections of the cemetery (RC, CON, FC, MU, PATH, BLD by default). Each has code, name, description, fill color, stroke color.
- **Burial Spot Types** — categories for individual burials (Civilian, Veteran — Army/Navy/Marines/Air Force, Child, Clergy, First Responder by default). Each has name, color, lucide icon (cross/star/flower/anchor/cog/circle/heart/award).
- **Map Background Library** — reusable map images (capped at 6, downscaled to 1600px webp). Auto-populated when the operator uploads a background in Map Maker.

All three lists are stored in localStorage keys `memorialspace.{plot-types,spot-types,bg-library}` via a shared `useStored<T>` hook in `lib/cemetery-config.ts`. The hook syncs across components via a `CustomEvent('stored:<key>')` broadcast and across tabs via the native `storage` event. **Important**: the hook returns `[value, setStored, error]` — `setStored` returns `prev` on persistence failure (e.g. `QuotaExceededError`) so the UI never claims a save succeeded that didn't.

### Plot Map Maker (`/app/map-maker`)

A truly fullscreen editor for cemetery operators. Single file: `pages/b2b/map-maker.tsx`. Reads plot/spot types and the background library from the shared registry above. Three tools:
- **Select** (V) — click to select, drag to move, corner handle to resize.
- **Plot** (R) — pick a plot type, drag on canvas to place a rectangular plot.
- **Spot** (S) — pick a burial spot type, click to drop a pin with a lucide icon. Each spot has a full dossier panel: name, DOB, DOD (auto age calc), spot type, headstone image upload (downscaled to 400px), GPS lat/lon, map x/y readout, notes.

Layout / chrome:
- **Renders OUTSIDE the B2B layout.** `App.tsx` short-circuits the `B2BRoutes()` switch when `useLocation() === "/map-maker"` and renders `<MapMaker />` standalone. This bypasses the `lg:pl-72 max-w-7xl mx-auto` constraints from `B2BLayout` so the editor can fill the entire viewport.
- Outer container is `fixed inset-0 z-40 flex flex-col bg-background` with a `rootRef` used by the browser Fullscreen API (`requestFullscreen` / `exitFullscreen`).
- Top toolbar: Back button → /dashboard, left-panel toggle, map name, 2D/3D, zoom (with **Fit to screen**), visibility toggles, Export, Save, browser **Fullscreen** toggle (F hotkey), right-panel toggle.
- Both side panels are collapsible. Collapsed = 48px icon-only mini-rail (Select/Plot/Spot tools, Upload, Sample, Settings on the left; Save/Export on the right). `ToolButton` accepts an `iconOnly` prop for the mini variant.

Background images:
- Upload via the file picker, drag-and-drop directly on the canvas (with a visible drop overlay), pick from the "Recent Backgrounds" thumbnail grid, or load the bundled sample at `public/sample-cemetery-map.webp`.
- Uploads are downscaled to 1600px webp and auto-added to the library.
- `setBackgroundFromDataUrl` returns `Promise<boolean>` so callers (`onUploadImage`, `onCanvasDrop`, `loadSample`) only show the "Loaded background" status toast on actual success — no false positives if `downscaleImage` fails.
- `loadSample` checks `res.ok` and surfaces a user-visible error toast on HTTP/network failure (no silent `console.error`-only failure).

Other features:
- 2D / 3D view toggle — 3D applies `transform: rotateX(<tilt>deg)` with a tilt slider; pointer interaction disabled in 3D.
- Zoom 10%–300%; **Fit to screen** computes a zoom that frames the current image inside `canvasWrapRef.current`'s client size minus 64px padding.
- Save/load multiple named maps to localStorage under key prefix `memorialspace.map-maker:<slug>`. Export current map as JSON.
- Hotkeys: V/R/S (tools), Delete/Backspace (delete selection), Esc (deselect / exit fullscreen), **F** (toggle browser fullscreen).
- Window-level `drop`/`dragend` listeners clear the drag overlay so it can't get stuck if a drag ends outside the canvas.

Implementation notes:
- Pointer math uses `svg.getScreenCTM().inverse()` so coordinates are in image-space regardless of zoom.
- Drag state lives in a `useRef`; the cleanup `useEffect` depends on `[view]` only (NOT `tool`) so a tool switch in the same event as a pointerdown can't nuke the drag. The `switchToSelectOnUp` flag defers the auto-switch-to-Select after a Spot drop until pointerup.
- Lucide icons are rendered as nested `<svg>` children of the canvas SVG via `x/y/width/height` props.
- `migrateDoc()` defensively normalizes legacy saved maps (old `type` → new `typeId`, invalid `status` → `available`, non-numeric coords → 0/undefined, polygon `points` parsed and dropped if fewer than 3 valid vertices remain).
- Plots support an optional `points: [number, number][]` polygon outline (absolute SVG coords, perimeter order). When present the plot renders as `<polygon>` instead of `<rect>`; the bounding box (`x,y,w,h`) is kept in sync so existing select/move/resize handles still work — the move handler translates polygon points by the same delta, the resize handler scales them relative to the top-left.
- Background library writes are non-blocking; `backgroundsErr` from `useBackgrounds()` surfaces a toast if persistence fails.
- Z-index layering: root `z-40`, empty-state `z-10`, drag overlay `z-20`, status toast `z-50`. Radix portals (toasts/dialogs) sit higher and remain reachable.

Linked from `b2b-layout` nav: Cemetery Operations → Map Maker; Settings → Cemetery Setup. The Back button in the top toolbar is the user's escape hatch back to the rest of the B2B app.

### AI Map Maker (`/app/ai-map-maker`)

Sub-feature under Map Maker that converts existing JPG/PNG/WebP/PDF cemetery maps into a clickable digital map using Claude's vision API. Single file: `pages/b2b/ai-map-maker.tsx`. Renders inside the regular `B2BLayout` (it's a pre-processor, not a fullscreen editor).

Pipeline:
1. **Upload** — drag-drop or file picker accepts `image/*` and `application/pdf`. PDFs are rendered via `pdfjs-dist` (worker URL imported with `?url` so Vite emits a hashed asset). Multi-page PDFs get a Prev/Next page picker. The selected page (or image) is downscaled to 1600px webp via `downscaleImage` from `cemetery-config.ts`.
2. **Analyse with AI** — POSTs `{image: dataUrl, imgWidth, imgHeight, plotTypes, spotTypes}` to `/api/ai/detect-map`. The endpoint sends the image + the operator's current cemetery type list to `claude-sonnet-4-6` and asks for, per plot, **a polygon outline (`points: [[x,y]…]`, 3-32 normalised vertices in perimeter order) PLUS the bounding box** classified against those exact `typeId`s. The prompt is explicit that rotated, curved, L-shaped or otherwise non-rectangular regions must keep their true shape. Results are sanitised with Zod, unknown type ids fall back to the first available, polygon vertices are clamped to `[0,1]`, and the server **derives the bbox from the polygon** when present (more reliable than trusting a separately-emitted bbox). Plots without polygons fall back to the rect bbox.
3. **Review & open** — detected polygons are overlaid on the preview as filled `<polygon>`s (or `<rect>`s when no polygon was returned) with section labels; spots render as colored dots. Operator names the map and clicks **Open in Map Maker**.
4. **Hand-off** — the page writes the assembled `MapDoc` to `localStorage["memorialspace.map-maker:<slug>"]` (so it appears in Saved Maps) AND to `localStorage["memorialspace.map-maker:__pending__"]`, then `setLocation("/map-maker")`. The Map Maker has a mount-time `useEffect` that reads `__pending__`, loads it via `migrateDoc()`, flashes a status toast, and removes the pending key so a refresh doesn't re-load it.

API route: `artifacts/api-server/src/routes/aiMap.ts` (mounted under `/api`). Body limit was bumped to 12 MB in `app.ts` to accommodate base64 images. Validation is strict (Zod) on both the inbound request and the AI's outbound JSON; ` ```json ` fences are stripped if Claude wraps the response.

AI integration: `lib/integrations-anthropic-ai/` is a minimal lib that just re-exports a configured `anthropic` client (no DB tables, no batch utils — this is a one-shot vision call). Provisioned via `setupReplitAIIntegrations` (env vars `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY`).

Linked from `b2b-layout` nav: Cemetery Operations → AI Map Maker (Wand2 icon, sits directly under Map Maker).
