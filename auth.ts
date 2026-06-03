import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import db from "@/lib/db"
import { authConfig } from "@/auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(credentials.email as string) as
          | {
              id: string
              name: string
              email: string
              password_hash: string
              role: string
            }
          | undefined

        if (!user) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        )
        if (!passwordMatch) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
})
