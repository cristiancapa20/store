"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import BarcodeInput from "@/components/BarcodeInput";
import { addProduct } from "@/lib/actions";

type FormErrors = {
  name?: string;
  sku?: string;
  price?: string;
  initialStock?: string;
  form?: string;
};

export default function AddProductForm() {
  const t = useTranslations("addProduct");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [showSkuScanner, setShowSkuScanner] = useState(false);

  const handleSkuScan = useCallback((barcode: string) => {
    setSku(barcode);
    setShowSkuScanner(false);
  }, []);

  const handleSubmit = () => {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = t("nameRequired");
    if (!sku.trim()) errs.sku = t("skuRequired");
    if (!price.trim()) {
      errs.price = t("priceRequired");
    } else if (isNaN(Number(price)) || Number(price) < 0) {
      errs.price = t("priceInvalid");
    }
    if (!initialStock.trim()) {
      errs.initialStock = t("stockRequired");
    } else if (!Number.isInteger(Number(initialStock)) || Number(initialStock) < 0) {
      errs.initialStock = t("stockInvalid");
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await addProduct({
        name: name.trim(),
        sku: sku.trim(),
        price: parseFloat(price),
        initialStock: parseInt(initialStock, 10),
        description: description.trim() || undefined,
      });
      if ("error" in result) {
        setErrors({ form: result.error });
      } else {
        router.push("/products?added=1");
      }
    });
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      <h1 className="ui-page-title">{t("title")}</h1>

      {/* SKU barcode scanner inline overlay */}
      {showSkuScanner && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("scanHint")}
          </p>
          <BarcodeInput onScan={handleSkuScan} initialMode="camera" />
          <button
            type="button"
            onClick={() => setShowSkuScanner(false)}
            className="w-full rounded-full py-3 text-sm text-brand-700 dark:text-brand-200 min-h-[48px] hover:bg-brand-50/80 dark:hover:bg-brand-800/30 transition-colors"
          >
            {t("cancelScan")}
          </button>
        </div>
      )}

      {!showSkuScanner && (
        <>
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className={`ui-input ${errors.name ? "ring-2 ring-red-400" : ""}`}
            />
            {errors.name && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* SKU */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              SKU <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Product SKU or barcode"
                className={`ui-input flex-1 ${errors.sku ? "ring-2 ring-red-400" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowSkuScanner(true)}
                aria-label="Scan barcode for SKU"
                className="flex items-center justify-center rounded-full bg-surface dark:bg-brand-900 shadow-[0_6px_20px_rgba(3,15,34,0.08)] hover:bg-brand-50 min-h-[48px] min-w-[48px] w-12 h-12 transition-all shrink-0 text-brand-800"
              >
                <svg
                  className="w-5 h-5 text-zinc-600 dark:text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                  />
                </svg>
              </button>
            </div>
            {errors.sku && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.sku}</p>
            )}
          </div>

          {/* Price */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Price <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`ui-input ${errors.price ? "ring-2 ring-red-400" : ""}`}
            />
            {errors.price && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.price}</p>
            )}
          </div>

          {/* Initial Stock */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Initial Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className={`ui-input ${errors.initialStock ? "ring-2 ring-red-400" : ""}`}
            />
            {errors.initialStock && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.initialStock}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className="ui-input resize-none rounded-3xl"
            />
          </div>

          {/* API / form-level error */}
          {errors.form && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {errors.form}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="ui-btn-primary-block py-4 text-base"
          >
            {isPending ? t("adding") : t("submit")}
          </button>
        </>
      )}
    </div>
  );
}
