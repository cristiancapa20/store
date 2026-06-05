"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/sell",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const cause = (error.cause as { err?: Error } | undefined)?.err
      if (cause?.message === "ACCOUNT_SUSPENDED") {
        return { error: "Tu cuenta está suspendida. Contacta a soporte." }
      }
      if (cause?.message === "ACCOUNT_NOT_CONFIGURED") {
        return { error: "Cuenta no configurada. Contacta a soporte." }
      }
      return { error: "Credenciales inválidas. Inténtalo de nuevo." }
    }
    throw error
  }
  return null
}
