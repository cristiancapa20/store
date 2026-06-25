"use client"

import Link from "next/link"

type Props = {
  role?: string
  plan?: string | null
}

export default function PlanCard({ role, plan }: Props) {
  if (role !== "admin") return null

  if (plan === "pro") {
    return (
      <div className="mx-3 mb-3 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Plan Pro ✓
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-3 mb-3 px-4 py-3 rounded-2xl bg-brand-50 dark:bg-brand-900/30 border border-brand-200/60 dark:border-brand-700/30">
      <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 mb-0.5">
        Plan Básico · $9/mes
      </p>
      <p className="text-xs text-brand-500 dark:text-brand-400 mb-2">
        500 productos · 2 usuarios
      </p>
      <Link
        href="/plans"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
      >
        Mejorar a Pro →
      </Link>
    </div>
  )
}
