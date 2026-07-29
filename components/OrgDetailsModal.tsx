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
<span className="ui-tag-accent">Pro</span>
  ) : (
<span className="ui-tag">Básico</span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <dt className="text-sm text-muted shrink-0">{label}</dt>
      <dd className="text-sm text-right text-content truncate">
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
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer font-medium text-content hover:text-accent transition-colors"
        }
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {org.name}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={org.name}
            className="w-[92vw] sm:w-[480px] max-h-[90vh] overflow-y-auto rounded-3xl border border-line bg-surface p-6 flex flex-col gap-5 animate-fade-in-up"
            style={{ boxShadow: "var(--shadow-pop)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl border border-line flex items-center justify-center shrink-0 text-accent">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-content leading-tight truncate">
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
                className="shrink-0 w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-muted hover:text-content transition-colors"
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
              <p className="ui-eyebrow mb-3">Equipo</p>
              {org.members.length === 0 ? (
                <p className="text-sm text-muted">Sin usuarios registrados.</p>
              ) : (
                <div className="space-y-2">
                  {org.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full border border-line flex items-center justify-center shrink-0 font-mono text-[11px] text-accent">
                        {member.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-content truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {member.email}
                        </p>
                      </div>
                      <span className="ui-tag shrink-0">
                        {member.role === "admin" ? "Administrador" : "Empleado"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-line">
              <p className="ui-eyebrow mb-3">Acciones</p>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
