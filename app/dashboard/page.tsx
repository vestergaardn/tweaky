import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, FolderGit2, FolderPlus } from "lucide-react"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"

export default async function Dashboard() {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) redirect("/")

  const { data: projects } = await getSupabaseAdmin()
    .from("projects")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (!projects) redirect("/")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 active:scale-[0.98]"
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderPlus size={40} className="text-zinc-300 mb-3" strokeWidth={1.5} />
          <p className="text-zinc-500 font-medium">No projects yet</p>
          <p className="text-zinc-400 text-sm mt-1">Create one to get started.</p>
          <Link
            href="/dashboard/projects/new"
            className="mt-4 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium active:scale-[0.98]"
          >
            Create Project
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/projects/${p.id}`}
            className="flex items-center gap-4 bg-white border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-zinc-400 transition-all duration-200"
          >
            <FolderGit2 size={20} className="text-zinc-300 shrink-0" strokeWidth={1.5} />
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-zinc-400 mt-0.5">{p.repo_full_name}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
