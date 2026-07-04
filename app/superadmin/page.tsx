import { auth } from "@/auth"
import { notFound } from "next/navigation"
import db from "@/lib/db"
import OrgDetailsModal from "@/components/OrgDetailsModal"
import { toggleOrgStatus, changeOrgPlan } from "./actions"

type OrgRow = {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  plan: string
  status: string
  created_at: string
  user_count: number
}

type OrgMemberRow = {
  id: string
  name: string
  email: string
  role: string
  organization_id: string
}

function StatusBadge({ status }: { status: string }) {
  return status === "active" ? (
    <span className="ui-badge-success">Activa</span>
  ) : (
    <span className="ui-badge-danger">Suspendida</span>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  return plan === "pro" ? (
    <span className="ui-badge bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300">
      Pro
    </span>
  ) : (
    <span className="ui-badge bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60">
      Básico
    </span>
  )
}

export default async function SuperAdminPage() {
  const session = await auth()
  if (session?.user?.role !== "super_admin") notFound()

  const orgs = db
    .prepare(`
      SELECT o.id, o.name, o.email, o.phone, o.address, o.plan, o.status, o.created_at,
             COUNT(u.id) AS user_count
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `)
    .all() as OrgRow[]

  const members = db
    .prepare(`
      SELECT id, name, email, role, organization_id
      FROM users
      WHERE organization_id IS NOT NULL
      ORDER BY role = 'admin' DESC, name
    `)
    .all() as OrgMemberRow[]

  const membersByOrg = new Map<string, OrgMemberRow[]>()
  for (const member of members) {
    const list = membersByOrg.get(member.organization_id) ?? []
    list.push(member)
    membersByOrg.set(member.organization_id, list)
  }

  const orgDetails = new Map(
    orgs.map((org) => [
      org.id,
      {
        id: org.id,
        name: org.name,
        email: org.email,
        phone: org.phone,
        address: org.address,
        plan: org.plan,
        status: org.status,
        createdAt: org.created_at,
        members: membersByOrg.get(org.id) ?? [],
      },
    ])
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-page-title">Tiendas registradas</h1>
        <p className="text-sm text-brand-600 dark:text-brand-300 mt-1">
          {orgs.length} {orgs.length === 1 ? "tienda" : "tiendas"} en la plataforma
        </p>
      </div>

      {orgs.length === 0 ? (
        <div className="ui-alert-info">No hay tiendas registradas aún.</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="lg:hidden space-y-3">
            {orgs.map((org) => (
              <div key={org.id} className="ui-card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <OrgDetailsModal
                      org={orgDetails.get(org.id)!}
                      triggerClassName="font-semibold text-brand-900 dark:text-brand-50 truncate hover:text-brand-600 dark:hover:text-brand-300 hover:underline transition-colors block cursor-pointer"
                    >
                      <OrgActions org={org} />
                    </OrgDetailsModal>
                    <p className="text-sm text-brand-600 dark:text-brand-300 truncate">
                      {org.email}
                    </p>
                    {org.phone && (
                      <p className="text-xs text-brand-500 dark:text-brand-400">
                        {org.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge status={org.status} />
                    <PlanBadge plan={org.plan} />
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-brand-500 dark:text-brand-400">
                  <span>{org.user_count} {org.user_count === 1 ? "empleado" : "empleados"}</span>
                  <span>{new Date(org.created_at).toLocaleDateString("es")}</span>
                </div>
                <OrgActions org={org} />
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden lg:block ui-card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 dark:border-white/10">
                  <th className="text-left px-5 py-3.5 font-semibold text-brand-600 dark:text-brand-300">Tienda</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-brand-600 dark:text-brand-300">Email</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-brand-600 dark:text-brand-300">Plan</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-brand-600 dark:text-brand-300">Estado</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-brand-600 dark:text-brand-300">Empleados</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-brand-600 dark:text-brand-300">Registro</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {orgs.map((org, i) => (
                  <tr
                    key={org.id}
                    className={`border-b border-brand-100/60 dark:border-white/5 last:border-0 ${
                      i % 2 === 1 ? "bg-brand-50/40 dark:bg-white/[0.02]" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 font-medium text-brand-900 dark:text-brand-50">
                      <OrgDetailsModal org={orgDetails.get(org.id)!}>
                        <OrgActions org={org} compact />
                      </OrgDetailsModal>
                    </td>
                    <td className="px-5 py-3.5 text-brand-600 dark:text-brand-300">{org.email}</td>
                    <td className="px-5 py-3.5"><PlanBadge plan={org.plan} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={org.status} /></td>
                    <td className="px-5 py-3.5 text-brand-600 dark:text-brand-300">{org.user_count}</td>
                    <td className="px-5 py-3.5 text-brand-500 dark:text-brand-400 text-xs">
                      {new Date(org.created_at).toLocaleDateString("es")}
                    </td>
                    <td className="px-5 py-3.5">
                      <OrgActions org={org} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function OrgActions({ org, compact = false }: { org: OrgRow; compact?: boolean }) {
  return (
    <div className={`flex gap-2 ${compact ? "justify-end" : ""}`}>
      <form
        action={async () => {
          "use server"
          await toggleOrgStatus(org.id)
        }}
      >
        <button
          type="submit"
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            org.status === "active"
              ? "bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400"
              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 dark:text-emerald-400"
          }`}
        >
          {org.status === "active" ? "Suspender" : "Activar"}
        </button>
      </form>

      <form
        action={async () => {
          "use server"
          await changeOrgPlan(org.id, org.plan === "basic" ? "pro" : "basic")
        }}
      >
        <button
          type="submit"
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 dark:text-brand-300 transition-colors"
        >
          {org.plan === "basic" ? "→ Pro" : "→ Básico"}
        </button>
      </form>
    </div>
  )
}
