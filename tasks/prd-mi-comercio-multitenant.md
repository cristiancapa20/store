# PRD: Mi Comercio — Multi-tenant SaaS + Diseño SaaS

## Problem Statement

The Store Inventory app currently works as a single-tenant POS: one hardcoded API key and location ID in `.env.local`, one set of staff users in SQLite, and no way for new businesses to sign up. There is no landing page to explain the product, no way for the platform owner to see which businesses are using it, and the visual design doesn't reflect the premium SaaS identity the product needs to compete.

The result: the app can only serve one business at a time, requires manual setup for every new client, and has no self-service onboarding.

## Solution

Convert the Store Inventory app into "Mi Comercio" — a multi-tenant SaaS platform where:

- Any business can self-register and immediately get a working POS connected to the Inventory Service.
- Each business's data is fully isolated via their own Inventory Service Organization and API key.
- The platform owner (super_admin) can view all registered businesses and manage their plan and status.
- Store admins can manage their own staff within their plan limits.
- A public landing page markets the product and drives registrations.
- The visual design adopts a premium dark-first SaaS aesthetic using neutral dark tokens.

## User Stories

### Landing & Registration

1. As a prospective business owner, I want to see a landing page for Mi Comercio, so that I can understand what the product offers before signing up.
2. As a prospective business owner, I want to see pricing plans (Básico $9/mes, Pro $19/mes) on the landing page, so that I can evaluate the cost before registering.
3. As a prospective business owner, I want a "Registrarse" button that takes me to the registration form, so that I can start the onboarding process.
4. As a prospective business owner, I want to fill a registration form with my store name, my name, email, phone, address, and password, so that my business account is created.
5. As a prospective business owner, I want the registration to fail with a clear error if the inventory service is unavailable, so that I know my account was not partially created.
6. As a prospective business owner, I want to be automatically logged in and redirected to `/sell` after successful registration, so that I can start using the app immediately.
7. As a returning business owner, I want a "Iniciar sesión" link on the landing page, so that I can quickly access my account.
8. As any visitor, I want to switch between Spanish and English on the landing page, so that I can read it in my preferred language.
9. As any visitor, I want to toggle dark/light mode on the landing page, so that I can read it comfortably.

### Multi-tenant — Business Owner (Admin)

10. As a store admin, I want my session to carry my organization's Inventory API key and location ID, so that all POS operations use my store's data.
11. As a store admin, I want to be blocked at login with "Cuenta suspendida" if my organization is inactive, so that I understand why I can't access the app.
12. As a store admin, I want to see my current plan (Básico/Pro) in the sidebar, so that I always know what tier I'm on.
13. As a store admin on the Básico plan, I want to see an "Mejorar a Pro" CTA in the sidebar, so that I can easily upgrade.
14. As a store admin on the Pro plan, I want to see a "Plan Pro ✓" indicator in the sidebar, so that I know my account is fully unlocked.
15. As a store admin, I want to be blocked from adding a product if my organization has 500 or more products on the Básico plan, so that the plan limits are enforced.

### Multi-tenant — Staff Management

16. As a store admin, I want to view all staff members in my organization, so that I can see who has access to the POS.
17. As a store admin, I want to create a new staff member (name, email, password), so that employees can log in.
18. As a store admin on the Básico plan, I want to be blocked from creating a third staff member, so that the 2-user limit is enforced.
19. As a store admin, I want to delete a staff member, so that I can revoke access when someone leaves.
20. As a staff member, I want to log in and access only the POS and inventory views (not staff management), so that my access is scoped to my role.

### Super Admin

