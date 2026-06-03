import Link from "next/link";
import ProductList from "./ProductList";

type Props = {
  searchParams: Promise<{ added?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const added = params.added === "1";

  return (
    <div className="relative flex flex-col h-full p-4">
      <h1 className="text-xl font-semibold mb-4">Products</h1>

      {added && (
        <div className="mb-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400 font-medium">
          Product added successfully.
        </div>
      )}

      <ProductList />

      {/* FAB — Add Product */}
      <Link
        href="/products/new"
        aria-label="Add product"
        className="fixed bottom-24 right-4 flex items-center justify-center w-14 h-14 rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 transition-colors"
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
