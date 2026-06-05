import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      organizationId?: string | null
      inventoryApiKey?: string | null
      inventoryLocationId?: string | null
      organizationStatus?: string | null
      organizationPlan?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    organizationId?: string | null
    inventoryApiKey?: string | null
    inventoryLocationId?: string | null
    organizationStatus?: string | null
    organizationPlan?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role: string
    organizationId?: string | null
    inventoryApiKey?: string | null
    inventoryLocationId?: string | null
    organizationStatus?: string | null
    organizationPlan?: string | null
  }
}
