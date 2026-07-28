import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sale } from "./types";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("./db", () => ({
  default: { prepare: vi.fn() },
}));
vi.mock("./inventoryClient", () => ({
  apiFetch: vi.fn(),
  getInventoryConfig: vi.fn(),
}));

import { auth } from "@/auth";
import db from "./db";
import { apiFetch, getInventoryConfig } from "./inventoryClient";
import {
  scanBarcode,
  createSale,
  listInventory,
  addProduct,
  adjustStock,
  listSales,
  getSalesSummary,
  listStaff,
  getInvoicePreviewInfo,
  getSale,
} from "./actions";

const mockAuth = vi.mocked(auth);
const mockApiFetch = vi.mocked(apiFetch);
const mockGetInventoryConfig = vi.mocked(getInventoryConfig);
const mockPrepare = vi.mocked(db.prepare);

const adminSession = {
  user: { id: "admin-1", name: "Ana", role: "admin", organizationId: "org-1" },
};
const staffSession = {
  user: { id: "staff-1", name: "Bob", role: "staff", organizationId: "org-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(adminSession as never);
  mockGetInventoryConfig.mockResolvedValue({
    apiKey: "test-key",
    locationId: "loc-1",
    apiBase: "http://api.test",
  });
});

describe("listStaff", () => {
  it("returns only the session organization's staff, ordered by name", async () => {
    const all = vi.fn().mockReturnValue([{ id: "u1", name: "Ana" }]);
    mockPrepare.mockReturnValue({ all } as never);

    const result = await listStaff();

    expect(result).toEqual([{ id: "u1", name: "Ana" }]);
    expect(mockPrepare).toHaveBeenCalledWith(
      "SELECT id, name FROM users WHERE organization_id = ? ORDER BY name"
    );
    expect(all).toHaveBeenCalledWith("org-1");
  });

  it("returns an empty array when the session has no organization", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "super-1", name: "Root", role: "admin" },
    } as never);

    const result = await listStaff();

    expect(result).toEqual([]);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it("returns an empty array when the query throws", async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error("db locked");
    });

    const result = await listStaff();

    expect(result).toEqual([]);
  });
});

describe("scanBarcode", () => {
  it("propagates an API error", async () => {
    mockApiFetch.mockResolvedValue({ error: "Network error" });

    const result = await scanBarcode("123");

    expect(result).toEqual({ error: "Network error" });
  });

  it("tags a found:false response with the not_found code", async () => {
    mockApiFetch.mockResolvedValue({
      found: false,
      product: { id: "", name: "", barcode: null },
      price: null,
      stock: null,
    });

    const result = await scanBarcode("123");

    expect(result).toEqual({ error: "Product not found", code: "not_found" });
  });

  it("leaves an API failure uncoded so the UI does not call it 'not found'", async () => {
    mockApiFetch.mockResolvedValue({ error: "HTTP 422" });

    const result = await scanBarcode("123");

    expect(result).toEqual({ error: "HTTP 422" });
    expect(result).not.toHaveProperty("code");
  });

  it("maps a found product, falling back to the scanned barcode as sku", async () => {
    mockApiFetch.mockResolvedValue({
      found: true,
      product: { id: "p1", name: "Coca-Cola", barcode: null },
      price: "350.00",
      stock: 10,
    });

    const result = await scanBarcode("7501234567890");

    expect(result).toEqual({
      id: "p1",
      name: "Coca-Cola",
      sku: "7501234567890",
      price: 350,
      stock: 10,
    });
  });

  it("returns a price the cart can do arithmetic on, not the raw decimal string", async () => {
    mockApiFetch.mockResolvedValue({
      found: true,
      product: { id: "p1", name: "Coca-Cola", barcode: null },
      price: "350.00",
      stock: 10,
    });

    const result = await scanBarcode("7501234567890");

    if ("error" in result) throw new Error("expected success");
    expect(typeof result.price).toBe("number");
    expect(result.price.toFixed(2)).toBe("350.00");
    expect(result.price * 2).toBe(700);
  });

  it("defaults null price/stock to 0", async () => {
    mockApiFetch.mockResolvedValue({
      found: true,
      product: { id: "p1", name: "Coca-Cola", barcode: "789" },
      price: null,
      stock: null,
    });

    const result = await scanBarcode("789");

    expect(result).toMatchObject({ price: 0, stock: 0, sku: "789" });
  });

  it("scopes the scan to the resolved location", async () => {
    mockApiFetch.mockResolvedValue({
      found: false,
      product: { id: "", name: "", barcode: null },
      price: null,
      stock: null,
    });

    await scanBarcode("abc 123");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/scan?barcode=abc%20123&location_id=loc-1"
    );
  });
});

