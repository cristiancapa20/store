import { auth } from "@/auth"

export type ActionError = { error: string }
export type ActionResult<T> = T | ActionError

export async function getInventoryConfig() {
  const session = await auth()
  return {
    apiKey:
      session?.user?.inventoryApiKey ??
      process.env.INVENTORY_API_KEY ??
      "",
    locationId:
      session?.user?.inventoryLocationId ??
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
