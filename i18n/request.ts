import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const locales = ["es", "en"] as const;
type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? "es";
  const locale: Locale = (locales as readonly string[]).includes(raw)
    ? (raw as Locale)
    : "es";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
