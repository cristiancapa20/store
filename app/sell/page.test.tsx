// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";

vi.mock("@/lib/actions", () => ({
  scanBarcode: vi.fn(),
  createSale: vi.fn(),
  listInventory: vi.fn(),
  getInvoicePreviewInfo: vi.fn(),
}));

// El lector de codigos monta @zxing/browser contra la camara; aqui solo estorba.
vi.mock("@/components/BarcodeInput", () => ({
  default: () => null,
}));

import { createSale, getInvoicePreviewInfo, listInventory } from "@/lib/actions";
import es from "@/messages/es.json";
import SellPage from "./page";

const mockCreateSale = vi.mocked(createSale);
const mockListInventory = vi.mocked(listInventory);
const mockGetInvoicePreviewInfo = vi.mocked(getInvoicePreviewInfo);

const product = { id: "p1", name: "Agua", sku: "111", price: 350, stock: 10 };

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <SellPage />
    </NextIntlClientProvider>
  );
}

function keysSentToCreateSale(): string[] {
  return mockCreateSale.mock.calls.map((call) => call[1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListInventory.mockResolvedValue({
    products: [product],
    total: 1,
    page: 1,
    limit: 8,
  });
  mockGetInvoicePreviewInfo.mockResolvedValue({
    storeName: "Tiendita",
    taxRate: 0.1,
    staffName: "Ana",
  });
});

afterEach(() => {
  cleanup();
});

async function addProductToCart(user: ReturnType<typeof userEvent.setup>) {
  const search = await screen.findByPlaceholderText<HTMLInputElement>(
    es.sell.searchPlaceholder
  );
  await waitFor(() => expect(search.disabled).toBe(false));
  await user.type(search, "Agua");
  await user.click(await screen.findByText(product.name));
}

async function confirmSale(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: es.sell.viewInvoice }));
  await user.click(
    await screen.findByRole("button", { name: es.sell.generateInvoice })
  );
}

describe("SellPage product search", () => {
  it("sends the typed term to the service instead of downloading the catalog", async () => {
    const user = userEvent.setup();

    renderPage();
    const search = await screen.findByPlaceholderText(es.sell.searchPlaceholder);
    await user.type(search, "Agu");

    await waitFor(() =>
      expect(mockListInventory).toHaveBeenCalledWith(1, 8, "Agu")
    );
    // El catalogo completo ya no se descarga: no hay una peticion de una pagina
    // entera para filtrarla en memoria.
    expect(mockListInventory).not.toHaveBeenCalledWith(1, 100);
    expect(mockListInventory).not.toHaveBeenCalledWith(1, 100, undefined);
  });

  it("shows what the service returned, without re-filtering it locally", async () => {
    const user = userEvent.setup();
    // Ni el nombre ni el SKU contienen el termino escrito: si la pantalla
    // siguiera filtrando en memoria, esta fila desapareceria.
    mockListInventory.mockResolvedValue({
      products: [{ ...product, name: "Botella de agua" }],
      total: 1,
      page: 1,
      limit: 8,
    });

    renderPage();
    const search = await screen.findByPlaceholderText(es.sell.searchPlaceholder);
    await user.type(search, "zzz");

    expect(await screen.findByText("Botella de agua")).toBeTruthy();
  });

  it("does not query the service for a single character", async () => {
    const user = userEvent.setup();

    renderPage();
    const search = await screen.findByPlaceholderText(es.sell.searchPlaceholder);
    await user.type(search, "a");

    await waitFor(() => expect(screen.queryByText(product.name)).toBeNull());
    expect(mockListInventory).not.toHaveBeenCalled();
  });
});

describe("SellPage idempotency key", () => {
  it("reuses the same key when the same ticket is confirmed twice", async () => {
    const user = userEvent.setup();
    // Primer intento fallido: el ticket sigue vivo y el cajero reintenta.
    mockCreateSale.mockResolvedValue({ error: "Network error" });

    renderPage();
    await addProductToCart(user);

    await confirmSale(user);
    await waitFor(() => expect(mockCreateSale).toHaveBeenCalledTimes(1));

    await user.click(
      await screen.findByRole("button", { name: es.sell.generateInvoice })
    );
    await waitFor(() => expect(mockCreateSale).toHaveBeenCalledTimes(2));

    const [first, second] = keysSentToCreateSale();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("rotates the key once the sale is registered", async () => {
    const user = userEvent.setup();
    mockCreateSale.mockResolvedValue({ error: "Network error" });

    renderPage();
    await addProductToCart(user);

    await confirmSale(user);
    await waitFor(() => expect(mockCreateSale).toHaveBeenCalledTimes(1));

    mockCreateSale.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      staffId: "u1",
      staffName: "Ana",
      items: [],
      subtotal: 350,
      total: 385,
    });
    await user.click(
      await screen.findByRole("button", { name: es.sell.generateInvoice })
    );
    await waitFor(() => expect(mockCreateSale).toHaveBeenCalledTimes(2));
    await screen.findByText(es.sell.saleConfirmed);

    await addProductToCart(user);
    await confirmSale(user);
    await waitFor(() => expect(mockCreateSale).toHaveBeenCalledTimes(3));

    const [retried, registered, next] = keysSentToCreateSale();
    expect(registered).toBe(retried);
    expect(next).not.toBe(registered);
  });

  it("shows the translated message for a 409, not the service string with the UUID", async () => {
    const user = userEvent.setup();
    mockCreateSale.mockResolvedValue({
      error: "Insufficient stock for product 8f1c-2b7e-uuid",
      code: "insufficient_stock",
      status: 409,
    });

    renderPage();
    await addProductToCart(user);
    await confirmSale(user);

    await screen.findByText(es.errors.insufficient_stock);
    expect(screen.queryByText(/8f1c-2b7e-uuid/)).toBeNull();
  });

  it("gives each ticket tab its own key", async () => {
    const user = userEvent.setup();
    mockCreateSale.mockResolvedValue({ error: "Network error" });

    renderPage();
    await addProductToCart(user);
    await confirmSale(user);
    await waitFor(() => expect(mockCreateSale).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: es.sell.cancel }));

    await user.click(screen.getByRole("button", { name: es.sell.newTicket }));
    await addProductToCart(user);
    await confirmSale(user);
    await waitFor(() => expect(mockCreateSale).toHaveBeenCalledTimes(2));

    const [ticketOne, ticketTwo] = keysSentToCreateSale();
    expect(ticketTwo).not.toBe(ticketOne);
  });
});

describe("SellPage invoice download", () => {
  it("asks for the invoice by id with the same GET link the history uses", async () => {
    const user = userEvent.setup();
    mockCreateSale.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      staffId: "u1",
      staffName: "Ana",
      items: [],
      subtotal: 350,
      total: 385,
    });

    renderPage();
    await addProductToCart(user);
    await confirmSale(user);
    await screen.findByText(es.sell.saleConfirmed);

    // Un enlace, no un formulario: la ruta solo exporta GET y el importe lo
    // pone el servicio a partir del id, asi que aqui no viaja nada mas.
    const link = await screen.findByRole<HTMLAnchorElement>("link", {
      name: es.sell.downloadInvoicePdf,
    });
    expect(link.getAttribute("href")).toBe("/api/invoices/sale-1");
  });
});
