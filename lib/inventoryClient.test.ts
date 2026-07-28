import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  default: { prepare: vi.fn() },
}));

import { auth } from "@/auth";
import db from "@/lib/db";
import {
  apiFetch,
  getInventoryConfig,
  resolveInventoryTimeoutMs,
  DEFAULT_INVENTORY_TIMEOUT_MS,
} from "./inventoryClient";

const mockAuth = vi.mocked(auth);
const mockPrepare = vi.mocked(db.prepare);

function mockSession(user: Record<string, unknown> | null) {
  mockAuth.mockResolvedValue((user ? { user } : null) as never);
}

function mockOrgRow(row: unknown) {
  const get = vi.fn().mockReturnValue(row);
  mockPrepare.mockReturnValue({ get } as never);
  return get;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INVENTORY_API_URL = "http://api.test/v1";
  // Presentes a proposito: ninguna ruta debe volver a caer en ellas.
  process.env.INVENTORY_API_KEY = "inv_live_env_fallback";
  process.env.INVENTORY_LOCATION_ID = "env-loc";
  delete process.env.INVENTORY_TIMEOUT_MS;
});

describe("getInventoryConfig", () => {
  it("resolves the credential from organizationId, not from the session", async () => {
    mockSession({ id: "u1", role: "staff", organizationId: "org-1" });
    const get = mockOrgRow({
      inventory_api_key: "inv_live_org_one",
      inventory_location_id: "loc-1",
    });

    const config = await getInventoryConfig();

    expect(get).toHaveBeenCalledWith("org-1");
    expect(config.apiKey).toBe("inv_live_org_one");
    expect(config.locationId).toBe("loc-1");
    expect(config.apiBase).toBe("http://api.test/v1");
  });

  it("ignores an inventoryApiKey injected into the session object", async () => {
    mockSession({
      id: "u1",
      role: "staff",
      organizationId: "org-1",
      inventoryApiKey: "inv_live_forged",
      inventoryLocationId: "forged-loc",
    });
    mockOrgRow({
      inventory_api_key: "inv_live_org_one",
      inventory_location_id: "loc-1",
    });

    const config = await getInventoryConfig();

    expect(config.apiKey).toBe("inv_live_org_one");
    expect(config.locationId).toBe("loc-1");
  });

  it("throws when there is no session at all", async () => {
    mockSession(null);

    await expect(getInventoryConfig()).rejects.toThrow(/organizacion en la sesion/i);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it("throws instead of using env vars when the session has no organization", async () => {
    mockSession({ id: "u1", role: "super_admin", organizationId: null });

    await expect(getInventoryConfig()).rejects.toThrow(/organizacion en la sesion/i);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it("throws instead of using env vars when the organization has no credential stored", async () => {
    mockSession({ id: "u1", role: "admin", organizationId: "org-2" });
    mockOrgRow({ inventory_api_key: null, inventory_location_id: null });

    await expect(getInventoryConfig()).rejects.toThrow(/org-2/);
  });

  it("throws when the organization has a key but no location", async () => {
    mockSession({ id: "u1", role: "admin", organizationId: "org-3" });
    mockOrgRow({ inventory_api_key: "inv_live_org_three", inventory_location_id: null });

    await expect(getInventoryConfig()).rejects.toThrow(/credencial de inventario/i);
  });

  it("throws instead of using env vars when the organization row is missing", async () => {
    mockSession({ id: "u1", role: "admin", organizationId: "org-ghost" });
    mockOrgRow(undefined);

    await expect(getInventoryConfig()).rejects.toThrow(/org-ghost/);
  });

  it("throws a clear error when INVENTORY_API_URL is missing", async () => {
    delete process.env.INVENTORY_API_URL;
    mockSession({ id: "u1", role: "staff", organizationId: "org-1" });
    mockOrgRow({
      inventory_api_key: "inv_live_org_one",
      inventory_location_id: "loc-1",
    });

    await expect(getInventoryConfig()).rejects.toThrow(/INVENTORY_API_URL/);
  });

  it("never returns the env credential for any input", async () => {
    const cases: Array<Record<string, unknown> | null> = [
      null,
      { id: "u1", role: "super_admin", organizationId: null },
      { id: "u1", role: "admin", organizationId: "org-2" },
    ];

    for (const user of cases) {
      mockSession(user);
      mockOrgRow({ inventory_api_key: null, inventory_location_id: null });
      await expect(getInventoryConfig()).rejects.toThrow();
    }
  });
});

describe("apiFetch headers", () => {
  function mockResolvedConfig() {
    mockSession({ id: "u1", role: "staff", organizationId: "org-1" });
    mockOrgRow({
      inventory_api_key: "inv_live_org_one",
      inventory_location_id: "loc-1",
    });
  }

  function headersOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
    return (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
  }

  it("merges caller headers with the ones it already sets", async () => {
    mockResolvedConfig();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/sales", {
      method: "POST",
      headers: { "Idempotency-Key": "ticket-key-1" },
    });

    expect(headersOf(fetchMock)).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer inv_live_org_one",
      "Idempotency-Key": "ticket-key-1",
    });

    vi.unstubAllGlobals();
  });

  it("does not let a caller overwrite the credential or the content type", async () => {
    mockResolvedConfig();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/sales", {
      method: "POST",
      headers: {
        Authorization: "Bearer attacker",
        "Content-Type": "text/plain",
      },
    });

    expect(headersOf(fetchMock)).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer inv_live_org_one",
    });

    vi.unstubAllGlobals();
  });
});

