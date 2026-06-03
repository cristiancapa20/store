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

export type ActionError = { error: string };

export type ActionResult<T> = T | ActionError;
