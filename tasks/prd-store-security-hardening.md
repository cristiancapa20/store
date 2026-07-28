# PRD: Corrección del aislamiento entre tiendas y del flujo de venta

## Overview

Una auditoría de seguridad encontró que la API key de inventario de cada tienda se envía al navegador dentro de la sesión de NextAuth, que los server actions no verifican autenticación ni rol, que las peticiones sin organización resuelta caen silenciosamente sobre el inventario configurado en el entorno, y que el carrito lanza una excepción tras cada escaneo de código de barras.

Este PRD cubre esas correcciones. Son la diferencia entre una aplicación multi-tenant y una que solo lo parece.

## Prerequisitos

**✅ COMPLETADO.** `prd-tenant-isolation-hardening.md` del repositorio `inventory-service` está terminado: 19/19 historias, con `typecheck` y `lint` en verde. Las dos dependencias de este PRD están satisfechas.

> ### ⚠️ Regresión activa: esta aplicación está rota ahora mismo
>
> Al hacer explícitos los límites de paginación, el servicio pasó de recortar en silencio a devolver **422**. Su máximo es 100 y esta aplicación sigue pidiendo más: `listInventory(1, 500)` en `app/sell/page.tsx:72` y `listInventory(1, 200)` en `app/adjust/page.tsx:57`, `app/products/InventoryDashboard.tsx:133` y `app/products/ProductList.tsx:90`.
>
> Los cuatro reciben 422, de modo que **el punto de venta, el ajuste de stock y el panel de inventario no cargan productos**. Era el efecto previsto de aquella corrección, pero obliga a reordenar: **US-012 va la primera**, por delante incluso del crash del carrito.

Dependencias originales, ya resueltas:

| Historia de este PRD | Depende de | Motivo |
|---|---|---|
| US-008 (factura desde el servidor) | Servicio: *«Exponer `GET /v1/sales/:saleId`»* | El endpoint no existe hoy; sin él no hay forma de obtener los importes autoritativos de una venta |
| US-010 (paginación en servidor) | Servicio: *«Hacer explícito el límite máximo de paginación»* | Los listados dejan de truncar en silencio y pasan a devolver 422, lo que cambia el comportamiento que esta aplicación debe manejar |

Las historias del servicio se citan por título y no por número: su `prd.json` renumera respecto al markdown al dividir una historia demasiado grande.

El resto de historias no dependen del servicio y pueden abordarse en cualquier orden. Si por alguna razón se empieza este PRD antes de tiempo, US-008 y US-010 quedan bloqueadas; las demás no.

Conviene además tener presente que el servicio corrige en paralelo una fuga de datos entre organizaciones por la ruta de idempotencia. Mientras esa corrección no esté desplegada, endurecer esta aplicación no basta para garantizar el aislamiento entre tiendas.

## Goals

- Que la API key de inventario nunca abandone el servidor.
- Que ninguna acción del servidor se ejecute sin sesión válida y sin el rol adecuado.
- Que la organización de una petición se derive siempre de la sesión, sin ningún camino alternativo.
- Que el flujo de venta con escáner funcione y no dependa de precios calculados en el cliente.

## Quality Gates

Estos comandos deben pasar en cada historia de usuario:

- `npm run typecheck` — comprobación de tipos
- `npm run lint` — linting
- `npm test` — suite de Vitest

Advertencia para el agente: varias pruebas actuales **fijan el comportamiento vulnerable** y fallarán al corregir el código. Eso es esperado y correcto; deben actualizarse dentro de la misma historia, nunca eludirse relajando la aserción. Los casos conocidos están señalados en cada historia.

## User Stories

> **Orden de ejecución real:** US-012 → US-005 → US-001 → US-002 → US-003 → US-004 → US-006 → US-007 → US-010 → US-008 → US-009 → US-011. US-012 está al final del documento por haberse añadido después; el `prd.json` ya la ordena por delante.

---

### US-012: Dejar de solicitar límites por encima del máximo del servicio
**Description:** Como cajero, quiero que la pantalla de venta vuelva a cargar productos, porque hoy no carga ninguno.

