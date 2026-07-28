# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Límites de paginación del servicio**: `lib/pagination.ts` exporta `INVENTORY_MAX_LIMIT` (100, el `MAX_LIMIT` del servicio) y `clampInventoryLimit()`. Los componentes cliente importan la constante; `listInventory` (server action) además recorta el `limit` recibido, así ninguna ruta puede provocar un 422 por límite. Es un módulo plano (sin `"use server"` ni `auth`), por eso puede importarse desde `"use client"`.
- **Idempotencia por ticket, no por clic**: `lib/idempotency.ts` exporta `newIdempotencyKey()` (módulo plano, importable desde `"use client"`). La clave vive en el estado del ticket (`Ticket.idempotencyKey` en `app/sell/page.tsx`), se genera en `makeTicket()` y **solo** se renueva cuando la venta queda registrada; mientras la llamada falle, el reintento reenvía la misma y el servicio deduplica contra su único `(location_id, idempotency_key)`. `createSale(items, idempotencyKey)` la exige como parámetro (no opcional: así `tsc` señala a quien la olvide) y la reenvía en la cabecera `Idempotency-Key`, descartando la cadena en blanco — el servicio guardaría `""` y todas las ventas sin clave de una tienda colisionarían entre sí. `apiFetch` fusiona las cabeceras del llamante **antes** de las suyas: se puede añadir, no sustituir `Authorization` ni `Content-Type`.
- **Pruebas de componente**: `vitest.config.ts` fija `environment: "node"`; una prueba de UI solo necesita el pragma `// @vitest-environment jsdom` en la primera línea del fichero (ver `app/sell/page.test.tsx`). Sin `globals: true` no hay limpieza automática (`cleanup()` en `afterEach`) ni matchers de `jest-dom` (usar propiedades del DOM: `input.disabled`, no `toBeDisabled`). Para i18n, envolver con `NextIntlClientProvider locale="es" messages={es}` importando `messages/es.json`, y seleccionar por esas mismas claves (`es.sell.generateInvoice`) para que renombrar una clave rompa la prueba. `components/BarcodeInput` arrastra `@zxing/browser` contra la cámara: mockearlo.
- **Importes como cadenas decimales**: el servicio serializa todo importe como cadena (`"350.00"`), nunca como número JSON. `lib/decimal.ts` exporta el tipo `ApiDecimal` (`string | number | null | undefined`) y `parseDecimal()`. Toda forma `Api*` de `lib/actions.ts` tipa sus importes como `ApiDecimal` y convierte **una sola vez en el borde** con `parseDecimal`; de ahí para dentro (`Product`, `Sale`, `SaleItem`) todo es `number`. Nunca propagar la cadena a la UI: `"350".toFixed()` lanza y `sum + "10.00"` concatena en silencio.
- **Credenciales fuera de la sesión**: NextAuth v5 sirve el objeto de sesión **descifrado** en `GET /api/auth/session`, ruta excluida del matcher de `proxy.ts`. Todo lo que el callback `session` asigne es legible desde el navegador. Los secretos se quedan en el token JWT (cifrado) y el servidor los resuelve bajo demanda: la sesión solo lleva `organizationId`, y `getInventoryConfig()` (`lib/inventoryClient.ts`) lo usa para leer `inventory_api_key`/`inventory_location_id` de la tabla `organizations`. `types/next-auth.d.ts` declara los campos en `Session`, `User` y `JWT` por separado — quitarlos de `Session` y dejarlos en las otras dos hace que `tsc` señale cualquier consumidor que siguiera leyéndolos de la sesión.
- **Sin respaldo global de tenant**: `getInventoryConfig()` (`lib/inventoryClient.ts`) **lanza** `InventoryConfigError` si falta `INVENTORY_API_URL`, si la sesión no resuelve `organizationId`, o si la organización no tiene `inventory_api_key` **y** `inventory_location_id`. No existen `INVENTORY_API_KEY` ni `INVENTORY_LOCATION_ID` en el entorno: eran una credencial única y cualquier petición sin organización terminaba operando sobre esa tienda. Solo `INVENTORY_API_URL` (URL base, no credencial) e `INVENTORY_ADMIN_SECRET` (aprovisionamiento en el registro) siguen en env. El módulo importa `server-only`, así que importarlo desde un `"use client"` rompe el build. Como la función lanza, toda llamada debe estar **dentro** del `try` que la cubre.
- **Errores de acción con código y status**: `ActionError` es `{ error: string; code?: ActionErrorCode; status?: number }`, definido **solo** en `lib/types.ts` (`lib/inventoryClient.ts` lo importa de ahí; tuvo un duplicado sin `code` y por eso el cliente HTTP no podía clasificar nada). `status` aparece solo si el servicio respondió: su ausencia junto a `code: "timeout" | "network"` es lo que distingue «nadie respondió» de «el servicio respondió un error». `apiFetch` clasifica por status (401/403 → `service_auth` — la credencial de la tienda, **no** la sesión del cajero, que es `unauthorized`/`forbidden`; 404 → `not_found`; 409 → `insufficient_stock`/`conflict`; 422 → `invalid_request`; 5xx → `service_error`) y nunca propaga un cuerpo no JSON (devuelve `HTTP <status>`). La UI ramifica por `result.code`, nunca por el texto; `useActionErrorMessage()` traduce **cualquier** código, así que todo miembro nuevo de `ActionErrorCode` necesita su clave en `messages/es.json` y `messages/en.json` (`tsc` no lo comprueba: lo cubre la verificación de paridad).
- **Timeout en toda petición saliente**: `apiFetch(path, { timeoutMs })` arma `AbortSignal.timeout(resolveInventoryTimeoutMs(timeoutMs))` y lo combina con el `signal` del llamante vía `AbortSignal.any`. `resolveInventoryTimeoutMs()` (exportada por `lib/inventoryClient.ts`) resuelve override → `INVENTORY_TIMEOUT_MS` → 8000 ms, descartando valores no finitos o `<= 0`. Las rutas que no pueden usar `apiFetch` (aprovisionamiento en `app/register/actions.ts`, que usa el admin secret y aún no tiene sesión) pasan `signal: AbortSignal.timeout(resolveInventoryTimeoutMs())` a mano. Para probarlo: un `fetch` falso que devuelva una promesa que solo se rechaza en el `abort` del signal recibido, con `timeoutMs: 20`; un `mockRejectedValue` pasaría aunque no se enviara ningún signal.
- **Autorización dentro de cada server action**: los server actions se despachan por identificador `Next-Action` con POST contra **cualquier** ruta, incluidas las que `auth.config.ts` deja públicas (`/`, `/register`), así que el middleware nunca los ve. `lib/authz.ts` (importa `server-only`) exporta `requireSession()` y `requireAdmin()`, que **devuelven** `Authorized | ActionError` en vez de lanzar. Toda acción exportada de `lib/actions.ts` empieza con `const gate = await requireX(); if ("error" in gate) return gate;` y lee la identidad de `gate.user` en lugar de volver a llamar a `auth()`. Efecto secundario en los tipos: una acción que antes devolvía un valor desnudo (`listStaff`, `getInvoicePreviewInfo`) pasa a `ActionResult<T>` y `tsc` señala a sus consumidores.
- **Mensaje de error traducido en el cliente**: los server actions no tienen contexto de locale, así que devuelven el código y la UI resuelve el texto con `useActionErrorMessage()` (`lib/useActionErrorMessage.ts`, módulo `"use client"`): devuelve `t("errors."+code)` para `unauthorized`/`forbidden` y `result.error` para el resto. Añadir el hook a un componente obliga a incluirlo en las dependencias de sus `useCallback`/`useEffect` (`eslint react-hooks/exhaustive-deps` está activo).
- **Toda lectura de `users` filtra por organización**: `users` es una tabla multi-tenant; cualquier `SELECT` sin `WHERE organization_id = ?` expone los usuarios de todas las tiendas, incluido el superadministrador (que no pertenece a ninguna). El `organizationId` sale de `gate.user` (guardia de `lib/authz.ts`) en server actions y de `session.user` en componentes de servidor (`app/staff/page.tsx:15`). Está tipado `string | null | undefined`, así que hay que cortocircuitar con lista vacía **antes** de la consulta: better-sqlite3 lanza si se le pasa `undefined` como parámetro, y el fallo acabaría en el `catch` genérico confundiendo «sin organización» con «BD caída». Al aseverar esto en pruebas, comprobar el SQL **y** el argumento de `all()`; solo el texto del SQL deja pasar un binding olvidado.
- **Paginar y agregar en el servidor**: `listSales(filters)` devuelve `SalesPage` (`{sales,total,page,limit,truncated}`) y **siempre** manda `page` y `limit` (defecto 20, recortado con `clampInventoryLimit`; `/sales` comparte el `MAX_LIMIT=100` del inventario). Las métricas no se derivan de la página: `getSalesSummary(filters, today)` las pide a `GET /v1/reports/sales?locationId&from&to`, que agrega en la base de datos. `today` es el día **local del llamante** (`YYYY-MM-DD`): el servidor no conoce la zona de la caja. Ojo con el contrato: el reporte cuenta solo ventas `completed` mientras `/sales` también lista las anuladas — esta app nunca anula, pero es la única fuente de divergencia posible entre el `total` de la tabla y el recuento del reporte. La búsqueda de catálogo se delega con `listInventory(page, limit, search)` → parámetro `name` del servicio (parcial e insensible a mayúsculas); `barcode` es coincidencia **exacta** y esa vía ya la cubre `scanBarcode`.
- **Lo que el servicio no sabe filtrar**: `GET /v1/sales` solo acepta `startDate`, `endDate`, `page` y `limit`; su `ListSalesSchema` de zod **descarta en silencio** cualquier otra clave, así que mandarle un `staffId` no da 422, simplemente no filtra. Por eso el filtro por empleado recorre el rango (`scanSalesByStaff`, páginas de 100, tope `SALES_SCAN_MAX_PAGES = 10`) y filtra **antes** de cortar la página; el resultado trae `truncated` y la UI lo dice en vez de presentar un recuento parcial como definitivo. Antes de "delegar un filtro al servicio", leer el esquema zod del endpoint: un parámetro ignorado es peor que un filtro local, porque el fallo es invisible.
- **`setState` síncrono dentro de un `useEffect` es error de lint** (`react-hooks/set-state-in-effect`), no aviso. Un debounce se salva porque el `setState` vive dentro del `setTimeout`; una rama de salida temprana (`if (term.length < 2) { setX([]); return; }`) hay que meterla **dentro** del callback del timer, y lo que deba ocurrir al instante (marcar «buscando») va en el manejador del `onChange`, no en el efecto. Lo mismo con «al cambiar el filtro, volver a la página 1»: no es un efecto sobre el filtro, es parte del setter del filtro.
- **Factura desde el servidor**: `getSale(saleId)` (`lib/actions.ts`) pide `GET /v1/sales/:saleId`; como la credencial que usa `apiFetch` es la de la organización de la sesión, la comprobación de tenencia **es la petición**: el servicio responde 404 —no 403— para una venta ajena. Ojo: ese endpoint responde en la forma de `createSale` (`SaleResult`: importes como cadena, `actorRef`, items **sin** `productName`), distinta de la del listado `/sales`; los nombres se resuelven aparte con `GET /v1/products/:id` y caen al id si fallan. `app/api/invoices/[saleId]/route.tsx` es un `GET` (lectura idempotente; ya no recibe ningún cuerpo) y traduce `ActionErrorCode` → status con `STATUS_BY_CODE`, `?? 502`. Para probar una ruta que emite PDF, mockear `@react-pdf/renderer` y aseverar sobre `renderToBuffer.mock.calls[0][0].props.sale`.
- **El verbo de un route handler es un contrato con la UI**: `/api/invoices/[saleId]` solo exporta `GET`, y tanto `/sell` como `/history` piden la factura con un `<a href={/api/invoices/${id}} target="_blank" rel="noopener noreferrer">`. Next responde **405** a todo verbo sin handler exportado, así que un enlace contra una ruta que solo exporta `POST` (o al revés) es un fallo silencioso en tiempo de ejecución que `tsc` no ve. Se fija con dos pruebas baratas: sobre el módulo (`import * as route` + `expect(route).not.toHaveProperty("POST")` — el 405 lo produce el enrutador, no el fichero, así que no se puede invocar desde Vitest) y sobre la pantalla (`getByRole("link")` + `href` exacto, que se rompe si alguien lo convierte en `<form>`). Un paso e2e que solo asevera `toBeVisible()` sobre ese control es cobertura aparente: hay que pulsarlo. En Playwright, con `target="_blank"` la petición sale de la pestaña nueva — escuchar en `page.context().waitForEvent("response", { predicate })`, no en `page`; `BrowserContext` no emite `download`, solo `Page`. `e2e/` entra en `tsconfig` (`**/*.ts`), así que `npm run typecheck` es la única verificación autónoma de ese fichero (`npm run test:e2e` deja organizaciones huérfanas en el servicio y no es quality gate).
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

