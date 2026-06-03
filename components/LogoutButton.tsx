import { signOut } from "@/auth"

export default function LogoutButton() {
  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <form action={handleSignOut}>
      <button
        type="submit"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors min-h-[48px] px-2"
      >
        Sign out
      </button>
    </form>
  )
}
