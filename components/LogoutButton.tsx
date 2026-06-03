import { signOut } from "@/auth";
import { getTranslations } from "next-intl/server";

export default async function LogoutButton() {
  const t = await getTranslations("auth");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <form action={handleSignOut}>
      <button
        type="submit"
        className="text-sm text-brand-700 dark:text-brand-300 hover:text-brand-950 dark:hover:text-brand-50 transition-colors min-h-[48px] px-3 rounded-full hover:bg-brand-50 dark:hover:bg-brand-800/40"
      >
        {t("signOut")}
      </button>
    </form>
  );
}