## 2026-07-28 - US-006: Enviar Idempotency-Key al crear una venta

**Implementado**

- Nuevo `lib/idempotency.ts` con `newIdempotencyKey()`. Módulo plano (sin `server-only`) porque la clave se genera en el **cliente**, junto al ticket: generarla en el servidor la ataría al clic y no deduplicaría nada. Devuelve UUID v4 vía `crypto.randomUUID()`, con respaldo sobre `getRandomValues`/`Math.random` porque `randomUUID` solo existe en contexto seguro y un TPV servido por http sobre una IP de la red local no lo tiene — justo el despliegue donde el doble cobro importa.
- `app/sell/page.tsx`: `Ticket` gana `idempotencyKey`, que `makeTicket()` genera. `handleConfirm` la captura del ticket activo y la pasa a `createSale`. La clave **solo** se renueva al registrarse la venta (junto con `cart: []` y `lastSaleId`); si la llamada falla, la clave sigue viva y el reintento reenvía la misma. Cada pestaña de ticket tiene la suya.
- `lib/actions.ts` (`createSale`): segundo parámetro `idempotencyKey: string` **obligatorio** — así `tsc` señala cualquier llamada que lo olvide — reenviado como `headers: { "Idempotency-Key": key }`. Una clave en blanco se descarta y no se envía la cabecera: el servicio guardaría `""` tal cual y el único `(location_id, idempotency_key)` haría chocar entre sí a todas las ventas sin clave de la misma tienda.
- `lib/inventoryClient.ts` (`apiFetch`): las cabeceras del llamante pasan a fusionarse **antes** de las fijas. Antes iban después, de modo que un llamante podía pisar `Authorization` y `Content-Type`; ahora puede añadir (`Idempotency-Key`) pero no sustituir.
- Pruebas: nuevo `app/sell/page.test.tsx` (jsdom + Testing Library, primera prueba de componente del repo) con los tres casos que fijan la AC 2 — reintento del mismo ticket con la misma clave, rotación tras la venta registrada, y una clave distinta por pestaña. Nuevo `lib/idempotency.test.ts` (formato, unicidad, ambas ramas de respaldo). En `lib/actions.test.ts`, dos casos nuevos (cabecera reenviada, clave en blanco omitida) y los siete puntos de llamada existentes actualizados. En `lib/inventoryClient.test.ts`, dos casos para la fusión de cabeceras.

