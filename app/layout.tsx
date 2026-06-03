import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
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
  themeColor: "#16a34a",
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

  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50" suppressHydrationWarning>
        {session?.user && <BottomNav />}
        <div className={`flex flex-col h-full ${session?.user ? "lg:pl-56" : ""}`}>
          <div className="flex flex-col h-full mx-auto w-full max-w-md lg:max-w-none">
            {session?.user && (
              <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {session.user.name}
                </span>
                <LogoutButton />
              </header>
            )}
            <main className={`flex-1 overflow-y-auto ${session?.user ? "pb-16 lg:pb-0" : ""}`}>
              <div className="w-full lg:w-4/5 lg:mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
