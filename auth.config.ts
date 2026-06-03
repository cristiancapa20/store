import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname === "/login"
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth")

      if (isApiAuth) return true
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/sell", nextUrl))
      }
      if (!isLoggedIn && !isLoginPage) {
        return false
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = (token.id ?? token.sub) as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  providers: [],
}
