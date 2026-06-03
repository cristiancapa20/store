"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/lib/locale-action";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: "es" | "en") => {
    if (next === locale || isPending) return;
    startTransition(() => setLocale(next));
  };

  return (
    <div
      role="group"
      aria-label="Cambiar idioma"
      className="flex items-center gap-0.5 rounded-full bg-brand-100 dark:bg-brand-800/50 p-0.5"
    >
      {(["es", "en"] as const).map((lang) => {
        const isActive = locale === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => switchTo(lang)}
            disabled={isPending}
            aria-pressed={isActive}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all duration-200 min-h-[24px] disabled:opacity-60 ${
              isActive
                ? "bg-brand-600 text-white shadow-sm"
                : "text-brand-500 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-100"
            }`}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}
