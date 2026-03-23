import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { CopyButton } from "./copy-button"

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) redirect("/")

  const supabase = getSupabaseAdmin()
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single()

  if (!project) redirect("/dashboard")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tweaky.vercel.app"
  const snippet = `<script src="${appUrl}/widget.js" data-project-id="${project.script_tag_id}"></script>`

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700"
      >
        <ArrowLeft size={14} />
        Back to projects
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-sm text-zinc-400 mt-1">{project.repo_full_name}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700">Install snippet</h2>
        <p className="text-sm text-zinc-500">
          Add this script tag to your site. The widget will appear automatically.
        </p>
        <div className="relative">
          <pre className="bg-zinc-900 text-zinc-100 text-sm rounded-lg p-4 pr-14 overflow-x-auto">
            <code>{snippet}</code>
          </pre>
          <CopyButton text={snippet} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-zinc-400 mb-1">Branch</div>
          <div className="font-medium">{project.default_branch}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-zinc-400 mb-1">Dev port</div>
          <div className="font-medium">{project.dev_port}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-zinc-400 mb-1">Install command</div>
          <div className="font-mono font-medium">{project.install_command}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-zinc-400 mb-1">Dev command</div>
          <div className="font-mono font-medium">{project.dev_command}</div>
        </div>
      </div>
    </div>
  )
}
