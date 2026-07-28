import { describe, it, expect } from "vitest";
import { INVENTORY_MAX_LIMIT, clampInventoryLimit } from "./pagination";

describe("clampInventoryLimit", () => {
  it("matches the service maximum", () => {
    expect(INVENTORY_MAX_LIMIT).toBe(100);
  });

  it("caps anything above the maximum", () => {
    expect(clampInventoryLimit(500)).toBe(100);
    expect(clampInventoryLimit(101)).toBe(100);
  });

  it("leaves valid limits untouched", () => {
    expect(clampInventoryLimit(1)).toBe(1);
    expect(clampInventoryLimit(50)).toBe(50);
    expect(clampInventoryLimit(100)).toBe(100);
  });

  it("floors to a positive integer", () => {
    expect(clampInventoryLimit(0)).toBe(1);
    expect(clampInventoryLimit(-10)).toBe(1);
    expect(clampInventoryLimit(10.9)).toBe(10);
    expect(clampInventoryLimit(NaN)).toBe(100);
  });
});
