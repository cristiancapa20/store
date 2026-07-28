import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  default: { prepare: vi.fn() },
}));

import { auth } from "@/auth";
import db from "@/lib/db";
import { getInventoryConfig } from "./inventoryClient";

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

  it("falls back to env vars when the session has no organization", async () => {
    mockSession({ id: "u1", role: "super_admin", organizationId: null });

    const config = await getInventoryConfig();

    expect(mockPrepare).not.toHaveBeenCalled();
    expect(config.apiKey).toBe("inv_live_env_fallback");
    expect(config.locationId).toBe("env-loc");
  });

  it("falls back to env vars when the organization has no credential stored", async () => {
    mockSession({ id: "u1", role: "admin", organizationId: "org-2" });
    mockOrgRow({ inventory_api_key: null, inventory_location_id: null });

    const config = await getInventoryConfig();

    expect(config.apiKey).toBe("inv_live_env_fallback");
    expect(config.locationId).toBe("env-loc");
  });

  it("falls back to env vars when the organization row is missing", async () => {
    mockSession({ id: "u1", role: "admin", organizationId: "org-ghost" });
    mockOrgRow(undefined);

    const config = await getInventoryConfig();

    expect(config.apiKey).toBe("inv_live_env_fallback");
    expect(config.locationId).toBe("env-loc");
  });
});
