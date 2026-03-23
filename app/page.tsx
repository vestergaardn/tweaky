import { auth, signIn } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <form
        action={async () => {
          "use server"
          await signIn("github")
        }}
      >
        <button
          type="submit"
          className="bg-zinc-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-zinc-800 transition-colors"
        >
          Sign in with GitHub
        </button>
      </form>
    </div>
  )
}