describe("createSale", () => {
  const items = [
    { productId: "p1", quantity: 2, unitPrice: 5 },
    { productId: "p2", quantity: 1, unitPrice: 3 },
  ];

  it("sends staff identity and mapped items to the API", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "staff-1", name: "Bob" },
    } as never);
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      total: 13,
      items: [],
    });

    await createSale(items, "ticket-key-1");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/sales",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          location_id: "loc-1",
          actor_ref: "staff-1",
          items: [
            { product_id: "p1", quantity: 2 },
            { product_id: "p2", quantity: 1 },
          ],
        }),
      })
    );
  });

  it("forwards the ticket key as the Idempotency-Key header", async () => {
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      total: 13,
      items: [],
    });

    await createSale(items, "ticket-key-1");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/sales",
      expect.objectContaining({
        headers: { "Idempotency-Key": "ticket-key-1" },
      })
    );
  });

  it("omits the header rather than sending a blank key", async () => {
    // El servicio guardaria "" tal cual y el unico (location_id,
    // idempotency_key) haria chocar entre si a todas las ventas sin clave.
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      total: 13,
      items: [],
    });

    await createSale(items, "   ");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/sales",
      expect.objectContaining({ headers: undefined })
    );
  });

  it("refuses to register a sale when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      total: 13,
      items: [],
    });

    const result = await createSale(items, "ticket-key-1");

    expect(result).toMatchObject({ code: "unauthorized" });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("propagates an API error", async () => {
    mockApiFetch.mockResolvedValue({ error: "Insufficient stock" });

    const result = await createSale(items, "ticket-key-1");

    expect(result).toEqual({ error: "Insufficient stock" });
  });

  it("codes any 409 from /sales as insufficient stock, whatever the wording", async () => {
    // POST /sales solo devuelve 409 por stock, y su mensaje lleva el UUID del
    // producto: lo que llega a la UI tiene que ser el codigo, no esa cadena.
    mockApiFetch.mockResolvedValue({
      error: "Something new the service says",
      status: 409,
    });

    const result = await createSale(items, "ticket-key-1");

    expect(result).toMatchObject({ code: "insufficient_stock", status: 409 });
  });

  it("leaves other transport failures untouched", async () => {
    mockApiFetch.mockResolvedValue({ error: "timed out", code: "timeout" });

    const result = await createSale(items, "ticket-key-1");

    expect(result).toEqual({ error: "timed out", code: "timeout" });
  });

  it("computes subtotal from the cart and parses a string total", async () => {
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      total: "13.00",
      items: [],
    });

    const result = await createSale(items, "ticket-key-1");

    expect(result).toMatchObject({ subtotal: 13, total: 13 });
  });

  it("defaults createdAt only when the API omits the field (nullish, not falsy)", async () => {
    // NOTE: the implementation uses `result.createdAt ?? new Date().toISOString()`,
    // which only falls back on null/undefined. An empty string passes through as-is —
    // documenting current behavior here rather than the likely intent.
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "",
      total: 13,
      items: [],
    });

    const result = await createSale(items, "ticket-key-1");

    if ("error" in result) throw new Error("expected success");
    expect(result.createdAt).toBe("");
  });

  it("defaults createdAt when the API omits the field entirely", async () => {
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: undefined as unknown as string,
      total: 13,
      items: [],
    });

    const result = await createSale(items, "ticket-key-1");

    if ("error" in result) throw new Error("expected success");
    expect(result.createdAt).not.toBe("");
    expect(() => new Date(result.createdAt).toISOString()).not.toThrow();
  });
});

