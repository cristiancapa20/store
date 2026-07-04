import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import AddProductForm from "./AddProductForm";

export default async function AddProductPage() {
  const session = await auth();

  if (!session || session.user?.role !== "admin") {
    const t = await getTranslations("addProduct");
    return (
      <div className="flex flex-col h-full p-4 items-center justify-center">
        <div className="ui-alert-error rounded-2xl px-6 py-8 text-center max-w-sm w-full">
          <svg
            className="w-12 h-12 text-red-400 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h1 className="text-lg font-semibold mb-2">
            {t("accessDeniedTitle")}
          </h1>
          <p className="text-sm">{t("accessDeniedBody")}</p>
        </div>
      </div>
    );
  }

  return <AddProductForm />;
}
