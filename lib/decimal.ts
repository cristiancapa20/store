// The inventory service serialises every monetary column as a decimal string
// ("350.00"), never as a JSON number. Converting once at the API boundary keeps
// strings from leaking into the UI, where `.toFixed()` would throw.
export type ApiDecimal = string | number | null | undefined;

export function parseDecimal(value: ApiDecimal, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}
