import { getTranslations } from "next-intl/server";

export default async function GuidePage() {
  const t = await getTranslations("guide");

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="ui-page-title">{t("title")}</h1>
        <p className="text-sm text-muted mt-1">
          {t("subtitle")}
        </p>
      </div>

      <Section
        step="1"
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

      <div className="ui-card space-y-3">
        <p className="ui-eyebrow">
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
              <p className="font-medium text-content text-xs">{t(tab)}</p>
              <p className="text-muted text-xs">{t(desc)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Internal components ---

function Section({ step, title, subtitle, icon, children }: {
  step: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="ui-card overflow-hidden p-0">
      <div className="flex items-center gap-3.5 px-4 py-3.5 border-b border-line">
        <span className="ui-eyebrow shrink-0">{step.padStart(2, "0")}</span>
        <svg className="w-5 h-5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm text-content">{title}</p>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: { label: string; detail?: string }[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="ui-num shrink-0 w-5 h-5 rounded-md border border-line text-[10px] text-accent flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-medium text-content">{item.label}</p>
            {item.detail && (
              <p className="text-xs text-muted mt-1">{item.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-line px-3 py-2.5">
      <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs text-muted">{children}</p>
    </div>
  );
}
