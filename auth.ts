import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import db from "@/lib/db"
import { authConfig } from "@/auth.config"
import { withOrganizationRefresh } from "@/lib/sessionClaims"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // El estado y el plan se releen aqui, no en auth.config.ts: el middleware
    // carga ese fichero en el runtime de edge y no puede tocar SQLite.
    jwt: withOrganizationRefresh(authConfig.callbacks!.jwt!),
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const row = db
          .prepare(`
            SELECT u.id, u.name, u.email, u.password_hash, u.role,
                   u.organization_id,
                   o.name AS organization_name,
                   o.inventory_api_key, o.inventory_location_id,
                   o.status, o.plan
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.email = ?
          `)
          .get(credentials.email as string) as
          | {
              id: string
              name: string
              email: string
              password_hash: string
              role: string
              organization_id: string | null
              organization_name: string | null
              inventory_api_key: string | null
              inventory_location_id: string | null
              status: string | null
              plan: string | null
            }
          | undefined

        if (!row) return null

        const ok = await bcrypt.compare(
          credentials.password as string,
          row.password_hash
        )
        if (!ok) return null

        if (row.role !== "super_admin" && !row.organization_id) {
          throw new Error("ACCOUNT_NOT_CONFIGURED")
        }

        if (row.status === "inactive") {
          throw new Error("ACCOUNT_SUSPENDED")
        }

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          organizationId: row.organization_id,
          organizationName: row.organization_name,
          inventoryApiKey: row.inventory_api_key,
          inventoryLocationId: row.inventory_location_id,
          organizationStatus: row.status,
          organizationPlan: row.plan,
        }
      },
    }),
  ],
})
