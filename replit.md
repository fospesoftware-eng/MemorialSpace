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
