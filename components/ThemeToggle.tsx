"use client";

import { useTransition } from "react";
import { setTheme } from "@/lib/theme-action";

const SunIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
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
      className={`relative flex items-center w-[52px] h-[28px] rounded-full transition-colors duration-300 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
        isDark
          ? "bg-brand-600"
          : "bg-brand-200 dark:bg-brand-700/60"
      }`}
    >
      {/* Track icons */}
      <span className={`absolute left-2 text-white/80 transition-opacity duration-200 ${isDark ? "opacity-0" : "opacity-100"}`}>
        <SunIcon />
      </span>
      <span className={`absolute right-2 text-white/80 transition-opacity duration-200 ${isDark ? "opacity-100" : "opacity-0"}`}>
        <MoonIcon />
      </span>

      {/* Sliding thumb */}
      <span
        className={`absolute top-[3px] w-[22px] h-[22px] rounded-full shadow-md
          flex items-center justify-center text-brand-600 transition-all duration-300
          ${isDark
            ? "left-[27px] bg-white"
            : "left-[3px] bg-white"
          }`}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}
