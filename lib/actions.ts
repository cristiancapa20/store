"use server";

import type {
  ActionResult,
  CartItem,
  InventoryPage,
  NewProduct,
  Product,
  Sale,
  SaleFilters,
} from "./types";

function apiUrl(path: string): string {
  const base = process.env.INVENTORY_API_URL ?? "";
  return `${base}${path}`;
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
      return { error: text || `HTTP ${res.status}` };
    }
    return (await res.json()) as T;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function scanBarcode(
  barcode: string
): Promise<ActionResult<Product>> {
  return apiFetch<Product>(`/products/barcode/${encodeURIComponent(barcode)}`);
}

export async function createSale(
  items: CartItem[]
): Promise<ActionResult<Sale>> {
  return apiFetch<Sale>("/sales", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export async function listInventory(
  page = 1,
  limit = 50
): Promise<ActionResult<InventoryPage>> {
  return apiFetch<InventoryPage>(
    `/products?page=${page}&limit=${limit}`
  );
}

export async function addProduct(
  data: NewProduct
): Promise<ActionResult<Product>> {
  return apiFetch<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function adjustStock(
  productId: string,
  delta: number
): Promise<ActionResult<{ stock: number }>> {
  return apiFetch<{ stock: number }>(
    `/products/${encodeURIComponent(productId)}/adjust`,
    {
      method: "POST",
      body: JSON.stringify({ delta }),
    }
  );
}

export async function listSales(
  filters: SaleFilters = {}
): Promise<ActionResult<{ sales: Sale[]; total: number }>> {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.staffId) params.set("staffId", filters.staffId);
  if (filters.page != null) params.set("page", String(filters.page));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return apiFetch<{ sales: Sale[]; total: number }>(
    `/sales${qs ? `?${qs}` : ""}`
  );
}
