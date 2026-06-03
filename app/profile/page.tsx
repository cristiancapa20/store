import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import db from "@/lib/db";

type LocationInfo = {
  id: string;
  name: string;
  allowNegativeStock: boolean;
  createdAt: string;
};

async function fetchLocation(): Promise<LocationInfo | null> {
  try {
    const res = await fetch(
      `${process.env.INVENTORY_API_URL}/locations/${process.env.INVENTORY_LOCATION_ID}`,
      {
        headers: { Authorization: `Bearer ${process.env.INVENTORY_API_KEY}` },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const session = await auth();

  const [location, staffCount] = await Promise.all([
    fetchLocation(),
    Promise.resolve(
      (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count
    ),
  ]);

  const storeName = process.env.STORE_NAME ?? "—";
  const taxRate = process.env.TAX_RATE ? `${(parseFloat(process.env.TAX_RATE) * 100).toFixed(0)}%` : "—";

  return (
    <div className="space-y-5 pb-4">
      <h1 className="ui-page-title">{t("title")}</h1>

      {/* Store card */}
      <div className="ui-card space-y-4">
        {/* Store icon + name */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(74,92,186,0.30)]">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-brand-900 dark:text-brand-50 leading-tight">
              {storeName}
            </p>
            <p className="text-sm text-brand-500 dark:text-brand-400">
              {location ? location.name : t("locationUnknown")}
            </p>
          </div>
        </div>

        <div className="h-px bg-brand-100 dark:bg-brand-800/60" />

        {/* Info rows */}
        <dl className="space-y-3">
          <Row label={t("locationName")} value={location?.name ?? "—"} />
          <Row label={t("taxRate")} value={taxRate} />
          <Row
            label={t("negativeStock")}
            value={location?.allowNegativeStock ? t("allowed") : t("notAllowed")}
            valueClass={location?.allowNegativeStock
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"}
          />
          <Row label={t("staffCount")} value={String(staffCount)} />
        </dl>
      </div>

      {/* Connected user */}
      <div className="ui-card space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-400 dark:text-brand-500">
          {t("session")}
        </p>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-800 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-brand-600 dark:text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-900 dark:text-brand-50">
              {session?.user?.name ?? "—"}
            </p>
            <p className="text-xs text-brand-500 dark:text-brand-400">
              {session?.user?.email ?? "—"}
            </p>
          </div>
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-300">
            {(session?.user as { role?: string } | undefined)?.role ?? "staff"}
          </span>
        </div>
      </div>

      {/* API status */}
      <div className="ui-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${location ? "bg-emerald-500" : "bg-red-500"}`} />
          <p className="text-sm font-medium text-brand-800 dark:text-brand-200">
            {t("apiStatus")}
          </p>
        </div>
        <span className={`text-xs font-semibold ${location ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
          {location ? t("connected") : t("disconnected")}
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-brand-500 dark:text-brand-400 shrink-0">{label}</dt>
      <dd className={`text-sm font-medium text-right truncate ${valueClass ?? "text-brand-900 dark:text-brand-100"}`}>
        {value}
      </dd>
    </div>
  );
}