**Archivos**

- Nuevos: `lib/idempotency.ts`, `lib/idempotency.test.ts`, `app/sell/page.test.tsx`
- Modificados: `lib/actions.ts`, `lib/actions.test.ts`, `lib/inventoryClient.ts`, `lib/inventoryClient.test.ts`, `app/sell/page.tsx`

**Validación**: `npm run typecheck`, `npm run lint`, `npm test` (119 pruebas, 12 ficheros) y `npm run build` en verde. Sin cadenas nuevas, así que no hubo cambios de i18n. Verificación contra el servicio real no realizada: el contrato se confirmó leyendo `inventory-service/src/app/v1/sales/route.ts:43` (`req.headers.get("idempotency-key")`) y `src/lib/inventory/sales.ts` (búsqueda previa dentro de la transacción, más rescate del `unique violation`).

**Learnings**

- La prueba de componente se verificó **al revés** antes de darla por buena: sustituyendo `activeTicket.idempotencyKey` por `newIdempotencyKey()` en `handleConfirm`, dos de los tres casos fallan. Una prueba de idempotencia que no se ha visto fallar con la clave por clic no asevera nada.
- El orden del spread de cabeceras en `apiFetch` era una vulnerabilidad latente, no un detalle de estilo: con `...init.headers` al final, cualquier llamante podía sustituir `Authorization`. Al abrir la puerta a cabeceras extra hay que cerrar esa.
- Una clave vacía es **peor** que ninguna clave. El servicio no valida la cabecera; guarda `""` y el índice único `(location_id, idempotency_key)` convierte todas las ventas sin clave de una tienda en duplicados entre sí. De ahí que `createSale` descarte la cadena en blanco en vez de reenviarla.
- Hacer el parámetro obligatorio en vez de opcional es lo que hace verificable la AC: un `idempotencyKey?: string` habría dejado pasar en silencio a cualquier llamada futura que lo olvidara, que es exactamente el defecto que arregla esta historia.
- Vitest corre con `environment: "node"`; una prueba de componente solo necesita el pragma `// @vitest-environment jsdom` por fichero. No hace falta tocar `vitest.config.ts`. Sin `globals: true` no hay limpieza automática de Testing Library (`cleanup()` en `afterEach`) ni matchers de `jest-dom` (`toBeDisabled` no existe: usar la propiedad del DOM).
- Para el contexto de i18n en pruebas, envolver con `NextIntlClientProvider locale="es" messages={es}` importando `messages/es.json` directamente es más barato que mockear `next-intl`, y de paso los selectores de la prueba (`es.sell.generateInvoice`) fallan si alguien renombra una clave.
- `components/BarcodeInput` arrastra `@zxing/browser` contra la cámara: hay que mockearlo para renderizar `/sell` en jsdom.

