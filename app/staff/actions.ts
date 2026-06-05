"use server"

import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import db from "@/lib/db"

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "admin") throw new Error("Unauthorized")
  return session.user
}

export async function createStaff(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const user = await requireAdmin()

  const name = (formData.get("name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim().toLowerCase()
  const password = formData.get("password") as string

  if (!name || !email || !password) {
    return { error: "Todos los campos son requeridos." }
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." }
  }

  const orgId = user.organizationId
  const plan = user.organizationPlan ?? "basic"

  // Enforce plan limit: basic = max 2 staff
  if (plan === "basic") {
    const count = (
      db
        .prepare("SELECT COUNT(*) AS c FROM users WHERE organization_id = ?")
        .get(orgId) as { c: number }
    ).c
    if (count >= 2) {
      return {
        error:
          "Límite del plan alcanzado (2 usuarios). Mejora a Pro para agregar más empleados.",
      }
    }
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email)
  if (existing) return { error: "Este email ya está en uso." }

  const hash = await bcrypt.hash(password, 10)
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, organization_id)
    VALUES (?, ?, ?, ?, 'staff', ?)
  `).run(randomUUID(), name, email, hash, orgId)

  revalidatePath("/staff")
  return null
}

export async function deleteStaff(userId: string): Promise<void> {
  const user = await requireAdmin()
  // Only delete users that belong to the same organization
  db.prepare(
    "DELETE FROM users WHERE id = ? AND organization_id = ? AND role = 'staff'"
  ).run(userId, user.organizationId)
  revalidatePath("/staff")
}
