import "server-only"

import type { NextAuthConfig } from "next-auth"
import type { JWT } from "next-auth/jwt"
import db from "@/lib/db"

type OrgRow = { status: string | null; plan: string | null }

type JwtCallback = NonNullable<NonNullable<NextAuthConfig["callbacks"]>["jwt"]>

// El JWT se firma una vez al iniciar sesion y despues solo se re-emite con el
// mismo contenido: sin esta relectura, suspender una tienda no surtia efecto
// hasta que caducara la sesion. La consulta vive aqui y no en auth.config.ts
// porque ese fichero lo carga el middleware en el runtime de edge, donde ni
// better-sqlite3 ni bcrypt existen.
export function refreshOrganizationClaims(token: JWT): JWT | null {
  // El superadministrador no pertenece a ninguna organizacion: no hay fila que
  // releer, y tratarlo como tienda sin estado lo dejaria fuera del propio panel
  // desde el que se suspenden las tiendas.
  if (token.role === "super_admin" || !token.organizationId) return token

  let org: OrgRow | undefined
  try {
    org = db
      .prepare("SELECT status, plan FROM organizations WHERE id = ?")
      .get(token.organizationId) as OrgRow | undefined
  } catch {
    // Un fallo de SQLite es la aplicacion rota, no una tienda suspendida: se
    // conservan los datos del token en vez de echar a todos los cajeros.
    return token
  }

  // Devolver null destruye la sesion: Auth.js limpia la cookie y auth() pasa a
  // devolver null, asi que las guardias de lib/authz.ts ya rechazan cualquier
  // accion. Es el mismo desenlace que da authorize() al iniciar sesion con una
  // tienda suspendida (ACCOUNT_SUSPENDED), solo que sin esperar a la caducidad.
  // Sin fila la organizacion fue borrada: tampoco puede operar.
  if (!org || org.status !== "active") return null

  return {
    ...token,
    organizationStatus: org.status,
    organizationPlan: org.plan,
  }
}

// Encadena la relectura al callback jwt de auth.config.ts (que solo copia los
// datos del `user` en el inicio de sesion) sin que ese fichero tenga que
// importar la base de datos.
export function withOrganizationRefresh(base: JwtCallback): JwtCallback {
  return async (params) => {
    const token = await base(params)
    return token && refreshOrganizationClaims(token)
  }
}