describe("listInventory", () => {
  it("maps API items, parsing price and falling back sku to the id prefix", async () => {
    mockApiFetch.mockResolvedValue({
      data: [
        { productId: "abcdefgh12345", name: "Agua", barcode: null, price: "0.50", stock: 3 },
        { productId: "p2", name: "Pan", barcode: "111", price: "1.25", stock: 7 },
      ],
      total: 2,
      page: 1,
      limit: 50,
    });

    const result = await listInventory();

    expect(result).toEqual({
      products: [
        { id: "abcdefgh12345", name: "Agua", sku: "abcdefgh", price: 0.5, stock: 3 },
        { id: "p2", name: "Pan", sku: "111", price: 1.25, stock: 7 },
      ],
      total: 2,
      page: 1,
      limit: 50,
    });
  });

  it("requests the given page and limit for the resolved location", async () => {
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });

    await listInventory(2, 10);

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/locations/loc-1/inventory?page=2&limit=10"
    );
  });

  it("clamps a limit above the service maximum instead of triggering a 422", async () => {
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });

    await listInventory(1, 500);

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/locations/loc-1/inventory?page=1&limit=100"
    );
  });

  it("delegates the search term to the service's name filter", async () => {
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 8 });

    await listInventory(1, 8, "  agu  ");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/locations/loc-1/inventory?page=1&limit=8&name=agu"
    );
  });

  it("omits the name filter for a blank search term", async () => {
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 8 });

    await listInventory(1, 8, "   ");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/locations/loc-1/inventory?page=1&limit=8"
    );
  });

  it("propagates an API error", async () => {
    mockApiFetch.mockResolvedValue({ error: "Network error" });

    const result = await listInventory();

    expect(result).toEqual({ error: "Network error" });
  });
});

describe("addProduct", () => {
  const newProduct = { name: "Leche", sku: "222", price: 2.5, initialStock: 5 };

  it("blocks new products on the basic plan once the 500 limit is reached", async () => {
    mockAuth.mockResolvedValue({
      user: { ...adminSession.user, organizationPlan: "basic" },
    } as never);
    mockApiFetch.mockResolvedValueOnce({ total: 500 });

    const result = await addProduct(newProduct);

    expect(result).toEqual({
      error:
        "Límite del plan alcanzado (500 productos). Mejora a Pro para continuar.",
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it("allows creation on the basic plan when under the limit", async () => {
    mockAuth.mockResolvedValue({
      user: { ...adminSession.user, organizationPlan: "basic" },
    } as never);
    mockApiFetch
      .mockResolvedValueOnce({ total: 10 }) // count check
      .mockResolvedValueOnce({ id: "p1", name: "Leche", barcode: "222" }) // product create
      .mockResolvedValueOnce({}) // inventory register
      .mockResolvedValueOnce({}); // stock adjustment

    const result = await addProduct(newProduct);

    expect(result).toEqual({
      id: "p1",
      name: "Leche",
      sku: "222",
      price: 2.5,
      stock: 5,
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(4);
  });

  it("skips the plan-limit check entirely on the pro plan", async () => {
    mockAuth.mockResolvedValue({
      user: { ...adminSession.user, organizationPlan: "pro" },
    } as never);
    mockApiFetch
      .mockResolvedValueOnce({ id: "p1", name: "Leche", barcode: "222" })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await addProduct(newProduct);

    expect(mockApiFetch).toHaveBeenCalledTimes(3);
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("limit=1")
    );
  });

  it("skips the stock adjustment call when initialStock is 0", async () => {
    mockAuth.mockResolvedValue({
      user: { ...adminSession.user, organizationPlan: "pro" },
    } as never);
    mockApiFetch
      .mockResolvedValueOnce({ id: "p1", name: "Leche", barcode: "222" })
      .mockResolvedValueOnce({});

    const result = await addProduct({ ...newProduct, initialStock: 0 });

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ stock: 0 });
  });

  it("propagates an error from product creation", async () => {
    mockAuth.mockResolvedValue({
      user: { ...adminSession.user, organizationPlan: "pro" },
    } as never);
    mockApiFetch.mockResolvedValueOnce({ error: "Duplicate barcode" });

    const result = await addProduct(newProduct);

    expect(result).toEqual({ error: "Duplicate barcode" });
  });

  it("propagates an error from the stock adjustment step", async () => {
    mockAuth.mockResolvedValue({
      user: { ...adminSession.user, organizationPlan: "pro" },
    } as never);
    mockApiFetch
      .mockResolvedValueOnce({ id: "p1", name: "Leche", barcode: "222" })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ error: "Adjustment failed" });

    const result = await addProduct(newProduct);

    expect(result).toEqual({ error: "Adjustment failed" });
  });
});

describe("adjustStock", () => {
  it("sends the delta and reason for the resolved location", async () => {
    // The Inventory Service responds with `newStock`, not `stock`.
    mockApiFetch.mockResolvedValue({ newStock: 12 });

    const result = await adjustStock("p1", -3, "damaged");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/inventory-adjustments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          location_id: "loc-1",
          product_id: "p1",
          delta: -3,
          reason: "damaged",
        }),
      })
    );
    expect(result).toEqual({ stock: 12 });
  });

  it("defaults reason to 'manual'", async () => {
    mockApiFetch.mockResolvedValue({ newStock: 12 });

    await adjustStock("p1", 1);

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/inventory-adjustments",
      expect.objectContaining({
        body: JSON.stringify({
          location_id: "loc-1",
          product_id: "p1",
          delta: 1,
          reason: "manual",
        }),
      })
    );
  });

  it("propagates an API error", async () => {
    mockApiFetch.mockResolvedValue({ error: "Product not found" });

    const result = await adjustStock("p1", 1);

    expect(result).toEqual({ error: "Product not found" });
  });
});

