"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/lib/locale-action";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(() => {
      setLocale(locale === "es" ? "en" : "es");
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-800/50 text-brand-800 dark:text-brand-100 shadow-[0_4px_12px_rgba(3,15,34,0.06)] hover:bg-brand-100 transition-colors disabled:opacity-50 min-h-[32px]"
      aria-label={locale === "es" ? "Switch to English" : "Cambiar a Español"}
    >
      {locale === "es" ? "EN" : "ES"}
    </button>
  );
}
