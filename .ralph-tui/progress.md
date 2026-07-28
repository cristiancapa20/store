# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Límites de paginación del servicio**: `lib/pagination.ts` exporta `INVENTORY_MAX_LIMIT` (100, el `MAX_LIMIT` del servicio) y `clampInventoryLimit()`. Los componentes cliente importan la constante; `listInventory` (server action) además recorta el `limit` recibido, así ninguna ruta puede provocar un 422 por límite. Es un módulo plano (sin `"use server"` ni `auth`), por eso puede importarse desde `"use client"`.
- **Errores de acción con código**: `ActionError` es `{ error: string; code?: ActionErrorCode }`. `scanBarcode` marca `code: "not_found"` solo cuando el servicio responde `found:false`; cualquier otro fallo (422, red, auth) llega sin código. La UI debe ramificar por `result.code`, nunca por el texto del error.
- **i18n**: toda cadena visible va en `messages/es.json` y `messages/en.json` con las mismas claves. Verificación rápida de paridad:
  `node -e "const es=require('./messages/es.json'),en=require('./messages/en.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v,p+k+'.'):[p+k]);const a=new Set(f(es)),b=new Set(f(en));console.log([...a].filter(k=>!b.has(k)),[...b].filter(k=>!a.has(k)))"`

---

## 2026-07-28 - US-012: Dejar de solicitar límites por encima del máximo del servicio

**Implementado**

- Nuevo `lib/pagination.ts`: `INVENTORY_MAX_LIMIT = 100` + `clampInventoryLimit()`.
- `listInventory` recorta el `limit` antes de construir la URL (defensa por si alguna llamada futura vuelve a pedir de más).
- Las tres pantallas vivas piden `INVENTORY_MAX_LIMIT` en lugar de 500 / 200.
- Truncamiento visible al usuario (AC 3):
  - Venta: nota bajo el buscador cuando `total > productos cargados` (`sell.catalogTruncated`) y mensaje de error si el catálogo no carga (`sell.catalogLoadFailed`, antes se tragaba el error en silencio).
  - Ajuste: aviso `adjust.searchTruncated` y error `adjust.searchFailed` (antes también silencioso).
  - Panel de inventario: banner `inventory.partialCatalog` avisando de que KPIs y tabla solo cubren la página cargada.
- 422 ≠ «producto no encontrado» (AC 4): `ActionError` gana `code?: "not_found"`; `scanBarcode` solo lo marca cuando el servicio responde `found:false`. Venta y ajuste ramifican por `code`. De paso, `app/adjust/page.tsx` dejaba de estar traducido ahí: mostraba `Product not found: ${error}` hardcodeado en inglés.
- **Decisión sobre `app/products/ProductList.tsx`: eliminado.** Es código muerto — nadie lo importa (`app/products/page.tsx` renderiza `InventoryDashboard`); mantenerlo obligaría a duplicar el aviso de truncamiento en una pantalla inalcanzable. Con él se retiran sus claves huérfanas `products.outOfStock` y `products.inStock` (ningún otro componente las usa; `sell.outOfStock` es una clave distinta y sigue en uso).

**Archivos**

- Nuevos: `lib/pagination.ts`, `lib/pagination.test.ts`
- Modificados: `lib/actions.ts`, `lib/types.ts`, `lib/actions.test.ts`, `app/sell/page.tsx`, `app/adjust/page.tsx`, `app/products/InventoryDashboard.tsx`, `messages/es.json`, `messages/en.json`
- Eliminado: `app/products/ProductList.tsx`

**Validación**: `npm run typecheck`, `npm run lint`, `npm test` (71 pruebas) y `npm run build` en verde. No hubo verificación visual contra el servicio real: ni el servicio de inventario (3001) ni el dev server (3000) estaban levantados en esta sesión.

**Learnings**

- `lib/actions.ts` es `"use server"`: solo puede exportar funciones async. Cualquier constante compartida con componentes cliente necesita su propio módulo plano (de ahí `lib/pagination.ts`), y ese módulo no debe importar `auth`/`db` o arrastraría código de servidor al bundle.
- `lib/inventoryClient.ts` define su propio `ActionError` duplicando el de `lib/types.ts`. Añadir `code` opcional en `types.ts` sigue siendo compatible porque `apiFetch` devuelve un objeto estructuralmente asignable, pero conviene saber que hay dos definiciones divergiendo.
- Las pruebas afirmaban `toEqual({ error: "Product not found" })`; `toEqual` es estricto con las claves nuevas, así que añadir `code` las rompe. Actualizadas dentro de esta historia, no relajadas.
- La búsqueda de `app/adjust/page.tsx` sigue pidiendo el inventario **en cada pulsación** y filtrando en memoria; con el tope de 100 el problema de fondo (catálogos grandes) solo queda avisado, no resuelto. Es exactamente lo que cierra US-010 (parámetro `name` del servicio + paginación real).
- Los KPIs de `InventoryDashboard` (valor de inventario, stock bajo, desglose) se calculan sobre los productos cargados, mientras que «Total Productos» viene del `total` del servicio: siguen discrepando por diseño hasta US-010; el banner nuevo lo hace explícito en lugar de disimularlo.

---
