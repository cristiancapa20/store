"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { listSales, listStaff } from "@/lib/actions";
import type { Sale, SaleFilters } from "@/lib/types";

type StaffUser = { id: string; name: string };

function SaleCard({ sale }: { sale: Sale }) {
  const t = useTranslations("history");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="ui-card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-4 flex items-center justify-between min-h-[48px] hover:bg-brand-50/60 dark:hover:bg-brand-800/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">
            {dateStr} · {timeStr}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {sale.staffName ?? "—"} ·{" "}
            {t("items", { count: itemCount })}
          </p>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            ${sale.total.toFixed(2)}
          </span>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-brand-200/50 dark:border-brand-700/40 px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {sale.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300 flex-1 min-w-0 truncate pr-2">
                  {item.productName}
                </span>
                <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 shrink-0">
                  <span>
                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 w-16 text-right">
                    ${item.lineTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-zinc-100 dark:border-zinc-700">
            <span className="text-zinc-500 dark:text-zinc-400">{t("total")}</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              ${sale.total.toFixed(2)}
            </span>
          </div>
          <Link
            href={`/api/invoices/${sale.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-full bg-brand-50 dark:bg-brand-800/30 px-4 py-3 text-sm font-medium text-brand-800 dark:text-brand-100 hover:bg-brand-100 transition-colors min-h-[48px]"
          >
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {t("downloadInvoice")}
          </Link>
        </div>
      )}
    </div>
  );
}

function SaleSkeleton() {
  return (
    <div className="ui-card animate-pulse flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3" />
          <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3" />
        </div>
        <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-700 rounded ml-4" />
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const t = useTranslations("history");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [staffId, setStaffId] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
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
        setSales([]);
      } else {
        setSales(result.sales);
      }
      setHasFetched(true);
    });
  }, [startDate, endDate, staffId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pb-20">
      <h1 className="ui-page-title">{t("title")}</h1>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
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
        <label className="ui-label-muted">{t("staffFilter")}</label>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="ui-input"
        >
          <option value="">{t("allStaff")}</option>
          {staffUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading skeleton */}
      {showSkeleton && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <SaleSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Sales list */}
      {!showSkeleton && (
        <>
          {sales.length === 0 ? (
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-sm">
                {hasFetched ? t("noSales") : t("loading")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sales.map((sale) => (
                <SaleCard key={sale.id} sale={sale} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
