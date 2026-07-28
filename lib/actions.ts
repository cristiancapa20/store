"use server";

import { auth } from "@/auth";
import db from "./db";
import { parseDecimal, type ApiDecimal } from "./decimal";
import { apiFetch, getInventoryConfig } from "./inventoryClient";
import { clampInventoryLimit } from "./pagination";
import type {
  ActionResult,
  CartItem,
  InventoryPage,
  NewProduct,
  Product,
  Sale,
  SaleFilters,
} from "./types";

export async function listStaff(): Promise<{ id: string; name: string }[]> {
  try {
    return db
      .prepare("SELECT id, name FROM users ORDER BY name")
      .all() as { id: string; name: string }[];
  } catch {
    return [];
  }
}

// --- Internal API shapes ---
type ApiInventoryItem = {
  productId: string;
  name: string;
  barcode: string | null;
  price: ApiDecimal;
  stock: number;
};

type ApiScanResult = {
  found: boolean;
  product: { id: string; name: string; barcode: string | null };
  price: string | null;
  stock: number | null;
};

type ApiSaleResponse = {
  id: string;
  createdAt: string;
  total: ApiDecimal;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: ApiDecimal;
    lineTotal: ApiDecimal;
  }>;
};

// --- Actions ---

export async function scanBarcode(
  barcode: string
): Promise<ActionResult<Product>> {
  const { locationId } = await getInventoryConfig();
  const result = await apiFetch<ApiScanResult>(
    `/scan?barcode=${encodeURIComponent(barcode)}&location_id=${locationId}`
  );
  if ("error" in result) return result;
  if (!result.found) return { error: "Product not found", code: "not_found" };
  return {
    id: result.product.id,
    name: result.product.name,
    sku: result.product.barcode ?? barcode,
    price: parseDecimal(result.price),
    stock: result.stock ?? 0,
  };
}

export async function getInvoicePreviewInfo(): Promise<{
  storeName: string;
  taxRate: number;
  staffName: string;
}> {
  const session = await auth();
  return {
    storeName: process.env.STORE_NAME ?? "Store",
    taxRate: parseFloat(process.env.TAX_RATE ?? "0"),
    staffName: session?.user?.name ?? "Staff",
  };
}

export async function createSale(
  items: CartItem[]
): Promise<ActionResult<Sale>> {
  const session = await auth();
  const staffId = session?.user?.id ?? "unknown";
  const staffName = session?.user?.name ?? "Staff";
  const { locationId } = await getInventoryConfig();

  const result = await apiFetch<ApiSaleResponse>("/sales", {
    method: "POST",
    body: JSON.stringify({
      location_id: locationId,
      actor_ref: staffId,
      items: items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
    }),
  });

  if ("error" in result) return result;

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const total = parseDecimal(result.total);

  return {
    id: result.id,
    createdAt: result.createdAt ?? new Date().toISOString(),
    staffId,
    staffName,
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.unitPrice * i.quantity,
    })),
    subtotal,
    total,
  };
}

