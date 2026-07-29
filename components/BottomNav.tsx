"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import PlanCard from "./PlanCard";

type NavKey =
  | "sell"
  | "products"
  | "addProduct"
  | "adjustStock"
  | "history"
  | "guide"
  | "profile"
  | "staff";

const StoreIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const allTabs: { href: string; key: NavKey; icon: React.ReactNode; adminOnly?: boolean }[] = [
  {
    href: "/sell",
    key: "sell",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6M9 21h6" />
      </svg>
    ),
  },
  {
    href: "/products",
    key: "products",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: "/products/new",
    key: "addProduct",
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/adjust",
    key: "adjustStock",
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    href: "/history",
    key: "history",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/staff",
    key: "staff",
    adminOnly: true,
    icon: <UsersIcon />,
  },
  {
    href: "/guide",
    key: "guide",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/profile",
    key: "profile",
    icon: <StoreIcon />,
  },
];

// Gana la pestaña cuya ruta case mas larga: si no, /products/new encendia a la
// vez "Inventario" y "Agregar", porque /products es prefijo suyo.
function matchLength(pathname: string, href: string) {
  if (pathname === href) return href.length;
  if (pathname.startsWith(href + "/")) return href.length;
  return -1;
}

function isActive(pathname: string, href: string) {
  const own = matchLength(pathname, href);
  if (own < 0) return false;
  return !allTabs.some((tab) => matchLength(pathname, tab.href) > own);
}

type Props = {
  userRole?: string;
  organizationPlan?: string | null;
  organizationName?: string | null;
};

export default function BottomNav({ userRole, organizationPlan, organizationName }: Props) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const isAdmin = userRole === "admin";
  const visibleTabs = allTabs.filter(tab => !tab.adminOnly || isAdmin);
  const mainTabs = visibleTabs.filter(tab => tab.key !== "profile");
  const profileTab = visibleTabs.find(tab => tab.key === "profile")!;

  // La pestaña activa se marca con el acento y una barra vertical a la
  // izquierda; el fondo apenas cambia. Mismo gesto que en las tarjetas: el
  // color marca el estado, no un bloque solido.
  function navLinkClass(active: boolean) {
    return `group relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-sm transition-colors w-full ${
      active
        ? "text-accent font-medium bg-[var(--accent-wash)]"
        : "text-muted hover:text-content"
    }`;
  }

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 z-40 bg-bg border-r border-line">
        <div className="flex items-center h-16 px-6 border-b border-line shrink-0">
          <span className="font-display font-bold text-lg tracking-tight text-content">
            {t("appName")}
            <span className="text-accent">.</span>
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {mainTabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={navLinkClass(active)}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent" />
                )}
                {tab.icon}
                <span>{t(tab.key as NavKey)}</span>
              </Link>
            );
          })}
        </nav>

        <PlanCard role={userRole} plan={organizationPlan} />

        <div className="px-3 pb-4 pt-2 border-t border-line">
          {(() => {
            const active = isActive(pathname, profileTab.href);
            return (
              <Link
                href={profileTab.href}
                className={navLinkClass(active)}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent" />
                )}
                {profileTab.icon}
                <span className="truncate">{organizationName || t("profile")}</span>
              </Link>
            );
          })()}
        </div>
      </aside>

      {/* Barra inferior movil */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 max-w-md mx-auto pointer-events-none">
        <div
          className="pointer-events-auto rounded-2xl px-1.5 py-1.5 bg-surface border border-line"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          <div className="flex items-center justify-around gap-0.5">
            {visibleTabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1.5 gap-1 rounded-xl transition-colors ${
                    active ? "text-accent bg-[var(--accent-wash)]" : "text-muted"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.icon}
                  {/* Sans y sin mayusculas a proposito: con ocho pestañas a
                      390px, la mono en caja alta no entra y se trunca. */}
                  <span className="text-[9px] font-medium leading-none truncate max-w-full px-0.5">
                    {t(tab.key as NavKey)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
