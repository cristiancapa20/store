import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { prepare: vi.fn() } }));

import { auth } from "@/auth";
import db from "@/lib/db";
import { createStaff, deleteStaff } from "./actions";

const mockAuth = vi.mocked(auth);
const mockPrepare = vi.mocked(db.prepare);

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function asAdmin(overrides: Partial<{ organizationId: string; organizationPlan: string }> = {}) {
  mockAuth.mockResolvedValue({
    user: {
      role: "admin",
      organizationId: overrides.organizationId ?? "org-1",
      organizationPlan: overrides.organizationPlan ?? "basic",
    },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createStaff", () => {
  it("rejects when the admin's session has no organization (stale session)", async () => {
    mockAuth.mockResolvedValue({
      user: { role: "admin", organizationId: null, organizationPlan: "basic" },
    } as never);

    const result = await createStaff(
      null,
      formData({ name: "Ana", email: "ana@b.com", password: "password1" })
    );

    expect(result).toEqual({
      error:
        "Tu sesión no tiene una tienda asociada. Cierra sesión y vuelve a iniciar sesión, luego intenta de nuevo.",
    });
  });

  it("rejects when the caller is not an admin", async () => {
    mockAuth.mockResolvedValue({ user: { role: "staff" } } as never);

    await expect(
      createStaff(
        null,
        formData({ name: "A", email: "a@b.com", password: "password1" })
      )
    ).rejects.toThrow("Unauthorized");
  });

  it("requires all fields", async () => {
    asAdmin();

    const result = await createStaff(
      null,
      formData({ name: "", email: "", password: "" })
    );

    expect(result).toEqual({ error: "Todos los campos son requeridos." });
  });

  it("requires an 8+ character password", async () => {
    asAdmin();

    const result = await createStaff(
      null,
      formData({ name: "Ana", email: "ana@b.com", password: "short" })
    );

    expect(result).toEqual({
      error: "La contraseña debe tener al menos 8 caracteres.",
    });
  });

  it("blocks a 3rd staff member on the basic plan", async () => {
    asAdmin({ organizationPlan: "basic" });
    const get = vi.fn().mockReturnValue({ c: 2 });
    mockPrepare.mockReturnValue({ get } as never);

    const result = await createStaff(
      null,
      formData({ name: "Ana", email: "ana@b.com", password: "password1" })
    );

    expect(result).toEqual({
      error:
        "Límite del plan alcanzado (2 usuarios). Mejora a Pro para agregar más empleados.",
    });
  });

  it("counts only staff (not the admin) against the basic plan limit", async () => {
    asAdmin({ organizationPlan: "basic" });
    // 1 existing staff member (the admin itself must not count toward the limit)
    const get = vi.fn().mockReturnValue({ c: 1 });
    mockPrepare.mockReturnValue({ get } as never);

    // The count query must scope to role = 'staff'
    await createStaff(
      null,
      formData({ name: "Ana", email: "ana@b.com", password: "password1" })
    );

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("role = 'staff'")
    );
  });

  it("does not enforce the staff limit on the pro plan", async () => {
    asAdmin({ organizationPlan: "pro" });
    const get = vi.fn().mockReturnValue(undefined); // email-in-use check
    const run = vi.fn();
    mockPrepare.mockReturnValue({ get, run } as never);

    const result = await createStaff(
      null,
      formData({ name: "Ana", email: "ana@b.com", password: "password1" })
    );

    expect(result).toBeNull();
    expect(run).toHaveBeenCalled();
  });

  it("rejects a duplicate email", async () => {
    asAdmin({ organizationPlan: "pro" });
    const get = vi.fn().mockReturnValue({ id: "existing" });
    mockPrepare.mockReturnValue({ get } as never);

    const result = await createStaff(
      null,
      formData({ name: "Ana", email: "ana@b.com", password: "password1" })
    );

    expect(result).toEqual({ error: "Este email ya está en uso." });
  });

  it("scopes the new staff user to the admin's organization", async () => {
    asAdmin({ organizationId: "org-42", organizationPlan: "pro" });
    const get = vi.fn().mockReturnValue(undefined);
    const run = vi.fn();
    mockPrepare.mockReturnValue({ get, run } as never);

    await createStaff(
      null,
      formData({ name: "Ana", email: "ana@b.com", password: "password1" })
    );

    expect(run).toHaveBeenCalledWith(
      expect.any(String),
      "Ana",
      "ana@b.com",
      expect.any(String),
      "org-42"
    );
  });
});

describe("deleteStaff", () => {
  it("rejects when the caller is not an admin", async () => {
    mockAuth.mockResolvedValue({ user: { role: "staff" } } as never);

    await expect(deleteStaff("u1")).rejects.toThrow("Unauthorized");
  });

  it("scopes deletion to the admin's organization and the staff role", async () => {
    asAdmin({ organizationId: "org-1" });
    const run = vi.fn();
    mockPrepare.mockReturnValue({ run } as never);

    await deleteStaff("u1");

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("role = 'staff'")
    );
    expect(run).toHaveBeenCalledWith("u1", "org-1");
  });
});
