import "server-only"
import { auth } from "@/auth"
import db from "@/lib/db"

export type ActionError = { error: string }
export type ActionResult<T> = T | ActionError

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

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<ActionResult<T>> {
  const { apiKey, apiBase } = await getInventoryConfig()
  try {
    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(init?.headers as Record<string, string> | undefined),
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      try {
        const json = JSON.parse(text) as { error?: string; message?: string }
        return { error: json.error ?? json.message ?? `HTTP ${res.status}` }
      } catch {
        return { error: `HTTP ${res.status}` }
      }
    }
    return (await res.json()) as T
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" }
  }
}

export async function getProductCount(locationId: string): Promise<number> {
  const result = await apiFetch<{ total: number }>(
    `/locations/${locationId}/inventory?page=1&limit=1`
  )
  if ("error" in result) return 0
  return result.total
}
