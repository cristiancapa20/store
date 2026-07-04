import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const role = (auth?.user as { role?: string } | undefined)?.role
      const pathname = nextUrl.pathname

      // Public routes — allow always
      if (
        pathname === "/" ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/api/auth")
      ) {
        // Redirect logged-in users away from public pages
        if (isLoggedIn) {
          const dest = role === "super_admin" ? "/superadmin" : "/sell"
          return Response.redirect(new URL(dest, nextUrl))
        }
        return true
      }

      // Login page
      if (pathname === "/login") {
        if (isLoggedIn) {
          const dest = role === "super_admin" ? "/superadmin" : "/sell"
          return Response.redirect(new URL(dest, nextUrl))
        }
        return true
      }

      // Not logged in — redirect to login
      if (!isLoggedIn) return false

      // super_admin: scoped to /superadmin only
      if (role === "super_admin") {
        if (!pathname.startsWith("/superadmin")) {
          return Response.redirect(new URL("/superadmin", nextUrl))
        }
        return true
      }

      // admin/staff: blocked from /superadmin
      if (pathname.startsWith("/superadmin")) {
        return Response.redirect(new URL("/sell", nextUrl))
      }

      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
        token.organizationId = (user as { organizationId?: string | null }).organizationId
        token.organizationName = (user as { organizationName?: string | null }).organizationName
        token.inventoryApiKey = (user as { inventoryApiKey?: string | null }).inventoryApiKey
        token.inventoryLocationId = (user as { inventoryLocationId?: string | null }).inventoryLocationId
        token.organizationStatus = (user as { organizationStatus?: string | null }).organizationStatus
        token.organizationPlan = (user as { organizationPlan?: string | null }).organizationPlan
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = (token.id ?? token.sub) as string
        session.user.role = token.role as string
        session.user.organizationId = token.organizationId as string | null | undefined
        session.user.organizationName = token.organizationName as string | null | undefined
        session.user.inventoryApiKey = token.inventoryApiKey as string | null | undefined
        session.user.inventoryLocationId = token.inventoryLocationId as string | null | undefined
        session.user.organizationStatus = token.organizationStatus as string | null | undefined
        session.user.organizationPlan = token.organizationPlan as string | null | undefined
      }
      return session
    },
  },
  providers: [],
}