---

## 2026-07-28 - US-007: Timeout y codigo de estado en el cliente HTTP

**Implementado**

- `lib/inventoryClient.ts`: `apiFetch` acepta `InventoryRequestInit = RequestInit & { timeoutMs?: number }` y arma la petición con `AbortSignal.timeout(resolveInventoryTimeoutMs(timeoutMs))`. Si el llamante trae su propio `signal`, se combinan con `AbortSignal.any`. `resolveInventoryTimeoutMs()` (exportada) resuelve override de llamada → `INVENTORY_TIMEOUT_MS` → `DEFAULT_INVENTORY_TIMEOUT_MS` (8000 ms), descartando valores no finitos o `<= 0`: un `INVENTORY_TIMEOUT_MS=abc` que resolviera a `0` abortaría cada petición al instante.
- Errores clasificados. `ActionError` gana `status?: number`, presente **solo** cuando el servicio respondió; `ActionErrorCode` gana `insufficient_stock`, `conflict`, `invalid_request`, `service_auth`, `service_error`, `timeout` y `network`. `codeForStatus()` mapea 401/403 → `service_auth` (la credencial de la tienda, no la sesión del cajero), 404 → `not_found`, 409 → `insufficient_stock` o `conflict`, 422 → `invalid_request`, 5xx → `service_error`. Un cuerpo 200 ilegible es `service_error` **con** status, no `network`: hubo respuesta.
- `lib/inventoryClient.ts` deja de declarar sus propios `ActionError`/`ActionResult` y los importa de `lib/types.ts`. Eran duplicados sin `code`, y por eso `apiFetch` no podía clasificar nada.
- `lib/actions.ts` (`createSale`): un `status === 409` se fuerza a `code: "insufficient_stock"`. `POST /v1/sales` solo devuelve 409 por stock (`inventory-service/src/app/v1/sales/route.ts:71`), así que el código no depende de la redacción del mensaje del servicio.
- `lib/useActionErrorMessage.ts`: pasa de traducir dos códigos a traducir **cualquiera** (`result.code ? t(result.code) : result.error`). Es lo que cumple la AC 4: el `Insufficient stock for product <uuid>` del servicio ya no llega a la pantalla.
- Las otras dos rutas con `fetch` crudo también quedan acotadas: `app/profile/page.tsx` pasa a usar `apiFetch` (hereda timeout y clasificación) y las tres llamadas de aprovisionamiento de `app/register/actions.ts` reciben `signal: AbortSignal.timeout(resolveInventoryTimeoutMs())`, que cae en el `try/catch` que ya tenían.
- i18n: ocho claves nuevas en `errors` (`not_found`, `insufficient_stock`, `conflict`, `invalid_request`, `service_auth`, `service_error`, `timeout`, `network`) en `es.json` y `en.json`. `.env.example`, `README.md` y `CLAUDE.md` documentan `INVENTORY_TIMEOUT_MS` como opcional.
- Pruebas: `lib/inventoryClient.test.ts` suma la resolución del timeout (defecto, env, env inservible, override), el aborto real de una petición colgada, que `timeoutMs` no se cuela en el init de `fetch`, el fallo de red sin `status`, la tabla de status → code, y que un cuerpo no JSON no se propaga (`HTTP 502`). `lib/actions.test.ts` cubre el 409 de `createSale`. `app/sell/page.test.tsx` asevera el mensaje traducido y que el UUID **no** aparece.

