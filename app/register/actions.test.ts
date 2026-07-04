import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The real "next-auth" package pulls in "next/server", which Vitest's Vite-based
// resolver can't load outside a Next.js build — mock it with a minimal AuthError.
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    constructor(message?: string, options?: { cause?: unknown }) {
      super(message, options);
    }
  },
}));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));

import { AuthError } from "next-auth";
vi.mock("@/lib/db", () => ({ default: { prepare: vi.fn() } }));

import { signIn } from "@/auth";
import db from "@/lib/db";
import { registerAction } from "./actions";

const mockSignIn = vi.mocked(signIn);
const mockPrepare = vi.mocked(db.prepare);

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validFields = {
  storeName: "Tienda Ana",
  ownerName: "Ana Pérez",
  email: "ana@tienda.com",
  phone: "555-1234",
  address: "Calle Falsa 123",
  password: "password1",
  confirmPassword: "password1",
};

const envSnapshot = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...envSnapshot };
  delete process.env.INVENTORY_ADMIN_SECRET;
  delete process.env.INVENTORY_API_URL;
  vi.stubEnv("NODE_ENV", "test");

  // Default: no existing user/org, prepare().run() no-ops.
  mockPrepare.mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
    run: vi.fn(),
  } as never);
  mockSignIn.mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("registerAction validation", () => {
  it("requires all required fields", async () => {
    const result = await registerAction(
      null,
      formData({ ...validFields, storeName: "" })
    );
    expect(result).toEqual({ error: "Todos los campos son requeridos." });
  });

  it("rejects an invalid email", async () => {
    const result = await registerAction(
      null,
      formData({ ...validFields, email: "not-an-email" })
    );
    expect(result).toEqual({ error: "El email no es válido." });
  });

  it("requires an 8+ character password", async () => {
    const result = await registerAction(
      null,
      formData({ ...validFields, password: "short", confirmPassword: "short" })
    );
    expect(result).toEqual({
      error: "La contraseña debe tener al menos 8 caracteres.",
    });
  });

  it("requires matching passwords", async () => {
    const result = await registerAction(
      null,
      formData({ ...validFields, confirmPassword: "different1" })
    );
    expect(result).toEqual({ error: "Las contraseñas no coinciden." });
  });

  it("rejects an email already used by a user or an organization", async () => {
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue({ id: "existing" }),
      run: vi.fn(),
    } as never);

    const result = await registerAction(null, formData(validFields));

    expect(result).toEqual({ error: "Este email ya está registrado." });
  });
});

describe("registerAction without inventory service configured", () => {
  it("creates the organization/user locally and auto-logs in without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await registerAction(null, formData(validFields));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: validFields.email,
      password: validFields.password,
      redirectTo: "/sell",
    });
    expect(result).toBeNull();
  });
});

describe("registerAction with inventory service configured", () => {
  beforeEach(() => {
    process.env.INVENTORY_ADMIN_SECRET = "admin-secret";
    process.env.INVENTORY_API_URL = "http://inventory.test/v1";
  });

  function okResponse(body: unknown) {
    return { ok: true, json: async () => body };
  }
  function failResponse(status = 500) {
    return { ok: false, status, text: async () => "boom" };
  }

  it("provisions org, api key and location, then persists them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ id: "inv-org-1" })) // org
      .mockResolvedValueOnce(okResponse({ plainKey: "inv-key-1" })) // api key
      .mockResolvedValueOnce(okResponse({ id: "inv-loc-1" })); // location
    vi.stubGlobal("fetch", fetchMock);
    const run = vi.fn();
    mockPrepare.mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run,
    } as never);

    const result = await registerAction(null, formData(validFields));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://inventory.test/v1/admin/organizations"
    );
    // organizations insert call carries the provisioned inventory ids
    const orgInsertCall = run.mock.calls.find((args) =>
      args.includes("inv-org-1")
    );
    expect(orgInsertCall).toEqual(
      expect.arrayContaining(["inv-org-1", "inv-key-1", "inv-loc-1"])
    );
    expect(result).toBeNull();
  });

  it("in development, proceeds without inventory linkage when org creation fails", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(failResponse()));

    const result = await registerAction(null, formData(validFields));

    expect(result).toBeNull();
  });

  it("in production, surfaces a service-unavailable error when org creation fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(failResponse()));

    const result = await registerAction(null, formData(validFields));

    expect(result).toEqual({
      error: "Servicio no disponible, intenta más tarde.",
    });
  });

  it("in production, surfaces a service-unavailable error when api-key creation fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(okResponse({ id: "inv-org-1" }))
        .mockResolvedValueOnce(failResponse())
    );

    const result = await registerAction(null, formData(validFields));

    expect(result).toEqual({
      error: "Servicio no disponible, intenta más tarde.",
    });
  });

  it("in production, surfaces a service-unavailable error when the network call throws", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await registerAction(null, formData(validFields));

    expect(result).toEqual({
      error: "Servicio no disponible, intenta más tarde.",
    });
  });

  it("in development, proceeds without inventory linkage when the network call throws", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await registerAction(null, formData(validFields));

    expect(result).toBeNull();
  });
});

describe("registerAction auto-login", () => {
  it("returns a friendly message if auto-login fails with an AuthError", async () => {
    vi.stubGlobal("fetch", vi.fn());
    mockSignIn.mockRejectedValue(new AuthError("bad session"));

    const result = await registerAction(null, formData(validFields));

    expect(result).toEqual({
      error: "Registro exitoso. Por favor inicia sesión.",
    });
  });

  it("rethrows non-AuthError errors from sign-in (e.g. redirect signals)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    mockSignIn.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      registerAction(null, formData(validFields))
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