**Contexto:** el servicio declara ahora `MAX_LIMIT = 100` y valida con `.max(MAX_LIMIT)` en zod, de modo que un `limit` superior devuelve **422** en lugar de recortar en silencio como hacía antes. Esta aplicación sigue pidiendo más en cuatro sitios: `app/sell/page.tsx:72` pide 500, y `app/adjust/page.tsx:57`, `app/products/InventoryDashboard.tsx:133` y `app/products/ProductList.tsx:90` piden 200.

Esta historia es el **desbloqueo inmediato**. La solución completa —delegar la búsqueda en el servicio y paginar de verdad— es US-010.

**Acceptance Criteria:**
- [ ] Ninguna llamada a `listInventory` solicita un `limit` superior a 100
- [ ] La pantalla de venta, la de ajuste y el panel de inventario vuelven a mostrar productos contra el servicio real
- [ ] Cuando el catálogo excede lo que devuelve una página, la interfaz lo indica al usuario en lugar de aparentar que el listado está completo
- [ ] Un 422 del servicio deja de presentarse al usuario como «producto no encontrado»
- [ ] Los textos nuevos existen en `messages/es.json` y `messages/en.json`

> `app/products/ProductList.tsx` es código muerto: no lo referencia nadie. Corregirlo igualmente o eliminarlo, pero dejar constancia de la decisión.

---

### US-001: Retirar la API key de inventario del objeto de sesión
**Description:** Como propietario de una tienda, quiero que mi credencial de inventario no sea legible desde el navegador, para que ningún empleado ni ningún script inyectado pueda operar sobre mi inventario por fuera de la aplicación.

**Contexto:** `auth.config.ts:73` copia `inventoryApiKey` a `session.user`. NextAuth v5 sirve el objeto de sesión **descifrado** desde `GET /api/auth/session`, ruta excluida del matcher del middleware en `proxy.ts:8`. El JWT sí va cifrado; el problema es exclusivamente el callback `session`. La credencial concede todas las operaciones `/v1/*` de la organización.

**Acceptance Criteria:**
- [ ] El callback `session` de `auth.config.ts` ya no asigna `inventoryApiKey` ni `inventoryLocationId`
- [ ] El callback `jwt` los sigue almacenando en el token, que viaja cifrado
- [ ] `types/next-auth.d.ts` elimina ambos campos de la interfaz `Session`, conservándolos en la de `JWT`, de modo que el compilador señale cualquier uso restante
- [ ] `organizationId` permanece en la sesión: es el identificador con el que el servidor resuelve la credencial
- [ ] Una petición autenticada a `GET /api/auth/session` devuelve un JSON sin ninguna cadena que empiece por `inv_live_`

---

### US-002: Resolver la configuración de inventario desde el token, sin recurso al entorno
**Description:** Como propietario de una tienda, quiero que una petición sin organización resuelta falle, en lugar de operar en silencio sobre el inventario de otra tienda.

**Contexto:** `lib/inventoryClient.ts:9-16` cae a `process.env.INVENTORY_API_KEY` y `process.env.INVENTORY_LOCATION_ID` cuando la sesión no los trae. Como el alta de tiendas fuera de producción se traga los fallos de aprovisionamiento y guarda la organización con la clave a `NULL` (`app/register/actions.ts:64-130`), cada registro en desarrollo produce una tienda que lee el inventario de la tienda del entorno.

**Acceptance Criteria:**
- [ ] `getInventoryConfig` obtiene la credencial del token de sesión, mediante `auth()`, y no consulta `process.env` para la clave ni para la location
- [ ] Si no hay sesión, o la sesión no tiene credencial de inventario, se lanza un error explícito en lugar de devolver cadenas vacías
- [ ] Se conserva `process.env.INVENTORY_API_URL`, que es la URL base del servicio y no una credencial de tenant
- [ ] Si falta `INVENTORY_API_URL`, se falla con un mensaje claro en vez de construir una URL relativa
- [ ] `lib/inventoryClient.ts` incluye `import "server-only"` para que cualquier importación desde un componente de cliente rompa la compilación
- [ ] Se crea `.env.example` —hoy **no existe**, pese a que `CLAUDE.md` indica copiarlo para arrancar— documentando únicamente las variables que la aplicación sigue necesitando: `INVENTORY_API_URL`, `AUTH_SECRET`, `INVENTORY_ADMIN_SECRET`, `STORE_NAME`, `TAX_RATE` y las de siembra del superadministrador
- [ ] `INVENTORY_API_KEY` e `INVENTORY_LOCATION_ID` **no** aparecen en ese fichero, y se anota en `CLAUDE.md` que se retiraron y por qué
- [ ] Se corrige la instrucción de arranque de `CLAUDE.md`, que hoy manda copiar un `.env.local.example` inexistente

