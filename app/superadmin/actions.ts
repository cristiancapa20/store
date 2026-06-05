"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import db from "@/lib/db"

async function requireSuperAdmin() {
  const session = await auth()
  if (session?.user?.role !== "super_admin") {
    throw new Error("Unauthorized")
  }
}

export async function toggleOrgStatus(orgId: string): Promise<void> {
  await requireSuperAdmin()
  const org = db
    .prepare("SELECT status FROM organizations WHERE id = ?")
    .get(orgId) as { status: string } | undefined
  if (!org) return
  const next = org.status === "active" ? "inactive" : "active"
  db.prepare("UPDATE organizations SET status = ? WHERE id = ?").run(next, orgId)
  revalidatePath("/superadmin")
}

export async function changeOrgPlan(
  orgId: string,
  plan: "basic" | "pro"
): Promise<void> {
  await requireSuperAdmin()
  db.prepare("UPDATE organizations SET plan = ? WHERE id = ?").run(plan, orgId)
  revalidatePath("/superadmin")
}
