// The Inventory Service validates `limit` with `.max(100)`: anything above it
// is rejected with 422 instead of being silently trimmed.
export const INVENTORY_MAX_LIMIT = 100;

export function clampInventoryLimit(limit: number): number {
  if (!Number.isFinite(limit)) return INVENTORY_MAX_LIMIT;
  return Math.min(Math.max(1, Math.trunc(limit)), INVENTORY_MAX_LIMIT);
}