---

### US-003: Exigir sesión y rol en todos los server actions
**Description:** Como propietario de una tienda, quiero que las acciones del servidor comprueben quién llama, para que nadie las invoque sin sesión ni por encima de su rol.

**Contexto:** `lib/actions.ts` declara `"use server"` en la línea 1 y ninguna de sus acciones exportadas comprueba la autorización; solo llaman a `auth()` para *leer* identidad (líneas 79, 90, 166). El middleware no protege esto: los server actions se despachan por identificador `Next-Action` y admiten POST contra cualquier ruta, incluidas `/` y `/register`, que `auth.config.ts:14-25` deja pasar sin sesión.

El patrón correcto ya existe en el repositorio, en `app/staff/actions.ts:9-13`.

**Acceptance Criteria:**
- [ ] Existen ayudantes `requireSession()` y `requireAdmin()` reutilizables, siguiendo el patrón de `app/staff/actions.ts`
- [ ] Toda acción exportada de `lib/actions.ts` invoca uno de los dos como primera sentencia: `scanBarcode`, `createSale`, `listInventory`, `addProduct`, `adjustStock`, `listSales`, `listStaff`, `getInvoicePreviewInfo`
- [ ] `addProduct` y `adjustStock` exigen rol `admin`, en coherencia con el gate de interfaz de `app/products/new/page.tsx:8` y con la marca `adminOnly` de `components/BottomNav.tsx`
- [ ] Las acciones devuelven un error de autorización en lugar de lanzar excepciones no controladas hacia la interfaz
- [ ] Se actualiza la prueba de `lib/actions.test.ts` que hoy asevera que `createSale` funciona sin sesión (alrededor de la línea 168), para que ahora exija el rechazo

---

### US-004: Restringir `listStaff` a la organización que consulta
**Description:** Como propietario de una tienda, no quiero ver en mi filtro de historial los nombres de los empleados de otras tiendas.

**Contexto:** `lib/actions.ts:18-20` ejecuta `SELECT id, name FROM users ORDER BY name` sin `WHERE organization_id`. Se usa desde el filtro de `/history`, así que cada tienda ve los usuarios de toda la plataforma, incluido el superadministrador. La consulta correcta ya existe en `app/staff/page.tsx:15`.

**Acceptance Criteria:**
- [ ] La consulta filtra por el `organizationId` de la sesión
- [ ] Si la sesión no tiene organización, se devuelve una lista vacía en lugar de todos los usuarios
- [ ] La prueba de `lib/actions.test.ts:39-51`, que hoy asevera el SQL sin filtro, se actualiza para exigir el filtro por organización

---

### US-005: Tratar los importes de la API como cadenas decimales
**Description:** Como cajero, quiero que el carrito no se rompa al escanear un producto.

**Contexto:** el servicio devuelve `price` como cadena (`scan.ts:98`, `item.price.toString()`), pero `lib/actions.ts:38` lo tipa como `number | null` y la línea 69 lo propaga sin convertir. Llega al carrito en `app/sell/page.tsx:180` y se renderiza en la línea 460 con `entry.unitPrice.toFixed(2)`: **`"350".toFixed` no es una función, y la vista del carrito lanza `TypeError` tras cualquier escaneo con éxito**. La ruta de búsqueda no falla porque `listInventory` sí convierte con `parseFloat` (`lib/actions.ts:152`).

El fallo no se detecta hoy porque las pruebas simulan `apiFetch` por completo y el fixture de escaneo usa `price: null`.

**Acceptance Criteria:**
- [ ] `ApiScanResult` tipa `price` como `string | null`, reflejando el contrato real
- [ ] La conversión a número ocurre una sola vez, en el borde, igual que en `listInventory`
- [ ] Se revisan `ApiSaleResponse.total`, `unitPrice` y `lineTotal`, que también llegan como cadenas
- [ ] El fixture de escaneo de `lib/actions.test.ts` usa un precio real en formato cadena, por ejemplo `"350.00"`, y no `null`
- [ ] Existe una prueba que asevera que el `price` devuelto por `scanBarcode` es un `number` utilizable
- [ ] Verificado en la aplicación: escanear un producto con precio y comprobar que el carrito lo renderiza

