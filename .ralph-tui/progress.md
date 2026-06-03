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

