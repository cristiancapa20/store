"use client";

import { useState, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import BarcodeInput from "@/components/BarcodeInput";
import { scanBarcode, listInventory, adjustStock } from "@/lib/actions";
import { useActionErrorMessage } from "@/lib/useActionErrorMessage";
import type { Product } from "@/lib/types";

type Reason = "Restock" | "Shrinkage" | "Correction" | "Other";

const SEARCH_RESULT_LIMIT = 10;

export default function AdjustPage() {
  const t = useTranslations("adjust");
  const actionErrorMessage = useActionErrorMessage();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [delta, setDelta] = useState<number>(0);
  const [reason, setReason] = useState<Reason>("Restock");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [newStock, setNewStock] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const projectedStock = selectedProduct ? selectedProduct.stock + delta : 0;
  const belowZero = selectedProduct !== null && projectedStock < 0;

  const selectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setScanError(null);
    setAdjustError(null);
    setNewStock(null);
    setDelta(0);
  }, []);

  const handleScan = useCallback(
    (barcode: string) => {
      setScanError(null);
      setSelectedProduct(null);
      setNewStock(null);
      setDelta(0);
      startTransition(async () => {
        const result = await scanBarcode(barcode);
        if ("error" in result) {
          setScanError(
            result.code === "not_found"
              ? t("productNotFound")
              : t("scanFailed", { error: actionErrorMessage(result) }),
          );
        } else {
          selectProduct(result);
        }
      });
    },
    [selectProduct, t, actionErrorMessage],
  );

  // The term goes to the service's `name` filter instead of downloading a page
  // of the catalog to sift through it here.
  const handleSearchChange = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      const term = query.trim();
      if (term.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }
      const result = await listInventory(1, SEARCH_RESULT_LIMIT, term);
      if ("error" in result) {
        setSearchError(actionErrorMessage(result));
        setSearchResults([]);
        return;
      }
      setSearchError(null);
      setSearchResults(result.products);
    },
    [actionErrorMessage],
  );

  const handleApply = useCallback(() => {
    if (!selectedProduct || belowZero || delta === 0) return;
    setAdjustError(null);
    setNewStock(null);
    startTransition(async () => {
      const result = await adjustStock(selectedProduct.id, delta);
      if ("error" in result) {
        setAdjustError(actionErrorMessage(result));
      } else {
        setNewStock(result.stock);
        setSelectedProduct((prev) =>
          prev ? { ...prev, stock: result.stock } : null,
        );
        setDelta(0);
      }
    });
  }, [selectedProduct, belowZero, delta, actionErrorMessage]);

  const handleDeltaInput = useCallback((val: string) => {
    const n = parseInt(val, 10);
    setDelta(isNaN(n) ? 0 : n);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedProduct(null);
    setDelta(0);
    setNewStock(null);
    setAdjustError(null);
    setScanError(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return (
    <div className="flex flex-col h-full gap-5 overflow-y-auto">
      <h1 className="ui-page-title">{t("title")}</h1>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          {/* Barcode Input */}
          <BarcodeInput onScan={handleScan} disabled={isPending} />

          {/* Name / SKU search */}
          <div className="relative w-full min-w-0">
            <div className="ui-search">
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
                  strokeWidth={1.75}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="ui-search-field"
              />
            </div>
            {searchError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {t("searchFailed", { error: searchError })}
              </p>
            )}
            {searchResults.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-line bg-surface z-10 overflow-hidden animate-fade-in-up"
                style={{ boxShadow: "var(--shadow-pop)" }}
              >
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p)}
                    className="w-full text-left px-4 py-3 min-h-[48px] flex items-center justify-between gap-3 border-b border-line last:border-0 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <span className="font-medium text-sm text-content truncate">
                      {p.name}
                    </span>
                    <span className="ui-num text-[11px] text-muted shrink-0">
                      {p.sku} · {p.stock}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scan error */}
          {scanError && <div className="ui-alert-error">{scanError}</div>}
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          {/* Selected product panel */}
          {selectedProduct ? (
            <div className="flex flex-col gap-4">
              {/* Product info card */}
              <div className="ui-card flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-content">
                    {selectedProduct.name}
                  </p>
                  <p className="ui-num text-[11px] text-muted mt-1">
                    {selectedProduct.sku}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {t("currentStock")}
                  </p>
                  <p className="ui-num text-2xl text-content mt-1">
                    {selectedProduct.stock}
                  </p>
                </div>
              </div>

              {/* Delta stepper */}
              <div className="flex flex-col gap-2">
                <label className="ui-label">{t("adjustment")}</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDelta((d) => d - 1)}
                    aria-label={t("decrease")}
                    className="ui-btn-icon-circle text-xl"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={delta}
                    onChange={(e) => handleDeltaInput(e.target.value)}
                    aria-label={t("adjustAmount")}
                    className="ui-input ui-num flex-1 text-center text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setDelta((d) => d + 1)}
                    aria-label={t("increase")}
                    className="ui-btn-icon-circle text-xl"
                  >
                    +
                  </button>
                </div>
                <p
                  className={`text-sm ${
                    belowZero ? "text-red-600 dark:text-red-400" : "text-muted"
                  }`}
                >
                  {belowZero
                    ? t("belowZero", { stock: projectedStock })
                    : delta !== 0
                      ? t("newStock", { stock: projectedStock })
                      : t("enterAmount")}
                </p>
              </div>

              {/* Reason dropdown */}
              <div className="flex flex-col gap-2">
                <label className="ui-label">{t("reason")}</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as Reason)}
                  className="ui-input"
                >
                  <option value="Restock">{t("restock")}</option>
                  <option value="Shrinkage">{t("shrinkage")}</option>
                  <option value="Correction">{t("correction")}</option>
                  <option value="Other">{t("other")}</option>
                </select>
              </div>

              {/* Adjust error */}
              {adjustError && (
                <div className="ui-alert-error">{adjustError}</div>
              )}

              {/* Success */}
              {newStock !== null && (
                <div className="ui-alert-success">
                  {t("updated", { stock: newStock })}
                </div>
              )}

              {/* Apply button */}
              <button
                type="button"
                onClick={handleApply}
                disabled={isPending || belowZero || delta === 0}
                className="ui-btn-primary-block"
              >
                {isPending ? t("applying") : t("apply")}
              </button>

              {/* Select another */}
              <button
                type="button"
                onClick={resetSelection}
                className="ui-btn-text"
              >
                {t("selectAnother")}
              </button>
            </div>
          ) : (
            !scanError && (
              <div className="ui-empty">
                <p className="text-sm">{t("emptyHint")}</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
