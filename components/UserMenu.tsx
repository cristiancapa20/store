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
        className="flex items-center gap-2.5 pl-1 pr-2 rounded-xl min-h-[48px]
                   text-muted hover:text-content transition-colors"
      >
        <span className="w-8 h-8 shrink-0 rounded-full border border-line bg-surface-2
                         flex items-center justify-center font-mono text-[11px] text-accent">
          {initials(name)}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium text-content truncate max-w-[140px]">
            {name}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {roleLabel}
          </span>
        </span>
        <svg
          className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface
                     z-50 overflow-hidden animate-fade-in-up"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-medium text-content truncate">{name}</p>
            {organizationName && (
              <p className="text-xs text-muted truncate mt-0.5">{organizationName}</p>
            )}
            <span className="ui-tag mt-2">{roleLabel}</span>
          </div>
          <div className="p-2">{children}</div>
        </div>
      )}
    </div>
  );
}
