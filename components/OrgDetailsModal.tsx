"use client";

import { useEffect, useState } from "react";

type OrgMember = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type OrgDetails = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  plan: string;
  status: string;
  createdAt: string;
  members: OrgMember[];
};

function StatusBadge({ status }: { status: string }) {
  return status === "active" ? (
    <span className="ui-badge-success">Activa</span>
  ) : (
    <span className="ui-badge-danger">Suspendida</span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return plan === "pro" ? (
    <span className="ui-badge bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300">
      Pro
    </span>
  ) : (
    <span className="ui-badge bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60">
      Básico
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-brand-100/60 dark:border-white/5 last:border-0">
      <dt className="text-sm text-brand-500 dark:text-brand-400 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-right text-brand-900 dark:text-brand-100 truncate">
        {value}
      </dd>
    </div>
  );
}

export default function OrgDetailsModal({
  org,
  triggerClassName,
  children,
}: {
  org: OrgDetails;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer font-medium text-brand-700 dark:text-brand-300 bg-brand-50 hover:bg-brand-100 dark:bg-brand-800/40 dark:hover:bg-brand-800/70 transition-colors"
        }
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {org.name}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={org.name}
            className="ui-card w-[92vw] sm:w-[480px] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(10,25,49,0.30)]">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-brand-900 dark:text-brand-50 leading-tight truncate">
                    {org.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <PlanBadge plan={org.plan} />
                    <StatusBadge status={org.status} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-800/40 hover:text-brand-700 dark:hover:text-brand-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info rows */}
            <dl>
              <Row label="Email" value={org.email} />
              <Row label="Teléfono" value={org.phone ?? "—"} />
              <Row label="Dirección" value={org.address ?? "—"} />
              <Row label="Registrada el" value={new Date(org.createdAt).toLocaleDateString("es")} />
              <Row label="Miembros" value={org.members.length} />
            </dl>

            {/* Team */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-400 dark:text-brand-500 mb-2">
                Equipo
              </p>
              {org.members.length === 0 ? (
                <p className="text-sm text-brand-500 dark:text-brand-400">Sin usuarios registrados.</p>
              ) : (
                <div className="space-y-2">
                  {org.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-800 flex items-center justify-center shrink-0 text-xs font-bold text-brand-600 dark:text-brand-300">
                        {member.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-brand-900 dark:text-brand-50 truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-brand-500 dark:text-brand-400 truncate">
                          {member.email}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-300">
                        {member.role === "admin" ? "Administrador" : "Empleado"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-1 border-t border-brand-100/60 dark:border-white/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-400 dark:text-brand-500 mb-2 mt-3">
                Acciones
              </p>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