---

### US-006: Enviar `Idempotency-Key` al crear una venta
**Description:** Como cajero, quiero que un doble clic o un reintento no cobre dos veces ni descuente el stock dos veces.

**Contexto:** el servicio admite la cabecera y deduplica con un constraint de base de datos, pero `lib/actions.ts:95-105` no la envía y `lib/inventoryClient.ts:27-35` solo fija `Content-Type` y `Authorization`. Tanto `packages/inventory-ui/src/client.ts:28` como `consumer-app/server.mjs:52` del repositorio del servicio ya lo hacen bien y sirven de referencia.

**Acceptance Criteria:**
- [ ] `createSale` acepta y reenvía una clave de idempotencia en la cabecera `Idempotency-Key`
- [ ] La clave se genera **por ticket**, no por clic, de modo que un reintento del mismo ticket reutilice la misma clave
- [ ] `apiFetch` permite pasar cabeceras adicionales sin sobrescribir las que ya fija
- [ ] Existe una prueba que asevera que dos invocaciones consecutivas del mismo ticket envían la misma clave

---

### US-007: Añadir timeout y conservar el código de estado en el cliente HTTP
**Description:** Como cajero, quiero que un servicio caído dé un error comprensible y rápido, y no una espera indefinida.

**Contexto:** `lib/inventoryClient.ts:27` no usa `AbortSignal.timeout`, así que un servicio colgado bloquea el server action hasta que la plataforma lo mata. Además la función descarta `res.status` (líneas 35-42), por lo que la aplicación no puede distinguir un 401 de un 409 o un 503, y expone al usuario cadenas crudas como `fetch failed`.

**Acceptance Criteria:**
- [ ] Toda petición saliente lleva un timeout configurable, con un valor por defecto razonable para un punto de venta
- [ ] El tipo `ActionError` incluye el código de estado HTTP cuando lo hay
- [ ] Los fallos de red se distinguen de las respuestas de error del servicio
- [ ] Un 409 por stock insuficiente se presenta al usuario con un mensaje traducido, no con la cadena en inglés que incluye el UUID del producto
- [ ] Los mensajes nuevos existen en `messages/es.json` y `messages/en.json`, según exige `CLAUDE.md:97`

---

### US-008: Emitir la factura desde datos del servidor
**Description:** Como propietario, quiero que una factura no pueda contener importes fabricados por el cliente.

**Contexto:** `app/api/invoices/[saleId]/route.tsx:206-233` valida la *forma* del cuerpo, no su autenticidad: importes, cantidades, totales, nombre del empleado e identificador de venta llegan desde el navegador (`app/history/page.tsx:331`), y no se comprueba que la venta pertenezca a la organización de quien la pide.

**DEPENDENCIA:** requiere `GET /v1/sales/:saleId`, que **no existía** cuando se redactó este PRD. Lo aporta la historia *«Exponer `GET /v1/sales/:saleId`»* del PRD `prd-tenant-isolation-hardening.md` del servicio, que debe estar completada antes de empezar esta. El endpoint devuelve 404 —no 403— cuando la venta pertenece a otra organización, así que el aislamiento entre tiendas queda garantizado por el servicio y no hay que reimplementarlo aquí.

**Acceptance Criteria:**
- [ ] La ruta obtiene la venta llamando a `GET /v1/sales/:saleId` del servicio, en el servidor
- [ ] Se verifica que la venta pertenece a la organización de la sesión; si no, se responde 404
- [ ] Los importes del PDF proceden exclusivamente de la respuesta del servicio
- [ ] La ruta deja de aceptar el campo `sale` del cuerpo de la petición
- [ ] `app/history/page.tsx` deja de enviarlo
- [ ] Existe al menos una prueba de esta ruta, que hoy no tiene ninguna: sin sesión da 401 y con venta de otra organización da 404

---

### US-009: Corregir el enlace de descarga de factura de la pantalla de venta
**Description:** Como cajero, quiero poder descargar la factura desde la pantalla de venta.

**Contexto:** `app/sell/page.tsx:424` usa un enlace `GET`, pero la ruta solo exporta `POST`, de modo que responde 405. El historial ya se corrigió para usar un formulario `POST`; la pantalla de venta se quedó atrás. La prueba e2e comprueba que el enlace es *visible* pero nunca lo pulsa, lo que da una falsa sensación de cobertura.

