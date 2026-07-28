import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  default: { prepare: vi.fn() },
}));

import { auth } from "@/auth";
import db from "@/lib/db";
import { apiFetch, getInventoryConfig } from "./inventoryClient";

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
