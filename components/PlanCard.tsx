"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

type Props = {
  role?: string
  plan?: string | null
}

export default function PlanCard({ role, plan }: Props) {
  const t = useTranslations("nav")

  if (role !== "admin") return null

  if (plan === "pro") {
    return (
      <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl border border-line">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-accent">
            {t("planPro")}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-3 mb-2 px-3 py-3 rounded-xl border border-line">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {t("planBasic")}
      </p>
      <p className="mt-1 text-xs text-muted">{t("planBasicLimits")}</p>
      <Link
        href="/plans"
        className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:gap-2 transition-all"
      >
        {t("planUpgrade")} <span aria-hidden>→</span>
      </Link>
    </div>
  )
}