**Archivos**: `lib/inventoryClient.ts`, `lib/inventoryClient.test.ts`, `lib/types.ts`, `lib/actions.ts`, `lib/actions.test.ts`, `lib/useActionErrorMessage.ts`, `app/profile/page.tsx`, `app/register/actions.ts`, `app/sell/page.test.tsx`, `messages/es.json`, `messages/en.json`, `.env.example`, `README.md`, `CLAUDE.md`

**Validación**: `npm run typecheck`, `npm run lint`, `npm test` (139 pruebas, 12 ficheros) y `npm run build` en verde. Paridad es/en verificada. La prueba de UI se comprobó al revés: sustituyendo el hook por `result.error` falla, así que asevera la traducción y no el renderizado. Sin verificación contra el servicio real: el mapeo de status se leyó de `inventory-service/src/app/v1/**` y de `src/lib/inventory/errors.ts`.

**Learnings**

- Para probar un timeout **de verdad** no hace falta mockear temporizadores: basta un `fetch` falso que devuelva una promesa que solo se rechaza en el `abort` del `signal` recibido (`init.signal.addEventListener("abort", () => reject(signal.reason))`) y llamar con `timeoutMs: 20`. Así se ejercita el `AbortSignal.timeout` real; con un `mockRejectedValue` la prueba pasaría aunque no se pasara ningún signal.
- Un `AbortSignal` propio del cliente no puede pisar el del llamante: `AbortSignal.any([callerSignal, timeoutSignal])` es lo que permite conservar ambos. Y `timeoutMs` hay que **desestructurarlo fuera** del resto del init: pasarlo a `fetch` sería una clave desconocida (hoy ignorada, mañana no).
- La ausencia de `status` es mejor señal que un código de error inventado: `{code:"network"}` sin `status` dice «nadie respondió», mientras que cualquier error con `status` vino del servicio. Por eso el cuerpo 200 ilegible conserva su 200 en vez de caer en el `catch` genérico, donde se habría contado como fallo de red.
- `401/403` del servicio de inventario **no** son `unauthorized`/`forbidden`: esos códigos ya significan «tu sesión de la app». Reutilizarlos habría mostrado «Tu sesión expiró, inicia sesión de nuevo» ante una API key de tienda mal aprovisionada, mandando al cajero a hacer justo lo que no arregla nada. De ahí `service_auth`.
- `lib/inventoryClient.ts` tenía su propia copia de `ActionError` sin `code`. Mientras existió, cualquier clasificación en el cliente HTTP era invisible para la UI. Antes de añadir un campo a un tipo, comprobar que no hay un gemelo en otro módulo.
- Traducir por código en el hook (`result.code ? t(result.code) : result.error`) simplifica el hook, pero pone un requisito implícito: cada miembro de `ActionErrorCode` necesita su clave en los dos ficheros de mensajes, y `tsc` no lo comprueba. La verificación de paridad es/en es lo único que lo cubre hoy.
---

## 2026-07-28 - US-010: Paginar y filtrar en el servidor el historial y el inventario

**Implementado**