export async function listInventory(
  page = 1,
  limit = 50
): Promise<ActionResult<InventoryPage>> {
  type ApiResponse = {
    data: ApiInventoryItem[];
    total: number;
    page: number;
    limit: number;
  };

  const { locationId } = await getInventoryConfig();
  const result = await apiFetch<ApiResponse>(
    `/locations/${locationId}/inventory?page=${page}&limit=${clampInventoryLimit(limit)}`
  );
  if ("error" in result) return result;

  return {
    products: result.data.map((item) => ({
      id: item.productId,
      name: item.name,
      sku: item.barcode ?? item.productId.slice(0, 8),
      price: parseDecimal(item.price),
      stock: item.stock,
    })),
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
}

export async function addProduct(
  data: NewProduct
): Promise<ActionResult<Product>> {
  type ApiProduct = { id: string; name: string; barcode: string | null };

  const session = await auth();
  const plan = session?.user?.organizationPlan ?? "basic";
  const { locationId } = await getInventoryConfig();

  // Enforce plan limit: basic allows up to 500 products
  if (plan === "basic") {
    type CountResponse = { total: number };
    const countResult = await apiFetch<CountResponse>(
      `/locations/${locationId}/inventory?page=1&limit=1`
    );
    if (!("error" in countResult) && countResult.total >= 500) {
      return {
        error:
          "Límite del plan alcanzado (500 productos). Mejora a Pro para continuar.",
      };
    }
  }

  // 1. Create product in catalog
  const productResult = await apiFetch<ApiProduct>("/products", {
    method: "POST",
    body: JSON.stringify({ name: data.name, barcode: data.sku }),
  });
  if ("error" in productResult) return productResult;

  // 2. Register in location (sets price)
  const invResult = await apiFetch<Record<string, unknown>>(
    `/locations/${locationId}/inventory`,
    {
      method: "POST",
      body: JSON.stringify({
        productId: productResult.id,
        quantity: 0,
        price: data.price,
      }),
    }
  );
  if ("error" in invResult) return invResult as ActionResult<Product>;

  // 3. Set initial stock via adjustment
  if (data.initialStock > 0) {
    const adjResult = await apiFetch<Record<string, unknown>>(
      "/inventory-adjustments",
      {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          product_id: productResult.id,
          delta: data.initialStock,
          reason: "initial",
        }),
      }
    );
    if ("error" in adjResult) return adjResult as ActionResult<Product>;
  }

  return {
    id: productResult.id,
    name: productResult.name,
    sku: data.sku,
    price: data.price,
    stock: data.initialStock,
  };
}

export async function adjustStock(
  productId: string,
  delta: number,
  reason = "manual"
): Promise<ActionResult<{ stock: number }>> {
  const { locationId } = await getInventoryConfig();
  const result = await apiFetch<{ newStock: number }>(
    "/inventory-adjustments",
    {
      method: "POST",
      body: JSON.stringify({
        location_id: locationId,
        product_id: productId,
        delta,
        reason,
      }),
    }
  );
  if ("error" in result) return result;
  return { stock: result.newStock };
}

export async function listSales(
  filters: SaleFilters = {}
): Promise<ActionResult<{ sales: Sale[]; total: number }>> {
  type ApiSale = {
    id: string;
    locationId: string;
    staffId: string | null;
    createdAt: string;
    total: ApiDecimal;
    items: Array<{
      productId: string | null;
      productName: string | null;
      quantity: number;
      unitPrice: ApiDecimal;
      lineTotal: ApiDecimal;
    }>;
  };
  type ApiResponse = {
    data: ApiSale[];
    total: number;
    page: number;
    limit: number;
  };

  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", `${filters.endDate}T23:59:59Z`);
  if (filters.page != null) params.set("page", String(filters.page));
  if (filters.limit != null) params.set("limit", String(filters.limit));

  const result = await apiFetch<ApiResponse>(`/sales?${params.toString()}`);
  if ("error" in result) return result;

  const staffMap = new Map(
    (
      db
        .prepare("SELECT id, name FROM users")
        .all() as { id: string; name: string }[]
    ).map((u) => [u.id, u.name])
  );

  let sales: Sale[] = result.data.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    staffId: s.staffId ?? "",
    staffName: staffMap.get(s.staffId ?? "") ?? s.staffId ?? "Unknown",
    items: s.items.map((i) => ({
      productId: i.productId ?? "",
      productName: i.productName ?? "",
      quantity: i.quantity,
      unitPrice: parseDecimal(i.unitPrice),
      lineTotal: parseDecimal(i.lineTotal),
    })),
    subtotal: s.items.reduce((sum, i) => sum + parseDecimal(i.lineTotal), 0),
    total: parseDecimal(s.total),
  }));

  if (filters.staffId) {
    sales = sales.filter((s) => s.staffId === filters.staffId);
  }

  return { sales, total: result.total };
}
