"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { listInventory, listSales } from "@/lib/actions";
import { INVENTORY_MAX_LIMIT } from "@/lib/pagination";
import { useActionErrorMessage } from "@/lib/useActionErrorMessage";
import type { Product } from "@/lib/types";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 250;

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
      className="ui-card flex flex-col gap-2"
      style={
        alert
          ? { borderColor: "color-mix(in srgb, #dc2626 40%, transparent)" }
          : undefined
      }
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <div className="flex items-end gap-1.5">
        <p
          className={`ui-num text-2xl leading-none ${
            alert ? "text-red-600 dark:text-red-400" : "text-content"
          }`}
        >
          {value}
        </p>
        {icon && <span className="mb-0.5">{icon}</span>}
      </div>
      {sub && (
        <p
          className={`text-xs ${
            alert ? "text-red-600 dark:text-red-400" : "text-muted"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// Verde, ambar y rojo son la escala de stock: el acento (verde) significa "hay",
// y por eso no se usa aqui ningun otro verde.
function StockDot({ stock }: { stock: number }) {
  if (stock === 0)
    return <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />;
  if (stock <= 10)
    return <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />;
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent shrink-0" />;
}

function stockTextClass(stock: number): string {
  if (stock === 0) return "text-red-600 dark:text-red-400";
  if (stock <= 10) return "text-amber-700 dark:text-amber-300";
  return "text-muted";
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-line">
          {Array.from({ length: 5 }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div className="h-4 bg-surface-2 rounded-md animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function TrendUpIcon() {
  return (
    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}

export default function InventoryDashboard({ added }: { added?: boolean }) {
  const t = useTranslations("inventory");
  const tp = useTranslations("products");
  const actionErrorMessage = useActionErrorMessage();

  // Two reads with different jobs: `statsProducts` feeds the KPIs and the
  // breakdown panels (a whole-catalog question the service has no endpoint for,
  // so it stays capped at one page), while `pageProducts` is the table and comes
  // straight from the service, page by page and already filtered by name.
  const [statsProducts, setStatsProducts] = useState<Product[]>([]);
  const [pageProducts, setPageProducts] = useState<Product[]>([]);
  const [apiTotal, setApiTotal] = useState(0);
  const [pageTotal, setPageTotal] = useState(0);
  const [todaySales, setTodaySales] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [reloadToken, setReloadToken] = useState(0);
  // Two readers, two error slots: a stats reload that succeeds must not clear
  // the message the table read left behind, nor the other way round.
  const [statsError, setStatsError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    startTransition(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [statsResult, salesResult] = await Promise.all([
        listInventory(1, INVENTORY_MAX_LIMIT),
        listSales({ startDate: today, endDate: today, limit: 1 }),
      ]);

      if ("error" in statsResult) {
        setStatsError(actionErrorMessage(statsResult));
      } else {
        setStatsProducts(statsResult.products);
        setApiTotal(statsResult.total);
        setStatsError(null);
      }

      if (!("error" in salesResult)) {
        setTodaySales(salesResult.total);
      }
    });
  }, [actionErrorMessage, reloadToken]);

  useEffect(() => {
    startTransition(async () => {
      const result = await listInventory(page, PAGE_SIZE, debouncedSearch);
      if ("error" in result) {
        setPageError(actionErrorMessage(result));
        setPageProducts([]);
        setPageTotal(0);
      } else {
        setPageError(null);
        setPageProducts(result.products);
        setPageTotal(result.total);
      }
      setHasFetched(true);
    });
  }, [actionErrorMessage, page, debouncedSearch, reloadToken]);

  const load = useCallback(() => setReloadToken((n) => n + 1), []);

  // The service has no stock predicate, so this one still narrows the page on
  // screen — hence the separate indicator below, which does not pretend the
  // count covers the catalog.
  const paginated = pageProducts.filter(
    (p) =>
      stockFilter === "all" ||
      (stockFilter === "ok" && p.stock > 10) ||
      (stockFilter === "low" && p.stock > 0 && p.stock <= 10) ||
      (stockFilter === "out" && p.stock === 0)
  );

  const totalPages = Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const inventoryValue = statsProducts.reduce(
    (s, p) => s + p.price * p.stock,
    0
  );
  const lowStockCount = statsProducts.filter((p) => p.stock <= 10).length;

  const error = pageError ?? statsError;
  const showSkeleton = isPending && !hasFetched;
  // The KPI panels read a single page of the catalog: the service returns at most
  // INVENTORY_MAX_LIMIT rows and has no aggregate endpoint for stock. The table
  // below is not affected — it pages against the service.
  const truncated = apiTotal > statsProducts.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="ui-page-title">{t("title")}</h1>
          <p className="text-sm text-muted mt-1">{t("subtitle")}</p>
        </div>
        <Link
          href="/products/new"
          className="ui-btn-primary self-start shrink-0"
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
            className="w-5 h-5 text-muted shrink-0"
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
            onChange={(e) => setSearch(e.target.value)}
            className="ui-search-field"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
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
            className="ui-btn-icon-circle"
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

      {/* Partial catalog notice */}
      {!showSkeleton && !error && truncated && (
        <div className="ui-alert-info">
          {t("partialCatalog", {
            shown: statsProducts.length,
            total: apiTotal,
          })}
        </div>
      )}

      {/* Table */}
      <div className="ui-card p-0 overflow-hidden">
        {!showSkeleton && (
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-line"
          >
            <p className="font-mono text-[11px] text-muted">
              {stockFilter === "all"
                ? t("showing", {
                    from: pageTotal === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1,
                    to: Math.min(
                      (safePage - 1) * PAGE_SIZE + pageProducts.length,
                      pageTotal
                    ),
                    total: pageTotal,
                  })
                : t("showingStockFiltered", {
                    shown: paginated.length,
                    page: safePage,
                    total: pageTotal,
                  })}
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                {[
                  t("colCode"),
                  t("colName"),
                  t("colStock"),
                  t("colPrice"),
                  t("colActions"),
                ].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted whitespace-nowrap"
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
                    className="px-4 py-12 text-center text-muted text-sm"
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
                    className="border-b border-line transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <td className="ui-num px-4 py-3.5 text-xs text-accent whitespace-nowrap">
                      #{p.sku.slice(0, 10).toUpperCase()}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-content max-w-[200px]">
                      <span className="line-clamp-1">{p.name}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`ui-num flex items-center gap-2 text-xs ${stockTextClass(p.stock)}`}
                      >
                        <StockDot stock={p.stock} />
                        {p.stock} {t("units")}
                      </span>
                    </td>
                    <td className="ui-num px-4 py-3.5 text-content whitespace-nowrap">
                      ${p.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href="/adjust"
                        className="text-xs text-accent hover:underline underline-offset-4 min-h-[48px] flex items-center"
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
            className="ui-btn-secondary"
          >
            {t("previous")}
          </button>
          <span className="ui-num text-sm text-muted">
            {t("pageOf", { current: safePage, total: totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="ui-btn-secondary"
          >
            {t("next")}
          </button>
        </div>
      )}

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-24 lg:pb-4">
        {/* Recently Added */}
        <div className="ui-card">
          <h2 className="ui-section-title mb-4">
            {t("recentTitle")}
          </h2>
          {!showSkeleton && statsProducts.length === 0 && (
            <p className="text-sm text-muted">{tp("noProducts")}</p>
          )}
          {showSkeleton &&
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 border-b border-line last:border-0 animate-pulse"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-2 shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 bg-surface-2 rounded-md w-3/4 mb-1.5" />
                  <div className="h-2.5 bg-surface-2 rounded-md w-1/3" />
                </div>
                <div className="h-4 w-12 bg-surface-2 rounded-md" />
              </div>
            ))}
          {!showSkeleton &&
            [...statsProducts].slice(-3).reverse().map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2.5 border-b border-line last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg border border-line flex items-center justify-center shrink-0 text-accent">
                    <svg
                      className="w-4 h-4"
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
                    <p className="text-sm font-medium text-content truncate">
                      {p.name}
                    </p>
                    <p className="ui-num text-[11px] text-muted mt-0.5">
                      {p.sku}
                    </p>
                  </div>
                </div>
                <span className="ui-num text-sm text-content shrink-0 ml-3">
                  ${p.price.toFixed(2)}
                </span>
              </div>
            ))}
        </div>

        {/* Stock Status */}
        <div className="ui-card">
          <h2 className="ui-section-title mb-4">
            {t("stockStatusTitle")}
          </h2>
          {(() => {
            const tot = statsProducts.length || 1;
            const ok = statsProducts.filter((p) => p.stock > 10).length;
            const low = statsProducts.filter(
              (p) => p.stock > 0 && p.stock <= 10
            ).length;
            const out = statsProducts.filter((p) => p.stock === 0).length;
            const rows = [
              {
                label: t("stockSufficient"),
                count: ok,
                pct: ok / tot,
                color: "bg-accent",
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
                      <span className="text-muted">
                        {r.label} ({Math.round(r.pct * 100)}%)
                      </span>
                      <span className="ui-num text-muted">
                        {r.count}
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: "var(--surface-2)" }}
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
