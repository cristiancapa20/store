import { signOut } from "@/auth";
import { getTranslations } from "next-intl/server";

type Props = {
  variant?: "pill" | "menuitem";
};

export default async function LogoutButton({ variant = "pill" }: Props) {
  const t = await getTranslations("auth");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const className =
    variant === "menuitem"
      ? "w-full text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[48px] px-4 rounded-xl"
      : "text-sm text-brand-700 dark:text-brand-300 hover:text-brand-950 dark:hover:text-brand-50 transition-colors min-h-[48px] px-3 rounded-full hover:bg-brand-50 dark:hover:bg-brand-800/40";

  return (
    <form action={handleSignOut} className={variant === "menuitem" ? "w-full" : undefined}>
      <button type="submit" className={className}>
        {t("signOut")}
      </button>
    </form>
  );
}
