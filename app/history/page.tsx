"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { listSales, listStaff } from "@/lib/actions";
import type { Sale, SaleFilters } from "@/lib/types";

const PAGE_SIZE = 10;

type StaffUser = { id: string; name: string };

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-card flex flex-col gap-1 min-w-0">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{label}</p>
      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">{value}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function IconEye() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function IconPrint() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function exportToCSV(sales: Sale[], locale: string) {
  const rows = [
    ["ID", "Fecha", "Total"],
    ...sales.map((s) => [
      `#${s.id.slice(0, 8).toUpperCase()}`,
      new Date(s.createdAt).toLocaleDateString(locale),
      s.total.toFixed(2),
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historial.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

export default function HistoryPage() {
  const t = useTranslations("history");
  const locale = useLocale();

  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [staffId, setStaffId] = useState("");
  const [page, setPage] = useState(1);

  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [staffPending, startStaffTransition] = useTransition();
  const [salesPending, startSalesTransition] = useTransition();

  const isPending = staffPending || salesPending;
  const showSkeleton = isPending && !hasFetched;

  const fetchStaff = useCallback(() => {
    startStaffTransition(async () => {
      const users = await listStaff();
      setStaffUsers(users);
    });
  }, []);

  const fetchSales = useCallback(() => {
    const filters: SaleFilters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (staffId) filters.staffId = staffId;
    startSalesTransition(async () => {
      const result = await listSales(filters);
      if ("error" in result) {
        setAllSales([]);
      } else {
        setAllSales(result.sales);
        setPage(1);
      }
      setHasFetched(true);
    });
  }, [startDate, endDate, staffId]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { fetchSales(); }, [fetchSales]);

  // Metrics
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
  const todaySales = allSales.filter((s) => {
    const d = new Date(s.createdAt);
    return d.toLocaleDateString("en-CA") === todayStr;
  });
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  const avgTicket =
    allSales.length > 0
      ? allSales.reduce((sum, s) => sum + s.total, 0) / allSales.length
      : 0;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(allSales.length / PAGE_SIZE));
  const paginatedSales = allSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const fromIndex = allSales.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toIndex = Math.min(page * PAGE_SIZE, allSales.length);
  const pageNumbers = buildPageNumbers(page, totalPages);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) +
      " • " +
      d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pb-20">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="ui-page-title">{t("title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`ui-btn-secondary text-xs px-3 gap-1.5 ${showFilters ? "bg-brand-100 dark:bg-brand-800/70 border-brand-300 dark:border-brand-600" : ""}`}
          >
            <IconFilter />
            {t("filters")}
          </button>
          <button
            type="button"
            onClick={() => exportToCSV(allSales, locale)}
            disabled={allSales.length === 0}
            className="ui-btn-secondary text-xs px-3 gap-1.5"
          >
            <IconExport />
            {t("export")}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="ui-card flex flex-col gap-3 animate-fade-in">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="ui-label-muted">{t("from")}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="ui-input"
              />
            </div>
            <div className="flex-1">
              <label className="ui-label-muted">{t("to")}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="ui-input"
              />
            </div>
          </div>
          <div>
            <label className="ui-label-muted">{t("staffFilter")}</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="ui-input"
            >
              <option value="">{t("allStaff")}</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label={t("todayTotal")} value={`$${todayTotal.toFixed(2)}`} />
        <MetricCard label={t("invoicesIssued")} value={String(allSales.length)} />
        <MetricCard label={t("pendingCount")} value="0" />
        <MetricCard label={t("avgTicket")} value={`$${avgTicket.toFixed(2)}`} />
      </div>

      {/* Table card */}
      <div className="ui-card overflow-hidden p-0">
        {showSkeleton ? (
          <TableSkeleton />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-100 dark:border-brand-700/40">
                    {[
                      { key: "invoiceId", align: "left" },
                      { key: "client", align: "left" },
                      { key: "date", align: "left" },
                      { key: "total", align: "right" },
                      { key: "status", align: "left" },
                      { key: "actions", align: "right" },
                    ].map(({ key, align }) => (
                      <th
                        key={key}
                        className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-${align}`}
                      >
                        {t(key as Parameters<typeof t>[0])}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/60 dark:divide-brand-700/30">
                  {paginatedSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center text-sm text-zinc-400">
                        {hasFetched ? t("noSales") : t("loading")}
                      </td>
                    </tr>
                  ) : (
                    paginatedSales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-brand-50/40 dark:hover:bg-brand-800/20 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                          #{sale.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                          {t("consumerFinal")}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-xs">
                          {formatDate(sale.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          ${sale.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                            {t("paid")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <form
                              action={`/api/invoices/${sale.id}`}
                              method="POST"
                              target="_blank"
                            >
                              <input type="hidden" name="sale" value={JSON.stringify(sale)} />
                              <button
                                type="submit"
                                title={t("viewSale")}
                                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-brand-600 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-800/40 transition-colors"
                              >
                                <IconEye />
                              </button>
                            </form>
                            <form
                              action={`/api/invoices/${sale.id}`}
                              method="POST"
                              target="_blank"
                            >
                              <input type="hidden" name="sale" value={JSON.stringify(sale)} />
                              <button
                                type="submit"
                                title={t("printInvoice")}
                                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-brand-600 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-800/40 transition-colors"
                              >
                                <IconPrint />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {allSales.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-brand-100 dark:border-brand-700/40 flex-wrap gap-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("showing", { from: fromIndex, to: toIndex, total: allSales.length })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-brand-100 dark:hover:bg-brand-800/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <IconChevronLeft />
                  </button>
                  {pageNumbers.map((pg, i) =>
                    pg === "…" ? (
                      <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-zinc-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setPage(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          page === pg
                            ? "bg-brand-600 text-white shadow-sm"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-brand-100 dark:hover:bg-brand-800/40"
                        }`}
                      >
                        {pg}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-brand-100 dark:hover:bg-brand-800/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <IconChevronRight />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