21. As the super_admin, I want to be redirected to `/superadmin` after login, so that I land on my management dashboard.
22. As the super_admin, I want to see a list of all registered organizations with their name, email, plan, status, number of employees, and registration date, so that I can monitor platform usage.
23. As the super_admin, I want to suspend an active organization, so that I can cut off access for non-paying clients.
24. As the super_admin, I want to reactivate a suspended organization, so that I can restore access after payment.
25. As the super_admin, I want to change an organization's plan between Básico and Pro, so that I can reflect their subscription tier.
26. As the super_admin, I want to be blocked from accessing `/sell`, `/products`, or any store-facing route, so that my account is clearly scoped to platform management.
27. As the super_admin, I want my dashboard to use a minimal layout without the BottomNav, so that the interface is appropriate for management tasks.

### Design System

28. As a store user, I want the app to use a premium dark SaaS design (neutral dark backgrounds, high-contrast text, clean borders), so that the tool feels professional.
29. As a store user, I want a clean light mode that inverts the dark palette (white surfaces, soft borders, same blue accent), so that the app is readable in bright environments.
30. As a store user on desktop, I want to see dense data tables with colored status badges and pagination for product lists and sales history, so that I can scan more information at once.
31. As a store user on mobile, I want to continue seeing card-based layouts for products and sales, so that the POS experience remains thumb-friendly.

## Implementation Decisions

### Modules

**1. Database layer (`lib/db.ts`)**
Single deep module that owns all schema initialization and migrations. On startup it:
- Creates the `organizations` table if absent.
- Migrates the `users` table to add `organization_id` and expand the role constraint to include `super_admin`.
- Auto-seeds the `super_admin` user from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` env vars using `bcrypt.hashSync`.

Schema shape (from design session):
```
organizations: id, name, email, phone, address, plan, status,
               inventory_org_id, inventory_api_key, inventory_location_id, created_at
users:         id, name, email, password_hash,
               role (admin|staff|super_admin), organization_id FK
