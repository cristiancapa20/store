"use client";

import { useCallback, useState, useTransition, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import BarcodeInput from "@/components/BarcodeInput";
import {
  scanBarcode,
  createSale,
  listInventory,
  getInvoicePreviewInfo,
} from "@/lib/actions";
import { newIdempotencyKey } from "@/lib/idempotency";
import { useActionErrorMessage } from "@/lib/useActionErrorMessage";
import type { CartItem, Product } from "@/lib/types";

const SEARCH_RESULT_LIMIT = 8;
// The service answers every keystroke; the delay keeps a fast typist from firing
// one request per character.
const SEARCH_DEBOUNCE_MS = 250;

type InvoiceInfo = {
  storeName: string;
  taxRate: number;
  staffName: string;
};

type CartEntry = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
};

type Ticket = {
  id: number;
  number: number;
  cart: CartEntry[];
  lastSaleId: string | null;
  // Identifica al ticket, no al clic: mientras la venta no se registre, cada
  // reintento reenvia esta misma clave y el servicio deduplica.
  idempotencyKey: string;
};

type Toast = {
  id: number;
  message: string;
  variant: "success" | "error";
};

let _toastId = 0;

function makeTicket(number: number): Ticket {
  return {
    id: number,
    number,
    cart: [],
    lastSaleId: null,
    idempotencyKey: newIdempotencyKey(),
  };
}

