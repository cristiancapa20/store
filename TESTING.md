# Estado de Testing

_Última actualización: 2026-07-03_

Este documento resume la cobertura de tests agregada a la app, los bugs reales
encontrados y corregidos en el proceso, y lo que todavía falta probar.

## Infraestructura

| Herramienta | Uso | Comando |
|---|---|---|
| Vitest + msw-style mocking | Tests unitarios de server actions | `npm run test` / `npm run test:watch` |
| Playwright | E2E contra un dev server real | `npm run test:e2e` |

Config: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`.

## Cubierto y pasando (64 tests unitarios + 1 e2e golden path)

### Unit tests (Vitest)

- **`lib/actions.ts`** (`lib/actions.test.ts`) — scanBarcode, createSale,
  listInventory, addProduct, adjustStock, listSales, listStaff. Incluye
  cálculo de subtotal/total, límite de plan "basic" (500 productos), fallback
  de SKU, join de staffId con la tabla local de usuarios.
- **`app/login/actions.ts`** (`app/login/actions.test.ts`) — login exitoso,
  credenciales inválidas, cuenta suspendida, cuenta no configurada.
- **`app/register/actions.ts`** (`app/register/actions.test.ts`) —
  validaciones de formulario, email duplicado, aprovisionamiento de
  organización en la Inventory Service (éxito y fallas en cada paso),
  comportamiento distinto en dev vs producción cuando el servicio falla,
  auto-login post-registro.
- **`app/staff/actions.ts`** (`app/staff/actions.test.ts`) — alta/baja de
  empleados, límite de plan "basic" (2 usuarios), scoping por organización.
- **`app/superadmin/actions.ts`** (`app/superadmin/actions.test.ts`) —
  cambio de plan, activar/desactivar organización, control de acceso
  `super_admin`.

### E2E (Playwright)

- **`e2e/comercio-flow.spec.ts`** — flujo completo real contra el dev server
  y la Inventory Service local: registrar comercio → agregar producto →
  ajustar stock → vender → aparece en historial → agregar/eliminar staff.
  Pasa de punta a punta.

## Bugs reales encontrados y corregidos

1. **`lib/actions.ts::adjustStock()`** leía el campo `stock` de la respuesta,
   pero la Inventory Service devuelve `newStock`. El mensaje de éxito en
   `/adjust` siempre salía en blanco ("Stock actualizado a"), aunque el stock
   sí se actualizaba bien. **Corregido.**

2. **Aislamiento multi-tenant roto en `app/register/actions.ts`**:
   - El admin secret se mandaba en un header custom `x-admin-secret`, pero
     la Inventory Service (`~/dev/inventory-service/src/lib/adminAuth.ts`)
     solo acepta `Authorization: Bearer <secret>`.
   - `INVENTORY_ADMIN_SECRET` en `.env.local` era el placeholder sin
     configurar (`your-admin-secret-here`).
   - La API key emitida se leía como `key`, pero la Inventory Service
     devuelve `plainKey`.

   Resultado combinado: el aprovisionamiento de organización fallaba
   silenciosamente (en dev) y **todo comercio nuevo registrado compartía la
   location real de desarrollo** en vez de tener su propia location aislada.
   **Los tres puntos están corregidos**; verificado con e2e que un comercio
   nuevo ahora obtiene su propia location vacía.

## Efecto secundario pendiente

Durante el diagnóstico del bug de aislamiento, algunos productos/ventas de
prueba se crearon por error en tu location real de dev (antes de encontrar
el fix). Se limpiaron todos excepto uno:

- Producto **`E2E Producto 1783120965137`** (SKU `E2E-1783120965137`) con una
  venta de $9.99 asociada. La API rechaza borrar productos con ventas
  asociadas (409 Conflict) y marcarlo `isActive: false` no lo oculta del
  listado de inventario. Queda ahí, identificable por el nombre, hasta que
  decidas borrarlo manualmente (requeriría acceso directo a la base de la
  Inventory Service).

## No cubierto / sin tests todavía

- **Generación del PDF de factura** (`app/api/invoices/[saleId]/route.tsx`) —
  solo se verificó que el link de descarga aparece, no el contenido del PDF.
- **Escáner de código de barras por cámara** (`components/BarcodeInput.tsx`,
  `@zxing`) — no es fácilmente testeable en e2e automatizado sin mockear la
  cámara.
- **Páginas de perfil, guía, selector de idioma, toggle de tema** — sin
  cobertura.
- **UI de superadmin en el navegador** — solo las server actions tienen
  tests unitarios; falta un e2e que ejercite `/superadmin` desde la UI.
- **PWA / service worker** (`@ducanh2912/next-pwa`) — sin cobertura.
- **Casos de concurrencia** — dos ventas simultáneas sobre el mismo
  producto, ajustes de stock concurrentes, condiciones de carrera en
  general.
- **Componentes React aislados** (React Testing Library) — hoy toda la
  cobertura de UI pasa por el e2e de Playwright; no hay tests de componente
  para `InventoryDashboard`, `AddProductForm`, `StaffClient`, etc. por
  separado.

## Cómo correr todo

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest run (unit)
npm run test:e2e    # playwright test (requiere dev server + Inventory Service corriendo)
```