describe("resolveInventoryTimeoutMs", () => {
  it("defaults when nothing is configured", () => {
    expect(resolveInventoryTimeoutMs()).toBe(DEFAULT_INVENTORY_TIMEOUT_MS);
  });

  it("takes the value from INVENTORY_TIMEOUT_MS", () => {
    process.env.INVENTORY_TIMEOUT_MS = "2500";
    expect(resolveInventoryTimeoutMs()).toBe(2500);
  });

  it("ignores an unusable INVENTORY_TIMEOUT_MS instead of aborting instantly", () => {
    process.env.INVENTORY_TIMEOUT_MS = "nope";
    expect(resolveInventoryTimeoutMs()).toBe(DEFAULT_INVENTORY_TIMEOUT_MS);
    process.env.INVENTORY_TIMEOUT_MS = "0";
    expect(resolveInventoryTimeoutMs()).toBe(DEFAULT_INVENTORY_TIMEOUT_MS);
    process.env.INVENTORY_TIMEOUT_MS = "-1";
    expect(resolveInventoryTimeoutMs()).toBe(DEFAULT_INVENTORY_TIMEOUT_MS);
  });

  it("lets a per-call override win over the environment", () => {
    process.env.INVENTORY_TIMEOUT_MS = "2500";
    expect(resolveInventoryTimeoutMs(50)).toBe(50);
    expect(resolveInventoryTimeoutMs(0)).toBe(2500);
  });
});

describe("apiFetch transport failures", () => {
  function mockResolvedConfig() {
    mockSession({ id: "u1", role: "staff", organizationId: "org-1" });
    mockOrgRow({
      inventory_api_key: "inv_live_org_one",
      inventory_location_id: "loc-1",
    });
  }

  // Un servicio colgado: nunca responde, solo reacciona al abort del cliente.
  function stubHangingFetch() {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject((init.signal as AbortSignal).reason)
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("aborts a hung request instead of waiting forever", async () => {
    mockResolvedConfig();
    stubHangingFetch();

    const result = await apiFetch("/sales", { method: "POST", timeoutMs: 20 });

    expect(result).toEqual({
      error: expect.stringContaining("20ms"),
      code: "timeout",
    });
    expect("status" in (result as object)).toBe(false);

    vi.unstubAllGlobals();
  });

  it("passes an AbortSignal to fetch and does not leak timeoutMs into the init", async () => {
    mockResolvedConfig();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/sales", { method: "POST", timeoutMs: 1234 });

    const init = fetchMock.mock.calls[0][1] as RequestInit & { timeoutMs?: number };
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.timeoutMs).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("does not call a malformed 200 body a network failure", async () => {
    mockResolvedConfig();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      })
    );

    const result = await apiFetch("/sales");

    expect(result).toMatchObject({ code: "service_error", status: 200 });

    vi.unstubAllGlobals();
  });

  it("marks a network failure with a code and no status", async () => {
    mockResolvedConfig();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const result = await apiFetch("/sales");

    expect(result).toEqual({ error: "fetch failed", code: "network" });

    vi.unstubAllGlobals();
  });
});

describe("apiFetch error responses", () => {
  function mockResolvedConfig() {
    mockSession({ id: "u1", role: "staff", organizationId: "org-1" });
    mockOrgRow({
      inventory_api_key: "inv_live_org_one",
      inventory_location_id: "loc-1",
    });
  }

  function stubResponse(status: number, body: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: async () => body,
      })
    );
  }

  const cases: Array<[number, string, string | undefined]> = [
    [401, JSON.stringify({ error: "Unauthorized" }), "service_auth"],
    [403, JSON.stringify({ error: "Forbidden" }), "service_auth"],
    [404, JSON.stringify({ error: "Not found" }), "not_found"],
    [
      409,
      JSON.stringify({ error: "Insufficient stock for product 8f1c-uuid" }),
      "insufficient_stock",
    ],
    [409, JSON.stringify({ error: "Sale is already voided" }), "conflict"],
    [422, JSON.stringify({ error: "Invalid query params" }), "invalid_request"],
    [503, JSON.stringify({ error: "Service unavailable" }), "service_error"],
    [418, JSON.stringify({ error: "I am a teapot" }), undefined],
  ];

  it.each(cases)("maps %i to a code and keeps the status", async (status, body, code) => {
    mockResolvedConfig();
    stubResponse(status, body);

    const result = (await apiFetch("/sales")) as { status?: number; code?: string };

    expect(result.status).toBe(status);
    expect(result.code).toBe(code);

    vi.unstubAllGlobals();
  });

  it("never leaks a non-JSON error body to the caller", async () => {
    mockResolvedConfig();
    stubResponse(502, "<html><body>Bad gateway</body></html>");

    const result = await apiFetch("/sales");

    expect(result).toEqual({
      error: "HTTP 502",
      code: "service_error",
      status: 502,
    });

    vi.unstubAllGlobals();
  });
});
