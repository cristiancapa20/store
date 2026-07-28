# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Límites de paginación del servicio**: `lib/pagination.ts` exporta `INVENTORY_MAX_LIMIT` (100, el `MAX_LIMIT` del servicio) y `clampInventoryLimit()`. Los componentes cliente importan la constante; `listInventory` (server action) además recorta el `limit` recibido, así ninguna ruta puede provocar un 422 por límite. Es un módulo plano (sin `"use server"` ni `auth`), por eso puede importarse desde `"use client"`.
- **Importes como cadenas decimales**: el servicio serializa todo importe como cadena (`"350.00"`), nunca como número JSON. `lib/decimal.ts` exporta el tipo `ApiDecimal` (`string | number | null | undefined`) y `parseDecimal()`. Toda forma `Api*` de `lib/actions.ts` tipa sus importes como `ApiDecimal` y convierte **una sola vez en el borde** con `parseDecimal`; de ahí para dentro (`Product`, `Sale`, `SaleItem`) todo es `number`. Nunca propagar la cadena a la UI: `"350".toFixed()` lanza y `sum + "10.00"` concatena en silencio.
- **Credenciales fuera de la sesión**: NextAuth v5 sirve el objeto de sesión **descifrado** en `GET /api/auth/session`, ruta excluida del matcher de `proxy.ts`. Todo lo que el callback `session` asigne es legible desde el navegador. Los secretos se quedan en el token JWT (cifrado) y el servidor los resuelve bajo demanda: la sesión solo lleva `organizationId`, y `getInventoryConfig()` (`lib/inventoryClient.ts`) lo usa para leer `inventory_api_key`/`inventory_location_id` de la tabla `organizations`. `types/next-auth.d.ts` declara los campos en `Session`, `User` y `JWT` por separado — quitarlos de `Session` y dejarlos en las otras dos hace que `tsc` señale cualquier consumidor que siguiera leyéndolos de la sesión.
- **Sin respaldo global de tenant**: `getInventoryConfig()` (`lib/inventoryClient.ts`) **lanza** `InventoryConfigError` si falta `INVENTORY_API_URL`, si la sesión no resuelve `organizationId`, o si la organización no tiene `inventory_api_key` **y** `inventory_location_id`. No existen `INVENTORY_API_KEY` ni `INVENTORY_LOCATION_ID` en el entorno: eran una credencial única y cualquier petición sin organización terminaba operando sobre esa tienda. Solo `INVENTORY_API_URL` (URL base, no credencial) e `INVENTORY_ADMIN_SECRET` (aprovisionamiento en el registro) siguen en env. El módulo importa `server-only`, así que importarlo desde un `"use client"` rompe el build. Como la función lanza, toda llamada debe estar **dentro** del `try` que la cubre.
- **Errores de acción con código**: `ActionError` es `{ error: string; code?: ActionErrorCode }` con `ActionErrorCode = "not_found" | "unauthorized" | "forbidden"`. `scanBarcode` marca `not_found` solo cuando el servicio responde `found:false`; los códigos de autorización los ponen los guardias de `lib/authz.ts`; cualquier otro fallo (422, red) llega sin código. La UI debe ramificar por `result.code`, nunca por el texto del error.
- **Autorización dentro de cada server action**: los server actions se despachan por identificador `Next-Action` con POST contra **cualquier** ruta, incluidas las que `auth.config.ts` deja públicas (`/`, `/register`), así que el middleware nunca los ve. `lib/authz.ts` (importa `server-only`) exporta `requireSession()` y `requireAdmin()`, que **devuelven** `Authorized | ActionError` en vez de lanzar. Toda acción exportada de `lib/actions.ts` empieza con `const gate = await requireX(); if ("error" in gate) return gate;` y lee la identidad de `gate.user` en lugar de volver a llamar a `auth()`. Efecto secundario en los tipos: una acción que antes devolvía un valor desnudo (`listStaff`, `getInvoicePreviewInfo`) pasa a `ActionResult<T>` y `tsc` señala a sus consumidores.
- **Mensaje de error traducido en el cliente**: los server actions no tienen contexto de locale, así que devuelven el código y la UI resuelve el texto con `useActionErrorMessage()` (`lib/useActionErrorMessage.ts`, módulo `"use client"`): devuelve `t("errors."+code)` para `unauthorized`/`forbidden` y `result.error` para el resto. Añadir el hook a un componente obliga a incluirlo en las dependencias de sus `useCallback`/`useEffect` (`eslint react-hooks/exhaustive-deps` está activo).
- **Toda lectura de `users` filtra por organización**: `users` es una tabla multi-tenant; cualquier `SELECT` sin `WHERE organization_id = ?` expone los usuarios de todas las tiendas, incluido el superadministrador (que no pertenece a ninguna). El `organizationId` sale de `gate.user` (guardia de `lib/authz.ts`) en server actions y de `session.user` en componentes de servidor (`app/staff/page.tsx:15`). Está tipado `string | null | undefined`, así que hay que cortocircuitar con lista vacía **antes** de la consulta: better-sqlite3 lanza si se le pasa `undefined` como parámetro, y el fallo acabaría en el `catch` genérico confundiendo «sin organización» con «BD caída». Al aseverar esto en pruebas, comprobar el SQL **y** el argumento de `all()`; solo el texto del SQL deja pasar un binding olvidado.
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

