"use client";

import { useTransition } from "react";
import { setTheme } from "@/lib/theme-action";

const SunIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

export default function ThemeToggle({ current }: { current: "light" | "dark" }) {
  const [isPending, startTransition] = useTransition();
  const isDark = current === "dark";

  const toggle = () => {
    startTransition(() => {
      setTheme(isDark ? "light" : "dark");
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      onClick={toggle}
      disabled={isPending}
      className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-xl
                 text-muted hover:text-accent transition-colors disabled:opacity-60"
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
