import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { requireAdmin, requireSession } from "./authz";

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireSession", () => {
  it("returns an unauthorized error when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);

    expect(await requireSession()).toEqual({
      error: expect.any(String),
      code: "unauthorized",
    });
  });

  it("returns an unauthorized error when the session carries no user", async () => {
    mockAuth.mockResolvedValue({ expires: "2026-01-01" } as never);

    expect(await requireSession()).toMatchObject({ code: "unauthorized" });
  });

  it("returns the session user for any authenticated role", async () => {
    const user = { id: "u1", name: "Bob", role: "staff" };
    mockAuth.mockResolvedValue({ user } as never);

    expect(await requireSession()).toEqual({ user });
  });
});

describe("requireAdmin", () => {
  it("returns a forbidden error for a non-admin role", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", name: "Bob", role: "staff" },
    } as never);

    expect(await requireAdmin()).toEqual({
      error: expect.any(String),
      code: "forbidden",
    });
  });

  it("propagates the unauthorized error when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);

    expect(await requireAdmin()).toMatchObject({ code: "unauthorized" });
  });

  it("returns the session user for an admin", async () => {
    const user = { id: "u1", name: "Ana", role: "admin" };
    mockAuth.mockResolvedValue({ user } as never);

    expect(await requireAdmin()).toEqual({ user });
  });
});
