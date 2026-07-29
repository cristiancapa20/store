import Link from "next/link";
import { getTranslations } from "next-intl/server";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Encabezado de seccion del portafolio: numeracion mono en acento, titulo
// display y una regla que se come el ancho restante.
function SectionHead({ n, eyebrow, title, subtitle }: {
  n: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-5">
        <span className="ui-eyebrow shrink-0">
          {n} / {eyebrow}
        </span>
        <span className="ui-rule" />
      </div>
      <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-content">
        {title}
      </h2>
      {subtitle && <p className="text-muted mt-3 max-w-2xl leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    const role = session.user.role;
    redirect(role === "super_admin" ? "/superadmin" : "/sell");
  }

  const t = await getTranslations("landing");
  const tNav = await getTranslations("nav");
  const cookieStore = await cookies();
  const theme = cookieStore.get("STORE_THEME")?.value === "dark" ? "dark" : "light";

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <span className="font-display font-bold text-lg tracking-tight text-content">
            {tNav("appName")}
            <span className="text-accent">.</span>
          </span>
          <nav className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle current={theme} />
            <LanguageSwitcher />
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center min-h-[48px] px-4 rounded-xl text-sm text-muted hover:text-content transition-colors"
            >
              {t("login")}
            </Link>
            <Link href="/register" className="ui-btn-primary">
              {t("register")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute inset-0 grid-bg" />
          <div className="pointer-events-none absolute inset-0 accent-glow" />
          <div className="relative max-w-[1100px] mx-auto px-5 sm:px-8 pt-24 pb-24 sm:pt-32 sm:pb-28">
            <span className="ui-tag-accent">{t("heroBadge")}</span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-content mt-6 max-w-3xl">
              {t("heroTitle")}
            </h1>
            <p className="text-lg text-muted max-w-xl mt-6 leading-relaxed">
              {t("heroSubtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Link href="/register" className="ui-btn-primary sm:w-auto">
                {t("heroCta")}
              </Link>
              <Link href="#features" className="ui-btn-secondary sm:w-auto">
                {t("heroSecondary")}
              </Link>
            </div>
          </div>
        </section>

        {/* Funciones */}
        <section id="features" className="max-w-[1100px] mx-auto px-5 sm:px-8 py-24">
          <SectionHead
            n="01"
            eyebrow={t("sectionFeatures")}
            title={t("featuresTitle")}
            subtitle={t("featuresSubtitle")}
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(["f1", "f2", "f3", "f4", "f5", "f6"] as const).map((key) => (
              <div key={key} className="ui-card-interactive flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl border border-line flex items-center justify-center text-lg">
                  {t(`${key}Icon`)}
                </div>
                <h3 className="font-display font-semibold text-content">{t(`${key}Title`)}</h3>
                <p className="text-sm text-muted leading-relaxed">{t(`${key}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Como funciona */}
        <section className="border-y border-line">
          <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-24">
            <SectionHead n="02" eyebrow={t("sectionHow")} title={t("howTitle")} />
            <div className="grid sm:grid-cols-3 gap-8">
              {(["step1", "step2", "step3"] as const).map((key, i) => (
                <div key={key}>
                  <span className="font-mono text-4xl font-medium text-accent/25">
                    0{i + 1}
                  </span>
                  <h3 className="font-display font-semibold text-content mt-3 mb-2">
                    {t(`${key}Title`)}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{t(`${key}Desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Planes */}
        <section id="pricing" className="max-w-[1100px] mx-auto px-5 sm:px-8 py-24">
          <SectionHead
            n="03"
            eyebrow={t("sectionPlans")}
            title={t("plansTitle")}
            subtitle={t("plansSubtitle")}
          />
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            <div className="ui-card flex flex-col gap-5">
              <div>
                <span className="ui-eyebrow">{t("planBasicName")}</span>
                <div className="font-display text-4xl font-bold text-content mt-3">
                  <span className="ui-num">$9</span>
                  <span className="text-base font-normal text-muted ml-1">{t("perMonth")}</span>
                </div>
              </div>
              <ul className="space-y-2.5 text-sm text-muted flex-1">
                {(["planBasicF1", "planBasicF2", "planBasicF3"] as const).map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="text-accent mt-0.5">✓</span>
                    <span>{t(f)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="ui-btn-secondary w-full">
                {t("planCta")}
              </Link>
            </div>

            <div
              className="ui-card flex flex-col gap-5 relative"
              style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)" }}
            >
              <span className="ui-tag-accent absolute top-4 right-4">{t("planProBadge")}</span>
              <div>
                <span className="ui-eyebrow">{t("planProName")}</span>
                <div className="font-display text-4xl font-bold text-content mt-3">
                  <span className="ui-num">$19</span>
                  <span className="text-base font-normal text-muted ml-1">{t("perMonth")}</span>
                </div>
              </div>
              <ul className="space-y-2.5 text-sm text-muted flex-1">
                {(["planProF1", "planProF2", "planProF3"] as const).map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="text-accent mt-0.5">✓</span>
                    <span>{t(f)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="ui-btn-primary-block">
                {t("planCta")}
              </Link>
            </div>
          </div>
        </section>

        {/* Cierre */}
        <section className="relative overflow-hidden border-t border-line">
          <div className="pointer-events-none absolute inset-0 grid-bg" />
          <div className="pointer-events-none absolute inset-0 accent-glow" />
          <div className="relative max-w-[1100px] mx-auto px-5 sm:px-8 py-24 text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-content">
              {t("ctaTitle")}
            </h2>
            <p className="text-muted mt-4 text-lg max-w-xl mx-auto">{t("ctaSubtitle")}</p>
            <Link href="/register" className="ui-btn-primary mt-10">
              {t("ctaBtn")}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display font-bold text-sm tracking-tight text-content">
            {tNav("appName")}
            <span className="text-accent">.</span>
          </span>
          <nav className="flex items-center gap-5 text-sm text-muted">
            <Link href="/login" className="hover:text-accent transition-colors">
              {t("login")}
            </Link>
            <Link href="/register" className="hover:text-accent transition-colors">
              {t("register")}
            </Link>
          </nav>
          <p className="font-mono text-[11px] text-muted">
            © {year} · {t("footerRights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
