# Store Inventory — Frontend PWA

Mobile-first Next.js PWA for in-store staff. Scan barcodes, process sales, manage products, adjust stock, and generate PDF invoices. All inventory data comes from a separate [Inventory Service](../inventory-service) — this repo is **frontend only**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Auth | NextAuth v5 — Credentials provider |
| Local DB | SQLite via `better-sqlite3` (users/auth only) |
| Barcode | `BarcodeDetector` API + `@zxing/browser` fallback |
| PDF | `@react-pdf/renderer` (server-side) |
| PWA | `@ducanh2912/next-pwa` |

---

## Project Structure

```
app/
  layout.tsx          # Root layout — sidebar (desktop) + bottom nav (mobile)
  page.tsx            # Redirect → /sell
  sell/               # Scan & sell (cart + checkout)
  products/           # Product list with stock badges
  products/new/       # Add product form (admin only)
  adjust/             # Stock adjustment
  history/            # Sales history with filters
  guide/              # In-app user manual
  login/              # Login screen
  api/
    auth/             # NextAuth route handler
    invoices/[saleId] # PDF invoice generator

components/
  BottomNav.tsx       # Responsive nav — sidebar on lg+, bottom bar on mobile
  BarcodeInput.tsx    # Camera + HID scanner component
  LogoutButton.tsx

lib/
  actions.ts          # All server actions (proxy to Inventory Service API)
  db.ts               # SQLite — users table only
  types.ts            # Shared TypeScript types

data/
  store.db            # SQLite database (gitignored)

tasks/
  prd-store-inventory-frontend.md   # Product Requirements Document
```

---

## Getting Started

### 1. Prerequisites

- Node.js 20+
- The [Inventory Service](../inventory-service) running locally
- The Inventory Service admin secret (see Inventory Service docs) — each store's
  own API key is provisioned at registration and stored per tenant, not in env

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `INVENTORY_API_URL` | Base URL of the Inventory Service including `/v1` (e.g. `http://localhost:3001/v1`) |
| `INVENTORY_ADMIN_SECRET` | Admin token used to provision a new store (organization, API key, location) on register |
| `AUTH_SECRET` | Random secret for NextAuth session encryption |
| `STORE_NAME` | Displayed on PDF invoices |
| `TAX_RATE` | Decimal tax rate for invoices (e.g. `0.10` for 10%) |
| `SUPER_ADMIN_EMAIL` | Email for the initial super admin account |
| `SUPER_ADMIN_PASSWORD` | Password for the initial super admin account |

> `INVENTORY_API_KEY` and `INVENTORY_LOCATION_ID` no longer exist. They were a
> global tenant credential that any unresolved request silently fell back to.
> The credential is per store, stored in `organizations`, and resolved from the
> session's organization — see `lib/inventoryClient.ts`.

### 4. Seed the admin user

```bash
npm run seed
```

### 5. Run in development

```bash
# Terminal 1 — Inventory Service (port 3001)
cd ../inventory-service && PORT=3001 npm run dev

# Terminal 2 — This app (port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your seed credentials.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run lint` | ESLint |
| `npm run seed` | Create admin user from env vars |

---

## Architecture Notes

### API Proxy Layer

The `INVENTORY_API_KEY` must **never reach the browser**. All calls to the Inventory Service go through Next.js server actions in `lib/actions.ts`. No `fetch` to the inventory API appears in any `"use client"` file.

### Authentication

Staff accounts live in a local SQLite database (`data/store.db`). NextAuth handles sessions via `httpOnly` cookies. The Inventory Service has no knowledge of individual staff users — it only receives an `actor_ref` (the NextAuth user ID) when recording sales.

### Barcode Scanning

`BarcodeInput` supports two modes toggled by a button:

- **Camera** — uses `BarcodeDetector` with `@zxing/browser` fallback for Safari/iOS. The component opens the device camera and detects barcodes visually in real time. Best for phones on the shop floor.
- **Scanner** — designed for physical USB or Bluetooth barcode scanners (the "gun" style readers). These devices emulate a keyboard: when aimed at a barcode they fire the digits very quickly and send an Enter keystroke. The component keeps a hidden `<input>` focused to capture that keystroke stream. The on-screen message *"Listo para escanear"* confirms the hidden input is active and waiting. If your store doesn't use a physical reader, this mode is not needed — Camera or the product search input are the alternatives.

The **product search input** on the Sell screen is a third option: type a product name or SKU and select from the dropdown. Useful on desktop where there is no scanner and the camera is inconvenient.

### Sales History

Sales are fetched from `GET /v1/sales` on the Inventory Service. Staff names are resolved locally by matching the `actorRef` (NextAuth user ID) against the SQLite users table.

### PDF Invoices

Generated server-side via `GET /api/invoices/[saleId]` using `@react-pdf/renderer`. The route is protected — unauthenticated requests return 401.

### Responsive Layout

- **Mobile** (`< 1024px`): fixed bottom navigation bar, `max-w-md` content
- **Desktop** (`≥ 1024px`): fixed 224px sidebar, full-width content area at 80% with `mx-auto`

---

## Environment File Reference

```env
# Inventory Service
INVENTORY_API_URL=http://localhost:3001/v1
INVENTORY_ADMIN_SECRET=<admin-secret>

# NextAuth
AUTH_SECRET=<random-secret>

# Store
STORE_NAME=My Store
TAX_RATE=0.10

# Super admin seed
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=changeme123
```

> Never commit `.env.local`. It is already in `.gitignore`.
