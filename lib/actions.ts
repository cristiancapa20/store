"use server";

import { requireAdmin, requireSession } from "./authz";
import db from "./db";
import { parseDecimal, type ApiDecimal } from "./decimal";
import { apiFetch, getInventoryConfig } from "./inventoryClient";
import { clampInventoryLimit, INVENTORY_MAX_LIMIT } from "./pagination";
import type {
  ActionResult,
  CartItem,
  InventoryPage,
  NewProduct,
  Product,
  Sale,
  SaleFilters,
  SalesPage,
  SalesSummary,
} from "./types";

export async function listStaff(): Promise<
  ActionResult<{ id: string; name: string }[]>
> {
  const gate = await requireSession();
  if ("error" in gate) return gate;

  const organizationId = gate.user.organizationId;
  if (!organizationId) return [];

  try {
    return db
      .prepare(
        "SELECT id, name FROM users WHERE organization_id = ? ORDER BY name"
      )
      .all(organizationId) as { id: string; name: string }[];
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
  const gate = await requireSession();
  if ("error" in gate) return gate;

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

export async function getInvoicePreviewInfo(): Promise<
  ActionResult<{
    storeName: string;
    taxRate: number;
    staffName: string;
  }>
> {
  const gate = await requireSession();
  if ("error" in gate) return gate;

  return {
    storeName: process.env.STORE_NAME ?? "Store",
    taxRate: parseFloat(process.env.TAX_RATE ?? "0"),
    staffName: gate.user.name ?? "Staff",
  };
}

export async function createSale(
  items: CartItem[],
  idempotencyKey: string
): Promise<ActionResult<Sale>> {
  const gate = await requireSession();
  if ("error" in gate) return gate;

  const staffId = gate.user.id ?? "unknown";
  const staffName = gate.user.name ?? "Staff";
  const { locationId } = await getInventoryConfig();

  // Una clave vacia seria peor que ninguna: el servicio la guardaria tal cual y
  // el unico (location_id, idempotency_key) haria chocar entre si a todas las
  // ventas sin clave de la misma tienda.
  const key = idempotencyKey.trim();

  const result = await apiFetch<ApiSaleResponse>("/sales", {
    method: "POST",
    headers: key ? { "Idempotency-Key": key } : undefined,
    body: JSON.stringify({
      location_id: locationId,
      actor_ref: staffId,
      items: items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
    }),
  });

  if ("error" in result) {
    // POST /sales solo responde 409 por stock insuficiente, asi que el codigo se
    // fija aqui aunque el servicio cambie la redaccion del mensaje.
    return result.status === 409
      ? { ...result, code: "insufficient_stock" as const }
      : result;
  }

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
  limit = 50,
  search?: string
): Promise<ActionResult<InventoryPage>> {
  const gate = await requireSession();
  if ("error" in gate) return gate;

  type ApiResponse = {
    data: ApiInventoryItem[];
    total: number;
    page: number;
    limit: number;
  };

  const { locationId } = await getInventoryConfig();

  const params = new URLSearchParams({
    page: String(Math.max(1, Math.trunc(page))),
    limit: String(clampInventoryLimit(limit)),
  });
  // `name` matches partially and case-insensitively on the service side, so the
  // catalog no longer has to be downloaded to be searched. `barcode` is an exact
  // match there, which is what the scanner path (`scanBarcode`) already covers.
  const name = search?.trim();
  if (name) params.set("name", name);

  const result = await apiFetch<ApiResponse>(
    `/locations/${locationId}/inventory?${params.toString()}`
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
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  type ApiProduct = { id: string; name: string; barcode: string | null };

  const plan = gate.user.organizationPlan ?? "basic";
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
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

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

type ApiSalesResponse = {
  data: ApiSale[];
  total: number;
  page: number;
  limit: number;
};

type ApiSalesReport = { totalCount: number; totalRevenue: ApiDecimal };

const DEFAULT_SALES_LIMIT = 20;

// `GET /v1/sales` only accepts startDate, endDate, page and limit: its zod schema
// drops any other key without complaining, so an actor filter cannot be pushed
// down. Filtering *after* paginating is what made page 1 show three rows out of a
// reported forty, so the staff-filtered path walks the range and filters before
// slicing. The walk is bounded and the caller is told when it hit the ceiling.
const SALES_SCAN_MAX_PAGES = 10;

function salesQuery(filters: SaleFilters, page: number, limit: number): string {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", `${filters.endDate}T23:59:59Z`);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return params.toString();
}

// `users` is multi-tenant: a SELECT without the organization exposes every
// store's staff, plus the superadmin, who belongs to none.
function staffNames(organizationId: string | null | undefined): Map<string, string> {
  if (!organizationId) return new Map();
  try {
    const rows = db
      .prepare("SELECT id, name FROM users WHERE organization_id = ?")
      .all(organizationId) as { id: string; name: string }[];
    return new Map(rows.map((u) => [u.id, u.name]));
  } catch {
    return new Map();
  }
}

function toSale(s: ApiSale, staffMap: Map<string, string>): Sale {
  return {
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
  };
}

async function scanSalesByStaff(
  filters: SaleFilters,
  staffId: string
): Promise<ActionResult<{ rows: ApiSale[]; truncated: boolean }>> {
  const first = await apiFetch<ApiSalesResponse>(
    `/sales?${salesQuery(filters, 1, INVENTORY_MAX_LIMIT)}`
  );
  if ("error" in first) return first;

  const pages = Math.ceil(first.total / INVENTORY_MAX_LIMIT);
  const scanned = Math.min(pages, SALES_SCAN_MAX_PAGES);

  const rows = [...first.data];
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, scanned - 1) }, (_, i) =>
      apiFetch<ApiSalesResponse>(
        `/sales?${salesQuery(filters, i + 2, INVENTORY_MAX_LIMIT)}`
      )
    )
  );
  for (const result of rest) {
    if ("error" in result) return result;
    rows.push(...result.data);
  }

  return {
    rows: rows.filter((s) => (s.staffId ?? "") === staffId),
    truncated: pages > scanned,
  };
}

