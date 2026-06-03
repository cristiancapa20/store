"use client"

import { useActionState } from "react"
import { loginAction } from "./actions"

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Store Inventory
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Sign in to continue
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[48px]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[48px]"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-2xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
