import { describe, it, expect, vi, afterEach } from "vitest";

import { newIdempotencyKey } from "./idempotency";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newIdempotencyKey", () => {
  it("returns a v4 uuid", () => {
    expect(newIdempotencyKey()).toMatch(UUID_RE);
  });

  it("returns a different key on every call", () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));

    expect(keys.size).toBe(200);
  });

  it("still produces distinct keys without randomUUID (http, non-secure context)", () => {
    const { getRandomValues } = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: getRandomValues.bind(globalThis.crypto),
    });

    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));

    expect(keys.size).toBe(200);
    expect([...keys][0]).toMatch(UUID_RE);
  });

  it("falls back to Math.random when there is no web crypto at all", () => {
    vi.stubGlobal("crypto", undefined);

    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));

    expect(keys.size).toBe(200);
    expect([...keys][0]).toMatch(UUID_RE);
  });
});
