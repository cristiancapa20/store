# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Límites de paginación del servicio**: `lib/pagination.ts` exporta `INVENTORY_MAX_LIMIT` (100, el `MAX_LIMIT` del servicio) y `clampInventoryLimit()`. Los componentes cliente importan la constante; `listInventory` (server action) además recorta el `limit` recibido, así ninguna ruta puede provocar un 422 por límite. Es un módulo plano (sin `"use server"` ni `auth`), por eso puede importarse desde `"use client"`.
- **Importes como cadenas decimales**: el servicio serializa todo importe como cadena (`"350.00"`), nunca como número JSON. `lib/decimal.ts` exporta el tipo `ApiDecimal` (`string | number | null | undefined`) y `parseDecimal()`. Toda forma `Api*` de `lib/actions.ts` tipa sus importes como `ApiDecimal` y convierte **una sola vez en el borde** con `parseDecimal`; de ahí para dentro (`Product`, `Sale`, `SaleItem`) todo es `number`. Nunca propagar la cadena a la UI: `"350".toFixed()` lanza y `sum + "10.00"` concatena en silencio.
- **Credenciales fuera de la sesión**: NextAuth v5 sirve el objeto de sesión **descifrado** en `GET /api/auth/session`, ruta excluida del matcher de `proxy.ts`. Todo lo que el callback `session` asigne es legible desde el navegador. Los secretos se quedan en el token JWT (cifrado) y el servidor los resuelve bajo demanda: la sesión solo lleva `organizationId`, y `getInventoryConfig()` (`lib/inventoryClient.ts`) lo usa para leer `inventory_api_key`/`inventory_location_id` de la tabla `organizations`. `types/next-auth.d.ts` declara los campos en `Session`, `User` y `JWT` por separado — quitarlos de `Session` y dejarlos en las otras dos hace que `tsc` señale cualquier consumidor que siguiera leyéndolos de la sesión.
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

## 2026-07-28 - US-005: Tratar los importes de la API como cadenas decimales

**Implementado**

- Nuevo `lib/decimal.ts`: tipo `ApiDecimal = string | number | null | undefined` y `parseDecimal(value, fallback = 0)`, que convierte una sola vez en el borde y descarta `NaN`/`Infinity`.
- `ApiScanResult.price` pasa a `string | null` (contrato real del servicio) y `scanBarcode` devuelve `parseDecimal(result.price)`. Esto era el TypeError: `"350".toFixed is not a function` en `app/sell/page.tsx:487` tras **cualquier** escaneo con éxito.
- `ApiSaleResponse` (`total`, `items[].unitPrice`, `items[].lineTotal`) y el `ApiSale` de `listSales` se tipan como `ApiDecimal`. `listSales` convertía nada: `total`, `unitPrice` y `lineTotal` llegaban como cadenas a `app/history/page.tsx:316` (`sale.total.toFixed(2)`) y a la factura PDF (`app/api/invoices/[saleId]/route.tsx:121`), y `subtotal` se calculaba con `sum + "10.00"` → concatenación de cadenas. Ahora todo pasa por `parseDecimal`.
- `createSale`: el `typeof result.total === "string" ? parseFloat(...) : ...` inline se sustituye por `parseDecimal`. Sigue construyendo las líneas desde el carrito local (el servicio no devuelve `productName`), pero el carrito ya trae números reales.
- `listInventory`: `parseFloat(item.price)` → `parseDecimal(item.price)`, así un precio nulo o corrupto da 0 en vez de `NaN`.
- Pruebas: el fixture de escaneo usa `"350.00"` en vez de `null`; nueva prueba que asevera `typeof price === "number"`, `price.toFixed(2)` y `price * 2`; nueva prueba de `listSales` con `total`/`unitPrice`/`lineTotal` como cadenas; `lib/decimal.test.ts` cubre el helper.

**Archivos**

- Nuevos: `lib/decimal.ts`, `lib/decimal.test.ts`
- Modificados: `lib/actions.ts`, `lib/actions.test.ts`

**Validación**: `npm run typecheck`, `npm run lint` y `npm test` (77 pruebas) en verde. Sin verificación visual: el servicio de inventario (3001) no estaba levantado en esta sesión.

**Learnings**

