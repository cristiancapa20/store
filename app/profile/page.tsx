import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import db from "@/lib/db";
import { apiFetch, getInventoryConfig } from "@/lib/inventoryClient";

type LocationInfo = {
  id: string;
  name: string;
  allowNegativeStock: boolean;
  createdAt: string;
};

async function fetchLocation(): Promise<LocationInfo | null> {
  try {
    // Dentro del try: sin credencial de la organizacion getInventoryConfig lanza,
    // y aqui eso es "desconectado", no una pagina rota.
    const { locationId } = await getInventoryConfig();
    // Via apiFetch para heredar el timeout: un servicio colgado dejaba esta
    // pagina cargando hasta que la plataforma mataba la peticion.
    const result = await apiFetch<LocationInfo>(`/locations/${locationId}`, {
      cache: "no-store",
    });
    return "error" in result ? null : result;
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
  const taxRate = process.env.TAX_RATE
    ? `${(parseFloat(process.env.TAX_RATE) * 100).toFixed(0)}%`
    : "—";

  return (
    <div className="space-y-5 pb-4 max-w-2xl">
      <h1 className="ui-page-title">{t("title")}</h1>

      <div className="ui-card space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl border border-line flex items-center justify-center shrink-0 text-accent">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-content leading-tight truncate">
              {storeName}
            </p>
            <p className="text-sm text-muted truncate">
              {location ? location.name : t("locationUnknown")}
            </p>
          </div>
        </div>

        <div className="ui-divider" />

        <dl className="space-y-3">
          <Row label={t("locationName")} value={location?.name ?? "—"} />
          <Row label={t("taxRate")} value={taxRate} mono />
          <Row
            label={t("negativeStock")}
            value={location?.allowNegativeStock ? t("allowed") : t("notAllowed")}
            valueClass={
              location?.allowNegativeStock
                ? "text-amber-700 dark:text-amber-300"
                : "text-accent"
            }
          />
          <Row label={t("staffCount")} value={String(staffCount)} mono />
        </dl>
      </div>

      <div className="ui-card space-y-4">
        <p className="ui-eyebrow">{t("session")}</p>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-line flex items-center justify-center shrink-0 text-muted">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-content truncate">
              {session?.user?.name ?? "—"}
            </p>
            <p className="text-xs text-muted truncate">{session?.user?.email ?? "—"}</p>
          </div>
          <span className="ui-tag ml-auto">
            {(session?.user as { role?: string } | undefined)?.role ?? "staff"}
          </span>
        </div>
      </div>

      <div className="ui-card flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full ${location ? "bg-accent" : "bg-red-500"}`} />
          <p className="text-sm text-content">{t("apiStatus")}</p>
        </div>
        <span
          className={`font-mono text-[11px] uppercase tracking-wider ${
            location ? "text-accent" : "text-red-600 dark:text-red-400"
          }`}
        >
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
  mono = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-muted shrink-0">{label}</dt>
      <dd
        className={`text-sm text-right truncate ${mono ? "ui-num" : ""} ${
          valueClass ?? "text-content"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