function apiSale(id: string, staffId: string | null, total = "10.00") {
  return {
    id,
    locationId: "loc-1",
    staffId,
    createdAt: "2026-07-28T12:00:00Z",
    total,
    items: [],
  };
}

describe("listSales", () => {
  beforeEach(() => {
    const all = vi.fn().mockReturnValue([{ id: "u1", name: "Ana" }]);
    mockPrepare.mockReturnValue({ all } as never);
  });

  it("sends an explicit page and limit and appends end-of-day time to endDate", async () => {
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 3, limit: 10 });

    await listSales({ startDate: "2026-01-01", endDate: "2026-01-31", page: 3, limit: 10 });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/sales?startDate=2026-01-01&endDate=2026-01-31T23%3A59%3A59Z&page=3&limit=10"
    );
  });

  it("never leaves the page size to the service's default of 20", async () => {
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await listSales();

    expect(mockApiFetch).toHaveBeenCalledWith("/sales?page=1&limit=20");
  });

  it("clamps a limit above the service maximum instead of triggering a 422", async () => {
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });

    await listSales({ limit: 500 });

    expect(mockApiFetch).toHaveBeenCalledWith("/sales?page=1&limit=100");
  });

  it("reports the service total, not the number of rows on the page", async () => {
    mockApiFetch.mockResolvedValue({
      data: [apiSale("s1", "u1")],
      total: 137,
      page: 1,
      limit: 10,
    });

    const result = await listSales({ page: 1, limit: 10 });
    if ("error" in result) throw new Error("expected success");

    expect(result.sales).toHaveLength(1);
    expect(result.total).toBe(137);
    expect(result.truncated).toBe(false);
  });

  it("propagates an API error", async () => {
    mockApiFetch.mockResolvedValue({ error: "Network error" });

    const result = await listSales();

    expect(result).toEqual({ error: "Network error" });
  });

  it("joins staffId with the users of the session organization only", async () => {
    const all = vi.fn().mockReturnValue([{ id: "u1", name: "Ana" }]);
    mockPrepare.mockReturnValue({ all } as never);
    mockApiFetch.mockResolvedValue({
      data: [apiSale("s1", "u1"), apiSale("s2", "ghost"), apiSale("s3", null)],
      total: 3,
      page: 1,
      limit: 20,
    });

    const result = await listSales();
    if ("error" in result) throw new Error("expected success");

    expect(result.sales.map((s) => s.staffName)).toEqual(["Ana", "ghost", "Unknown"]);
    expect(mockPrepare).toHaveBeenCalledWith(
      "SELECT id, name FROM users WHERE organization_id = ?"
    );
    expect(all).toHaveBeenCalledWith("org-1");
  });

  // Antes el filtro se aplicaba DESPUES de paginar: la pagina 1 mostraba las
  // ventas del empleado que hubiera entre las 20 primeras del rango y `total`
  // seguia siendo el recuento sin filtrar.
  it("filters by staff before slicing the page, so the page is full and the total is the filtered count", async () => {
    mockApiFetch.mockResolvedValue({
      data: [
        apiSale("s1", "u1", "20.00"),
        apiSale("s2", "other"),
        apiSale("s3", "u1", "30.00"),
        apiSale("s4", "other"),
        apiSale("s5", "u1", "40.00"),
      ],
      total: 5,
      page: 1,
      limit: 100,
    });

    const first = await listSales({ staffId: "u1", page: 1, limit: 2 });
    if ("error" in first) throw new Error("expected success");
    expect(first.sales.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(first.total).toBe(3);

    const second = await listSales({ staffId: "u1", page: 2, limit: 2 });
    if ("error" in second) throw new Error("expected success");
    expect(second.sales.map((s) => s.id)).toEqual(["s5"]);
    expect(second.total).toBe(3);
  });

  it("walks every page of the range when filtering by staff", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      const page = Number(new URL(path, "http://x").searchParams.get("page"));
      return {
        data: [apiSale(`s${page}`, page === 2 ? "u1" : "other")],
        total: 150,
        page,
        limit: 100,
      };
    });

    const result = await listSales({ staffId: "u1" });
    if ("error" in result) throw new Error("expected success");

    expect(mockApiFetch).toHaveBeenCalledWith("/sales?page=1&limit=100");
    expect(mockApiFetch).toHaveBeenCalledWith("/sales?page=2&limit=100");
    expect(result.sales.map((s) => s.id)).toEqual(["s2"]);
    expect(result.truncated).toBe(false);
  });

  it("flags the result as truncated when the range outgrows the scan ceiling", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      const page = Number(new URL(path, "http://x").searchParams.get("page"));
      return { data: [apiSale(`s${page}`, "u1")], total: 5000, page, limit: 100 };
    });

    const result = await listSales({ staffId: "u1" });
    if ("error" in result) throw new Error("expected success");

    expect(mockApiFetch).toHaveBeenCalledTimes(10);
    expect(result.truncated).toBe(true);
  });

  it("converts the decimal strings of total, unitPrice and lineTotal to numbers", async () => {
    mockApiFetch.mockResolvedValue({
      data: [
        {
          id: "s1",
          locationId: "loc-1",
          staffId: "u1",
          createdAt: "t",
          total: "350.50",
          items: [
            {
              productId: "p1",
              productName: "Agua",
              quantity: 1,
              unitPrice: "350.50",
              lineTotal: "350.50",
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });

    const result = await listSales();
    if ("error" in result) throw new Error("expected success");

    const sale = result.sales[0];
    expect(sale.total.toFixed(2)).toBe("350.50");
    expect(sale.items[0].unitPrice).toBe(350.5);
    expect(sale.items[0].lineTotal).toBe(350.5);
    expect(sale.subtotal).toBe(350.5);
  });
});

describe("getSalesSummary", () => {
  beforeEach(() => {
    const all = vi.fn().mockReturnValue([{ id: "u1", name: "Ana" }]);
    mockPrepare.mockReturnValue({ all } as never);
  });

  // El servicio agrega en la base de datos: las metricas dejan de depender de
  // cuantas ventas cupieran en la pagina que la tabla acabara de pedir.
  it("aggregates the whole filtered range and the caller's local day separately", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("from=2026-07-28")) {
        return { totalCount: 4, totalRevenue: "125.00" };
      }
      return { totalCount: 120, totalRevenue: "9000.00" };
    });

    const result = await getSalesSummary(
      { startDate: "2026-07-01", endDate: "2026-07-31" },
      "2026-07-28"
    );
    if ("error" in result) throw new Error("expected success");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/reports/sales?locationId=loc-1&from=2026-07-01&to=2026-07-31T23%3A59%3A59Z"
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/reports/sales?locationId=loc-1&from=2026-07-28&to=2026-07-28T23%3A59%3A59Z"
    );
    expect(result).toEqual({
      count: 120,
      revenue: 9000,
      todayRevenue: 125,
      truncated: false,
    });
  });

  it("leaves today's total at zero when the filtered range excludes today", async () => {
    mockApiFetch.mockResolvedValue({ totalCount: 3, totalRevenue: "60.00" });

    const result = await getSalesSummary(
      { startDate: "2026-01-01", endDate: "2026-01-31" },
      "2026-07-28"
    );
    if ("error" in result) throw new Error("expected success");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(result.todayRevenue).toBe(0);
  });

  it("propagates a report error", async () => {
    mockApiFetch.mockResolvedValue({ error: "Service unavailable" });

    const result = await getSalesSummary({}, "2026-07-28");

    expect(result).toEqual({ error: "Service unavailable" });
  });

  it("aggregates the scanned rows when a staff filter is set", async () => {
    mockApiFetch.mockResolvedValue({
      data: [
        apiSale("s1", "u1", "20.00"),
        apiSale("s2", "other", "500.00"),
        apiSale("s3", "u1", "30.00"),
      ],
      total: 3,
      page: 1,
      limit: 100,
    });

    const result = await getSalesSummary({ staffId: "u1" }, "2026-07-28");

    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/reports/sales")
    );
    expect(result).toEqual({
      count: 2,
      revenue: 50,
      todayRevenue: 50,
      truncated: false,
    });
  });
});

