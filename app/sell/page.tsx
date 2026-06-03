"use client";

import { useCallback, useState, useTransition } from "react";
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
          showToast("Product not found", "error");
          return;
        }
        if (result.stock <= 0) {
          showToast("Out of stock", "error");
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
    [showToast]
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
        showToast(result.error || "Failed to create sale", "error");
        return;
      }
      setCart([]);
      setLastSaleId(result.id);
      showToast("Sale confirmed!", "success");
    });
  }, [cart, showToast]);

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
            className={`px-4 py-3 rounded-2xl text-white text-sm font-medium shadow-lg pointer-events-auto ${
              t.variant === "success" ? "bg-green-600" : "bg-red-500"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto pb-40">
        <BarcodeInput onScan={handleScan} disabled={isPending} />

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            {lastSaleId ? (
              <>
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-green-600 dark:text-green-400"
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
                  Sale confirmed — scan the next product.
                </p>
                <a
                  href={`/api/invoices/${lastSaleId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-2xl min-h-[48px] flex items-center transition-colors"
                >
                  View Invoice
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
                  Cart is empty
                </p>
                <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                  Scan a product barcode to add it to the cart.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {cart.map((entry) => (
              <div
                key={entry.productId}
                className="flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-zinc-100 dark:border-zinc-800 shadow-sm"
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
                    className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-base font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all min-h-[36px] min-w-[36px]"
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
                    className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-base font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all min-h-[36px] min-w-[36px]"
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
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
              <span className="text-xl font-bold tabular-nums">
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl min-h-[48px] transition-colors flex items-center justify-center gap-2"
            >
              {confirmPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Confirming…
                </>
              ) : (
                "Confirm Sale"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
