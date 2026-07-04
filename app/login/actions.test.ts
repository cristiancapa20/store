import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { signIn } from "@/auth";
import { loginAction } from "./actions";

const mockSignIn = vi.mocked(signIn);

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginAction", () => {
  it("returns null on success", async () => {
    mockSignIn.mockResolvedValue(undefined as never);

    const result = await loginAction(
      null,
      formData({ email: "a@b.com", password: "secret123" })
    );

    expect(result).toBeNull();
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "a@b.com",
      password: "secret123",
      redirectTo: "/sell",
    });
  });

  it("maps ACCOUNT_SUSPENDED to a Spanish error message", async () => {
    mockSignIn.mockRejectedValue(
      new AuthError("suspended", { cause: { err: new Error("ACCOUNT_SUSPENDED") } })
    );

    const result = await loginAction(
      null,
      formData({ email: "a@b.com", password: "secret123" })
    );

    expect(result).toEqual({
      error: "Tu cuenta está suspendida. Contacta a soporte.",
    });
  });

  it("maps ACCOUNT_NOT_CONFIGURED to a Spanish error message", async () => {
    mockSignIn.mockRejectedValue(
      new AuthError("not configured", { cause: { err: new Error("ACCOUNT_NOT_CONFIGURED") } })
    );

    const result = await loginAction(
      null,
      formData({ email: "a@b.com", password: "secret123" })
    );

    expect(result).toEqual({
      error: "Cuenta no configurada. Contacta a soporte.",
    });
  });

  it("falls back to generic invalid-credentials message for other auth errors", async () => {
    mockSignIn.mockRejectedValue(new AuthError("bad creds"));

    const result = await loginAction(
      null,
      formData({ email: "a@b.com", password: "wrong" })
    );

    expect(result).toEqual({
      error: "Credenciales inválidas. Inténtalo de nuevo.",
    });
  });

  it("rethrows non-AuthError errors (e.g. redirect signals)", async () => {
    mockSignIn.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      loginAction(null, formData({ email: "a@b.com", password: "secret123" }))
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
