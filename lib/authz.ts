import "server-only";

import type { Session } from "next-auth";
import { auth } from "@/auth";
import type { ActionError } from "./types";

export type SessionUser = Session["user"];

export type Authorized = { user: SessionUser };

// Server actions are dispatched by Next-Action id over POST to *any* route,
// including the ones auth.config.ts leaves public, so the middleware never sees
// them. Authorization has to happen inside the action itself.
export async function requireSession(): Promise<Authorized | ActionError> {
  const session = await auth();
  if (!session?.user) {
    return {
      error: "Necesitas iniciar sesión para realizar esta acción.",
      code: "unauthorized",
    };
  }
  return { user: session.user };
}

export async function requireAdmin(): Promise<Authorized | ActionError> {
  const gate = await requireSession();
  if ("error" in gate) return gate;
  if (gate.user.role !== "admin") {
    return {
      error: "Necesitas permisos de administrador para realizar esta acción.",
      code: "forbidden",
    };
  }
  return gate;
}
