export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  description?: string;
};

export type CartItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Sale = {
  id: string;
  createdAt: string;
  staffId: string;
  staffName?: string;
  items: SaleItem[];
  subtotal: number;
  total: number;
};

export type NewProduct = {
  name: string;
  sku: string;
  price: number;
  initialStock: number;
  description?: string;
};

export type SaleFilters = {
  startDate?: string;
  endDate?: string;
  staffId?: string;
  page?: number;
  limit?: number;
};

export type InventoryPage = {
  products: Product[];
  total: number;
  page: number;
  limit: number;
};

// `truncated` is only ever true on the staff-filtered path: the service cannot
// filter `/sales` by actor, so the action has to walk the pages itself and stops
// at a bounded number of them. The UI has to say so instead of presenting a
// partial count as the whole truth.
export type SalesPage = {
  sales: Sale[];
  total: number;
  page: number;
  limit: number;
  truncated: boolean;
};

export type SalesSummary = {
  count: number;
  revenue: number;
  todayRevenue: number;
  truncated: boolean;
};

// `code` lets the UI tell "the product does not exist" apart from a transport
// or validation failure (e.g. a 422 from the service), and an authorization
// refusal apart from either. `unauthorized`/`forbidden` are about *this* app's
// session; `service_auth` is the inventory service rejecting the store's key.
export type ActionErrorCode =
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "insufficient_stock"
  | "conflict"
  | "invalid_request"
  | "service_auth"
  | "service_error"
  | "timeout"
  | "network";

// `status` is present only when the service actually answered. Its absence next
// to a `timeout`/`network` code is what tells "nobody answered" apart from "the
// service answered with an error".
export type ActionError = {
  error: string;
  code?: ActionErrorCode;
  status?: number;
};

export type ActionResult<T> = T | ActionError;
