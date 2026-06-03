"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { listInventory } from "@/lib/actions";
import type { Product } from "@/lib/types";

function StockBadge({ stock }: { stock: number }) {
  const t = useTranslations("products");
  if (stock === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        {t("outOfStock")}
      </span>
    );
  }
  if (stock <= 10) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {t("inStock", { count: stock })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-800/40 dark:text-brand-50">
      {t("inStock", { count: stock })}
    </span>
  );
}

function ProductCard({ product }: { product: Product }) {
  const t = useTranslations("products");
  return (
    <div className="ui-card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {product.name}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            SKU: {product.sku}
          </p>
        </div>
        <StockBadge stock={product.stock} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          ${product.price.toFixed(2)}
        </p>
        <Link
          href="/adjust"
          className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline min-h-[48px] flex items-center"
        >
          {t("adjustStock")}
        </Link>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="ui-card animate-pulse flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3" />
        </div>
        <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-700 rounded" />
        <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
      </div>
    </div>
  );
}

export default function ProductList() {
  const t = useTranslations("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchInventory = useCallback(() => {
    startTransition(async () => {
      const result = await listInventory(1, 200);
      if ("error" in result) {
        setError(result.error);
      } else {
        setProducts(result.products);
        setError(null);
      }
      setHasFetched(true);
    });
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  });

  const showSkeleton = isPending && !hasFetched;

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="flex gap-2">
        <div className="ui-search flex-1">
          <svg
            className="w-5 h-5 text-brand-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ui-search-field"
          />
        </div>
        <button
          onClick={fetchInventory}
          disabled={isPending}
          aria-label={t("refreshLabel")}
          className="flex items-center justify-center min-w-[48px] min-h-[48px] rounded-full bg-surface dark:bg-brand-900 text-brand-700 dark:text-brand-200 shadow-[0_6px_20px_rgba(3,15,34,0.08)] hover:bg-brand-50 disabled:opacity-50 transition-all"
        >
          <svg
            className={`w-5 h-5 ${isPending ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {error && !isPending && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {showSkeleton && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      )}

      {!showSkeleton && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-400 py-16">
              <svg
                className="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <p className="text-sm">
                {search ? t("noMatch") : t("noProducts")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-24">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