export async function listSales(
  filters: SaleFilters = {}
): Promise<ActionResult<SalesPage>> {
  const gate = await requireSession();
  if ("error" in gate) return gate;

  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const limit = clampInventoryLimit(filters.limit ?? DEFAULT_SALES_LIMIT);

  if (filters.staffId) {
    const scan = await scanSalesByStaff(filters, filters.staffId);
    if ("error" in scan) return scan;

    const staffMap = staffNames(gate.user.organizationId);
    const from = (page - 1) * limit;
    return {
      sales: scan.rows.slice(from, from + limit).map((s) => toSale(s, staffMap)),
      total: scan.rows.length,
      page,
      limit,
      truncated: scan.truncated,
    };
  }

  const result = await apiFetch<ApiSalesResponse>(
    `/sales?${salesQuery(filters, page, limit)}`
  );
  if ("error" in result) return result;

  const staffMap = staffNames(gate.user.organizationId);
  return {
    sales: result.data.map((s) => toSale(s, staffMap)),
    total: result.total,
    page,
    limit,
    truncated: false,
  };
}

// `GET /v1/sales/:id` answers in the same shape `createSale` does, which is *not*
// the shape `/sales` lists: amounts are decimal strings and the items carry no
// product name (only the list endpoint joins the catalog).
type ApiSaleDetail = {
  id: string;
  locationId: string;
  status: string;
  actorRef: string | null;
  createdAt: string;
  total: ApiDecimal;
  items: Array<{
    productId: string | null;
    quantity: number;
    unitPrice: ApiDecimal;
    lineTotal: ApiDecimal;
  }>;
};

type ApiProduct = { id: string; name: string };

// A name is cosmetic, an amount is not: a lookup that fails falls back to the id
// instead of failing the whole read.
async function productNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const results = await Promise.all(
    unique.map((id) => apiFetch<ApiProduct>(`/products/${encodeURIComponent(id)}`))
  );
  const names = new Map<string, string>();
  results.forEach((result, i) => {
    if (!("error" in result)) names.set(unique[i], result.name);
  });
  return names;
}