export default function SellPage() {
  const t = useTranslations("sell");
  const actionErrorMessage = useActionErrorMessage();
  const [tickets, setTickets] = useState<Ticket[]>(() => [makeTicket(1)]);
  const [activeTicketId, setActiveTicketId] = useState(1);
  const nextTicketNumber = useRef(2);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo | null>(null);

  const activeTicket =
    tickets.find((tk) => tk.id === activeTicketId) ?? tickets[0];
  const cart = activeTicket.cart;
  const lastSaleId = activeTicket.lastSaleId;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [scanPending, startScan] = useTransition();
  const [confirmPending, startConfirm] = useTransition();
  const [searchPending, setSearchPending] = useState(false);
  const [, startInvoiceInfoLoad] = useTransition();

  const isPending = scanPending || confirmPending;

  // The whole catalog used to be downloaded to be filtered in memory, so only
  // its first page was findable. `listInventory` now forwards the term to the
  // service's `name` filter, which matches partially and case-insensitively.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const term = searchQuery.trim();
      if (term.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        setSearchPending(false);
        return;
      }

      const result = await listInventory(1, SEARCH_RESULT_LIMIT, term);
      if (cancelled) return;
      if ("error" in result) {
        setSearchError(actionErrorMessage(result));
        setSearchResults([]);
      } else {
        setSearchError(null);
        setSearchResults(result.products);
      }
      setSearchPending(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, actionErrorMessage]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchPending(value.trim().length >= 2);
  }, []);

  const updateActiveCart = useCallback(
    (updater: (cart: CartEntry[]) => CartEntry[]) => {
      setTickets((prev) =>
        prev.map((tk) =>
          tk.id === activeTicketId ? { ...tk, cart: updater(tk.cart) } : tk,
        ),
      );
    },
    [activeTicketId],
  );

  const addTicket = useCallback(() => {
    const number = nextTicketNumber.current++;
    const ticket = makeTicket(number);
    setTickets((prev) => [...prev, ticket]);
    setActiveTicketId(ticket.id);
  }, []);

  const closeTicket = useCallback(
    (id: number) => {
      const remaining = tickets.filter((tk) => tk.id !== id);
      if (remaining.length === 0) {
        const number = nextTicketNumber.current++;
        const fresh = makeTicket(number);
        setTickets([fresh]);
        setActiveTicketId(fresh.id);
        return;
      }
      setTickets(remaining);
      if (activeTicketId === id) {
        setActiveTicketId(remaining[0].id);
      }
    },
    [tickets, activeTicketId],
  );

  const addToCart = useCallback(
    (product: Product) => {
      if (product.stock <= 0) {
        const id = ++_toastId;
        setToasts((prev) => [
          ...prev,
          { id, message: t("outOfStock"), variant: "error" },
        ]);
        setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== id)),
          3000,
        );
        return;
      }
      updateActiveCart((prev) => {
        const idx = prev.findIndex((e) => e.productId === product.id);
        if (idx !== -1) {
          return prev.map((e, i) =>
            i === idx ? { ...e, quantity: e.quantity + 1 } : e,
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            unitPrice: product.price,
            quantity: 1,
          },
        ];
      });
      setSearchQuery("");
      setSearchResults([]);
      searchRef.current?.blur();
    },
    [t, updateActiveCart],
  );

  const showToast = useCallback(
    (message: string, variant: "success" | "error") => {
      const id = ++_toastId;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        3000,
      );
    },
    [],
  );

  const handleScan = useCallback(
    (barcode: string) => {
      startScan(async () => {
        const result = await scanBarcode(barcode);
        if ("error" in result) {
          showToast(
            result.code === "not_found"
              ? t("productNotFound")
              : t("scanFailed", { error: actionErrorMessage(result) }),
            "error",
          );
          return;
        }
        if (result.stock <= 0) {
          showToast(t("outOfStock"), "error");
          return;
        }
        updateActiveCart((prev) => {
          const idx = prev.findIndex((e) => e.productId === result.id);
          if (idx !== -1)
            return prev.map((e, i) =>
              i === idx ? { ...e, quantity: e.quantity + 1 } : e,
            );
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
    [showToast, t, updateActiveCart, actionErrorMessage],
  );

  const updateQty = useCallback(
    (productId: string, delta: number) => {
      updateActiveCart((prev) =>
        prev
          .map((e) =>
            e.productId === productId
              ? { ...e, quantity: e.quantity + delta }
              : e,
          )
          .filter((e) => e.quantity > 0),
      );
    },
    [updateActiveCart],
  );

  const removeItem = useCallback(
    (productId: string) => {
      updateActiveCart((prev) => prev.filter((e) => e.productId !== productId));
    },
    [updateActiveCart],
  );

  const handleConfirm = useCallback(() => {
    if (cart.length === 0) return;
    const ticketId = activeTicketId;
    const idempotencyKey = activeTicket.idempotencyKey;
    startConfirm(async () => {
      const items: CartItem[] = cart.map((e) => ({
        productId: e.productId,
        quantity: e.quantity,
        unitPrice: e.unitPrice,
      }));
      const result = await createSale(items, idempotencyKey);
      if ("error" in result) {
        showToast(actionErrorMessage(result) || t("failedToCreate"), "error");
        return;
      }
      // La clave se renueva solo al registrarse la venta: el ticket vacio que
      // queda es ya otra venta. Si el fallo llega antes, la clave sigue viva y
      // el reintento reutiliza la misma.
      setTickets((prev) =>
        prev.map((tk) =>
          tk.id === ticketId
            ? {
                ...tk,
                cart: [],
                lastSaleId: result.id,
                idempotencyKey: newIdempotencyKey(),
              }
            : tk,
        ),
      );
      setShowInvoicePreview(false);
      showToast(t("saleConfirmedToast"), "success");
    });
  }, [
    cart,
    activeTicketId,
    activeTicket.idempotencyKey,
    showToast,
    t,
    actionErrorMessage,
  ]);

  const openInvoicePreview = useCallback(() => {
    setShowInvoicePreview(true);
    if (!invoiceInfo) {
      startInvoiceInfoLoad(async () => {
        const info = await getInvoicePreviewInfo();
        if ("error" in info) {
          showToast(actionErrorMessage(info), "error");
          return;
        }
        setInvoiceInfo(info);
      });
    }
  }, [invoiceInfo, showToast, actionErrorMessage]);

  const subtotal = cart.reduce((s, e) => s + e.unitPrice * e.quantity, 0);
  const itemCount = cart.reduce((s, e) => s + e.quantity, 0);
  const taxRate = invoiceInfo?.taxRate ?? 0;
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  return (
    <div className="flex flex-col h-full">
      {/* Toast stack */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto animate-fade-in-up ${
              toast.variant === "success"
                ? "ui-alert-success"
                : "ui-alert-error"
            }`}
            style={{
              backgroundColor: "var(--surface)",
              boxShadow: "var(--shadow-pop)",
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Ticket tabs */}
      <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-3 -mx-1 px-1">
        {tickets.map((tk) => {
          const active = tk.id === activeTicketId;
          const qty = tk.cart.reduce((s, e) => s + e.quantity, 0);
          return (
            <div
              key={tk.id}
              className={`shrink-0 flex items-center rounded-xl border transition-colors ${
                active
                  ? "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[var(--accent-wash)] text-accent"
                  : "border-line text-muted"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTicketId(tk.id)}
                className="flex items-center gap-2 pl-3.5 pr-2 min-h-[44px] rounded-xl font-mono text-xs"
              >
                <span>{t("ticketLabel", { number: tk.number })}</span>
                {qty > 0 && (
                  <span className="ui-num text-[11px] rounded-md px-1.5 py-0.5 border border-line">
                    {qty}
                  </span>
                )}
              </button>
              {tickets.length > 1 && (
                <button
                  type="button"
                  onClick={() => closeTicket(tk.id)}
                  aria-label={t("closeTicket", { number: tk.number })}
                  className="w-8 h-8 mr-1 rounded-lg flex items-center justify-center shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={addTicket}
          aria-label={t("newTicket")}
          className="shrink-0 w-11 h-11 rounded-xl border border-line flex items-center justify-center text-muted hover:text-accent hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] transition-colors"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>

      {/* Cuerpo: en escritorio, entrada a la izquierda y carrito a la derecha —
          el mostrador ve las dos cosas a la vez. En movil se apilan y el total
          vuelve a ser la barra fija de abajo. */}
      <div
        className="flex-1 min-h-0 w-full overflow-y-auto pb-40 lg:pb-4
                      grid items-start gap-4 lg:gap-6
                      lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]"
      >
        {/* Columna de entrada */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Barcode input */}
          <BarcodeInput onScan={handleScan} disabled={isPending} />

          {/* Product search */}
          <div className="relative w-full min-w-0 shrink-0">
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
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("searchPlaceholder")}
                disabled={isPending}
                className="ui-search-field disabled:opacity-50"
              />

              {/* Spinner or clear button */}
              {searchPending ? (
                <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin shrink-0" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange("");
                    setSearchResults([]);
                    searchRef.current?.focus();
                  }}
                  className="w-6 h-6 rounded-md border border-line flex items-center justify-center text-muted hover:text-accent transition-colors shrink-0"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              ) : null}
            </div>

            {/* Search status */}
            {searchError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {t("searchFailed", { error: searchError })}
              </p>
            )}

            {/* Dropdown results */}
            {searchResults.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-line bg-surface z-20 overflow-hidden animate-fade-in-up"
                style={{ boxShadow: "var(--shadow-pop)" }}
              >
                {searchResults.map((product, i) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-4 min-h-[56px] transition-colors hover:bg-[var(--surface-2)] ${
                      i < searchResults.length - 1 ? "border-b border-line" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-content truncate leading-tight">
                        {product.name}
                      </p>
                      <p className="ui-num text-[11px] text-muted mt-1">
                        {product.sku}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="ui-num text-sm font-medium text-content">
                        ${product.price.toFixed(2)}
                      </span>
                      <span
                        className={
                          product.stock === 0
                            ? "ui-badge-danger"
                            : product.stock <= 10
                              ? "ui-badge-warning"
                              : "ui-badge-success"
                        }
                      >
                        {product.stock}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {searchQuery.trim().length >= 2 &&
              searchResults.length === 0 &&
              !searchPending &&
              !searchError && (
                <div
                  className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-line bg-surface z-20 px-4 py-4 flex items-center justify-center gap-2"
                  style={{ boxShadow: "var(--shadow-pop)" }}
                >
                  <p className="text-sm text-muted">{t("noResults")}</p>
                </div>
              )}
          </div>
        </div>

        {/* Columna del carrito */}
        <div className="flex flex-col gap-3 min-w-0 lg:sticky lg:top-0">
          {/* Cart or empty state */}
          {cart.length === 0 ? (
            <div className="ui-empty">
              {lastSaleId ? (
                <>
                  <div className="w-12 h-12 rounded-full border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] flex items-center justify-center text-accent">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="font-display font-semibold text-accent">
                    {t("saleConfirmed")}
                  </p>
                  <a
                    href={`/api/invoices/${lastSaleId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ui-btn-secondary mt-1"
                  >
                    {t("downloadInvoicePdf")}
                  </a>
                </>
              ) : (
                <>
                  <svg
                    className="w-10 h-10 opacity-40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.25}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p className="font-display font-semibold text-content">
                    {t("cartEmpty")}
                  </p>
                  <p className="text-sm">{t("cartEmptyHint")}</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((entry) => (
                <div
                  key={entry.productId}
                  className="ui-card p-3.5 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-content truncate">
                        {entry.productName}
                      </p>
                      <p className="ui-num text-[11px] text-muted mt-1">
                        ${entry.unitPrice.toFixed(2)} × {entry.quantity}
                      </p>
                    </div>
                    <p className="ui-num text-base font-medium text-accent shrink-0">
                      ${(entry.unitPrice * entry.quantity).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-line">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQty(entry.productId, -1)}
                        aria-label={t("decreaseQty", {
                          name: entry.productName,
                        })}
                        className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg border border-line flex items-center justify-center text-base text-content hover:text-accent hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] active:scale-95 transition-all"
                      >
                        −
                      </button>
                      <span className="ui-num w-8 text-center text-sm font-medium select-none">
                        {entry.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(entry.productId, 1)}
                        aria-label={t("increaseQty", {
                          name: entry.productName,
                        })}
                        className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg border border-line flex items-center justify-center text-base text-content hover:text-accent hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] active:scale-95 transition-all"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(entry.productId)}
                      aria-label={t("removeItem", { name: entry.productName })}
                      className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-muted hover:text-red-500 transition-colors shrink-0"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totales: barra flotante en movil, tarjeta al pie de la columna en lg */}
          {cart.length > 0 && (
            <div
              className="fixed bottom-[4.5rem] left-3 right-3 z-40 max-w-md mx-auto
                        lg:static lg:max-w-none lg:mx-0"
            >
              <div
                className="ui-card flex flex-col gap-3"
                style={{ boxShadow: "var(--shadow-pop)" }}
              >
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    {t("items", { count: itemCount })}
                  </span>
                  <span className="ui-num text-xl font-medium text-content">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openInvoicePreview}
                  disabled={isPending}
                  className="ui-btn-primary-block gap-2"
                >
                  {t("viewInvoice")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice preview modal */}
      {showInvoicePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !confirmPending && setShowInvoicePreview(false)}
        >
          <div
            className="w-[92vw] sm:w-[60vw] max-h-[90vh] overflow-y-auto rounded-3xl border border-line bg-surface p-6 flex flex-col gap-6 animate-fade-in-up"
            style={{ boxShadow: "var(--shadow-pop)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <span className="ui-eyebrow">{t("invoicePreviewTitle")}</span>
              <h2 className="font-display text-xl font-bold text-content mt-2">
                {invoiceInfo?.storeName ?? "…"}
              </h2>
              <p className="text-sm text-muted mt-1">
                {t("invoicePreviewSubtitle")}
              </p>
            </div>

            <div className="ui-num text-[11px] text-muted flex flex-col gap-0.5">
              <span>{new Date().toLocaleString()}</span>
              {invoiceInfo && <span>{invoiceInfo.staffName}</span>}
            </div>

            <div className="border border-line rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-wider text-muted border-b border-line">
                    <th className="text-left px-3 py-2.5 font-normal">
                      {t("product")}
                    </th>
                    <th className="text-right px-3 py-2.5 font-normal">
                      {t("quantity")}
                    </th>
                    <th className="text-right px-3 py-2.5 font-normal">
                      {t("unitPrice")}
                    </th>
                    <th className="text-right px-3 py-2.5 font-normal">
                      {t("total")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((entry) => (
                    <tr key={entry.productId} className="border-t border-line">
                      <td className="px-3 py-2.5 text-content">
                        {entry.productName}
                      </td>
                      <td className="ui-num px-3 py-2.5 text-right text-muted">
                        {entry.quantity}
                      </td>
                      <td className="ui-num px-3 py-2.5 text-right text-muted">
                        ${entry.unitPrice.toFixed(2)}
                      </td>
                      <td className="ui-num px-3 py-2.5 text-right text-content">
                        ${(entry.unitPrice * entry.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 items-end text-sm">
              <div className="flex justify-between w-52">
                <span className="text-muted">{t("subtotal")}</span>
                <span className="ui-num">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-52">
                <span className="text-muted">
                  {t("tax", { rate: (taxRate * 100).toFixed(0) })}
                </span>
                <span className="ui-num">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-52 pt-2 border-t border-line">
                <span className="font-display font-semibold">{t("total")}</span>
                <span className="ui-num text-base font-medium text-accent">
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowInvoicePreview(false)}
                disabled={confirmPending}
                className="ui-btn-secondary flex-1"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirmPending}
                className="ui-btn-primary flex-1 gap-2"
              >
                {confirmPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    {t("generatingInvoice")}
                  </>
                ) : (
                  t("generateInvoice")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
