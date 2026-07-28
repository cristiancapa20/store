import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ default: { prepare: vi.fn() } }));

import type { JWT } from "next-auth/jwt";
import type { User } from "next-auth";
import db from "@/lib/db";
import { authConfig } from "@/auth.config";
import {
  refreshOrganizationClaims,
  withOrganizationRefresh,
} from "./sessionClaims";

const mockPrepare = vi.mocked(db.prepare);

// El mismo encadenado que arma auth.ts: el callback de auth.config.ts copia los
// datos del `user` en el inicio de sesion y la relectura va detras.
const jwt = withOrganizationRefresh(authConfig.callbacks!.jwt!);

function organization(row: { status: string; plan: string } | undefined) {
  const get = vi.fn().mockReturnValue(row);
  mockPrepare.mockReturnValue({ get } as never);
  return get;
}

function staffToken(overrides: Partial<JWT> = {}): JWT {
  return {
    id: "u1",
    role: "staff",
    organizationId: "org-1",
    organizationStatus: "active",
    organizationPlan: "basic",
    ...overrides,
  } as JWT;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("refreshOrganizationClaims", () => {
  it("relee estado y plan de la organizacion en cada renovacion", () => {
    const get = organization({ status: "active", plan: "pro" });

    const token = refreshOrganizationClaims(staffToken({ organizationPlan: "basic" }));

    expect(get).toHaveBeenCalledWith("org-1");
    expect(token?.organizationPlan).toBe("pro");
    expect(token?.organizationStatus).toBe("active");
  });

  it("destruye la sesion de una tienda suspendida despues de iniciarla", () => {
    organization({ status: "inactive", plan: "pro" });

    // El token dice "active" porque asi se firmo al iniciar sesion: es
    // exactamente la ventana de hasta 30 dias que abria el defecto anterior.
    expect(refreshOrganizationClaims(staffToken())).toBeNull();
  });

  it("destruye la sesion si la organizacion ya no existe", () => {
    organization(undefined);

    expect(refreshOrganizationClaims(staffToken())).toBeNull();
  });

  it("no toca la sesion del superadministrador, que no tiene organizacion", () => {
    const token = { id: "s1", role: "super_admin", organizationId: null } as JWT;

    expect(refreshOrganizationClaims(token)).toBe(token);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it("conserva la sesion si la consulta falla: la base caida no es una suspension", () => {
    mockPrepare.mockImplementation(() => {
      throw new Error("database is locked");
    });

    const token = staffToken();

    expect(refreshOrganizationClaims(token)).toBe(token);
  });
});

describe("withOrganizationRefresh", () => {
  it("copia los datos del usuario al iniciar sesion y ademas los revalida", async () => {
    organization({ status: "active", plan: "pro" });

    const token = await jwt({
      token: {} as JWT,
      user: {
        id: "u1",
        role: "staff",
        organizationId: "org-1",
        organizationName: "Tienda Uno",
        inventoryApiKey: "inv_live_super_secret",
        inventoryLocationId: "loc-1",
        organizationStatus: "active",
        organizationPlan: "basic",
      } as User,
    } as never);

    expect(token?.inventoryApiKey).toBe("inv_live_super_secret");
    // El plan del `user` era "basic": gana el de la fila.
    expect(token?.organizationPlan).toBe("pro");
  });

  it("deja sin sesion la renovacion de una tienda suspendida", async () => {
    organization({ status: "inactive", plan: "basic" });

    // Sin `user`: es una renovacion, no un inicio de sesion.
    expect(await jwt({ token: staffToken() } as never)).toBeNull();
  });
});

describe("configuracion de sesion", () => {
  it("acota la sesion a una jornada en lugar de los 30 dias por defecto", () => {
    expect(authConfig.session?.maxAge).toBe(60 * 60 * 12);
  });
});
