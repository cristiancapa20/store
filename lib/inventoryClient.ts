import { auth } from "@/auth"
import db from "@/lib/db"

export type ActionError = { error: string }
export type ActionResult<T> = T | ActionError

type OrgCredentials = {
  inventory_api_key: string | null
  inventory_location_id: string | null
}

// La credencial nunca viaja en la sesion: solo el organizationId, y el servidor
// la resuelve aqui contra la tabla organizations.
export async function getInventoryConfig() {
  const session = await auth()
  const organizationId = session?.user?.organizationId

  let credentials: OrgCredentials | undefined
  if (organizationId) {
    credentials = db
      .prepare(
        "SELECT inventory_api_key, inventory_location_id FROM organizations WHERE id = ?"
      )
      .get(organizationId) as OrgCredentials | undefined
  }

  return {
    apiKey:
      credentials?.inventory_api_key ??
      process.env.INVENTORY_API_KEY ??
      "",
    locationId:
      credentials?.inventory_location_id ??
      process.env.INVENTORY_LOCATION_ID ??
      "",
    apiBase: process.env.INVENTORY_API_URL ?? "",
  }
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