- `lib/actions.ts` — `listSales(filters)` pasa a devolver `SalesPage` (`{sales,total,page,limit,truncated}`) y manda siempre `page` y `limit` (defecto `DEFAULT_SALES_LIMIT = 20`, recortado con `clampInventoryLimit`). El `total` es el del servicio, así que la paginación del historial deja de calcularse sobre las veinte últimas ventas.
- Filtro por empleado **antes** de paginar. `GET /v1/sales` no sabe filtrar por actor: su `ListSalesSchema` acepta solo `startDate`, `endDate`, `page` y `limit`, y zod descarta el resto sin error (`inventory-service/src/app/v1/sales/route.ts`). `scanSalesByStaff()` recorre el rango en páginas de `INVENTORY_MAX_LIMIT`, con tope `SALES_SCAN_MAX_PAGES = 10`, filtra y **luego** corta la página; `total` es el recuento filtrado y `truncated` avisa cuando el rango excede el tope.
- Nuevo `getSalesSummary(filters, today)` → `SalesSummary` (`{count, revenue, todayRevenue, truncated}`). Sin filtro de empleado usa `GET /v1/reports/sales?locationId&from&to`, que agrega en la base de datos: las métricas dejan de depender de cuántas ventas cupieran en la página. Con filtro de empleado reduce sobre el mismo recorrido. `today` es el día local del llamante y solo se consulta si cae dentro del rango filtrado, para que ambas ramas digan lo mismo.
- `listInventory(page, limit, search?)` reenvía el término al parámetro `name` del servicio (parcial, insensible a mayúsculas). `app/sell/page.tsx` deja de precargar el catálogo y busca contra el servicio con un debounce de 250 ms; `app/adjust/page.tsx` hace lo mismo. Desaparecen los avisos «solo se busca entre los primeros N».
- `app/products/InventoryDashboard.tsx` — la tabla pagina contra el servicio (`listInventory(page, PAGE_SIZE, search)`) y su indicador usa el `total` del servicio, así que deja de discrepar del KPI. Los KPI y los paneles de resumen siguen leyendo una página (el servicio no expone un agregado de stock) y su aviso se reescribió para decir que es eso y no la tabla. El filtro de stock, que el servicio tampoco tiene, sigue acotando la página en pantalla y tiene su propio indicador (`showingStockFiltered`).
- `app/history/page.tsx` — pagina y agrega contra el servidor; «Facturas emitidas» es el `total` del servicio y «Promedio Ticket» sale de `revenue/count` del resumen. La exportación a CSV recorre las páginas (`EXPORT_MAX_PAGES = 10`) en vez de volcar la página en pantalla.
- De paso, el `staffMap` de `listSales` filtraba `users` sin organización, contra el invariante que fijó US-004. Ahora la consulta lleva `WHERE organization_id = ?` con el id de `gate.user`.
- i18n: `sell.searchFailed` sustituye a `catalogTruncated`/`catalogLoadFailed`, se retira `adjust.searchTruncated`, se añaden `history.exporting`, `history.partialStaffHistory` e `inventory.showingStockFiltered`, y los tres *placeholders* de búsqueda pasan a hablar solo de nombre. Paridad es/en verificada.

**Archivos**: `lib/actions.ts`, `lib/actions.test.ts`, `lib/types.ts`, `lib/pagination.ts`, `app/history/page.tsx`, `app/products/InventoryDashboard.tsx`, `app/sell/page.tsx`, `app/sell/page.test.tsx`, `app/adjust/page.tsx`, `messages/es.json`, `messages/en.json`

**Validación**: `npm run typecheck`, `npm run lint`, `npm test` (154 pruebas, 12 ficheros) y `npm run build` en verde. Las pruebas nuevas se comprobaron **al revés**: reintroduciendo el filtro posterior a la paginación fallan tres casos de `listSales`, y devolviendo el filtrado en memoria de la pantalla de venta fallan dos de `page.test.tsx`. Sin verificación visual: ni el servicio de inventario (3001) ni la app (3000) estaban levantados en esta sesión.

**Learnings**

- Un parámetro que el servicio ignora es peor que un filtro local. `ListSalesSchema` es un `z.object` en modo *strip*: mandarle `staffId` no devuelve 422, simplemente no filtra, y el defecto quedaría invisible. La AC pedía «enviar el filtro al servicio»; el contrato no lo permite sin tocar el servicio, así que se cumplió la mitad que arregla el bug real (filtrar antes de paginar) y el resto se documenta.
- Recorrer páginas para suplir un filtro que falta hay que **acotarlo y confesarlo**. El tope de 10 páginas es una decisión de producto disfrazada de constante: sin el `truncated` que la acompaña, el recuento parcial se leería como total, que es exactamente el defecto que esta historia cierra.
- `/reports/sales` y `/sales` no cuentan lo mismo: el reporte filtra `status = 'completed'` y el listado no. Esta app no anula ventas, así que hoy coinciden, pero mezclar las dos fuentes en la misma pantalla es una divergencia latente. Conviene que el número que acompaña a la tabla («de N resultados») venga de la misma llamada que llenó la tabla.
- `react-hooks/set-state-in-effect` es **error**, no aviso, en este repo. Un `useEffect` que hace `setState` en su cuerpo no compila el lint; el debounce se salva porque el `setState` está dentro del `setTimeout`. La rama de salida temprana hay que meterla en el callback del timer y el estado inmediato («buscando…») en el `onChange`. El «al cambiar de filtro, volver a la página 1» tampoco es un efecto: es parte del setter.
- Una prueba de búsqueda delegada tiene que ser *discriminante*: si el producto devuelto por el mock contiene el término tecleado, pasa igual con filtrado local. El caso que sirve es teclear `zzz` y que el servicio devuelva «Botella de agua» — con filtro en memoria esa fila desaparece.
- Al partir el panel de inventario en dos lecturas (KPI y tabla) hicieron falta dos huecos de error: con uno solo, una recarga de KPI que va bien borra el mensaje que dejó la lectura de la tabla.

