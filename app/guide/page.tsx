import { getTranslations } from "next-intl/server";

export default async function GuidePage() {
  const t = await getTranslations("guide");

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="ui-page-title">{t("title")}</h1>
        <p className="text-sm text-brand-700/70 dark:text-brand-100/60 mt-1">
          {t("subtitle")}
        </p>
      </div>

      <Section
        step="1"
        color="brand"
        title={t("s1Title")}
        subtitle={t("s1Subtitle")}
        icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6M9 21h6" />}
      >
        <Steps items={[
          { label: t("s1s1") },
          { label: t("s1s2"), detail: t("s1s2d") },
          { label: t("s1s3"), detail: t("s1s3d") },
          { label: t("s1s4"), detail: t("s1s4d") },
          { label: t("s1s5"), detail: t("s1s5d") },
        ]} />
        <Tip>{t("s1tip")}</Tip>
      </Section>

      <Section
        step="2"
        color="blue"
        title={t("s2Title")}
        subtitle={t("s2Subtitle")}
        icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
      >
        <Steps items={[
          { label: t("s2s1") },
          { label: t("s2s2"), detail: t("s2s2d") },
          { label: t("s2s3"), detail: t("s2s3d") },
          { label: t("s2s4"), detail: t("s2s4d") },
        ]} />
        <Tip>{t("s2tip")}</Tip>
      </Section>

      <Section
        step="3"
        color="purple"
        title={t("s3Title")}
        subtitle={t("s3Subtitle")}
        icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />}
      >
        <Steps items={[
          { label: t("s3s1"), detail: t("s3s1d") },
          { label: t("s3s2"), detail: t("s3s2d") },
          { label: t("s3s3") },
        ]} />
        <Tip>{t("s3tip")}</Tip>
      </Section>

      <Section
        step="4"
        color="amber"
        title={t("s4Title")}
        subtitle={t("s4Subtitle")}
        icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />}
      >
        <Steps items={[
          { label: t("s4s1") },
          { label: t("s4s2"), detail: t("s4s2d") },
          { label: t("s4s3"), detail: t("s4s3d") },
          { label: t("s4s4"), detail: t("s4s4d") },
          { label: t("s4s5") },
        ]} />
        <Tip>{t("s4tip")}</Tip>
      </Section>

      <Section
        step="5"
        color="rose"
        title={t("s5Title")}
        subtitle={t("s5Subtitle")}
        icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
      >
        <Steps items={[
          { label: t("s5s1") },
          { label: t("s5s2"), detail: t("s5s2d") },
          { label: t("s5s3"), detail: t("s5s3d") },
          { label: t("s5s4"), detail: t("s5s4d") },
          { label: t("s5s5"), detail: t("s5s5d") },
        ]} />
      </Section>

      <div className="ui-card bg-brand-50/80 dark:bg-brand-900/40 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 dark:text-brand-400">
          {t("quickRef")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["qr1tab", "qr1desc"],
            ["qr2tab", "qr2desc"],
            ["qr3tab", "qr3desc"],
            ["qr4tab", "qr4desc"],
            ["qr5tab", "qr5desc"],
          ] as const).map(([tab, desc]) => (
            <div key={tab}>
              <p className="font-medium text-brand-800 dark:text-brand-200 text-xs">{t(tab)}</p>
              <p className="text-brand-500 dark:text-brand-400 text-xs">{t(desc)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Internal components ---

const colorMap = {
  brand:  { badge: "bg-brand-100 dark:bg-brand-800/50 text-brand-800 dark:text-brand-50", icon: "text-brand-600 dark:text-brand-400", border: "border-brand-600/40" },
  blue:   { badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",     icon: "text-blue-600 dark:text-blue-400",   border: "border-blue-200 dark:border-blue-800" },
  purple: { badge: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400", icon: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  amber:  { badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", icon: "text-amber-600 dark:text-amber-400",   border: "border-amber-200 dark:border-amber-800" },
  rose:   { badge: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",     icon: "text-rose-600 dark:text-rose-400",     border: "border-rose-200 dark:border-rose-800" },
};

function Section({ step, color, title, subtitle, icon, children }: {
  step: string;
  color: keyof typeof colorMap;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = colorMap[color];
  return (
    <div className="ui-card overflow-hidden p-0">
      <div className="flex items-center gap-3 px-4 py-3 bg-brand-50/70 dark:bg-brand-800/25">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${c.badge}`}>
          {step}
        </span>
        <svg className={`w-5 h-5 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
        <div>
          <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">{title}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: { label: string; detail?: string }[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-800 text-brand-800 dark:text-brand-100 text-xs font-semibold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.label}</p>
            {item.detail && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-brand-50/80 dark:bg-brand-800/30 rounded-2xl px-3 py-2">
      <svg className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{children}</p>
    </div>
  );
}
