import { describe, it, expect, vi, beforeEach } from "vitest";

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
  listStaff,
} from "./actions";

const mockAuth = vi.mocked(auth);
const mockApiFetch = vi.mocked(apiFetch);
const mockGetInventoryConfig = vi.mocked(getInventoryConfig);
const mockPrepare = vi.mocked(db.prepare);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInventoryConfig.mockResolvedValue({
    apiKey: "test-key",
    locationId: "loc-1",
    apiBase: "http://api.test",
  });
});

describe("listStaff", () => {
  it("returns staff ordered by name", async () => {
    const all = vi.fn().mockReturnValue([{ id: "u1", name: "Ana" }]);
    mockPrepare.mockReturnValue({ all } as never);

    const result = await listStaff();

    expect(result).toEqual([{ id: "u1", name: "Ana" }]);
    expect(mockPrepare).toHaveBeenCalledWith(
      "SELECT id, name FROM users ORDER BY name"
    );
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

  it("returns 'Product not found' when the API reports found:false", async () => {
    mockApiFetch.mockResolvedValue({
      found: false,
      product: { id: "", name: "", barcode: null },
      price: null,
      stock: null,
    });

    const result = await scanBarcode("123");

    expect(result).toEqual({ error: "Product not found" });
  });

  it("maps a found product, falling back to the scanned barcode as sku", async () => {
    mockApiFetch.mockResolvedValue({
      found: true,
      product: { id: "p1", name: "Coca-Cola", barcode: null },
      price: 1.5,
      stock: 10,
    });

    const result = await scanBarcode("7501234567890");

    expect(result).toEqual({
      id: "p1",
      name: "Coca-Cola",
      sku: "7501234567890",
      price: 1.5,
      stock: 10,
    });
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

    await createSale(items);

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

  it("falls back to 'unknown'/'Staff' when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      total: 13,
      items: [],
    });

    const result = await createSale(items);

    expect(result).toMatchObject({ staffId: "unknown", staffName: "Staff" });
  });

  it("propagates an API error", async () => {
    mockAuth.mockResolvedValue(null as never);
    mockApiFetch.mockResolvedValue({ error: "Insufficient stock" });

    const result = await createSale(items);

    expect(result).toEqual({ error: "Insufficient stock" });
  });

  it("computes subtotal from the cart and parses a string total", async () => {
    mockAuth.mockResolvedValue(null as never);
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "2026-01-01T00:00:00Z",
      total: "13.00",
      items: [],
    });

    const result = await createSale(items);

    expect(result).toMatchObject({ subtotal: 13, total: 13 });
  });

  it("defaults createdAt only when the API omits the field (nullish, not falsy)", async () => {
    // NOTE: the implementation uses `result.createdAt ?? new Date().toISOString()`,
    // which only falls back on null/undefined. An empty string passes through as-is —
    // documenting current behavior here rather than the likely intent.
    mockAuth.mockResolvedValue(null as never);
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: "",
      total: 13,
      items: [],
    });

    const result = await createSale(items);

    if ("error" in result) throw new Error("expected success");
    expect(result.createdAt).toBe("");
  });

  it("defaults createdAt when the API omits the field entirely", async () => {
    mockAuth.mockResolvedValue(null as never);
    mockApiFetch.mockResolvedValue({
      id: "sale-1",
      createdAt: undefined as unknown as string,
      total: 13,
      items: [],
    });

    const result = await createSale(items);

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
      user: { organizationPlan: "basic" },
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
      user: { organizationPlan: "basic" },
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
    mockAuth.mockResolvedValue({ user: { organizationPlan: "pro" } } as never);
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
    mockAuth.mockResolvedValue({ user: { organizationPlan: "pro" } } as never);
    mockApiFetch
      .mockResolvedValueOnce({ id: "p1", name: "Leche", barcode: "222" })
      .mockResolvedValueOnce({});

    const result = await addProduct({ ...newProduct, initialStock: 0 });

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ stock: 0 });
  });

  it("propagates an error from product creation", async () => {
    mockAuth.mockResolvedValue({ user: { organizationPlan: "pro" } } as never);
    mockApiFetch.mockResolvedValueOnce({ error: "Duplicate barcode" });

    const result = await addProduct(newProduct);

    expect(result).toEqual({ error: "Duplicate barcode" });
  });

  it("propagates an error from the stock adjustment step", async () => {
    mockAuth.mockResolvedValue({ user: { organizationPlan: "pro" } } as never);
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

describe("listSales", () => {
  beforeEach(() => {
    const all = vi.fn().mockReturnValue([{ id: "u1", name: "Ana" }]);
    mockPrepare.mockReturnValue({ all } as never);
  });

  it("builds query params and appends end-of-day time to endDate", async () => {
    mockApiFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });

    await listSales({ startDate: "2026-01-01", endDate: "2026-01-31", page: 1, limit: 50 });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/sales?startDate=2026-01-01&endDate=2026-01-31T23%3A59%3A59Z&page=1&limit=50"
    );
  });

  it("propagates an API error", async () => {
    mockApiFetch.mockResolvedValue({ error: "Network error" });

    const result = await listSales();

    expect(result).toEqual({ error: "Network error" });
  });

  it("joins staffId with local users, falling back to the id then 'Unknown'", async () => {
    mockApiFetch.mockResolvedValue({
      data: [
        { id: "s1", locationId: "loc-1", staffId: "u1", createdAt: "t", total: 5, items: [] },
        { id: "s2", locationId: "loc-1", staffId: "ghost", createdAt: "t", total: 5, items: [] },
        { id: "s3", locationId: "loc-1", staffId: null, createdAt: "t", total: 5, items: [] },
      ],
      total: 3,
      page: 1,
      limit: 50,
    });

    const result = await listSales();
    if ("error" in result) throw new Error("expected success");

    expect(result.sales.map((s) => s.staffName)).toEqual(["Ana", "ghost", "Unknown"]);
  });

  it("computes subtotal from line items and filters by staffId client-side", async () => {
    mockApiFetch.mockResolvedValue({
      data: [
        {
          id: "s1",
          locationId: "loc-1",
          staffId: "u1",
          createdAt: "t",
          total: 20,
          items: [
            { productId: "p1", productName: "Agua", quantity: 2, unitPrice: 5, lineTotal: 10 },
            { productId: "p2", productName: "Pan", quantity: 2, unitPrice: 5, lineTotal: 10 },
          ],
        },
        {
          id: "s2",
          locationId: "loc-1",
          staffId: "other",
          createdAt: "t",
          total: 5,
          items: [],
        },
      ],
      total: 2,
      page: 1,
      limit: 50,
    });

    const result = await listSales({ staffId: "u1" });
    if ("error" in result) throw new Error("expected success");

    expect(result.sales).toHaveLength(1);
    expect(result.sales[0].subtotal).toBe(20);
  });
});