**Acceptance Criteria:**
- [ ] La pantalla de venta usa el mismo mecanismo que el historial para solicitar la factura
- [ ] Es coherente con la interfaz que resulte de US-008
- [ ] Existe una prueba de Vitest sobre la ruta que asevera que responde a `POST` y no a `GET`, verificable con los quality gates
- [ ] Se actualiza la prueba e2e para que **pulse** el control en lugar de limitarse a comprobar que es visible

> Nota: `npm run test:e2e` (Playwright) **no** forma parte de los quality gates, porque crea organizaciones reales en el servicio de inventario y las deja huérfanas. El criterio verificable de forma autónoma es el de Vitest; el ajuste del e2e se comprueba a mano.

---

### US-010: Paginar y filtrar en el servidor el historial y el inventario
**Description:** Como propietario, quiero que los totales del historial reflejen todas mis ventas y no solo las veinte últimas.

**Contexto:** `app/history/page.tsx:141-148` llama a `listSales(filters)` sin `limit`, por lo que el servicio aplica su valor por defecto de 20; la página luego pagina en local sobre ese array y calcula "facturas emitidas" y "ticket promedio" a partir de él. El filtro por empleado se aplica **después** de paginar (`lib/actions.ts:310-312`), mientras `total` sigue siendo el recuento sin filtrar.

En paralelo, `app/sell/page.tsx:72` pide 500 artículos de inventario y `InventoryDashboard.tsx:133` pide 200 para luego buscar y filtrar en memoria. El servicio recorta a 100 sin avisar, así que con más de 100 SKUs hay productos invisibles en la búsqueda y en el panel.

**El enfoque de traerse el catálogo entero es el error de raíz, y no hace falta corregirlo en el servicio:** `GET /v1/locations/:id/inventory` ya admite los filtros `name` —coincidencia parcial, insensible a mayúsculas— y `barcode`, hoy sin usar desde esta aplicación. La búsqueda debe delegarse en el servicio en lugar de descargar el catálogo y filtrarlo en el navegador.

**DEPENDENCIA:** tras la historia *«Hacer explícito el límite máximo de paginación»* del PRD del servicio, un `limit` por encima del máximo deja de recortarse en silencio y pasa a devolver **422**. Las peticiones actuales de 500 y 200 artículos empezarán a fallar de forma visible, que es justo lo que se busca. Esta historia debe adaptarlas.

**Acceptance Criteria:**
- [ ] El historial pasa `page` y `limit` explícitos y usa el `total` del servicio para su paginación
- [ ] El filtro por empleado se envía al servicio y deja de aplicarse tras la paginación
- [ ] Las métricas agregadas se calculan sobre el conjunto completo, no sobre una página
- [ ] La búsqueda de productos de la pantalla de venta usa el parámetro `name` del servicio en lugar de filtrar en memoria un catálogo descargado
- [ ] El panel de inventario pagina contra el servicio en vez de recortar en el cliente, de modo que su indicador de total y su tabla dejen de discrepar
- [ ] Ninguna petición solicita un `limit` por encima del máximo documentado del endpoint
- [ ] Se actualiza la prueba `lib/actions.test.ts:464`, que hoy asevera el filtrado posterior a la paginación

---

### US-011: Revalidar el estado y el plan de la tienda en cada renovación de sesión
**Description:** Como operador de la plataforma, quiero que suspender una tienda surta efecto, en lugar de esperar a que caduque su sesión.

**Contexto:** `auth.config.ts:54-66` escribe `organizationStatus` y `organizationPlan` en el JWT una sola vez, al iniciar sesión, y nunca los revalida. No hay `session.maxAge` configurado, así que rige el valor por defecto de 30 días: `app/superadmin/actions.ts:14-23` cambia una fila que ya nadie vuelve a leer y una tienda suspendida puede seguir vendiendo casi un mes.

**Acceptance Criteria:**
- [ ] El callback `jwt` vuelve a leer estado y plan de la organización en las renovaciones, no solo en el inicio de sesión
- [ ] Una tienda suspendida deja de poder operar sin necesidad de cerrar sesión
- [ ] Se establece un `maxAge` de sesión acorde a un punto de venta
- [ ] Existe una prueba del comportamiento de suspensión

