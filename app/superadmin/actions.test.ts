import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { prepare: vi.fn() } }));

import { auth } from "@/auth";
import db from "@/lib/db";
import { toggleOrgStatus, changeOrgPlan } from "./actions";

const mockAuth = vi.mocked(auth);
const mockPrepare = vi.mocked(db.prepare);

beforeEach(() => {
  vi.clearAllMocks();
});

function asSuperAdmin() {
  mockAuth.mockResolvedValue({ user: { role: "super_admin" } } as never);
}

describe("toggleOrgStatus", () => {
  it("rejects non-super_admin callers", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);

    await expect(toggleOrgStatus("org-1")).rejects.toThrow("Unauthorized");
  });

  it("does nothing when the organization doesn't exist", async () => {
    asSuperAdmin();
    const get = vi.fn().mockReturnValue(undefined);
    const run = vi.fn();
    mockPrepare.mockReturnValue({ get, run } as never);

    await toggleOrgStatus("missing-org");

    expect(run).not.toHaveBeenCalled();
  });

  it("flips active to inactive", async () => {
    asSuperAdmin();
    const get = vi.fn().mockReturnValue({ status: "active" });
    const run = vi.fn();
    mockPrepare.mockReturnValue({ get, run } as never);

    await toggleOrgStatus("org-1");

    expect(run).toHaveBeenCalledWith("inactive", "org-1");
  });

  it("flips inactive to active", async () => {
    asSuperAdmin();
    const get = vi.fn().mockReturnValue({ status: "inactive" });
    const run = vi.fn();
    mockPrepare.mockReturnValue({ get, run } as never);

    await toggleOrgStatus("org-1");

    expect(run).toHaveBeenCalledWith("active", "org-1");
  });
});

describe("changeOrgPlan", () => {
  it("rejects non-super_admin callers", async () => {
    mockAuth.mockResolvedValue({ user: { role: "staff" } } as never);

    await expect(changeOrgPlan("org-1", "pro")).rejects.toThrow("Unauthorized");
  });

  it("updates the organization's plan", async () => {
    asSuperAdmin();
    const run = vi.fn();
    mockPrepare.mockReturnValue({ run } as never);

    await changeOrgPlan("org-1", "pro");

    expect(run).toHaveBeenCalledWith("pro", "org-1");
  });
});
