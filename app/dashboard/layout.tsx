import Link from "next/link"
import { LogOut } from "lucide-react"
import { signOut } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <Link href="/dashboard" className="text-zinc-900 font-bold text-lg">
          Tweaky
        </Link>
        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/" })
          }}
        >
          <button type="submit" className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-md hover:bg-zinc-100">
            <LogOut size={16} />
          </button>
        </form>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