---

## 2026-07-28 - US-008: Emitir la factura desde datos del servidor

**Implementado**

- Nuevo `getSale(saleId)` en `lib/actions.ts` → `ActionResult<Sale>`. Pide `GET /v1/sales/:saleId` con la credencial de la organización de la sesión, así que **la petición misma es la comprobación de tenencia**: el servicio responde 404 (no 403) para una venta de otra tienda y la acción lo propaga como `code: "not_found"`. No se reimplementa ningún filtro local.
- `GET /v1/sales/:id` responde en la forma de `createSale`, **no** en la de `/sales`: importes como cadena decimal y items **sin** `productName` (solo el listado une el catálogo). Los nombres se resuelven aparte con `GET /v1/products/:id` (ids distintos, en paralelo); un nombre es cosmético y un importe no, así que un fallo de esa búsqueda cae al id del producto en vez de tumbar la factura. El nombre del empleado sale del `staffNames()` ya existente, filtrado por organización.
- `app/api/invoices/[saleId]/route.tsx`: desaparece `parseSale()` (validaba la **forma** del cuerpo, no su autenticidad) y con él los 60 renglones que aceptaban importes, cantidades, totales y nombre de empleado del navegador. El handler pasa de `POST` a `GET` — es una lectura idempotente y no queda nada que enviar — y traduce el error de la acción con `STATUS_BY_CODE` (`unauthorized`→401, `forbidden`→403, `not_found`→404, resto→502). El `Content-Disposition` usa `sale.id` (el que devolvió el servicio) y no el de la URL, que llega sin validar a una cabecera.
- `app/history/page.tsx`: los dos `<form method="POST">` con `<input type="hidden" name="sale" value={JSON.stringify(sale)}>` pasan a ser enlaces `<a href={/api/invoices/${sale.id}} target="_blank" rel="noopener noreferrer">`. De paso queda arreglado `app/sell/page.tsx:473`, que ya enlazaba la ruta por GET contra un handler que solo exportaba POST (405 seguro al descargar la factura de la venta recién hecha).
- Pruebas: nuevo `app/api/invoices/[saleId]/route.test.ts` (5 casos: 401 sin sesión sin llegar a preguntar al servicio, 404 con venta de otra organización, PDF construido con los importes del servicio, cuerpo con una venta falsificada ignorado, 502 cuando el servicio falla). En `lib/actions.test.ts`, `describe("getSale")` con tres casos y `getSale` sumado a la tabla de autorización.

**Archivos**: `lib/actions.ts`, `lib/actions.test.ts`, `app/api/invoices/[saleId]/route.tsx`, `app/api/invoices/[saleId]/route.test.ts` (nuevo), `app/history/page.tsx`

**Validación**: `npm run typecheck`, `npm run lint`, `npm test` (163 pruebas, 13 ficheros) y `npm run build` en verde. Sin cadenas nuevas: no hubo cambios de i18n. Las pruebas se comprobaron **al revés**: cambiando `not_found: 404` por `400` falla el caso de la venta ajena, y sustituyendo el `subtotal` calculado por `0` fallan los dos casos que aseveran que los importes vienen del servicio. Sin verificación visual: ni el servicio (3001) ni la app (3000) estaban levantados.

**Learnings**

- Los dos endpoints de venta del servicio **no** devuelven la misma forma. `GET /v1/sales` (listado) da importes como número y `productName` resuelto; `GET /v1/sales/:id` da `SaleResult` — importes como cadena, `actorRef` en vez de `staffId`, y items sin nombre de producto. Reutilizar `toSale()` habría dejado la factura con `undefined` donde va el nombre; hace falta su propio `ApiSaleDetail`.
- Que la ruta solo exportara `POST` escondía un fallo de otro sitio: el enlace de descarga de `/sell` es un `<a href>` y recibía un 405. El cuerpo POST no estaba ahí por necesidad del PDF sino porque el historial ya tenía la venta en memoria — y esa comodidad es exactamente lo que permitía acuñar importes.
- Cuando la credencial es por organización, «verificar que la venta pertenece a la organización» no es un `if` después de la lectura: es la lectura. Añadir una comprobación local sobre `locationId` habría roto cualquier organización con más de un local sin aportar aislamiento que el servicio no diera ya.
- Para probar una ruta que emite PDF, mockear `@react-pdf/renderer` y aseverar sobre `renderToBuffer.mock.calls[0][0].props.sale` es más rápido y mucho más discriminante que inspeccionar los bytes: fija *qué datos* entran al documento, que es justo lo que arregla esta historia.
- Un `Partial<Record<ActionErrorCode, number>>` para traducir código → status obliga a `?? 502` y deja explícito que un error del servicio de inventario no es culpa del navegador. Mapear todo a 500 habría dado igual funcionalmente, pero un 502 es lo que dice «el que falló está detrás de mí».

