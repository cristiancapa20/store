"use server"

import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"
import { signIn } from "@/auth"
import { AuthError } from "next-auth"
import db from "@/lib/db"
import { resolveInventoryTimeoutMs } from "@/lib/inventoryClient"

type RegisterState = { error: string } | null

export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const storeName = (formData.get("storeName") as string)?.trim()
  const ownerName = (formData.get("ownerName") as string)?.trim()
  const email = (formData.get("email") as string)?.trim().toLowerCase()
  const phone = (formData.get("phone") as string)?.trim()
  const address = (formData.get("address") as string)?.trim()
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!storeName || !ownerName || !email || !password || !confirmPassword) {
    return { error: "Todos los campos son requeridos." }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email no es válido." }
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." }
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." }
  }

  const emailInUse =
    db.prepare("SELECT id FROM users WHERE email = ?").get(email) ||
    db.prepare("SELECT id FROM organizations WHERE email = ?").get(email)
  if (emailInUse) {
    return { error: "Este email ya está registrado." }
  }

  // Provision Organization in Inventory Service
  const adminSecret = process.env.INVENTORY_ADMIN_SECRET ?? ""
  const apiBase = (process.env.INVENTORY_API_URL ?? "").replace(/\/v1\/?$/, "")

  let inventoryOrgId: string | null = null
  let inventoryApiKey: string | null = null
  let inventoryLocationId: string | null = null

  const inventoryConfigured = !!apiBase && !!adminSecret

  if (inventoryConfigured) {
    try {
      // El aprovisionamiento son tres llamadas encadenadas: sin timeout, un
      // servicio colgado deja el registro esperando hasta que la plataforma
      // mata la peticion. Cada una aborta por su cuenta y cae en el catch.
      const timeoutMs = resolveInventoryTimeoutMs()

      // 1. Create organization
      const orgRes = await fetch(`${apiBase}/v1/admin/organizations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ name: storeName }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!orgRes.ok) {
        if (process.env.NODE_ENV === "production") {
          return { error: "Servicio no disponible, intenta más tarde." }
        }
        console.warn("[register] inventory org creation failed, proceeding without inventory linkage")
      } else {
        const org = (await orgRes.json()) as { id: string }
        inventoryOrgId = org.id

        // 2. Create API key
        const keyRes = await fetch(
          `${apiBase}/v1/admin/organizations/${inventoryOrgId}/api-keys`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminSecret}`,
            },
            body: JSON.stringify({ name: `${storeName} - Main` }),
            signal: AbortSignal.timeout(timeoutMs),
          }
        )
        if (!keyRes.ok) {
          if (process.env.NODE_ENV === "production") {
            return { error: "Servicio no disponible, intenta más tarde." }
          }
          console.warn("[register] inventory api-key creation failed, proceeding without inventory linkage")
        } else {
          const keyData = (await keyRes.json()) as { plainKey: string }
          inventoryApiKey = keyData.plainKey

          // 3. Create default location
          const locRes = await fetch(`${apiBase}/v1/locations`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${inventoryApiKey}`,
            },
            body: JSON.stringify({ name: `${storeName} - Principal` }),
            signal: AbortSignal.timeout(timeoutMs),
          })
          if (!locRes.ok) {
            if (process.env.NODE_ENV === "production") {
              return { error: "Servicio no disponible, intenta más tarde." }
            }
            console.warn("[register] inventory location creation failed, proceeding without inventory linkage")
          } else {
            const loc = (await locRes.json()) as { id: string }
            inventoryLocationId = loc.id
          }
        }
      }
    } catch {
      if (process.env.NODE_ENV === "production") {
        return { error: "Servicio no disponible, intenta más tarde." }
      }
      console.warn("[register] inventory service unreachable, proceeding without inventory linkage")
    }
  }

  // Persist to SQLite
  const orgId = randomUUID()
  db.prepare(`
    INSERT INTO organizations
      (id, name, email, phone, address, plan, status,
       inventory_org_id, inventory_api_key, inventory_location_id)
    VALUES (?, ?, ?, ?, ?, 'basic', 'active', ?, ?, ?)
  `).run(orgId, storeName, email, phone || null, address || null,
         inventoryOrgId, inventoryApiKey, inventoryLocationId)

  const userId = randomUUID()
  const hash = await bcrypt.hash(password, 10)
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, organization_id)
    VALUES (?, ?, ?, ?, 'admin', ?)
  `).run(userId, ownerName, email, hash, orgId)

  // Auto-login
  try {
    await signIn("credentials", { email, password, redirectTo: "/sell" })
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Registro exitoso. Por favor inicia sesión." }
    }
    throw err
  }
  return null
}