## 2026-07-28 - US-002: Resolver la configuración de inventario desde el token, sin recurso al entorno

**Implementado**

- `lib/inventoryClient.ts`: `getInventoryConfig()` deja de tener respaldo por entorno. Ahora (1) exige `INVENTORY_API_URL` y lanza si falta, (2) resuelve `organizationId` con `auth()` y lanza `InventoryConfigError` si no hay sesión u organización, (3) exige que la fila de `organizations` traiga `inventory_api_key` **y** `inventory_location_id`, y lanza nombrando la organización si falta alguno. Devuelve `InventoryConfig` (tipo exportado) con los tres campos ya garantizados no vacíos.
- `import "server-only"` en la cabecera del módulo (paquete `server-only` añadido a `dependencies`). Verificado en vivo: una `page.tsx` con `"use client"` que importa `getInventoryConfig` rompe `npm run build` con `'server-only' cannot be imported from a Client Component module`.
- `app/profile/page.tsx`: la llamada a `getInventoryConfig()` se mueve **dentro** del `try` de `fetchLocation()`. Sin ese cambio, una organización sin credencial convertía el indicador «API: desconectado» en una página rota. Ahora falla cerrado y muestra «desconectado».
- `vitest.config.ts`: alias `server-only` → `node_modules/server-only/empty.js`. `vitest.setup.ts`: se retiran las siembras de `INVENTORY_API_KEY` e `INVENTORY_LOCATION_ID`.
- Nuevo `.env.example` (solo `INVENTORY_API_URL`, `INVENTORY_ADMIN_SECRET`, `AUTH_SECRET`, `STORE_NAME`, `TAX_RATE`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`). `CLAUDE.md` y `README.md`: la instrucción de arranque pasa de `cp .env.local.example .env.local` (fichero inexistente) a `cp .env.example .env.local`, se actualizan las tablas de variables y se anota por qué se retiraron `INVENTORY_API_KEY` e `INVENTORY_LOCATION_ID`. De paso, `SEED_ADMIN_*` documentado no existía: `scripts/seed.ts` usa `SUPER_ADMIN_*`.
- `lib/inventoryClient.test.ts`: las tres pruebas de respaldo por entorno se invierten. Ahora los env vars se siembran a propósito en `beforeEach` con valores centinela y cada caso sin organización resuelta asevera `rejects.toThrow()`; se añaden los casos de sesión nula, credencial parcial (clave sin ubicación) y `INVENTORY_API_URL` ausente.

**Archivos**

- Nuevos: `.env.example`
- Modificados: `lib/inventoryClient.ts`, `lib/inventoryClient.test.ts`, `app/profile/page.tsx`, `vitest.config.ts`, `vitest.setup.ts`, `CLAUDE.md`, `README.md`, `package.json`, `package-lock.json`

**Validación**: `npm run typecheck`, `npm run lint`, `npm test` (89 pruebas) y `npm run build` en verde.

**Pendiente (fuera del alcance de esta historia)**: `app/register/actions.ts:53-120` sigue guardando la organización con `inventory_api_key = NULL` cuando el aprovisionamiento falla fuera de producción. Ya no es una fuga entre tiendas — ahora esas cuentas fallan al tocar inventario — pero el registro en desarrollo produce una tienda inservible sin decirlo. Merece historia propia.

**Learnings**

- `server-only` no venía instalado y **no** es una dependencia transitiva de Next 16; hay que añadirlo explícitamente. En Vitest (condición `node`, no `react-server`) su `index.js` lanza al importarse, así que cualquier módulo que lo importe rompe las pruebas hasta que se aliasa a `node_modules/server-only/empty.js` — el propio paquete publica ese módulo vacío, no hace falta escribir un stub.
- Al quitar un respaldo, borrar la variable de entorno del `setup` de pruebas **debilita** la prueba: el caso pasaría igual si el respaldo siguiera ahí. Lo correcto es lo contrario — sembrar el env con un centinela y aseverar que aun así lanza.
- Un `await` fuera del `try` es una bomba de relojería cuando la función pasa de devolver valores vacíos a lanzar. `app/profile/page.tsx` ya tenía el `try/catch` correcto; solo estaba una línea más abajo de donde hacía falta. Al convertir una función en lanzadora, revisar cada llamada por si el `catch` la cubre de verdad.
- Ejecutar `npm run build` reescribe `next-env.d.ts` (`./.next/dev/types/…` → `./.next/types/…`) frente a lo que deja `next dev`. Es ruido en el diff: conviene `git checkout -- next-env.d.ts` después de compilar.

---

## 2026-07-28 - US-003: Exigir sesión y rol en todos los server actions

**Implementado**

- Nuevo `lib/authz.ts` (con `import "server-only"`): `requireSession()` y `requireAdmin()`. Siguen el patrón de `app/staff/actions.ts:9-13` (una llamada a `auth()`, comparación de rol contra `"admin"`) pero **devuelven** `Authorized | ActionError` en lugar de lanzar, para que la UI reciba un error controlado y no una excepción del server action.
- `lib/types.ts`: `ActionErrorCode` pasa de `"not_found"` a `"not_found" | "unauthorized" | "forbidden"`.
- `lib/actions.ts`: las ocho acciones exportadas abren con un guardia. `requireSession()` en `scanBarcode`, `createSale`, `listInventory`, `listSales`, `listStaff` y `getInvoicePreviewInfo`; `requireAdmin()` en `addProduct` y `adjustStock`. Se elimina el `import { auth }`: la identidad (`id`, `name`, `organizationPlan`) sale de `gate.user`, así no se resuelve la sesión dos veces.
- Cambios de firma forzados por el guardia: `listStaff` pasa de `{id,name}[]` a `ActionResult<{id,name}[]>` y `getInvoicePreviewInfo` a `ActionResult<{storeName,taxRate,staffName}>`. `tsc` señaló sus dos consumidores (`app/history/page.tsx:138`, `app/sell/page.tsx:241`), ambos actualizados.
- i18n: nuevo espacio `errors` (`unauthorized`, `forbidden`) en `messages/es.json` y `messages/en.json`, y nuevo hook `lib/useActionErrorMessage.ts` que traduce el código o cae al `error` del servicio. Adoptado en `app/sell/page.tsx`, `app/adjust/page.tsx`, `app/products/InventoryDashboard.tsx` y `app/products/new/AddProductForm.tsx`.
- `components/BottomNav.tsx`: la pestaña `/adjust` se marca `adminOnly: true`. Ver la nota de criterio más abajo.
- Pruebas: la que aseveraba que `createSale` funcionaba sin sesión (`falls back to 'unknown'/'Staff'`) ahora exige `code: "unauthorized"` y que **no** se llame a `apiFetch`. Nuevo bloque `authorization` que recorre las ocho acciones sin sesión y comprueba además que `addProduct`/`adjustStock` rechazan a un rol `staff` y que `staff` sí puede leer inventario. Nuevo `lib/authz.test.ts` para los guardias. El `beforeEach` global siembra una sesión de admin, así que las pruebas existentes siguen ejercitando la ruta feliz.

**Archivos**

- Nuevos: `lib/authz.ts`, `lib/authz.test.ts`, `lib/useActionErrorMessage.ts`
- Modificados: `lib/actions.ts`, `lib/actions.test.ts`, `lib/types.ts`, `app/sell/page.tsx`, `app/adjust/page.tsx`, `app/history/page.tsx`, `app/products/InventoryDashboard.tsx`, `app/products/new/AddProductForm.tsx`, `components/BottomNav.tsx`, `messages/es.json`, `messages/en.json`

**Validación**: `npm run typecheck`, `npm run lint`, `npm test` (107 pruebas, 10 ficheros) y `npm run build` en verde. Paridad es/en verificada. Sin verificación visual: no se levantaron ni el servicio de inventario (3001) ni el dev server en esta sesión; la comprobación del rechazo anónimo es por prueba unitaria, no por POST real con cabecera `Next-Action`.

**Nota de criterio (cambio de comportamiento)**: hasta ahora un usuario `staff` podía ajustar stock — ni el middleware ni la interfaz lo impedían. La AC 3 exige rol admin en `adjustStock`, así que se marca también la pestaña `/adjust` como `adminOnly` para no dejar a `staff` una pantalla que siempre responde «sin permisos». La página `/adjust` sigue siendo alcanzable por URL (igual que antes); allí el guardia responde con el error traducido. Si el producto quiere que `staff` ajuste stock, lo que hay que revisar es la AC, no el guardia.

**Learnings**

- El middleware no es una defensa para server actions: se despachan por identificador `Next-Action` con POST contra cualquier ruta, incluidas las públicas de `auth.config.ts`. La única frontera real es la primera sentencia de la acción.
- Devolver el error en vez de lanzarlo tiene un coste de tipos que resulta útil: `listStaff`/`getInvoicePreviewInfo` ya no pueden devolver un valor desnudo, y el compilador localiza a cada consumidor. Un guardia que lanza habría pasado el typecheck y roto la UI en runtime.
- Las pruebas que mockeaban `auth()` a `null` estaban documentando el agujero, no un caso de borde: cinco casos de `createSale` pasaban sin sesión. Sembrar la sesión en el `beforeEach` global y dejar el `null` **solo** en las pruebas de autorización deja explícito qué ruta se está ejercitando.
- `app/staff/actions.ts` conserva su propio `requireAdmin` que **lanza**, y `app/staff/actions.test.ts` asevera `rejects.toThrow("Unauthorized")`. Quedan dos guardias con semánticas distintas en el repo; unificarlos obliga a cambiar `deleteStaff` (hoy `Promise<void>`) y su prueba, y eso queda fuera de esta historia.
- Añadir un hook a un componente cliente arrastra sus dependencias: `react-hooks/exhaustive-deps` está activo, así que `useActionErrorMessage()` tuvo que entrar en las listas de `useCallback`/`useEffect` de `sell`, `adjust` y el dashboard.

---

## 2026-07-28 - US-004: Restringir listStaff a la organización que consulta

**Implementado**

- `lib/actions.ts` (`listStaff`): la consulta pasa de `SELECT id, name FROM users ORDER BY name` a `SELECT id, name FROM users WHERE organization_id = ? ORDER BY name`, con el parámetro tomado de `gate.user.organizationId` (el guardia `requireSession()` de US-003 ya deja la identidad disponible, así que no hay una segunda llamada a `auth()`). Es la misma consulta que ya usaba `app/staff/page.tsx:15`.
- Cortocircuito antes del acceso a la BD: si la sesión no resuelve `organizationId` se devuelve `[]`. `organizationId` está declarado como `string | null | undefined` en `types/next-auth.d.ts`, y pasar `undefined` como parámetro a better-sqlite3 lanza; el cortocircuito evita además que el fallo caiga en el `catch` genérico y se confunda un «sin organización» con un «BD caída».
- Pruebas (`lib/actions.test.ts`): la que fijaba el SQL sin filtro ahora exige el `WHERE organization_id = ?` **y** que `all()` reciba `"org-1"` — aseverar solo el texto del SQL dejaría pasar un binding olvidado. Nueva prueba para la sesión sin organización (lista vacía y `db.prepare` sin llamar). `adminSession`/`staffSession` del `beforeEach` global incorporan `organizationId: "org-1"`.

**Archivos**: `lib/actions.ts`, `lib/actions.test.ts`

**Validación**: `npm run typecheck`, `npm run lint` y `npm test` (108 pruebas, 10 ficheros) en verde. Sin cambios de UI ni de i18n, así que no hubo verificación visual.

**Learnings**

- El superadministrador es el caso que hace visible la fuga: no pertenece a ninguna organización, así que aparecía en el filtro de historial de **todas** las tiendas. Devolver `[]` cuando no hay `organizationId` es lo correcto en ambos sentidos — ni la tienda ve a otros, ni el superadmin (que no tiene tienda) recibe el listado global.
- La prueba aseveraba el SQL exacto, es decir, fijaba el bug: cualquier corrección la rompía. Cuando una prueba de este tipo falla hay que preguntarse si documenta un requisito o solo la implementación de ayer; aquí era lo segundo.
- La consulta correcta ya vivía en `app/staff/page.tsx`. Antes de escribir un filtro nuevo, conviene buscar si otra ruta ya consulta la misma tabla: la divergencia entre dos lecturas de `users` es justo donde se coló la fuga.