---

## 2026-07-28 - US-009: Corregir el enlace de descarga de factura de la pantalla de venta

**Implementado**

- **El fallo de producción ya estaba corregido por US-008, en el sentido contrario al que enunciaba la historia.** La historia pedía que `/sell` migrase a POST como «ya hizo el historial»; US-008 hizo lo inverso: la ruta pasó a exportar solo `GET` (lectura idempotente, sin cuerpo) y el historial abandonó sus dos `<form method="POST">` por enlaces. Con eso, el `<a href={/api/invoices/${lastSaleId}}>` de `app/sell/page.tsx` dejó de recibir un 405 sin tocarlo. El criterio «coherente con la interfaz que resulte de US-008» manda sobre la letra de «responde a POST y no a GET», así que la prueba fija el contrato en la dirección real: **GET sí, POST no**. Ni `app/sell/page.tsx` ni `app/history/page.tsx` necesitaban cambios; ambos usan hoy el mismo mecanismo (enlace GET por id, `target="_blank"`).
- `app/api/invoices/[saleId]/route.test.ts`: nuevo caso que asevera el contrato de verbo del módulo — `typeof route.GET === "function"` y `expect(route).not.toHaveProperty("POST")`. Next responde 405 a cualquier verbo sin handler exportado, así que esta aserción es exactamente la que se habría puesto en rojo con el bug original.
- `app/sell/page.test.tsx`: nuevo `describe("SellPage invoice download")` que recorre la venta hasta «¡Venta confirmada!» y comprueba que el control es un `role="link"` con `href === "/api/invoices/sale-1"`. Cubre por Vitest el criterio «usa el mismo mecanismo que el historial»: si alguien lo convierte en `<button>`/`<form>`, `getByRole("link")` no lo encuentra.
- `e2e/comercio-flow.spec.ts`: el paso de la venta ya no se limita a `toBeVisible()` sobre el enlace — lo **pulsa** y espera la respuesta de `/api/invoices/`, aseverando `status 200` y `content-type: application/pdf`. Un 405 lo tumba.

**Archivos**: `app/api/invoices/[saleId]/route.test.ts`, `app/sell/page.test.tsx`, `e2e/comercio-flow.spec.ts`

**Validación**: `npm run typecheck`, `npm run lint` y `npm test` (165 pruebas, 13 ficheros) en verde. `npm run test:e2e` **no** se ejecutó: crea organizaciones reales en el servicio de inventario y las deja huérfanas, y no forma parte de los quality gates (así lo indica la propia historia). Sin cambios de i18n. Sin verificación visual: no hubo cambios de UI.

**Learnings**

- Una historia puede llegar ya resuelta *por el lado opuesto* al que describe. Aquí el criterio útil no era el literal («que responda a POST») sino el invariante: **el verbo que exporta la ruta y el verbo que usa la UI tienen que ser el mismo**, y eso es lo que conviene aseverar, no una dirección concreta. Antes de implementar una historia que arrastra contexto de una anterior, leer el estado real del fichero: el enunciado se escribió antes que el código.
- El contrato de verbo de un route handler se prueba sobre el **módulo**, no sobre la respuesta: `import * as route` + `expect(route).not.toHaveProperty("POST")`. No hay forma de invocar el 405 desde Vitest porque lo produce el enrutador de Next, no el fichero; lo único que este puede garantizar es qué exporta.
- Playwright: para un enlace con `target="_blank"` que descarga, la petición sale de la pestaña nueva, así que `page.waitForEvent("response")` no la ve. Hay que escuchar en el **contexto** (`page.context().waitForEvent("response", { predicate })`), que sí abarca las páginas hijas. `BrowserContext` no emite `download`, solo `Page`, de ahí que se asevere sobre la respuesta HTTP en vez de sobre el fichero.
- `tsconfig.json` incluye `**/*.ts`, así que `e2e/` **sí** entra en `npm run typecheck`: un error de firma en una llamada de Playwright se detecta sin levantar navegador ni tocar el servicio de inventario. Es la única verificación autónoma que tiene ese fichero.
- Una prueba e2e que solo comprueba visibilidad de un control es cobertura aparente: el enlace llevaba a un 405 y el paso pasaba en verde. Todo control cuya razón de ser es *ir a algún sitio* hay que pulsarlo y aseverar la respuesta.

---
