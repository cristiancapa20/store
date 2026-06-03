"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import Link from "next/link";
import { listInventory } from "@/lib/actions";
import type { Product } from "@/lib/types";

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        Out of stock
      </span>
    );
  }
  if (stock <= 10) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {stock} in stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      {stock} in stock
    </span>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col gap-2">
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
          className="text-xs text-green-600 dark:text-green-400 font-medium hover:underline min-h-[48px] flex items-center"
        >
          Adjust Stock
        </Link>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 animate-pulse flex flex-col gap-2">
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
        <input
          type="search"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-2xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={fetchInventory}
          disabled={isPending}
          aria-label="Refresh inventory"
          className="flex items-center justify-center min-w-[48px] min-h-[48px] rounded-2xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
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
                {search ? "No products match your search." : "No products yet."}
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