// The tenant check *is* the request: the credential resolved by
// `getInventoryConfig()` belongs to the session's organization, and the service
// scopes the lookup by it, answering 404 — not 403 — for a sale of another store.
// So a foreign sale arrives here as `code: "not_found"` and there is nothing left
// to re-verify locally.
export async function getSale(saleId: string): Promise<ActionResult<Sale>> {
  const gate = await requireSession();
  if ("error" in gate) return gate;

  const sale = await apiFetch<ApiSaleDetail>(
    `/sales/${encodeURIComponent(saleId)}`
  );
  if ("error" in sale) return sale;

  const names = await productNames(
    sale.items.map((i) => i.productId).filter((id): id is string => !!id)
  );
  const staffMap = staffNames(gate.user.organizationId);
  const staffId = sale.actorRef ?? "";

  return {
    id: sale.id,
    createdAt: sale.createdAt,
    staffId,
    staffName: staffMap.get(staffId) ?? sale.actorRef ?? "Unknown",
    items: sale.items.map((i) => ({
      productId: i.productId ?? "",
      productName: names.get(i.productId ?? "") ?? i.productId ?? "",
      quantity: i.quantity,
      unitPrice: parseDecimal(i.unitPrice),
      lineTotal: parseDecimal(i.lineTotal),
    })),
    subtotal: sale.items.reduce((sum, i) => sum + parseDecimal(i.lineTotal), 0),
    total: parseDecimal(sale.total),
  };
}

// `today` is the caller's *local* calendar day (YYYY-MM-DD): the server has no
// way to know the till's timezone, and the day boundary is what the cashier sees.
export async function getSalesSummary(
  filters: SaleFilters = {},
  today?: string
): Promise<ActionResult<SalesSummary>> {
  const gate = await requireSession();
  if ("error" in gate) return gate;

  if (filters.staffId) {
    const scan = await scanSalesByStaff(filters, filters.staffId);
    if ("error" in scan) return scan;

    const revenue = scan.rows.reduce((sum, s) => sum + parseDecimal(s.total), 0);
    const todayRevenue = today
      ? scan.rows
          .filter((s) => s.createdAt.slice(0, 10) === today)
          .reduce((sum, s) => sum + parseDecimal(s.total), 0)
      : 0;

    return {
      count: scan.rows.length,
      revenue,
      todayRevenue,
      truncated: scan.truncated,
    };
  }

  // `/reports/sales` aggregates in the database, so the metrics stop depending on
  // how many sales a page happened to carry. It counts completed sales only,
  // while `/sales` also lists voided ones; this app never voids, so the two
  // agree, and where they would not the report is the one answering "how much did
  // this store actually take".
  const { locationId } = await getInventoryConfig();
  const reportQuery = (from?: string, to?: string) => {
    const params = new URLSearchParams({ locationId });
    if (from) params.set("from", from);
    if (to) params.set("to", `${to}T23:59:59Z`);
    return params.toString();
  };

  // Every metric describes the *filtered* set, so a range that leaves today out
  // leaves today's total at zero — same as the staff-filtered branch above, which
  // can only see what the range brought back.
  const todayInRange =
    !!today &&
    (!filters.startDate || filters.startDate <= today) &&
    (!filters.endDate || filters.endDate >= today);

  const [range, todayReport] = await Promise.all([
    apiFetch<ApiSalesReport>(`/reports/sales?${reportQuery(filters.startDate, filters.endDate)}`),
    todayInRange
      ? apiFetch<ApiSalesReport>(`/reports/sales?${reportQuery(today, today)}`)
      : Promise.resolve(null),
  ]);

  if ("error" in range) return range;
  if (todayReport && "error" in todayReport) return todayReport;

  return {
    count: range.totalCount,
    revenue: parseDecimal(range.totalRevenue),
    todayRevenue: todayReport ? parseDecimal(todayReport.totalRevenue) : 0,
    truncated: false,
  };
}
