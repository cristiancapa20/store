import Link from "next/link";
import { getTranslations } from "next-intl/server";
import ProductList from "./ProductList";

type Props = {
  searchParams: Promise<{ added?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const added = params.added === "1";
  const t = await getTranslations("products");

  return (
    <div className="relative flex flex-col h-full gap-4">
      <h1 className="ui-page-title">{t("title")}</h1>

      {added && (
        <div className="ui-alert-success">
          {t("addedSuccess")}
        </div>
      )}

      <ProductList />

      {/* FAB — Add Product */}
      <Link
        href="/products/new"
        aria-label={t("addProduct")}
        className="fixed bottom-[4.5rem] right-4 lg:bottom-8 lg:right-10 flex items-center justify-center w-14 h-14 rounded-full bg-brand-600 text-white shadow-[0_12px_32px_rgba(79,123,168,0.45)] hover:bg-brand-800 transition-all active:scale-95"
      >
        <svg
          className="w-7 h-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </Link>
    </div>
  );
}
