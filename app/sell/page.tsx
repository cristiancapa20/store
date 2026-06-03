"use client";

import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import BarcodeInput from "@/components/BarcodeInput";
import { scanBarcode, createSale } from "@/lib/actions";
import type { CartItem } from "@/lib/types";

type CartEntry = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
};

type Toast = {
  id: number;
  message: string;
  variant: "success" | "error";
};

let _toastId = 0;

export default function SellPage() {
  const t = useTranslations("sell");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  const [scanPending, startScan] = useTransition();
  const [confirmPending, startConfirm] = useTransition();

  const isPending = scanPending || confirmPending;

  const showToast = useCallback(
    (message: string, variant: "success" | "error") => {
      const id = ++_toastId;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        3000
      );
    },
    []
  );

  const handleScan = useCallback(
    (barcode: string) => {
      startScan(async () => {
        const result = await scanBarcode(barcode);
        if ("error" in result) {
          showToast(t("productNotFound"), "error");
          return;
        }
        if (result.stock <= 0) {
          showToast(t("outOfStock"), "error");
          return;
        }
        setCart((prev) => {
          const idx = prev.findIndex((e) => e.productId === result.id);
          if (idx !== -1) {
            return prev.map((e, i) =>
              i === idx ? { ...e, quantity: e.quantity + 1 } : e
            );
          }
          return [
            ...prev,
            {
              productId: result.id,
              productName: result.name,
              unitPrice: result.price,
              quantity: 1,
            },
          ];
        });
      });
    },
    [showToast, t]
  );

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((e) =>
          e.productId === productId ? { ...e, quantity: e.quantity + delta } : e
        )
        .filter((e) => e.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((e) => e.productId !== productId));
  }, []);

  const handleConfirm = useCallback(() => {
    if (cart.length === 0) return;
    startConfirm(async () => {
      const items: CartItem[] = cart.map((e) => ({
        productId: e.productId,
        quantity: e.quantity,
        unitPrice: e.unitPrice,
      }));
      const result = await createSale(items);
      if ("error" in result) {
        showToast(result.error || t("failedToCreate"), "error");
        return;
      }
      setCart([]);
      setLastSaleId(result.id);
      showToast(t("saleConfirmedToast"), "success");
    });
  }, [cart, showToast, t]);

  const subtotal = cart.reduce((s, e) => s + e.unitPrice * e.quantity, 0);
  const itemCount = cart.reduce((s, e) => s + e.quantity, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toast stack */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`px-5 py-3 rounded-full text-white text-sm font-medium shadow-[0_12px_32px_rgba(3,15,34,0.2)] pointer-events-auto ${
              t.variant === "success" ? "bg-brand-600" : "bg-red-500"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="flex flex-col gap-4 flex-1 overflow-y-auto pb-40">
        <BarcodeInput onScan={handleScan} disabled={isPending} />

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            {lastSaleId ? (
              <>
                <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-brand-600 dark:text-brand-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                  {t("saleConfirmed")}
                </p>
                <a
                  href={`/api/invoices/${lastSaleId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-btn-primary px-6 py-3 text-sm"
                >
                  {t("viewInvoice")}
                </a>
              </>
            ) : (
              <>
                <svg
                  className="w-12 h-12 text-zinc-300 dark:text-zinc-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                  {t("cartEmpty")}
                </p>
                <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                  {t("cartEmptyHint")}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {cart.map((entry) => (
              <div
                key={entry.productId}
                className="flex items-center gap-3 ui-card p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {entry.productName}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    ${entry.unitPrice.toFixed(2)} ×{entry.quantity} ={" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      ${(entry.unitPrice * entry.quantity).toFixed(2)}
                    </span>
                  </p>
                </div>

                {/* Quantity stepper */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateQty(entry.productId, -1)}
                    aria-label={`Decrease quantity of ${entry.productName}`}
                    className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-800/50 flex items-center justify-center text-base font-bold text-brand-800 dark:text-brand-100 hover:bg-brand-100 active:scale-95 transition-all min-h-[36px] min-w-[36px]"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums select-none">
                    {entry.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(entry.productId, 1)}
                    aria-label={`Increase quantity of ${entry.productName}`}
                    className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-800/50 flex items-center justify-center text-base font-bold text-brand-800 dark:text-brand-100 hover:bg-brand-100 active:scale-95 transition-all min-h-[36px] min-w-[36px]"
                  >
                    +
                  </button>
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeItem(entry.productId)}
                  aria-label={`Remove ${entry.productName} from cart`}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0 min-h-[36px] min-w-[36px]"
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
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart footer — fixed above BottomNav */}
      {cart.length > 0 && (
        <div className="fixed bottom-[4.5rem] left-3 right-3 z-40 max-w-md mx-auto lg:bottom-6 lg:left-auto lg:right-8 lg:translate-x-0 lg:max-w-sm">
          <div className="ui-card flex flex-col gap-3 shadow-[0_20px_50px_rgba(3,15,34,0.18)]">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {t("items", { count: itemCount })}
              </span>
              <span className="text-xl font-bold tabular-nums">
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="ui-btn-primary-block py-4 gap-2"
            >
              {confirmPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t("confirming")}
                </>
              ) : (
                t("confirmSale")
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
