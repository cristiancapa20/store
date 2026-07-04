"use client"

import { useActionState } from "react"
import Link from "next/link"
import { registerAction } from "./actions"
import PasswordInput from "@/components/PasswordInput"
import AuthLayout from "@/components/AuthLayout"

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, null)

  return (
    <AuthLayout title="Crea tu cuenta gratis" description="Empieza a vender en minutos" formMaxWidth="md">
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="storeName" className="ui-label mb-1.5">
            Nombre de tu tienda
          </label>
          <input
            id="storeName"
            name="storeName"
            type="text"
            required
            className="ui-input"
            placeholder="Ej: Minimarket El Centro"
          />
        </div>

        <div>
          <label htmlFor="ownerName" className="ui-label mb-1.5">
            Tu nombre
          </label>
          <input
            id="ownerName"
            name="ownerName"
            type="text"
            required
            className="ui-input"
            placeholder="Tu nombre completo"
          />
        </div>

        <div>
          <label htmlFor="email" className="ui-label mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="ui-input"
            placeholder="tu@ejemplo.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="phone" className="ui-label mb-1.5">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="ui-input"
              placeholder="+593 99 000 0000"
            />
          </div>
          <div>
            <label htmlFor="address" className="ui-label mb-1.5">
              Dirección
            </label>
            <input
              id="address"
              name="address"
              type="text"
              className="ui-input"
              placeholder="Av. Principal 123"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="ui-label mb-1.5">
            Contraseña
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="ui-label mb-1.5">
            Confirmar contraseña
          </label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>

        {state?.error && (
          <p className="ui-alert-error text-center">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="ui-btn-primary-block mt-2"
        >
          {pending ? "Creando cuenta…" : "Crear cuenta gratis"}
        </button>

        <p className="text-center text-sm text-brand-700/60 dark:text-brand-300/60 mt-2">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
