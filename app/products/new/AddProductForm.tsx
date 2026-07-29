"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import BarcodeInput from "@/components/BarcodeInput";
import { addProduct } from "@/lib/actions";
import { useActionErrorMessage } from "@/lib/useActionErrorMessage";

type FormErrors = {
  name?: string;
  sku?: string;
  price?: string;
  initialStock?: string;
  form?: string;
};

export default function AddProductForm() {
  const t = useTranslations("addProduct");
  const actionErrorMessage = useActionErrorMessage();
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
    } else if (
      !Number.isInteger(Number(initialStock)) ||
      Number(initialStock) < 0
    ) {
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
        setErrors({ form: actionErrorMessage(result) });
      } else {
        router.push("/products?added=1");
      }
    });
  };

  return (
    <div className="flex flex-col h-full gap-5 overflow-y-auto">
      <h1 className="ui-page-title">{t("title")}</h1>

      {/* SKU barcode scanner inline overlay */}
      {showSkuScanner && (
        <div className="flex flex-col gap-3 max-w-2xl">
          <p className="text-sm text-muted">{t("scanHint")}</p>
          <BarcodeInput onScan={handleSkuScan} initialMode="camera" />
          <button
            type="button"
            onClick={() => setShowSkuScanner(false)}
            className="ui-btn-text"
          >
            {t("cancelScan")}
          </button>
        </div>
      )}

      {!showSkuScanner && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[1.3fr_1.3fr_1fr_1fr] items-start">
          {/* Name */}
          <div>
            <label className="ui-label">
              {t("nameLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className={`ui-input ${errors.name ? "ui-input-error" : ""}`}
            />
            {errors.name && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                {errors.name}
              </p>
            )}
          </div>

          {/* SKU */}
          <div>
            <label className="ui-label">
              {t("skuLabel")} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder={t("skuPlaceholder")}
                className={`ui-input flex-1 ${errors.sku ? "ui-input-error" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowSkuScanner(true)}
                aria-label={t("scanSkuLabel")}
                className="ui-btn-icon-circle"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                  />
                </svg>
              </button>
            </div>
            {errors.sku && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                {errors.sku}
              </p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="ui-label">
              {t("priceLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`ui-input ${errors.price ? "ui-input-error" : ""}`}
            />
            {errors.price && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                {errors.price}
              </p>
            )}
          </div>

          {/* Initial Stock */}
          <div>
            <label className="ui-label">
              {t("stockLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className={`ui-input ${errors.initialStock ? "ui-input-error" : ""}`}
            />
            {errors.initialStock && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                {errors.initialStock}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="sm:col-span-2 xl:col-span-4">
            <label className="ui-label">{t("descriptionLabel")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className="ui-input ui-textarea"
            />
          </div>

          {/* API / form-level error */}
          {errors.form && (
            <div className="ui-alert-error sm:col-span-2 xl:col-span-4">
              {errors.form}
            </div>
          )}

          {/* Submit */}
          <div className="sm:col-span-2 xl:col-span-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="ui-btn-primary w-full sm:w-auto sm:min-w-64"
            >
              {isPending ? t("adding") : t("submit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