describe("getSale", () => {
  const serviceSale = {
    id: "sale-1",
    locationId: "loc-1",
    status: "completed",
    actorRef: "staff-1",
    createdAt: "2026-07-20T10:00:00.000Z",
    total: "350.00",
    items: [
      { productId: "p1", quantity: 2, unitPrice: "100.00", lineTotal: "200.00" },
      { productId: "p2", quantity: 1, unitPrice: "150.00", lineTotal: "150.00" },
    ],
  };

  beforeEach(() => {
    mockPrepare.mockReturnValue({
      all: vi.fn().mockReturnValue([{ id: "staff-1", name: "Bob" }]),
    } as never);
  });

  it("reads the sale by id and turns every decimal string into a number", async () => {
    mockApiFetch.mockImplementation(async (path: string) =>
      path === "/sales/sale-1" ? serviceSale : { id: path, name: "Café" }
    );

    const result = await getSale("sale-1");

    expect(mockApiFetch).toHaveBeenCalledWith("/sales/sale-1");
    expect(result).toMatchObject({
      id: "sale-1",
      staffId: "staff-1",
      staffName: "Bob",
      subtotal: 350,
      total: 350,
    });
    expect((result as Sale).items[0]).toMatchObject({
      unitPrice: 100,
      lineTotal: 200,
      productName: "Café",
    });
  });

  // El servicio contesta 404 —no 403— para una venta de otra organizacion, asi
  // que el aislamiento llega hasta aqui como `not_found` y se propaga tal cual.
  it("propagates the service 404 for a sale of another organization", async () => {
    mockApiFetch.mockResolvedValue({
      error: "Sale not found",
      code: "not_found",
      status: 404,
    });

    const result = await getSale("sale-1");

    expect(result).toMatchObject({ code: "not_found", status: 404 });
    // Una venta que no es de esta tienda no dispara ninguna busqueda mas.
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the product id when the name lookup fails", async () => {
    mockApiFetch.mockImplementation(async (path: string) =>
      path === "/sales/sale-1"
        ? serviceSale
        : { error: "Product not found", code: "not_found", status: 404 }
    );

    const result = await getSale("sale-1");

    expect((result as Sale).items.map((i) => i.productName)).toEqual([
      "p1",
      "p2",
    ]);
    expect((result as Sale).total).toBe(350);
  });
});

