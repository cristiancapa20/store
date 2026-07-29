"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/lib/locale-action";

// Un solo control "ES / EN" en mono, no dos pastillas: ocupa menos en la barra
// y el idioma activo se lee por color, igual que en el portafolio.
export default function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const current = locale === "en" ? "en" : "es";
  const other = current === "es" ? "en" : "es";

  return (
    <button
      type="button"
      onClick={() => !isPending && startTransition(() => setLocale(other))}
      disabled={isPending}
      aria-label={`Cambiar idioma a ${other.toUpperCase()}`}
      className="flex items-center justify-center min-h-[48px] px-3 rounded-xl
                 font-mono text-xs transition-colors disabled:opacity-60"
    >
      <span className={current === "es" ? "text-accent" : "text-muted"}>ES</span>
      <span className="mx-1 text-muted/40">/</span>
      <span className={current === "en" ? "text-accent" : "text-muted"}>EN</span>
    </button>
  );
}
