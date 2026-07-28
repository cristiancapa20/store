import { describe, it, expect } from "vitest";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
import { authConfig } from "./auth.config";

const jwtCallback = authConfig.callbacks!.jwt!;
const sessionCallback = authConfig.callbacks!.session!;

const user = {
  id: "u1",
  name: "Ana",
  email: "ana@test.com",
  role: "staff",
  organizationId: "org-1",
  organizationName: "Tienda Uno",
  inventoryApiKey: "inv_live_super_secret",
  inventoryLocationId: "loc-1",
  organizationStatus: "active",
  organizationPlan: "pro",
} as User;

async function buildSession() {
  const token = (await jwtCallback({
    token: {} as JWT,
    user,
  } as never)) as JWT;

  const session = (await sessionCallback({
    session: { user: {}, expires: "" } as unknown as Session,
    token,
  } as never)) as Session;

  return { token, session };
}

describe("auth callbacks", () => {
  it("keeps the inventory credential in the encrypted token", async () => {
    const { token } = await buildSession();

    expect(token.inventoryApiKey).toBe("inv_live_super_secret");
    expect(token.inventoryLocationId).toBe("loc-1");
  });

  it("never serializes an inv_live_ credential into the session", async () => {
    const { session } = await buildSession();

    expect(JSON.stringify(session)).not.toContain("inv_live_");
    expect(JSON.stringify(session)).not.toContain("loc-1");
  });

  it("keeps organizationId in the session so the server can resolve the credential", async () => {
    const { session } = await buildSession();

    expect(session.user.organizationId).toBe("org-1");
    expect(session.user.role).toBe("staff");
    expect(session.user.organizationPlan).toBe("pro");
  });
});
