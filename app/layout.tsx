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
  title: "Store Inventory",
  description: "In-store inventory and sales management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Store Inventory",
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

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body
        className="h-full bg-brand-100 dark:bg-brand-950 text-brand-950 dark:text-brand-50"
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          {session?.user && <BottomNav />}
          {session?.user ? (
            <div className="flex flex-col h-full lg:pl-64 p-3 sm:p-4 lg:p-6 min-h-0">
              <div className="ui-shell flex-1 w-full max-w-md lg:max-w-none mx-auto min-h-0 h-full lg:max-h-[calc(100vh-3rem)]">
                <header className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 shrink-0 border-b border-brand-100 dark:border-brand-800/60">
                  <span className="text-sm font-semibold text-brand-900 dark:text-brand-50 truncate">
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
          ) : (
            children
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
