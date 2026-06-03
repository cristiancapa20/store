"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type NavKey = "sell" | "products" | "addProduct" | "adjustStock" | "history" | "guide" | "profile";

const StoreIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const tabs: { href: string; key: NavKey; icon: React.ReactNode }[] = [
  {
    href: "/sell",
    key: "sell",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6M9 21h6" />
      </svg>
    ),
  },
  {
    href: "/products",
    key: "products" as NavKey,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: "/products/new",
    key: "addProduct" as NavKey,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/adjust",
    key: "adjustStock" as NavKey,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    href: "/history",
    key: "history" as NavKey,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/guide",
    key: "guide" as NavKey,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/profile",
    key: "profile" as NavKey,
    icon: <StoreIcon />,
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/products/new") return pathname === "/products/new";
  return pathname === href || (pathname.startsWith(href) && href !== "/products/new");
}

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  // Main tabs (all except profile)
  const mainTabs = tabs.filter((tab) => tab.key !== "profile");
  const profileTab = tabs.find((tab) => tab.key === "profile")!;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-4 left-4 w-56 bg-surface dark:bg-brand-900 rounded-[2rem] shadow-[0_20px_56px_rgba(3,15,34,0.14)] z-40 py-6">
        {/* Brand */}
        <div className="px-6 pb-4">
          <span className="font-semibold text-brand-900 dark:text-brand-50 text-base tracking-tight">
            {t("appName")}
          </span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {mainTabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-all ${
                  active
                    ? "bg-brand-600 text-white shadow-[0_8px_24px_rgba(74,92,186,0.30)]"
                    : "text-brand-800/70 dark:text-brand-100/65 hover:bg-brand-100 dark:hover:bg-brand-800/40 hover:text-brand-900 dark:hover:text-brand-50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {tab.icon}
                <span>{t(tab.key)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Divider + Profile pinned at bottom */}
        <div className="px-4 pt-2 pb-2">
          <div className="h-px bg-brand-100 dark:bg-brand-800/60 mb-3" />
          {(() => {
            const active = isActive(pathname, profileTab.href);
            return (
              <Link
                href={profileTab.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-all ${
                  active
                    ? "bg-brand-600 text-white shadow-[0_8px_24px_rgba(74,92,186,0.30)]"
                    : "text-brand-800/70 dark:text-brand-100/65 hover:bg-brand-100 dark:hover:bg-brand-800/40 hover:text-brand-900 dark:hover:text-brand-50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {profileTab.icon}
                <span>{t("profile")}</span>
              </Link>
            );
          })()}
        </div>
      </aside>

      {/* Mobile bottom nav — all tabs including profile */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 max-w-md mx-auto pointer-events-none">
        <div className="pointer-events-auto bg-surface dark:bg-brand-900 rounded-full shadow-[0_16px_48px_rgba(3,15,34,0.18)] px-1 py-1.5">
          <div className="flex items-center justify-around gap-0.5 px-1">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1.5 gap-0.5 text-[9px] sm:text-[11px] font-medium transition-all rounded-full ${
                    active
                      ? "bg-brand-600 text-white shadow-[0_6px_18px_rgba(74,92,186,0.35)]"
                      : "text-brand-800/65 dark:text-brand-100/60"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.icon}
                  <span className="truncate max-w-full px-0.5">{t(tab.key)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
