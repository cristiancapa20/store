"use client"

import { useActionState } from "react"
import Link from "next/link"
import { registerAction } from "./actions"

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, null)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-brand-50 via-[#d8efff] to-brand-100 dark:from-brand-950 dark:via-brand-900 dark:to-brand-950">
      <div className="ui-shell w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-50 tracking-tight">
            Mi Comercio
          </h1>
          <p className="text-brand-700/70 dark:text-brand-100/60 mt-1 text-sm">
            Crea tu cuenta gratis
          </p>
        </div>

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
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="ui-input"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="ui-label mb-1.5">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              className="ui-input"
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
      </div>
    </div>
  )
}