```

Users with `organization_id = NULL` and role `admin|staff` are treated as misconfigured and receive a login error.

**2. Inventory client (`lib/inventoryClient.ts`)**
Extracted from `lib/actions.ts`. Encapsulates:
- `getInventoryConfig()` — reads `inventoryApiKey` + `inventoryLocationId` from the NextAuth session, falling back to env vars for backward compatibility.
- `apiFetch<T>()` — single fetch wrapper using the above config.

This separation means `lib/actions.ts` never reads `process.env` directly for credentials.

**3. Registration action (`app/register/actions.ts`)**
Orchestrates the full provisioning flow atomically:
1. Validate form inputs.
2. Check email uniqueness in both `users` and `organizations`.
3. Call Inventory Service admin endpoints in sequence: create Organization → create API key → create Location.
4. If any inventory call fails → return error, write nothing to SQLite.
5. On success → INSERT `organizations`, INSERT `users`, call `signIn`.

Uses `INVENTORY_ADMIN_SECRET` env var for the `x-admin-secret` header.

**4. Super admin actions (`app/superadmin/actions.ts`)**
Two server actions: `toggleOrgStatus(orgId)` and `changeOrgPlan(orgId, plan)`. Both verify the caller is `super_admin` before writing, then call `revalidatePath("/superadmin")`.

**5. Staff actions (`app/staff/actions.ts`)**
`createStaff(formData)` and `deleteStaff(userId)`. `createStaff` checks plan limits (Básico: max 2 users) before inserting. Both scope queries to the caller's `organization_id` from session.

**6. Auth layer (`auth.ts` + `auth.config.ts`)**
`authorize` performs a `LEFT JOIN organizations` to load `inventory_api_key`, `inventory_location_id`, `status`, and `plan` into the JWT. Routing rules in `authorized` callback:
- Public routes: `/`, `/register`, `/api/auth/*`
- `super_admin` → only `/superadmin`
- `admin|staff` → blocked from `/superadmin`
- Inactive org → login error
- Null `organization_id` on non-super_admin → login error

**7. Design system (`app/globals.css`)**
New semantic CSS custom properties (`--bg-base`, `--bg-surface`, `--bg-sidebar`, `--bg-elevated`, `--border-color`, `--text-primary`, `--text-muted`) defined for both dark and light modes. All `.ui-*` classes updated to reference these tokens instead of hard-coded `brand-*` shades.

Dark palette: near-black neutral (`#0f0f13` base, `#1c1c28` surface).
Light palette: white/gray clean inverse (`#f8f9fa` base, `#ffffff` surface).
Accent `brand-600 = #4a5cba` unchanged in both modes.

**8. Plan card component (`components/PlanCard.tsx`)**
Sidebar-bottom card. Props: `plan: 'basic' | 'pro'`, `role: string`. Renders upgrade CTA for `admin` on Básico, "Plan Pro ✓" chip on Pro, nothing for `staff`.

**9. Responsive table pattern**
New `.ui-table` CSS component class. Mobile: hidden, replaced by `.ui-card` list. Desktop (`lg:`): visible dense table with `<thead>`, `<tbody>`, column-aligned badges. Applied first to Products and Sales History pages.

**10. Landing page (`app/page.tsx`)**
Server component. Uses `next-intl` translations under the `landing` namespace (es + en). Sections: Navbar → Hero → Features (6 cards) → Cómo funciona (3 steps) → Planes pricing table → CTA → Footer. No app shell — rendered as raw children by layout when unauthenticated.

### Auth session shape
```typescript
session.user: {
  id, name, email, role,
  organizationId, inventoryApiKey, inventoryLocationId,
  organizationStatus, organizationPlan
}
```

### Plan limits enforcement
Checked server-side in actions, not in middleware. Returns a typed `ActionError` with a user-facing message when the limit is hit. The client surfaces this like any other action error.

### ENV vars added
```
SUPER_ADMIN_EMAIL      — super_admin login email
SUPER_ADMIN_PASSWORD   — super_admin login password
INVENTORY_ADMIN_SECRET — x-admin-secret header for /v1/admin/* endpoints
```

### No changes to `dev/inventory`
All provisioning is done by calling the Inventory Service's existing admin API endpoints. The inventory repo is not modified.

## Testing Decisions

The project has no automated test suite (`CLAUDE.md`: "Toda validación se hace con lint + typecheck + prueba manual en el navegador"). This remains unchanged for this iteration.

**Quality gates before shipping each module:**
- `npm run typecheck` — must pass with zero errors after every file change.
- `npm run lint` — must pass.
- Manual browser verification for each user story.

**If a test suite is added in the future, priority order for coverage:**
1. `registerAction` — most complex, multi-step, highest risk of partial failures.
2. `createStaff` / plan limit logic — pure business rule, easy to unit test.
3. `getInventoryConfig` — verifies session-first, env-fallback behavior.
4. Auth routing rules in `authorized` callback — tabular test cases per role × route.

## Out of Scope

- **Charts / KPI graphs** — deferred; KPI cards show numbers only for now.
- **Billing / payment integration** — plan changes are manual (super_admin toggles them). No Stripe.
- **Email notifications** — no "welcome" email, no "account suspended" email.
- **Password reset flow** — not included; admin resets staff passwords manually.
- **Multiple locations per organization** — the registration flow creates one location ("Principal"). Multi-location UI is a future epic.
- **Public API access (Scenario 3)** — businesses with existing webs consuming the Inventory API directly. Out of scope for this PRD.
- **Inventory data visibility for super_admin** — the super_admin sees only organization metadata, never inventory or sales data.
- **App Store / Google Play distribution** — PWA install only.

## Further Notes

- The `dev/store` SQLite file lives at `data/store.db`. The migration in `lib/db.ts` runs synchronously at server startup — no separate migration CLI needed.
- The `scripts/seed.ts` is rewritten to create only the `super_admin`. Existing `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` vars are replaced by `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`. Document this breaking change in `.env.local` comments.
- The Inventory Service must be running for registration to succeed (Scenario A). In local dev, start `dev/inventory` before testing the register flow.
- `bcrypt.hashSync` is used in `lib/db.ts` for the super_admin auto-seed (synchronous context). This is acceptable — it runs once per cold start and only when the user doesn't yet exist.
