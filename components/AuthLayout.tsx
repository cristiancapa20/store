"use client";

import { useTranslations } from "next-intl";

const StoreIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3.5">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-white text-sm">{title}</p>
        <p className="text-brand-100/70 text-sm mt-0.5">{desc}</p>
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

export default function AuthLayout({ title, description, formMaxWidth = "sm", children }: AuthLayoutProps) {
  const t = useTranslations("auth");
  const tNav = useTranslations("nav");
  const maxWClass = formMaxWidth === "md" ? "max-w-md" : "max-w-sm";

  return (
    <div className="min-h-screen flex bg-white dark:bg-[var(--bg-base)]">
      <div className="hidden lg:flex lg:w-[42%] relative flex-col justify-between overflow-hidden bg-brand-600 text-white p-10 xl:p-14">
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-brand-900/50 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10">
            <StoreIcon />
          </div>
          <span className="text-lg font-bold tracking-tight">{tNav("appName")}</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight leading-tight mb-4">
            {t("brandHeadline")}
          </h2>
          <p className="text-brand-100/80 text-base mb-10 max-w-sm">
            {t("brandSubtitle")}
          </p>

          <ul className="space-y-5">
            <FeatureRow
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6M9 21h6" />
                </svg>
              }
              title={t("featureSellTitle")}
              desc={t("featureSellDesc")}
            />
            <FeatureRow
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
              title={t("featureInventoryTitle")}
              desc={t("featureInventoryDesc")}
            />
            <FeatureRow
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title={t("featureHistoryTitle")}
              desc={t("featureHistoryDesc")}
            />
          </ul>
        </div>

        <p className="relative text-xs text-brand-200/50">
          &copy; {tNav("appName")}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
        <div className="lg:hidden pointer-events-none absolute -top-32 -left-24 w-72 h-72 rounded-full bg-brand-100 dark:bg-brand-900/40 blur-3xl opacity-70" />
        <div className="lg:hidden pointer-events-none absolute -bottom-32 -right-24 w-80 h-80 rounded-full bg-brand-100 dark:bg-brand-900/30 blur-3xl opacity-60" />

        <div className={`relative w-full ${maxWClass}`}>
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-600 shrink-0">
              <StoreIcon />
            </div>
            <span className="text-lg font-bold text-brand-950 dark:text-brand-50 tracking-tight">
              {tNav("appName")}
            </span>
          </div>

          <div className="rounded-[2rem] border border-[var(--border-color)] bg-white dark:bg-[var(--bg-surface)] shadow-[0_8px_40px_rgba(30,38,84,0.10)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.50)] p-6 sm:p-8">
            <div className="mb-8 text-center lg:text-left">
              <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-50 tracking-tight">
                {title}
              </h1>
              <p className="text-brand-700/70 dark:text-brand-100/60 mt-1 text-sm">
                {description}
              </p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
