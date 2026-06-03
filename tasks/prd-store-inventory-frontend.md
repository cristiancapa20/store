# PRD: Store Inventory Frontend (PWA)

## Overview

A mobile-first Next.js PWA for in-store staff to scan and sell products, manage inventory, and generate invoices. The app is a pure frontend that proxies all inventory operations through Next.js server actions to a separate Inventory Service API — the API key never reaches the browser. Staff authentication is handled by NextAuth with a local SQLite database.

## Goals

- Enable fast, thumb-friendly scan-and-sell workflows used dozens of times per day
- Support both camera-based and physical USB/Bluetooth barcode scanners
- Keep the Inventory Service API key strictly server-side via Next.js server actions
- Be installable as a PWA on Android and iOS
- Support multiple staff users with login/logout

## Quality Gates

These commands must pass for every user story:
- `npm run typecheck` — TypeScript type checking
- `npm run lint` — ESLint linting

For UI stories, also include:
- Verify the feature visually in the browser using the dev-browser skill

---

## User Stories

### US-001: Project scaffolding and PWA setup
**Description:** As a developer, I want a Next.js project with Tailwind, PWA support, and a shared mobile layout so that all subsequent features have a consistent, installable foundation.

**Acceptance Criteria:**
- [ ] Next.js 14+ app router project with TypeScript
- [ ] Tailwind CSS configured with `rounded-2xl` as the default card/button radius
- [ ] `next-pwa` or equivalent configured — app is installable on Android Chrome and iOS Safari
- [ ] `manifest.json` includes name, icons (192×192, 512×512), theme color, `display: standalone`
- [ ] Shared mobile layout: full-height, max-w-md centered, bottom navigation bar with 5 tabs (Sell, Products, Add, Adjust, History)
- [ ] Bottom nav is thumb-reachable (min 48px tap targets)
- [ ] Dark mode support via Tailwind `dark:` classes

---

### US-002: Staff authentication (NextAuth + SQLite)
**Description:** As a staff member, I want to log in with my username and password so that my sales are recorded under my account.