// Server actions are dispatched by Next-Action id over POST to any route, so
// the middleware never gates them: each action has to check the caller itself.
describe("authorization", () => {
  const cart = [{ productId: "p1", quantity: 1, unitPrice: 5 }];

  const callAction = {
    scanBarcode: () => scanBarcode("123"),
    createSale: () => createSale(cart, "ticket-key-1"),
    listInventory: () => listInventory(),
    addProduct: () =>
      addProduct({ name: "Leche", sku: "222", price: 2.5, initialStock: 0 }),
    adjustStock: () => adjustStock("p1", 1),
    listSales: () => listSales(),
    getSalesSummary: () => getSalesSummary(),
    listStaff: () => listStaff(),
    getInvoicePreviewInfo: () => getInvoicePreviewInfo(),
    getSale: () => getSale("sale-1"),
  };

  beforeEach(() => {
    const all = vi.fn().mockReturnValue([]);
    mockPrepare.mockReturnValue({ all } as never);
    mockApiFetch.mockResolvedValue({ ok: true });
  });

  for (const [name, call] of Object.entries(callAction)) {
    it(`rejects ${name} without a session`, async () => {
      mockAuth.mockResolvedValue(null as never);

      const result = await call();

      expect(result).toMatchObject({ code: "unauthorized" });
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(mockPrepare).not.toHaveBeenCalled();
    });
  }

  for (const name of ["addProduct", "adjustStock"] as const) {
    it(`rejects ${name} for a non-admin session`, async () => {
      mockAuth.mockResolvedValue(staffSession as never);

      const result = await callAction[name]();

      expect(result).toMatchObject({ code: "forbidden" });
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  }

  it("lets a staff session sell, scan and read", async () => {
    mockAuth.mockResolvedValue(staffSession as never);
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });

    const result = await listInventory();

    expect(result).not.toHaveProperty("error");
  });

  it("resolves the invoice staff name from the session", async () => {
    const result = await getInvoicePreviewInfo();

    expect(result).toMatchObject({ staffName: "Ana" });
  });
});
