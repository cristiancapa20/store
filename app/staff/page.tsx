import { auth } from "@/auth"
import { notFound } from "next/navigation"
import db from "@/lib/db"
import StaffClient from "./StaffClient"

type StaffRow = { id: string; name: string; email: string }

export default async function StaffPage() {
  const session = await auth()
  if (session?.user?.role !== "admin") notFound()

  const orgId = session.user.organizationId
  const plan = session.user.organizationPlan ?? "basic"

  const staff = db
    .prepare(
      "SELECT id, name, email FROM users WHERE organization_id = ? AND role = 'staff' ORDER BY name"
    )
    .all(orgId) as StaffRow[]

  const limit = plan === "pro" ? null : 2
  const canAdd = limit === null || staff.length < limit

  return (
    <StaffClient
      staff={staff}
      canAdd={canAdd}
      plan={plan}
      limit={limit}
    />
  )
}
