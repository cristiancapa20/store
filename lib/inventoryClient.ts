import "server-only"
import { auth } from "@/auth"
import db from "@/lib/db"
import type { ActionError, ActionErrorCode, ActionResult } from "./types"

export type InventoryConfig = {
  apiKey: string
  locationId: string
  apiBase: string
}

type OrgCredentials = {
  inventory_api_key: string | null
  inventory_location_id: string | null
}

export class InventoryConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InventoryConfigError"
  }
}

// La credencial nunca viaja en la sesion: solo el organizationId, y el servidor
// la resuelve aqui contra la tabla organizations. No hay respaldo por entorno:
// una credencial global haria que una peticion sin organizacion resuelta leyera
// y escribiera el inventario de otra tienda.
export async function getInventoryConfig(): Promise<InventoryConfig> {
  const apiBase = process.env.INVENTORY_API_URL
  if (!apiBase) {
    throw new InventoryConfigError(
      "Falta INVENTORY_API_URL: define la URL base del servicio de inventario (con sufijo /v1) en .env.local."
    )
  }

  const session = await auth()
  const organizationId = session?.user?.organizationId
  if (!organizationId) {
    throw new InventoryConfigError(
      "No hay organizacion en la sesion: la peticion no puede resolver a que tienda pertenece el inventario."
    )
  }

  const credentials = db
    .prepare(
      "SELECT inventory_api_key, inventory_location_id FROM organizations WHERE id = ?"
    )
    .get(organizationId) as OrgCredentials | undefined

  const apiKey = credentials?.inventory_api_key
  const locationId = credentials?.inventory_location_id
  if (!apiKey || !locationId) {
    throw new InventoryConfigError(
      `La organizacion ${organizationId} no tiene credencial de inventario aprovisionada.`
    )
  }

  return { apiKey, locationId, apiBase }
}

// Un TPV no puede quedarse esperando indefinidamente a un servicio colgado: el
// cajero tiene un cliente delante. Ocho segundos dan margen a una red lenta y
// aun asi devuelven el control a tiempo de reintentar la venta.
export const DEFAULT_INVENTORY_TIMEOUT_MS = 8_000

export type InventoryRequestInit = RequestInit & { timeoutMs?: number }

export function resolveInventoryTimeoutMs(overrideMs?: number): number {
  if (Number.isFinite(overrideMs) && (overrideMs as number) > 0) {
    return overrideMs as number
  }
  const fromEnv = Number(process.env.INVENTORY_TIMEOUT_MS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return DEFAULT_INVENTORY_TIMEOUT_MS
}

// El mensaje del servicio para el 409 de stock lleva el UUID del producto
// ("Insufficient stock for product 6f3a…"): inservible para el cajero, asi que
// se traduce a un codigo y la UI resuelve el texto.
function codeForStatus(
  status: number,
  message: string
): ActionErrorCode | undefined {
  if (status === 401 || status === 403) return "service_auth"
  if (status === 404) return "not_found"
  if (status === 409) {
    return /insufficient stock/i.test(message) ? "insufficient_stock" : "conflict"
  }
  if (status === 422) return "invalid_request"
  if (status >= 500) return "service_error"
  return undefined
}

async function errorFromResponse(res: Response): Promise<ActionError> {
  const text = await res.text().catch(() => "")
  let message = ""
  try {
    const json = JSON.parse(text) as { error?: string; message?: string }
    message = json.error ?? json.message ?? ""
  } catch {
    // Cuerpo no JSON (una pagina de error de un proxy, por ejemplo): no se
    // propaga tal cual a la UI.
    message = ""
  }
  return {
    error: message || `HTTP ${res.status}`,
    code: codeForStatus(res.status, message),
    status: res.status,
  }
}

export async function apiFetch<T>(
  path: string,
  init?: InventoryRequestInit
): Promise<ActionResult<T>> {
  const { apiKey, apiBase } = await getInventoryConfig()
  const { timeoutMs, signal, ...rest } = init ?? {}
  const timeoutSignal = AbortSignal.timeout(resolveInventoryTimeoutMs(timeoutMs))
  try {
    const res = await fetch(`${apiBase}${path}`, {
      ...rest,
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      // Las cabeceras del llamante van primero: puede anadir (Idempotency-Key)
      // pero no puede pisar el Content-Type ni, sobre todo, la credencial.
      headers: {
        ...(rest.headers as Record<string, string> | undefined),
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (!res.ok) return errorFromResponse(res)
    try {
      return (await res.json()) as T
    } catch {
      // Hubo respuesta, asi que no es un fallo de transporte: se conserva el
      // status para que no se confunda con "no se pudo contactar".
      return {
        error: `Malformed response from the inventory service (HTTP ${res.status})`,
        code: "service_error",
        status: res.status,
      }
    }
  } catch (err) {
    // Sin respuesta no hay status: su ausencia es la senal de que el fallo fue
    // de transporte y no una respuesta de error del servicio.
    if (timeoutSignal.aborted || (err instanceof Error && err.name === "TimeoutError")) {
      return { error: `Inventory service timed out after ${resolveInventoryTimeoutMs(timeoutMs)}ms`, code: "timeout" }
    }
    return {
      error: err instanceof Error ? err.message : "Network error",
      code: "network",
    }
  }
}

export async function getProductCount(locationId: string): Promise<number> {
  const result = await apiFetch<{ total: number }>(
    `/locations/${locationId}/inventory?page=1&limit=1`
  )
  if ("error" in result) return 0
  return result.total
}
