"use client";

import { useState, useCallback, useTransition, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getSalesSummary, listSales, listStaff } from "@/lib/actions";
import { INVENTORY_MAX_LIMIT } from "@/lib/pagination";
import type { Sale, SaleFilters, SalesSummary } from "@/lib/types";

const PAGE_SIZE = 10;
// The CSV is meant to be the whole result set, not the page on screen, so the
// export walks the service pages. The ceiling keeps a full-history export from
// turning into hundreds of round trips.
const EXPORT_MAX_PAGES = 10;

type StaffUser = { id: string; name: string };

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-card flex flex-col gap-2 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted truncate">
        {label}
      </p>
      <p className="ui-num text-xl text-content truncate">{value}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-surface-2 rounded-xl animate-pulse" />
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

  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [staffPending, startStaffTransition] = useTransition();
  const [salesPending, startSalesTransition] = useTransition();
  const [exportPending, startExportTransition] = useTransition();

  const isPending = staffPending || salesPending;
  const showSkeleton = isPending && !hasFetched;

  const filters = useMemo<SaleFilters>(() => {
    const next: SaleFilters = {};
    if (startDate) next.startDate = startDate;
    if (endDate) next.endDate = endDate;
    if (staffId) next.staffId = staffId;
    return next;
  }, [startDate, endDate, staffId]);

  // The metric cards cover the whole filtered set, so "today" has to be the
  // till's local day, not the server's.
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

  const fetchStaff = useCallback(() => {
    startStaffTransition(async () => {
      const users = await listStaff();
      setStaffUsers("error" in users ? [] : users);
    });
  }, []);

  // A change of filters restarts at page 1; a change of page must not reset it,
  // so the reset lives in the filter setters and not in the fetch effect.
  const changeFilter = useCallback(
    (apply: () => void) => {
      apply();
      setPage(1);
    },
    []
  );

  const fetchSales = useCallback(() => {
    startSalesTransition(async () => {
      const [pageResult, summaryResult] = await Promise.all([
        listSales({ ...filters, page, limit: PAGE_SIZE }),
        getSalesSummary(filters, todayStr),
      ]);

      if ("error" in pageResult) {
        setSales([]);
        setTotal(0);
        setTruncated(false);
      } else {
        setSales(pageResult.sales);
        setTotal(pageResult.total);
        setTruncated(pageResult.truncated);
      }

      setSummary("error" in summaryResult ? null : summaryResult);
      setHasFetched(true);
    });
  }, [filters, page, todayStr]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { fetchSales(); }, [fetchSales]);

  const handleExport = useCallback(() => {
    startExportTransition(async () => {
      const rows: Sale[] = [];
      for (let p = 1; p <= EXPORT_MAX_PAGES; p++) {
        const result = await listSales({ ...filters, page: p, limit: INVENTORY_MAX_LIMIT });
        if ("error" in result) break;
        rows.push(...result.sales);
        if (rows.length >= result.total) break;
      }
      if (rows.length > 0) exportToCSV(rows, locale);
    });
  }, [filters, locale]);

  // Metrics
  const todayTotal = summary?.todayRevenue ?? 0;
  const avgTicket =
    summary && summary.count > 0 ? summary.revenue / summary.count : 0;

  // Pagination — the service owns `total`, so the footer and the page agree.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toIndex = Math.min((page - 1) * PAGE_SIZE + sales.length, total);
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
          <p className="text-sm text-muted mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="ui-btn-secondary text-xs px-3 gap-1.5"
            style={showFilters ? { borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)", color: "var(--accent)" } : undefined}
          >
            <IconFilter />
            {t("filters")}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={total === 0 || exportPending}
            className="ui-btn-secondary text-xs px-3 gap-1.5"
          >
            <IconExport />
            {exportPending ? t("exporting") : t("export")}
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
                onChange={(e) => changeFilter(() => setStartDate(e.target.value))}
                className="ui-input"
              />
            </div>
            <div className="flex-1">
              <label className="ui-label-muted">{t("to")}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => changeFilter(() => setEndDate(e.target.value))}
                className="ui-input"
              />
            </div>
          </div>
          <div>
            <label className="ui-label-muted">{t("staffFilter")}</label>
            <select
              value={staffId}
              onChange={(e) => changeFilter(() => setStaffId(e.target.value))}
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
        <MetricCard label={t("invoicesIssued")} value={String(total)} />
        <MetricCard label={t("pendingCount")} value="0" />
        <MetricCard label={t("avgTicket")} value={`$${avgTicket.toFixed(2)}`} />
      </div>

      {truncated && (
        <div className="ui-alert-info">
          {t("partialStaffHistory", { scanned: total })}
        </div>
      )}

      {/* Table card */}
      <div className="ui-card overflow-hidden p-0">
        {showSkeleton ? (
          <TableSkeleton />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
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
                        className={`px-4 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted whitespace-nowrap text-${align}`}
                      >
                        {t(key as Parameters<typeof t>[0])}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center text-sm text-muted">
                        {hasFetched ? t("noSales") : t("loading")}
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="transition-colors hover:bg-[var(--surface-2)]"
                      >
                        <td className="ui-num px-4 py-3 text-xs text-accent whitespace-nowrap">
                          #{sale.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-content whitespace-nowrap">
                          {t("consumerFinal")}
                        </td>
                        <td className="ui-num px-4 py-3 text-muted whitespace-nowrap text-xs">
                          {formatDate(sale.createdAt)}
                        </td>
                        <td className="ui-num px-4 py-3 text-right text-content whitespace-nowrap">
                          ${sale.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="ui-badge-success gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                            {t("paid")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* La factura se pide por id: los importes los pone el
                                servicio, no esta pantalla. */}
                            <a
                              href={`/api/invoices/${sale.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={t("viewSale")}
                              className="inline-flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg text-muted hover:text-accent transition-colors"
                            >
                              <IconEye />
                            </a>
                            <a
                              href={`/api/invoices/${sale.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={t("printInvoice")}
                              className="inline-flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg text-muted hover:text-accent transition-colors"
                            >
                              <IconPrint />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-line flex-wrap gap-2">
                <p className="font-mono text-[11px] text-muted">
                  {t("showing", { from: fromIndex, to: toIndex, total })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:text-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <IconChevronLeft />
                  </button>
                  {pageNumbers.map((pg, i) =>
                    pg === "…" ? (
                      <span key={`dots-${i}`} className="w-9 h-9 flex items-center justify-center text-xs text-muted">
                        …
                      </span>
                    ) : (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setPage(pg)}
                        className={`ui-num w-9 h-9 rounded-lg text-xs transition-colors ${
                          page === pg
                            ? "bg-[var(--accent-wash)] text-accent border border-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
                            : "text-muted hover:text-content"
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
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:text-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
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
