"use server";

import { auth } from "@/auth";
import db from "./db";
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

function apiUrl(path: string): string {
  const base = process.env.INVENTORY_API_URL ?? "";
  return `${base}${path}`;
}

function locationId(): string {
  return process.env.INVENTORY_LOCATION_ID ?? "";
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.INVENTORY_API_KEY ?? ""}` };
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<ActionResult<T>> {
  try {
    const res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      try {
        const json = JSON.parse(text);
        return { error: json.error ?? json.message ?? `HTTP ${res.status}` };
      } catch {
        return { error: `HTTP ${res.status}` };
      }
    }
    return (await res.json()) as T;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

// --- Internal API shapes ---
type ApiInventoryItem = {
  productId: string;
  name: string;
  barcode: string | null;
  price: string;
  stock: number;
};

type ApiScanResult = {
  found: boolean;
  product: { id: string; name: string; barcode: string | null };
  price: number | null;
  stock: number | null;
};

type ApiSaleResponse = {
  id: string;
  createdAt: string;
  total: number | string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

// --- Actions ---

export async function scanBarcode(
  barcode: string
): Promise<ActionResult<Product>> {
  const result = await apiFetch<ApiScanResult>(
    `/scan?barcode=${encodeURIComponent(barcode)}&location_id=${locationId()}`
  );
  if ("error" in result) return result;
  if (!result.found) return { error: "Product not found" };
  return {
    id: result.product.id,
    name: result.product.name,
    sku: result.product.barcode ?? barcode,
    price: result.price ?? 0,
    stock: result.stock ?? 0,
  };
}

export async function createSale(
  items: CartItem[]
): Promise<ActionResult<Sale>> {
  const session = await auth();
  const staffId = session?.user?.id ?? "unknown";
  const staffName = session?.user?.name ?? "Staff";

  const result = await apiFetch<ApiSaleResponse>("/sales", {
    method: "POST",
    body: JSON.stringify({
      location_id: locationId(),
      actor_ref: staffId,
      items: items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
    }),
  });

  if ("error" in result) return result;

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const total =
    typeof result.total === "string" ? parseFloat(result.total) : result.total;
  const createdAt = result.createdAt ?? new Date().toISOString();

  return {
    id: result.id,
    createdAt,
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

  const result = await apiFetch<ApiResponse>(
    `/locations/${locationId()}/inventory?page=${page}&limit=${limit}`
  );
  if ("error" in result) return result;

  return {
    products: result.data.map((item) => ({
      id: item.productId,
      name: item.name,
      sku: item.barcode ?? item.productId.slice(0, 8),
      price: parseFloat(item.price),
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

  // 1. Create product
  const productResult = await apiFetch<ApiProduct>("/products", {
    method: "POST",
    body: JSON.stringify({ name: data.name, barcode: data.sku }),
  });
  if ("error" in productResult) return productResult;

  // 2. Register in location (sets price)
  const invResult = await apiFetch<Record<string, unknown>>(
    `/locations/${locationId()}/inventory`,
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
          location_id: locationId(),
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
  return apiFetch<{ stock: number }>("/inventory-adjustments", {
    method: "POST",
    body: JSON.stringify({
      location_id: locationId(),
      product_id: productId,
      delta,
      reason,
    }),
  });
}

export async function listSales(
  filters: SaleFilters = {}
): Promise<ActionResult<{ sales: Sale[]; total: number }>> {
  type ApiSale = {
    id: string;
    locationId: string;
    staffId: string | null;
    createdAt: string;
    total: number;
    items: Array<{
      productId: string | null;
      productName: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  };
  type ApiResponse = { data: ApiSale[]; total: number; page: number; limit: number };

  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", `${filters.endDate}T23:59:59Z`);
  if (filters.page != null) params.set("page", String(filters.page));
  if (filters.limit != null) params.set("limit", String(filters.limit));

  const result = await apiFetch<ApiResponse>(`/sales?${params.toString()}`);
  if ("error" in result) return result;

  // Resolve staff names from local users table
  const staffMap = new Map(
    (db.prepare("SELECT id, name FROM users").all() as { id: string; name: string }[])
      .map((u) => [u.id, u.name])
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
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotal: s.items.reduce((sum, i) => sum + i.lineTotal, 0),
    total: s.total,
  }));

  // staffId filter applied client-side (API doesn't support it yet)
  if (filters.staffId) {
    sales = sales.filter((s) => s.staffId === filters.staffId);
  }

  return { sales, total: result.total };
}