## Functional Requirements

- FR-1: Ningún dato de la sesión servida al navegador puede contener credenciales. Los secretos residen únicamente en el JWT cifrado o en el servidor.
- FR-2: Toda acción exportada desde un fichero `"use server"` debe verificar la sesión antes de cualquier efecto, y el rol cuando la operación lo requiera.
- FR-3: La organización de una petición se deriva siempre de la sesión. No puede existir un valor alternativo procedente del entorno.
- FR-4: Toda consulta a la base de datos local debe filtrar por `organization_id`.
- FR-5: Los importes que llegan de la API se convierten una sola vez, en el borde, y nunca se asume que sean números.
- FR-6: Los importes de una factura proceden del servicio, nunca del cliente.
- FR-7: Toda petición saliente lleva timeout y conserva el código de estado HTTP.
- FR-8: Todo texto visible para el usuario reside en `messages/es.json` y `messages/en.json`.

## Non-Goals

- Trasladar las pantallas del punto de venta a obtención de datos en servidor; hoy todas cargan por `useEffect`. Es una mejora de rendimiento relevante, pero no de seguridad.
- Persistir el impuesto en la venta. Hoy se muestra en pantalla y en el PDF pero no se envía al servicio, así que historial y factura no cuadran; queda registrado como pregunta abierta.
- Sustituir `STORE_NAME` y `TAX_RATE`, globales del entorno, por valores por tienda.
- Limitar la tasa del registro público, que hoy invoca el secreto de administración sin autenticación previa.
- Corregir el manejo de zonas horarias en los filtros de fecha.
- Reescribir `lib/db.ts`, que ejecuta DDL, una migración destructiva y un seed al importarse.
- Adoptar `@vos/inventory-ui`, que exigiría crear rutas BFF que esta aplicación no tiene.
- Eliminar código muerto, corregir cadenas sin traducir fuera de las historias anteriores o retirar artefactos de compilación del control de versiones.

## Technical Considerations

- La aplicación usa NextAuth v5 con estrategia JWT. `auth.config.ts` debe permanecer libre de dependencias de Node para seguir siendo válido en el runtime de edge; el acceso a SQLite y a bcrypt vive en `auth.ts`. No introducir consultas a base de datos en `auth.config.ts`.
- El middleware reside en `proxy.ts`, nombre que Next 16 emplea en lugar de `middleware.ts`.
- El patrón de autorización de referencia es `app/staff/actions.ts:9-13`.
- Las pruebas simulan `apiFetch` por completo (`lib/actions.test.ts:7-10`), razón por la cual ningún desajuste de contrato con el servicio es detectable hoy. `msw` figura en las dependencias de desarrollo y no se usa: es el lugar natural para pruebas de contrato, aunque quedan fuera de este PRD.
- La prueba e2e crea organizaciones reales en el servicio de inventario y las deja huérfanas en cada ejecución. Tenerlo presente al ejecutar `test:e2e`, que no forma parte de los gates.
- El servicio debe estar corriendo y actualizado con los cambios de `prd-tenant-isolation-hardening.md` para verificar US-008 y US-010. `INVENTORY_API_URL` apunta hoy a `http://localhost:3001/v1`, mientras que la aplicación de demostración del repositorio del servicio asume el puerto 3001 para sí misma y el 3000 para el servicio. Confirmar en qué puerto está levantado el servicio antes de dar por fallida una verificación.

## Success Metrics

- `GET /api/auth/session` no devuelve ninguna credencial de inventario.
- Un POST de server action sin cookie de sesión es rechazado.
- Escanear un producto con precio deja de lanzar `TypeError` en el carrito.
- El filtro de empleados del historial solo muestra usuarios de la propia tienda.
- Suspender una tienda impide vender de inmediato, sin cerrar sesión.

## Open Questions

- El impuesto se muestra en el modal de confirmación y en el PDF, pero no se envía al servicio ni se persiste, de modo que el total del historial y el de la factura no coinciden. ¿Debe persistirse en la venta, o dejar de presentarse como parte del total hasta que el servicio lo admita?
- Al retirar la credencial de la sesión, ¿se prefiere leerla del token en cada petición o consultarla en la base de datos local por `organizationId`? Lo segundo permite revocarla de inmediato; lo primero evita una consulta por petición.
