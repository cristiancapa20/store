# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **`react-hooks/set-state-in-effect` (v7 rule)**: All `setCameraState` calls inside a `useEffect` body — even in `else` branches — must be deferred via `setTimeout(() => setState(...), 0)`. The rule also traces into `useCallback` functions called from effects; if they call setState synchronously, the effect call site is flagged. Fix: use async IIFEs inside effects so all setState calls occur after `await`, and defer synchronous branches with `setTimeout`.
- **`.bin` wrappers broken on Node v26**: All `node_modules/.bin/*` wrappers fail with `Cannot find module`. Always use direct paths: `node node_modules/typescript/bin/tsc`, `node node_modules/eslint/bin/eslint.js`, `node node_modules/next/dist/bin/next`.
- **PWA + Next.js 16 Turbopack**: `@ducanh2912/next-pwa` uses webpack; must set `turbopack: {}` in `next.config.ts` to suppress the turbopack/webpack conflict error (it will still use Turbopack for dev/build; PWA SW only generates in production).
- **Components directory**: Shared components live in `/components/` (not `app/components/`). Already set up.
- **Bottom nav**: `components/BottomNav.tsx` — `"use client"` component using `usePathname()` for active state. 5 tabs: `/sell`, `/products`, `/products/new`, `/adjust`, `/history`.

---

## 2026-06-03 - store-bd8.1
- Scaffolded Next.js 16 app router project with TypeScript and Tailwind v4
- Installed `@ducanh2912/next-pwa` for PWA support
- Created `public/manifest.json` with name, icons (192×192, 512×512 green PNGs), theme color, `display: standalone`
- Created `components/BottomNav.tsx` — thumb-reachable (min-h-[48px]) bottom nav with 5 tabs
- Updated `app/layout.tsx` with PWA metadata, viewport settings, max-w-md centered layout, dark mode classes
- Created stub pages: `/sell`, `/products`, `/products/new`, `/adjust`, `/history`
- Home `/` redirects to `/sell`
- Added `typecheck` and `lint` scripts using direct node paths (not `.bin` wrappers)
- Updated `.gitignore` with Next.js/SQLite/PWA patterns
- Created `.env.local` with all required env var placeholders
- **Learnings:**
  - `node_modules/.bin` wrappers are all broken on Node v26 in this environment — use direct `node /path/to/bin` instead
  - `@ducanh2912/next-pwa` adds webpack config which conflicts with Next.js 16's default Turbopack — set `turbopack: {}` in config
  - PNG icons can be generated from raw Node.js using `zlib.deflateSync` + manual PNG byte construction without `canvas` dep
  - `create-next-app` refuses to scaffold into a non-empty dir — scaffold into `/tmp` and copy files over
---

## 2026-06-03 - store-bd8.3
- Created `lib/types.ts` with all shared types: `Product`, `CartItem`, `SaleItem`, `Sale`, `NewProduct`, `SaleFilters`, `InventoryPage`, `ActionResult<T>`
- Created `lib/actions.ts` with `"use server"` directive; implements all 6 server actions: `scanBarcode`, `createSale`, `listInventory`, `addProduct`, `adjustStock`, `listSales`
- Internal `apiFetch<T>` helper adds `Authorization: Bearer` header and catches all errors, returning `{ error: string }` instead of throwing
- `INVENTORY_API_URL` and `INVENTORY_API_KEY` read only via `process.env` inside `lib/actions.ts` — never in any client file
- **Learnings:**
  - Spread `init?.headers` after `authHeader()` so callers can't accidentally override the auth header (put auth header last)
  - `"use server"` at file top marks all exports as server actions; no per-function annotation needed
  - `encodeURIComponent` on path segments prevents injection into URL construction
---

