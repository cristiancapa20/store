# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

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

