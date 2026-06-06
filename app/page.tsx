import Link from "next/link";
import { getTranslations } from "next-intl/server";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    const role = session.user.role;
    redirect(role === "super_admin" ? "/superadmin" : "/sell");
  }

  const t = await getTranslations("landing");
  const cookieStore = await cookies();
  const theme = cookieStore.get("STORE_THEME")?.value === "dark" ? "dark" : "light";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b" style={{ background: "var(--bg-surface)", borderColor: "var(--border-color)" }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Mi Comercio</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle current={theme} />
            <LanguageSwitcher />
            <Link href="/login" className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80" style={{ color: "var(--text-primary)" }}>
              {t("login")}
            </Link>
            <Link href="/register" className="ui-btn-primary !min-h-[40px] !px-4 !text-xs sm:!text-sm">
              {t("register")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/30">
            {t("heroBadge")}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-5 leading-[1.1]" style={{ color: "var(--text-primary)" }}>
            {t("heroTitle")}
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className="ui-btn-primary !min-h-[52px] !px-8 !text-base w-full sm:w-auto">
              {t("heroCta")}
            </Link>
            <Link href="#features" className="inline-flex items-center gap-2 px-8 min-h-[52px] rounded-xl text-sm font-medium transition-colors w-full sm:w-auto justify-center" style={{ color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
              {t("heroSecondary")}
            </Link>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            {t("featuresTitle")}
          </h2>
          <p className="text-center mb-12" style={{ color: "var(--text-muted)" }}>
            {t("featuresSubtitle")}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(["f1", "f2", "f3", "f4", "f5", "f6"] as const).map((key) => (
              <div key={key} className="ui-card space-y-2">
                <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/40 rounded-xl flex items-center justify-center text-brand-600 dark:text-brand-400 text-xl">
                  {t(`${key}Icon`)}
                </div>
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                  {t(`${key}Title`)}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {t(`${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="py-16" style={{ background: "var(--bg-surface)" }}>
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12" style={{ color: "var(--text-primary)" }}>
              {t("howTitle")}
            </h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {(["step1", "step2", "step3"] as const).map((key, i) => (
                <div key={key} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-brand-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                    {i + 1}
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                    {t(`${key}Title`)}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {t(`${key}Desc`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            {t("plansTitle")}
          </h2>
          <p className="text-center mb-12" style={{ color: "var(--text-muted)" }}>
            {t("plansSubtitle")}
          </p>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Basic */}
            <div className="ui-card space-y-4">
              <div>
                <span className="text-sm font-semibold text-brand-600 dark:text-brand-300">{t("planBasicName")}</span>
                <div className="text-3xl font-black mt-1" style={{ color: "var(--text-primary)" }}>
                  $9<span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>/mes</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {(["planBasicF1", "planBasicF2", "planBasicF3"] as const).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> {t(f)}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="ui-btn-primary w-full !min-h-[44px] block text-center">
                {t("planCta")}
              </Link>
            </div>
            {/* Pro */}
            <div className="ui-card space-y-4 ring-2 ring-brand-600 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-2 py-0.5 bg-brand-600 rounded-full text-white text-xs font-bold">
                {t("planProBadge")}
              </div>
              <div>
                <span className="text-sm font-semibold text-brand-600 dark:text-brand-300">{t("planProName")}</span>
                <div className="text-3xl font-black mt-1" style={{ color: "var(--text-primary)" }}>
                  $19<span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>/mes</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {(["planProF1", "planProF2", "planProF3"] as const).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> {t(f)}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="ui-btn-primary w-full !min-h-[44px] block text-center">
                {t("planCta")}
              </Link>
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="py-20 bg-brand-600">
          <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              {t("ctaTitle")}
            </h2>
            <p className="text-brand-200 mb-8 text-lg">{t("ctaSubtitle")}</p>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-white text-brand-600 font-bold px-8 py-3.5 rounded-xl text-base shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:bg-brand-50 transition-colors min-h-[52px]">
              {t("ctaBtn")}
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t" style={{ background: "var(--bg-surface)", borderColor: "var(--border-color)" }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-brand-600 rounded-md flex items-center justify-center text-white text-xs font-bold">M</span>
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Mi Comercio</span>
          </div>
          <nav className="flex items-center gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/login" className="hover:opacity-80 transition-opacity">{t("login")}</Link>
            <Link href="/register" className="hover:opacity-80 transition-opacity">{t("register")}</Link>
          </nav>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            © 2025 Mi Comercio
          </p>
        </div>
      </footer>
    </div>
  );
}