- Los fixtures que simulan `apiFetch` son el contrato de facto: si un fixture usa `null` o `number` donde el servicio manda `"350.00"`, el tipado miente y las pruebas pasan igual. Al tocar una forma `Api*`, revisar el fixture antes que el tipo.
- La ruta de búsqueda no fallaba solo porque `listInventory` era la **única** que convertía; el bug llevaba escondido en `scanBarcode` y `listSales` desde el principio. Cuando una conversión aparece en un solo mapeo, sospechar de los hermanos.
- `subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0)` con cadenas no lanza: devuelve `"010.0010.00"`. Los fallos por cadenas decimales se manifiestan tarde y en otra pantalla; convertir en el borde es lo que evita rastrearlos.

---

## 2026-07-28 - US-001: Retirar la API key de inventario del objeto de sesión

**Implementado**

- `auth.config.ts`, callback `session`: dejan de copiarse `inventoryApiKey` e `inventoryLocationId`. El callback `jwt` los sigue guardando en el token (cifrado). `organizationId` permanece en sesión.
- `types/next-auth.d.ts`: ambos campos salen de `Session`; se conservan en `User` (alimenta el callback `jwt`) y en `JWT`. Así el compilador señala cualquier uso restante — que era exactamente uno.
- `lib/inventoryClient.ts`: `getInventoryConfig()` ya no lee la credencial de la sesión; la resuelve contra `organizations` con el `organizationId` de la sesión (`SELECT inventory_api_key, inventory_location_id FROM organizations WHERE id = ?`). Se mantiene el fallback a `INVENTORY_API_KEY` / `INVENTORY_LOCATION_ID` cuando no hay organización (super_admin) o la organización no tiene credencial guardada, igual que antes.
- Pruebas nuevas: `auth.config.test.ts` (el token conserva la credencial, el JSON de sesión no contiene `inv_live_`, `organizationId` sigue) y `lib/inventoryClient.test.ts` (resolución por `organizationId`, una `inventoryApiKey` inyectada en el objeto de sesión se ignora, y los tres fallbacks a env).

**Archivos**

- Nuevos: `auth.config.test.ts`, `lib/inventoryClient.test.ts`
- Modificados: `auth.config.ts`, `types/next-auth.d.ts`, `lib/inventoryClient.ts`

**Validación**: `npm run typecheck`, `npm run lint`, `npm test` (85 pruebas) y `npm run build` en verde.

Verificación en vivo de AC 5: dev server levantado, login por `POST /api/auth/callback/credentials` con `admin@example.com`, y `GET /api/auth/session` devuelve

```json
{"user":{"name":"Admin","email":"admin@example.com","id":"616ac95f-…","role":"admin","organizationId":"bb07c46f-…","organizationName":"tiendita","organizationStatus":"active","organizationPlan":"basic"},"expires":"…"}
```

sin `inventoryApiKey` ni `inventoryLocationId`. Matiz honesto: ninguna organización de la DB de desarrollo tiene `inventory_api_key` (todas `null`), así que la ausencia de la cadena `inv_live_` no probaba nada por sí sola; lo que se comprueba arriba es lo más fuerte — los campos no aparecen en absoluto. `/profile`, `/products` y `/sell` responden 200 con la resolución nueva (el servicio de inventario no estaba levantado, así que las llamadas a la API fallan igual que antes; no es regresión).

**Learnings**

- Quitar el campo del tipo `Session` es lo que convierte el cambio en verificable: `tsc` localizó el único consumidor real (`lib/inventoryClient.ts:10`). Sin ese paso el borrado del callback habría roto la app en runtime en vez de en compilación.
- El puerto 3001 está reservado al servicio de inventario (`INVENTORY_API_URL`). Si el 3000 está ocupado, `next dev` se muda al 3001 y la app se apunta a sí misma como servicio de inventario. En esta máquina el 3000 lo tiene tomado un proceso de Cursor sobre `127.0.0.1`, así que conviene fijar `next dev -p <puerto libre>` antes de verificar nada contra la API.
- `lib/inventoryClient.ts` ya arrastraba `db` de forma transitiva vía `@/auth`, así que importarlo explícitamente no añade peso al bundle ni toca el edge runtime del middleware (`proxy.ts` solo importa `auth.config`, nunca `inventoryClient`).
- `lib/actions.test.ts` mockea `./inventoryClient` entero, de modo que cambiar cómo se resuelve la credencial no afecta a esas 77 pruebas. El coste es que ninguna cubría la resolución; de ahí `lib/inventoryClient.test.ts`.
- Al mockear `auth` de NextAuth v5 con `vi.mocked(...)`, `mockResolvedValue` choca con la sobrecarga de `NextMiddleware`: hace falta `as never`, tal como ya hacía `lib/actions.test.ts`.

---
