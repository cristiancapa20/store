import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mi Comercio",
  description: "Gestión de inventario y ventas para tu tienda",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mi Comercio",
  },
};

export const viewport: Viewport = {
  themeColor: "#4a5cba",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const locale = await getLocale();
  const messages = await getMessages();
  const tUserMenu = await getTranslations("userMenu");
  const tNav = await getTranslations("nav");

  const cookieStore = await cookies();
  const theme = cookieStore.get("STORE_THEME")?.value === "dark" ? "dark" : "light";
  const isDark = theme === "dark";

  const role = session?.user?.role;
  const isSuperAdmin = role === "super_admin";
  const isAuthenticated = !!session?.user;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body
        className="h-full bg-[var(--bg-base)] text-[var(--text-primary)]"
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          {/* Super admin layout */}
          {isSuperAdmin && (
            <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
              <header className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shrink-0 text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-[var(--text-primary)] text-base tracking-tight truncate">
                      {tNav("appName")}
                    </span>
                    <span className="ml-2 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-300 align-middle">
                      {tUserMenu("roleSuperAdmin")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <ThemeToggle current={theme} />
                  <LanguageSwitcher />
                  <UserMenu
                    name={session?.user.name ?? ""}
                    roleLabel={tUserMenu("roleSuperAdmin")}
                    openMenuLabel={tUserMenu("openMenu")}
                  >
                    <LogoutButton variant="menuitem" />
                  </UserMenu>
                </div>
              </header>
              <main className="p-4 sm:p-6">{children}</main>
            </div>
          )}

          {/* Admin / staff layout */}
          {isAuthenticated && !isSuperAdmin && (
            <>
              <BottomNav
                userRole={role}
                organizationPlan={session.user.organizationPlan}
                organizationName={session.user.organizationName}
              />
              <div className="flex flex-col min-h-screen lg:pl-56">
                <header className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 min-w-0 rounded-lg -mx-1.5 px-1.5 py-1 hover:bg-brand-50 dark:hover:bg-brand-800/40 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-800/50 flex items-center justify-center shrink-0 text-brand-600 dark:text-brand-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9.75L12 4l9 5.75M4.5 10.5V19a1 1 0 001 1h4v-5h5v5h4a1 1 0 001-1v-8.5" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {session.user.organizationName}
                    </span>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <ThemeToggle current={theme} />
                    <LanguageSwitcher />
                    <UserMenu
                      name={session.user.name ?? ""}
                      roleLabel={role === "admin" ? tUserMenu("roleAdmin") : tUserMenu("roleStaff")}
                      organizationName={session.user.organizationName}
                      openMenuLabel={tUserMenu("openMenu")}
                    >
                      <LogoutButton variant="menuitem" />
                    </UserMenu>
                  </div>
                </header>
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6" style={{ background: "var(--bg-base)" }}>
                  {children}
                </main>
              </div>
            </>
          )}

          {/* Unauthenticated (landing, login, register) */}
          {!isAuthenticated && children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