## 2026-06-03 - store-bd8.4
- Implemented `components/BarcodeInput.tsx` — reusable dual-mode barcode input component
- Installed `@zxing/browser` and `@zxing/library` as Safari/iOS fallback for `BarcodeDetector` API
- Camera mode: uses native `BarcodeDetector` where available, falls back to `BrowserMultiFormatReader.decodeFromStream` (continuous async callback API)
- Scanner mode: invisible `sr-only` input captures rapid HID keystrokes, buffers them (100ms timeout resets buffer), fires `onScan` on Enter
- Green border overlay + `navigator.vibrate(50)` haptic on detection
- Permission denied → error state with retry button; generic camera error also handled
- **Learnings:**
  - `react-hooks/set-state-in-effect` (eslint-plugin-react-hooks v7) flags ALL synchronous setState in effect bodies — including in `else` branches. Fix: defer with `setTimeout(() => setState(...), 0)`.
  - The rule also traces into `useCallback` functions: if they call setState synchronously, the effect call site is flagged. Fix: inline camera logic as an async IIFE inside the effect.
  - `BrowserMultiFormatReader.decodeFromStream(stream, videoEl, callback)` is the correct continuous-scan API (returns `Promise<IScannerControls>`); `decodeFromVideoElement` also takes a callback (not a direct decode).
  - Dropped "requesting" from `CameraState` — use `"idle"` for the waiting-for-permission state.
---

## 2026-06-03 - store-bd8.2
- Installed `next-auth@beta` (v5.0.0-beta.31), `better-sqlite3`, `bcryptjs` and their TypeScript types
- Created `lib/db.ts` — initializes SQLite at `./data/store.db` with WAL mode; creates `users` table on first run
- Created `auth.config.ts` — Edge-safe NextAuth config (no DB imports); handles route protection via `authorized` callback, plus `jwt`/`session` callbacks to thread `id` and `role`
- Created `auth.ts` — full NextAuth config extending `authConfig`, adds Credentials provider querying SQLite + bcrypt password comparison
- Created `types/next-auth.d.ts` — module augmentation for `Session.user.{id, role}`, `User.role`, `JWT.{id, role}`
- Created `app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- Created `middleware.ts` — uses `NextAuth(authConfig).auth`; matcher excludes `/api/auth/*`, static assets, manifests
- Created `app/login/page.tsx` — client component using `useActionState` for pending + error state; rounded-2xl inputs, green Sign in button, mobile-optimized
- Created `app/login/actions.ts` — `loginAction` server action; catches `AuthError` and returns `{ error }`, re-throws redirect to Next.js
- Created `components/LogoutButton.tsx` — server component with inline `"use server"` action calling `signOut`; no SessionProvider needed
- Updated `app/layout.tsx` — calls `auth()` server-side; conditionally renders header (name + LogoutButton) and BottomNav only when session active
- Created `scripts/seed.ts` — creates admin user from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars; added `seed` npm script using `--experimental-strip-types`
- Added `AUTH_SECRET` and `AUTH_URL` to `.env.local` alongside existing `NEXTAUTH_*` vars
- **Learnings:**
  - NextAuth v5 Edge middleware pattern: split `auth.config.ts` (Edge-safe, no DB) from `auth.ts` (Node-only, has Credentials/DB). Middleware imports only `auth.config.ts`.
  - `signIn("credentials", { redirectTo })` in a server action throws `NEXT_REDIRECT` on success — re-throw it so Next.js handles navigation; catch only `AuthError` for credential failures.
  - `useActionState` (React 19) pairs cleanly with NextAuth v5 server actions: pending/error state from the action, redirect handled by the re-thrown NEXT_REDIRECT.
  - `LogoutButton` as a server component with inline `"use server"` avoids needing `SessionProvider` entirely.
  - Seed script runs with `node --env-file=.env.local --experimental-strip-types` on Node 26 — triggers MODULE_TYPELESS_PACKAGE_JSON warning but works fine.
  - `better-sqlite3` is sync — fine in Node.js `authorize` callback; no async issues.
---

## 2026-06-03 - store-bd8.8
- Implemented `/adjust` page as a `"use client"` component
- Features: `<BarcodeInput>` at top, name/SKU search with dropdown (fetches `listInventory(1,200)` and filters client-side), selected product card showing current stock, delta +/- stepper with numeric input, reason dropdown (Restock/Shrinkage/Correction/Other), `adjustStock()` server action call, new stock display on success, validation preventing stock below 0
- Files changed: `app/adjust/page.tsx`
- **Learnings:**
  - React 19 `startTransition` accepts async callbacks directly — no `useEffect` wrapping needed for transition-based server action calls
  - For client-side name search, call `listInventory(1, 200)` and filter locally — avoids adding a search endpoint while keeping the pattern simple
  - `"error" in result` type narrowing works for `ActionResult<T>` as long as `T` has no `error` field — Product, InventoryPage, and `{stock: number}` all satisfy this
  - `useCallback` for all handlers that touch state prevents stale closure issues without needing `useEffect`
---

