"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  roleLabel: string;
  organizationName?: string | null;
  openMenuLabel: string;
  children: React.ReactNode;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserMenu({
  name,
  roleLabel,
  organizationName,
  openMenuLabel,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={openMenuLabel}
        className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-full min-h-[48px] hover:bg-brand-50 dark:hover:bg-brand-800/40 transition-colors"
      >
        <span className="w-8 h-8 shrink-0 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
          {initials(name)}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold text-brand-900 dark:text-brand-50 truncate max-w-[140px]">
            {name}
          </span>
          <span className="text-xs text-brand-500 dark:text-brand-400">{roleLabel}</span>
        </span>
        <svg
          className={`w-4 h-4 text-brand-400 dark:text-brand-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[var(--border-color)]">
            <p className="text-sm font-semibold text-brand-900 dark:text-brand-50 truncate">
              {name}
            </p>
            {organizationName && (
              <p className="text-xs text-brand-500 dark:text-brand-400 truncate mt-0.5">
                {organizationName}
              </p>
            )}
            <span className="inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-300">
              {roleLabel}
            </span>
          </div>
          <div className="p-2">{children}</div>
        </div>
      )}
    </div>
  );
}
