"use client";

import { useTranslations } from "next-intl";

function FeatureRow({
  index,
  icon,
  title,
  desc,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex items-start gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl border border-line text-accent shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-1">
          {String(index).padStart(2, "0")}
        </p>
        <p className="font-display font-semibold text-content text-sm">{title}</p>
        <p className="text-muted text-sm mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </li>
  );
}

type AuthLayoutProps = {
  title: string;
  description: string;
  formMaxWidth?: "sm" | "md";
  children: React.ReactNode;
};

export default function AuthLayout({
  title,
  description,
  formMaxWidth = "sm",
  children,
}: AuthLayoutProps) {
  const t = useTranslations("auth");
  const tNav = useTranslations("nav");
  const maxWClass = formMaxWidth === "md" ? "max-w-md" : "max-w-sm";

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Columna de marca: la grilla blueprint y el resplandor del acento en vez
          de un bloque de color solido. */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-between overflow-hidden border-r border-line p-10 xl:p-14">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute inset-0 accent-glow" />

        <div className="relative">
          <span className="font-display font-bold text-lg tracking-tight text-content">
            {tNav("appName")}
            <span className="text-accent">.</span>
          </span>
        </div>

        <div className="relative">
          <h2 className="font-display text-3xl xl:text-4xl font-bold tracking-tight leading-tight text-content mb-4">
            {t("brandHeadline")}
          </h2>
          <p className="text-muted text-base leading-relaxed mb-12 max-w-sm">
            {t("brandSubtitle")}
          </p>

          <ul className="space-y-7">
            <FeatureRow
              index={1}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6M9 21h6" />
                </svg>
              }
              title={t("featureSellTitle")}
              desc={t("featureSellDesc")}
            />
            <FeatureRow
              index={2}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
              title={t("featureInventoryTitle")}
              desc={t("featureInventoryDesc")}
            />
            <FeatureRow
              index={3}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title={t("featureHistoryTitle")}
              desc={t("featureHistoryDesc")}
            />
          </ul>
        </div>

        <p className="relative font-mono text-[11px] text-muted">
          &copy; {tNav("appName")}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
        <div className="lg:hidden pointer-events-none absolute inset-0 grid-bg" />
        <div className="lg:hidden pointer-events-none absolute inset-0 accent-glow" />

        <div className={`relative w-full ${maxWClass}`}>
          <div className="lg:hidden text-center mb-8">
            <span className="font-display font-bold text-xl tracking-tight text-content">
              {tNav("appName")}
              <span className="text-accent">.</span>
            </span>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold text-content tracking-tight">
                {title}
              </h1>
              <p className="text-muted mt-1.5 text-sm leading-relaxed">{description}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
