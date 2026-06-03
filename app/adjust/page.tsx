"use client";

import { useState, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import BarcodeInput from "@/components/BarcodeInput";
import { scanBarcode, listInventory, adjustStock } from "@/lib/actions";
import type { Product } from "@/lib/types";

type Reason = "Restock" | "Shrinkage" | "Correction" | "Other";

export default function AdjustPage() {
  const t = useTranslations("adjust");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [delta, setDelta] = useState<number>(0);
  const [reason, setReason] = useState<Reason>("Restock");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [newStock, setNewStock] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const projectedStock = selectedProduct ? selectedProduct.stock + delta : 0;
  const belowZero = selectedProduct !== null && projectedStock < 0;

  const selectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSearchQuery("");
    setSearchResults([]);
    setScanError(null);
    setAdjustError(null);
    setNewStock(null);
    setDelta(0);
  }, []);

  const handleScan = useCallback((barcode: string) => {
    setScanError(null);
    setSelectedProduct(null);
    setNewStock(null);
    setDelta(0);
    startTransition(async () => {
      const result = await scanBarcode(barcode);
      if ("error" in result) {
        setScanError(`Product not found: ${result.error}`);
      } else {
        selectProduct(result);
      }
    });
  }, [selectProduct]);

  const handleSearchChange = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const result = await listInventory(1, 200);
    if (!("error" in result)) {
      const q = query.toLowerCase();
      const filtered = result.products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
      setSearchResults(filtered.slice(0, 10));
    }
  }, []);

  const handleApply = useCallback(() => {
    if (!selectedProduct || belowZero || delta === 0) return;
    setAdjustError(null);
    setNewStock(null);
    startTransition(async () => {
      const result = await adjustStock(selectedProduct.id, delta);
      if ("error" in result) {
        setAdjustError(result.error);
      } else {
        setNewStock(result.stock);
        setSelectedProduct((prev) =>
          prev ? { ...prev, stock: result.stock } : null
        );
        setDelta(0);
      }
    });
  }, [selectedProduct, belowZero, delta]);

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
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      <h1 className="ui-page-title">{t("title")}</h1>

      {/* Barcode Input */}
      <BarcodeInput onScan={handleScan} disabled={isPending} />

      {/* Name / SKU search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="ui-input"
        />
        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-surface dark:bg-brand-900 rounded-3xl shadow-[0_16px_40px_rgba(3,15,34,0.14)] z-10 overflow-hidden">
            {searchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProduct(p)}
                className="w-full text-left px-4 py-3 hover:bg-brand-50 dark:hover:bg-brand-800/40 min-h-[48px] flex items-center justify-between"
              >
                <span className="font-medium text-sm">{p.name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2 shrink-0">
                  {p.sku} · Stock: {p.stock}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scan error */}
      {scanError && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {scanError}
        </div>
      )}

      {/* Selected product panel */}
      {selectedProduct ? (
        <div className="flex flex-col gap-4">
          {/* Product info card */}
          <div className="ui-card flex items-center justify-between">
            <div>
              <p className="font-semibold">{selectedProduct.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {selectedProduct.sku}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("currentStock")}</p>
              <p className="text-2xl font-bold">{selectedProduct.stock}</p>
            </div>
          </div>

          {/* Delta stepper */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("adjustment")}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDelta((d) => d - 1)}
                aria-label="Decrease"
                className="flex items-center justify-center rounded-full bg-surface dark:bg-brand-900 text-xl font-bold text-brand-800 shadow-[0_6px_20px_rgba(3,15,34,0.08)] hover:bg-brand-50 min-h-[48px] min-w-[48px] w-12 h-12 transition-all"
              >
                −
              </button>
              <input
                type="number"
                value={delta}
                onChange={(e) => handleDeltaInput(e.target.value)}
                aria-label="Adjustment amount"
                className="ui-input flex-1 text-center text-lg font-semibold"
              />
              <button
                type="button"
                onClick={() => setDelta((d) => d + 1)}
                aria-label="Increase"
                className="flex items-center justify-center rounded-full bg-surface dark:bg-brand-900 text-xl font-bold text-brand-800 shadow-[0_6px_20px_rgba(3,15,34,0.08)] hover:bg-brand-50 min-h-[48px] min-w-[48px] w-12 h-12 transition-all"
              >
                +
              </button>
            </div>
            <p
              className={`text-sm ${
                belowZero
                  ? "text-red-600 dark:text-red-400 font-medium"
                  : "text-zinc-500 dark:text-zinc-400"
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
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("reason")}
            </label>
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
            <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {adjustError}
            </div>
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
            className="ui-btn-primary-block py-4 text-base"
          >
            {isPending ? t("applying") : t("apply")}
          </button>

          {/* Select another */}
          <button
            type="button"
            onClick={resetSelection}
            className="w-full rounded-full py-3 text-sm text-brand-700 dark:text-brand-200 min-h-[48px] hover:bg-brand-50/80 dark:hover:bg-brand-800/30 transition-colors"
          >
            {t("selectAnother")}
          </button>
        </div>
      ) : (
        !scanError && (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center px-4">
              {t("emptyHint")}
            </p>
          </div>
        )
      )}
    </div>
  );
}
