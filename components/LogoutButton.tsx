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
      ? "w-full text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/8 transition-colors min-h-[48px] px-4 rounded-xl"
      : "text-sm text-muted hover:text-content transition-colors min-h-[48px] px-3 rounded-xl";

  return (
    <form action={handleSignOut} className={variant === "menuitem" ? "w-full" : undefined}>
      <button type="submit" className={className}>
        {t("signOut")}
      </button>
    </form>
  );
}