**Acceptance Criteria:**
- [ ] NextAuth v5 configured with Credentials provider
- [ ] SQLite database (via `better-sqlite3` or `drizzle-orm` + SQLite) stores `users` table: `id`, `name`, `email`, `password_hash`, `role` (admin/staff)
- [ ] Passwords hashed with `bcrypt`
- [ ] Login screen: email + password fields, rounded-2xl inputs, "Sign in" button — mobile-optimized
- [ ] All app routes redirect to `/login` if unauthenticated
- [ ] Session includes `user.id`, `user.name`, `user.role`
- [ ] Logout available from the layout header
- [ ] Seed script creates at least one admin user from env vars (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`)

---

### US-003: Inventory API proxy layer (server actions)
**Description:** As a developer, I want all calls to the Inventory Service routed through Next.js server actions so that the API key never reaches the browser.

**Acceptance Criteria:**
- [ ] `INVENTORY_API_URL` and `INVENTORY_API_KEY` stored in `.env.local` only
- [ ] Server actions (or route handlers) created for each endpoint:
  - `scanBarcode(barcode: string)` → product details + current stock
  - `createSale(items: CartItem[])` → sale record with ID
  - `listInventory()` → paginated product list with stock
  - `addProduct(data: NewProduct)` → created product
  - `adjustStock(productId: string, delta: number)` → updated stock level
  - `listSales(filters: SaleFilters)` → sale records
- [ ] Each action adds `Authorization: Bearer ${INVENTORY_API_KEY}` header
- [ ] Actions return typed results; errors surface as `{ error: string }` never throwing to client
- [ ] No API key, URL, or raw fetch appears in any `"use client"` file

---

### US-004: Barcode input component (camera + physical scanner)
**Description:** As a cashier, I want to scan barcodes with my phone camera or a plugged-in scanner so that I can identify products instantly.

**Acceptance Criteria:**
- [ ] `<BarcodeInput>` component supports two modes, toggled by a button: **Camera** and **Scanner**
- [ ] **Camera mode:** uses `BarcodeDetector` API (with `zxing-js/browser` fallback); shows a live viewfinder; highlights detected barcode with a green overlay; fires `onScan(barcode)` callback
- [ ] **Scanner mode:** an invisible focused `<input>` that captures rapid keystrokes from HID keyboard-emulating scanners (terminated by Enter); fires `onScan(barcode)` on Enter
- [ ] Camera permission denied → graceful error state with retry button
- [ ] Detected barcode triggers a 50ms haptic vibration (`navigator.vibrate`)
- [ ] Component is reusable (used in Sell and Stock Adjustment screens)

---

### US-005: Scan & sell — cart and checkout
**Description:** As a cashier, I want to scan products into a cart, adjust quantities, and confirm the sale so that stock and sales records are updated.

**Acceptance Criteria:**
- [ ] `/sell` screen shows the `<BarcodeInput>` at the top and a cart list below
- [ ] Scanning a barcode calls `scanBarcode()` server action; found product is added to cart (or increments quantity if already present)
- [ ] Unknown barcode shows a toast: "Product not found"
- [ ] Out-of-stock product shows a toast: "Out of stock" and is not added
- [ ] Each cart row shows: product name, unit price, quantity stepper (−/+), line total; row swipe-left or trash icon removes it
- [ ] Cart footer shows: item count, subtotal, "Confirm Sale" button (green, full-width, rounded-2xl)
- [ ] Confirming calls `createSale()` server action; on success: cart clears, success toast appears, "View Invoice" button appears
- [ ] "View Invoice" navigates to the invoice for that sale ID
- [ ] Empty cart state shows a friendly prompt to scan

---

### US-006: Product list with stock levels
**Description:** As a staff member, I want to see all products and their current stock so that I can answer customer questions and spot low-stock items.

**Acceptance Criteria:**
- [ ] `/products` screen calls `listInventory()` on load
- [ ] Products displayed as a card list: name, SKU, price, stock badge
- [ ] Stock badge: green (>10), amber (1–10), red (0)
- [ ] Search input filters list client-side by name or SKU
- [ ] Pull-to-refresh (or a refresh button) re-fetches inventory
- [ ] Loading skeleton shown while fetching
- [ ] Each product card has a quick "Adjust Stock" link

---

### US-007: Add product
**Description:** As an admin, I want to add a new product to the inventory so that it can be sold immediately.

**Acceptance Criteria:**
- [ ] `/products/new` screen (accessible from `/products` via a FAB button)
- [ ] Form fields: Name (required), SKU (required), Price (required, number), Initial Stock (required, number), Description (optional)
- [ ] SKU field has a "Scan" icon that opens the `<BarcodeInput>` in camera mode to fill the field
- [ ] Client-side validation with inline error messages before submitting
- [ ] Submit calls `addProduct()` server action; success redirects to `/products` with a toast
- [ ] API error surfaces as an inline form error message
- [ ] Only users with `role === 'admin'` can access this screen; others see a 403 message

---

### US-008: Stock adjustment
**Description:** As a staff member, I want to adjust the stock level of a product so that the inventory reflects actual physical counts.

**Acceptance Criteria:**
- [ ] `/adjust` screen shows the `<BarcodeInput>` at the top
- [ ] Scanning or searching by name selects a product; shows current stock
- [ ] Delta input: `+` / `−` stepper plus a manual number input; supports positive (restock) and negative (shrinkage) adjustments
- [ ] Reason dropdown: Restock, Shrinkage, Correction, Other
- [ ] "Apply Adjustment" button calls `adjustStock()` server action; shows new stock level on success
- [ ] Prevents adjusting below 0 with a validation message

---

### US-009: Sales history with filters
**Description:** As a manager, I want to see all sales filtered by date range and staff member so that I can track performance and reconcile the till.

**Acceptance Criteria:**
- [ ] `/history` screen calls `listSales()` server action with active filters
- [ ] Filters: date-range picker (start date / end date) and staff member dropdown (populated from SQLite users list)
- [ ] Sales shown as a card list: date/time, staff name, item count, total amount
- [ ] Tapping a sale card expands it to show the line items
- [ ] Each expanded sale has a "Download Invoice" button
- [ ] Filters apply on change (no separate submit button needed)
- [ ] Loading state and empty state handled

---

### US-010: Invoice PDF generation
**Description:** As a cashier or manager, I want to download a PDF invoice for any sale so that I can give a receipt to the customer or keep records.

**Acceptance Criteria:**
- [ ] `GET /api/invoices/[saleId]` route handler fetches sale data via `INVENTORY_API_KEY` server-side and returns a PDF
- [ ] PDF generated with `@react-pdf/renderer`; contains:
  - Store name (from `STORE_NAME` env var)
  - Sale ID
  - Date and time
  - Staff member name
  - Line items: product name, quantity, unit price, line total
  - Subtotal, tax (rate from `TAX_RATE` env var), grand total
- [ ] Tapping "Download Invoice" / "View Invoice" triggers a browser download of the PDF
- [ ] Invoice filename: `invoice-{saleId}.pdf`
- [ ] Route is protected — unauthenticated requests return 401

---

## Functional Requirements

- **FR-1:** The `INVENTORY_API_KEY` env var must only be read in server-side code (`server actions`, `route handlers`, `lib/api.server.ts`). A lint rule or grep check must confirm it never appears in `"use client"` files.
- **FR-2:** All screens must be usable one-handed on a 375px-wide mobile screen.
- **FR-3:** The scan-to-cart action (scan → product appears in cart) must complete in under 1 second on a local dev network.
- **FR-4:** The app must pass a Lighthouse PWA audit (installable, offline-ready shell).
- **FR-5:** All interactive elements (buttons, steppers, inputs) must have a minimum 48×48px tap target.
- **FR-6:** NextAuth session tokens must be `httpOnly` cookies; `NEXTAUTH_SECRET` must be set in env.
- **FR-7:** The SQLite database file must be excluded from version control (`.gitignore`).

---

## Non-Goals

- No backend, database tables, or API routes that own data — the Inventory Service owns all inventory and sales data
- No real-time stock sync / WebSocket updates (pull-to-refresh is sufficient)
- No multi-store or multi-tenant support
- No online payment processing integration
- No customer-facing portal or customer accounts
- No barcode generation / label printing
- No bulk CSV import/export
- No email delivery of invoices (download only)
- No void/refund functionality (read-only history)

---

## Technical Considerations

- **Next.js 14+ App Router** — use `"use server"` for all Inventory API calls; `"use client"` only for interactive UI
- **SQLite** lives at `./data/store.db`; use `drizzle-orm` with SQLite adapter for type-safe queries
- **BarcodeDetector** is available on Chrome/Android; ship `zxing-js/browser` as fallback for Safari/iOS
- **Physical scanner HID mode:** scanners typically fire keystrokes at ~50ms intervals then send `Enter`; the hidden input trick handles this reliably
- **PDF:** `@react-pdf/renderer` runs in Node.js inside the route handler — no browser dependency
- **PWA caching:** cache the app shell (layout, fonts, icons) with a network-first strategy for API calls
- **Environment variables required:** `INVENTORY_API_URL`, `INVENTORY_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `STORE_NAME`, `TAX_RATE`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`

---

## Success Metrics

- Scan-to-cart latency < 1 second (p95 on local network)
- Lighthouse PWA score ≥ 90
- Zero occurrences of `INVENTORY_API_KEY` in client-side bundles (`grep` enforced)
- All 10 user stories pass `npm run typecheck && npm run lint`
- App installs successfully on Android Chrome and iOS Safari

---

## Open Questions

- What currency and locale should prices be formatted in? (Assumed USD/en-US for now)
- Should low-stock alerts (amber badge) threshold be configurable, or is 10 units fixed?
- Does the Inventory Service API paginate `listInventory`? If so, should the product list implement infinite scroll or pagination?
- Are there any rate limits on the Inventory Service API to be aware of for the scan flow?
