import { describe, it, expect } from "vitest";

import { parseDecimal } from "./decimal";

describe("parseDecimal", () => {
  it("converts the decimal strings the service returns", () => {
    expect(parseDecimal("350.00")).toBe(350);
    expect(parseDecimal("0.50")).toBe(0.5);
    expect(parseDecimal("-12.25")).toBe(-12.25);
  });

  it("passes finite numbers through untouched", () => {
    expect(parseDecimal(13)).toBe(13);
    expect(parseDecimal(0)).toBe(0);
  });

  it("falls back on null, undefined and unparseable values", () => {
    expect(parseDecimal(null)).toBe(0);
    expect(parseDecimal(undefined)).toBe(0);
    expect(parseDecimal("")).toBe(0);
    expect(parseDecimal("n/a")).toBe(0);
    expect(parseDecimal(Number.NaN)).toBe(0);
    expect(parseDecimal(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("honours an explicit fallback", () => {
    expect(parseDecimal(null, -1)).toBe(-1);
    expect(parseDecimal("abc", 99)).toBe(99);
  });
});
