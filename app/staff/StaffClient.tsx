"use client"

import { useActionState, useState } from "react"
import { createStaff, deleteStaff } from "./actions"

type StaffRow = { id: string; name: string; email: string }

type Props = {
  staff: StaffRow[]
  canAdd: boolean
  plan: string
  limit: number | null
}

export default function StaffClient({ staff, canAdd, plan, limit }: Props) {
  const [createState, createAction, creating] = useActionState(createStaff, null)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(userId: string) {
    setDeleting(userId)
    await deleteStaff(userId)
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title">Empleados</h1>
          <p className="text-sm text-brand-600 dark:text-brand-300 mt-0.5">
            {staff.length}{limit !== null ? `/${limit}` : ""} empleados · Plan{" "}
            <span className="font-medium capitalize">{plan}</span>
          </p>
        </div>
        {canAdd && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="ui-btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar
          </button>
        )}
      </div>

      {!canAdd && (
        <div className="ui-alert-info">
          Has alcanzado el límite de {limit} usuarios del plan Básico.{" "}
          <span className="font-medium">Mejora a Pro para agregar más empleados.</span>
        </div>
      )}

      {showForm && (
        <form action={createAction} className="ui-card space-y-4">
          <h2 className="font-semibold text-brand-900 dark:text-brand-50">
            Nuevo empleado
          </h2>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="name" className="ui-label mb-1.5">Nombre</label>
              <input id="name" name="name" type="text" required className="ui-input" placeholder="Nombre completo" />
            </div>
            <div>
              <label htmlFor="email" className="ui-label mb-1.5">Email</label>
              <input id="email" name="email" type="email" required className="ui-input" placeholder="empleado@tienda.com" />
            </div>
            <div>
              <label htmlFor="password" className="ui-label mb-1.5">Contraseña</label>
              <input id="password" name="password" type="password" required className="ui-input" placeholder="Mínimo 8 caracteres" />
            </div>
          </div>

          {createState?.error && (
            <p className="ui-alert-error">{createState.error}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="ui-btn-primary">
              {creating ? "Guardando…" : "Guardar empleado"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="ui-btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {staff.length === 0 ? (
        <div className="ui-alert-info">No hay empleados registrados aún.</div>
      ) : (
        <div className="space-y-2">
          {staff.map((member) => (
            <div key={member.id} className="ui-card flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-brand-900 dark:text-brand-50 truncate">
                  {member.name}
                </p>
                <p className="text-sm text-brand-600 dark:text-brand-300 truncate">
                  {member.email}
                </p>
              </div>
              <button
                onClick={() => handleDelete(member.id)}
                disabled={deleting === member.id}
                className="ui-btn-danger shrink-0 text-xs min-h-[36px] px-3"
              >
                {deleting === member.id ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
