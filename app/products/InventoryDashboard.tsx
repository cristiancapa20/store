"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { listInventory, listSales } from "@/lib/actions";
import type { Product } from "@/lib/types";

const PAGE_SIZE = 10;

type StockFilter = "all" | "ok" | "low" | "out";

function KpiCard({
  label,
  value,
  sub,
  alert = false,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="ui-card flex flex-col gap-1"
      style={alert ? { borderColor: "rgb(252 165 165 / 0.6)" } : undefined}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <div className="flex items-end gap-1.5">
        <p
          className={`text-2xl font-bold leading-none ${
            alert
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {value}
        </p>
        {icon && <span className="mb-0.5">{icon}</span>}
      </div>
      {sub && (
        <p
          className={`text-xs mt-0.5 ${
            alert
              ? "text-red-500 dark:text-red-400 font-medium"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function StockDot({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
    );
  if (stock <= 10)
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
    );
  return (
    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
  );
}

function stockTextClass(stock: number): string {
  if (stock === 0) return "text-red-600 dark:text-red-400 font-semibold";
  if (stock <= 10) return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-zinc-700 dark:text-zinc-300";
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
          {Array.from({ length: 5 }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function TrendUpIcon() {
  return (
    <svg
      className="w-4 h-4 text-emerald-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}

export default function InventoryDashboard({ added }: { added?: boolean }) {
  const t = useTranslations("inventory");
  const tp = useTranslations("products");

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [apiTotal, setApiTotal] = useState(0);
  const [todaySales, setTodaySales] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [invResult, salesResult] = await Promise.all([
        listInventory(1, 200),
        listSales({ startDate: today, endDate: today, limit: 1 }),
      ]);

      if ("error" in invResult) {
        setError(invResult.error);
      } else {
        setAllProducts(invResult.products);
        setApiTotal(invResult.total);
        setError(null);
      }

      if (!("error" in salesResult)) {
        setTodaySales(salesResult.total);
      }

      setHasFetched(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleFilter = (v: StockFilter) => {
    setStockFilter(v);
    setPage(1);
  };

  const filtered = allProducts.filter((p) => {
    const q = search.toLowerCase();
    const matchQ =
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchF =
      stockFilter === "all" ||
      (stockFilter === "ok" && p.stock > 10) ||
      (stockFilter === "low" && p.stock > 0 && p.stock <= 10) ||
      (stockFilter === "out" && p.stock === 0);
    return matchQ && matchF;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const inventoryValue = allProducts.reduce(
    (s, p) => s + p.price * p.stock,
    0
  );
  const lowStockCount = allProducts.filter((p) => p.stock <= 10).length;

  const showSkeleton = isPending && !hasFetched;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/products/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-semibold shadow hover:bg-brand-700 transition-colors min-h-[48px] self-start shrink-0"
        >
          <svg
            className="w-4 h-4 shrink-0"
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
          {t("addProduct")}
        </Link>
      </div>

      {/* Success alert */}
      {added && (
        <div className="ui-alert-success">{tp("addedSuccess")}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t("kpiTotal")}
          value={apiTotal.toLocaleString()}
        />
        <KpiCard
          label={t("kpiValue")}
          value={
            inventoryValue >= 1000
              ? `$${(inventoryValue / 1000).toFixed(1)}k`
              : `$${inventoryValue.toFixed(0)}`
          }
          sub="USD"
        />
        <KpiCard
          label={t("kpiLow")}
          value={String(lowStockCount)}
          sub={lowStockCount > 0 ? t("kpiAlerts") : undefined}
          alert={lowStockCount > 0}
        />
        <KpiCard
          label={t("kpiSales")}
          value={todaySales !== null ? String(todaySales) : "—"}
          sub={t("kpiSalesSub")}
          icon={
            todaySales !== null && todaySales > 0 ? (
              <TrendUpIcon />
            ) : undefined
          }
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
            placeholder={tp("searchPlaceholder")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="ui-search-field"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={stockFilter}
            onChange={(e) => handleFilter(e.target.value as StockFilter)}
            className="ui-input w-full sm:w-auto"
          >
            <option value="all">{t("filterAll")}</option>
            <option value="ok">{t("filterOk")}</option>
            <option value="low">{t("filterLow")}</option>
            <option value="out">{t("filterOut")}</option>
          </select>
          <button
            onClick={load}
            disabled={isPending}
            aria-label={tp("refreshLabel")}
            className="flex items-center justify-center w-12 h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-surface text-zinc-500 hover:text-brand-600 disabled:opacity-50 transition-colors shrink-0"
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
      </div>

      {/* Error */}
      {error && !isPending && (
        <div className="ui-alert-error">{error}</div>
      )}

      {/* Table */}
      <div className="ui-card p-0 overflow-hidden">
        {!showSkeleton && (
          <div
            className="flex items-center justify-between px-4 pt-3 pb-2.5"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {t("showing", {
                from: filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1,
                to: Math.min(safePage * PAGE_SIZE, filtered.length),
                total: filtered.length,
              })}
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                {[
                  t("colCode"),
                  t("colName"),
                  t("colStock"),
                  t("colPrice"),
                  t("colActions"),
                ].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showSkeleton && <TableSkeleton />}
              {!showSkeleton && paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-zinc-400 text-sm"
                  >
                    {search || stockFilter !== "all"
                      ? tp("noMatch")
                      : tp("noProducts")}
                  </td>
                </tr>
              )}
              {!showSkeleton &&
                paginated.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-brand-600 dark:text-brand-400 whitespace-nowrap">
                      #{p.sku.slice(0, 10).toUpperCase()}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100 max-w-[200px]">
                      <span className="line-clamp-1">{p.name}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`flex items-center gap-1.5 ${stockTextClass(p.stock)}`}
                      >
                        <StockDot stock={p.stock} />
                        {p.stock} {t("units")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      ${p.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href="/adjust"
                        className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline min-h-[48px] flex items-center"
                      >
                        {tp("adjustStock")}
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!showSkeleton && !error && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[48px] transition-colors"
          >
            {t("previous")}
          </button>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("pageOf", { current: safePage, total: totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[48px] transition-colors"
          >
            {t("next")}
          </button>
        </div>
      )}

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-24 lg:pb-4">
        {/* Recently Added */}
        <div className="ui-card">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3 text-sm">
            {t("recentTitle")}
          </h2>
          {!showSkeleton && allProducts.length === 0 && (
            <p className="text-sm text-zinc-400">{tp("noProducts")}</p>
          )}
          {showSkeleton &&
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 animate-pulse"
              >
                <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-full w-3/4 mb-1.5" />
                  <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full w-1/3" />
                </div>
                <div className="h-4 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
              </div>
            ))}
          {!showSkeleton &&
            [...allProducts].slice(-3).reverse().map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4 text-brand-500 dark:text-brand-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      SKU: {p.sku}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 shrink-0 ml-3">
                  ${p.price.toFixed(2)}
                </span>
              </div>
            ))}
        </div>

        {/* Stock Status */}
        <div className="ui-card">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4 text-sm">
            {t("stockStatusTitle")}
          </h2>
          {(() => {
            const tot = allProducts.length || 1;
            const ok = allProducts.filter((p) => p.stock > 10).length;
            const low = allProducts.filter(
              (p) => p.stock > 0 && p.stock <= 10
            ).length;
            const out = allProducts.filter((p) => p.stock === 0).length;
            const rows = [
              {
                label: t("stockSufficient"),
                count: ok,
                pct: ok / tot,
                color: "bg-emerald-500",
              },
              {
                label: t("stockLow"),
                count: low,
                pct: low / tot,
                color: "bg-amber-400",
              },
              {
                label: t("stockOut"),
                count: out,
                pct: out / tot,
                color: "bg-red-500",
              },
            ];
            return (
              <div className="flex flex-col gap-3">
                {rows.map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {r.label} ({Math.round(r.pct * 100)}%)
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {r.count} items
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: "var(--bg-elevated)" }}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${r.color}`}
                        style={{ width: `${Math.round(r.pct * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
