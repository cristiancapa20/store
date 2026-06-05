import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { auth } from "@/auth";

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
            <div className="min-h-screen">
              <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <span className="font-semibold text-[var(--text-primary)] text-sm">
                  Mi Comercio — Super Admin
                  <span className="ml-2 font-normal text-[var(--text-muted)]">
                    {session?.user.name}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <ThemeToggle current={theme} />
                  <LanguageSwitcher />
                  <LogoutButton />
                </div>
              </header>
              <main className="p-6">{children}</main>
            </div>
          )}

          {/* Admin / staff layout */}
          {isAuthenticated && !isSuperAdmin && (
            <>
              <BottomNav
                userRole={role}
                organizationPlan={session.user.organizationPlan}
              />
              <div className="flex flex-col h-full lg:pl-64 p-3 sm:p-4 lg:p-6 min-h-0">
                <div className="ui-shell flex-1 w-full max-w-md lg:max-w-none mx-auto min-h-0 h-full lg:max-h-[calc(100vh-3rem)]">
                  <header className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 shrink-0 border-b border-[var(--border-color)]">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {session.user.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <ThemeToggle current={theme} />
                      <LanguageSwitcher />
                      <LogoutButton />
                    </div>
                  </header>
                  <main className="ui-panel pb-24 lg:pb-5">
                    {children}
                  </main>
                </div>
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
