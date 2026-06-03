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

## 2026-06-03 - store-bd8.7
- Implemented `/products/new` — server component checks `session.user.role === "admin"`; non-admins see a 403 card
- Created `app/products/new/AddProductForm.tsx` — `"use client"` form with: Name, SKU+scan button, Price, Initial Stock (all required), Description (optional)
- SKU scan button toggles an inline `<BarcodeInput initialMode="camera" />` that fills the SKU field on scan and dismisses itself
- Client-side validation with inline per-field error messages before calling `addProduct()` server action
- Success redirects to `/products?added=1`; API errors surface as a form-level error banner
- Added FAB (`fixed bottom-24 right-4`) to `/products/page.tsx` linking to `/products/new`; reads `?added=1` searchParam to show a success toast
- Files changed: `components/BarcodeInput.tsx`, `app/products/new/page.tsx`, `app/products/new/AddProductForm.tsx`, `app/products/page.tsx`
- **Learnings:**
  - BarcodeInput needed an `initialMode` prop to start in camera mode — a minimal addition that allows reuse without mounting and immediately toggling
  - Admin guard in App Router: make the page a server component that calls `auth()`, render a 403 card for non-admins, and render the `"use client"` form component for admins — no middleware change needed
  - `searchParams` in Next.js 15+ is `Promise<{...}>` — must `await searchParams` in async server page component before reading keys
  - For a simple form submit handler, avoid `useCallback` wrapping — re-creation on each render is fine and avoids stale-closure ESLint issues with validation logic that reads multiple state vars
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

## 2026-06-03 - store-bd8.6
- Implemented `/products` product list with full acceptance criteria
- Created `app/products/ProductList.tsx` — `"use client"` component: fetches `listInventory(1,200)` on mount via `startTransition`, client-side search filter by name/SKU, refresh button (spinning icon while pending), 4 loading skeletons on initial fetch, product cards with name/SKU/price/StockBadge, "Adjust Stock" link per card
- Updated `app/products/page.tsx` — server component now renders `<ProductList />` alongside existing added-toast and FAB
- Stock badge: green (>10), amber (1-10), red (0) using Tailwind color classes
- **Learnings:**
  - Split server/client: keep `page.tsx` as server component to read `searchParams`; extract `ProductList.tsx` as `"use client"` for stateful inventory fetch — avoids `useSearchParams()` Suspense boundary requirement
  - Use `hasFetched` flag + `isPending` from `useTransition` to distinguish initial load (show skeleton) from refresh (spin icon only)
  - setState calls after `await` inside `startTransition(async () => {...})` don't trigger `react-hooks/set-state-in-effect` — only synchronous setState in effect bodies (or synchronous calls in traced useCallback functions) need `setTimeout` deferral
  - Pad product list with `pb-24` to prevent content hiding behind the fixed FAB button
---

## 2026-06-03 - store-bd8.5
- Implemented `/sell` page as a single `"use client"` component
- `<BarcodeInput>` at top calls `scanBarcode()` server action; adds product to cart or increments quantity
- "Product not found" toast on API error; "Out of stock" toast when `stock <= 0`
- Cart rows: product name, unit price × qty = line total, −/+ stepper (decrements to 0 = remove), trash icon remove button
- Fixed cart footer (above BottomNav at `bottom-16`) showing item count, subtotal, green "Confirm Sale" button with spinner while pending
- On success: cart clears, `lastSaleId` saved, empty state shows "View Invoice" link to `/api/invoices/<id>` + success toast
- Two separate `useTransition` hooks (`startScan` / `startConfirm`) so scan-pending and confirm-pending states are independent
- Files changed: `app/sell/page.tsx`
- **Learnings:**
  - Use two separate `useTransition` hooks for scan vs confirm — keeps spinner logic clean: `confirmPending` drives the button spinner, `scanPending` disables the BarcodeInput, `isPending = scanPending || confirmPending` gates both
  - Cart footer positioning: BottomNav is `fixed bottom-0` with `min-h-[48px]` tabs (~64px rendered); use `bottom-16` (64px) for the cart footer overlay to sit flush above it
  - `setLastSaleId` after `setCart([])` — empty cart triggers the "post-sale" empty state with View Invoice; this state clears when a new item is added (cart non-empty again)
  - `pb-40` on the scrollable body prevents cart items from hiding behind the fixed footer panel
---

## 2026-06-03 - store-bd8.9
- Implemented `/history` page as a `"use client"` component
- Added `listStaff()` server action to `lib/actions.ts` — queries SQLite `users` table directly; used for the staff dropdown in history filters
- Features: date-range pickers (From/To), staff member dropdown (all/per-user), sales card list with date/time/staff name/item count/total, tap-to-expand showing line items + totals, "Download Invoice" link per expanded sale, loading skeleton (4 cards) on initial fetch, empty state with icon
- Filters trigger re-fetch on change via `useCallback` + `useEffect([fetchSales])` pattern (same as ProductList)
- Two separate `useTransition` hooks (`staffPending`/`salesPending`) to independently track staff-load vs sales-load transitions
- Files changed: `app/history/page.tsx`, `lib/actions.ts`
- **Learnings:**
  - `listStaff` DB query in `lib/actions.ts` works without adding `better-sqlite3` to `serverExternalPackages` — Next.js auto-externalises native Node addons
  - Use two `useTransition` hooks (not one shared) when two independent async flows need independent pending tracking — combine with `isPending = aP || bP`
  - `useCallback` deps `[startDate, endDate, staffId]` cause `fetchSales` to re-create on filter change, which triggers the `useEffect([fetchSales])` re-run — clean filter-reactive fetch with no direct `useEffect` dep on filter state
---

## 2026-06-03 - store-bd8.10
- Implemented `GET /api/invoices/[saleId]` route handler at `app/api/invoices/[saleId]/route.tsx`
- Route fetches sale from Inventory API using `INVENTORY_API_KEY` server-side only; returns PDF via `@react-pdf/renderer`
- PDF contains: store name (STORE_NAME env), sale ID, date/time, staff name, line items table, subtotal, tax (TAX_RATE env), grand total
- Protected with `auth()` from NextAuth — unauthenticated requests return 401
- Response headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="invoice-{saleId}.pdf"`
- Added `serverExternalPackages: ["@react-pdf/renderer"]` to `next.config.ts` to prevent webpack bundling issues
- Files changed: `app/api/invoices/[saleId]/route.tsx`, `next.config.ts`, `package.json`
- **Learnings:**
  - `@react-pdf/renderer` uses `export = ReactPDF` (CJS); import as `import ReactPDF from '@react-pdf/renderer'` and destructure — works with `esModuleInterop: true`
  - `renderToBuffer()` returns `Promise<Buffer>` — must convert to `new Uint8Array(buffer)` for `NextResponse` body (TypeScript `BodyInit` type requires `BufferSource | Blob | ...`, not `Buffer`)
  - Add `serverExternalPackages: ["@react-pdf/renderer"]` in Next.js config to prevent webpack from bundling the package — avoids ESM/CJS interop issues at runtime
  - Route handlers use `context: { params: Promise<{ saleId: string }> }` in Next.js 15+ — must `await context.params` before accessing dynamic segments
---

