import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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

// Tres familias con un rol cada una: display para titulos, sans para cuerpo y
// mono para cifras, codigos de barras y etiquetas. Es la misma reparticion del
// portafolio, y es lo que hace que una columna de precios se lea como un dato
// y no como prosa.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const StoreGlyph = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M3 9.75L12 4l9 5.75M4.5 10.5V19a1 1 0 001 1h4v-5h5v5h4a1 1 0 001-1v-8.5"
    />
  </svg>
);

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

  const fontVars = `${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`;

  return (
    <html
      lang={locale}
      className={`${fontVars} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="h-full bg-bg text-content" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {/* Super admin */}
          {isSuperAdmin && (
            <div className="min-h-screen bg-bg">
              <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-5 sm:px-6 h-16 border-b border-line bg-bg/80 backdrop-blur-md">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-display font-bold text-lg tracking-tight text-content">
                    {tNav("appName")}
                    <span className="text-accent">.</span>
                  </span>
                  <span className="ui-tag-accent">{tUserMenu("roleSuperAdmin")}</span>
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

          {/* Admin / staff */}
          {isAuthenticated && !isSuperAdmin && (
            <>
              <BottomNav
                userRole={role}
                organizationPlan={session.user.organizationPlan}
                organizationName={session.user.organizationName}
              />
              <div className="flex flex-col min-h-screen lg:pl-60">
                <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-5 sm:px-6 h-16 shrink-0 border-b border-line bg-bg/80 backdrop-blur-md">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 min-w-0 rounded-lg -mx-2 px-2 py-1.5 text-muted hover:text-accent transition-colors"
                  >
                    <StoreGlyph />
                    <span className="text-sm font-medium text-content truncate">
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
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 lg:pb-8 bg-bg">
                  {children}
                </main>
              </div>
            </>
          )}

          {/* Sin sesion (landing, login, registro) */}
          {!isAuthenticated && children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
