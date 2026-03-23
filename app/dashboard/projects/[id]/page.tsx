import { getSupabaseAdmin } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import type { Session } from "next-auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { encrypt, decrypt } from "@/lib/crypto"
import { EnvVarsForm } from "./env-vars-form"

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const supabase = getSupabaseAdmin()

  const { data: project } = await supabase
    .from("projects")
    .select("*, submissions(*)")
    .eq("id", id)
    .eq("company_id", session!.user.companyId)
    .single()

  if (!project) redirect("/dashboard")

  const { data: envVars } = await supabase
    .from("project_env_vars")
    .select("id, key")
    .eq("project_id", id)
    .order("created_at")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const scriptTag = `<script src="${appUrl}/widget.js" data-project-id="${project.script_tag_id}"></script>`

  async function verifyOwnership(s: Session) {
    const { data } = await getSupabaseAdmin()
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("company_id", s.user.companyId)
      .single()
    return !!data
  }

  async function addEnvVar(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) redirect("/")
    if (!(await verifyOwnership(s))) return
    const key = (formData.get("key") as string).trim()
    const value = formData.get("value") as string
    if (!key || !value) return

    await getSupabaseAdmin()
      .from("project_env_vars")
      .upsert({ project_id: id, key, value: encrypt(value) }, { onConflict: "project_id,key" })

    revalidatePath(`/dashboard/projects/${id}`)
  }

  async function bulkAddEnvVars(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) redirect("/")
    if (!(await verifyOwnership(s))) return
    const bulk = formData.get("bulk") as string
    if (!bulk) return

    const rows = bulk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const eqIndex = line.indexOf("=")
        if (eqIndex === -1) return null
        const key = line.slice(0, eqIndex).trim()
        const value = line.slice(eqIndex + 1).trim()
        if (!key) return null
        return { project_id: id, key, value: encrypt(value) }
      })
      .filter(Boolean) as { project_id: string; key: string; value: string }[]

    if (rows.length === 0) return

    await getSupabaseAdmin()
      .from("project_env_vars")
      .upsert(rows, { onConflict: "project_id,key" })

    revalidatePath(`/dashboard/projects/${id}`)
  }

  async function deleteEnvVar(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) redirect("/")
    if (!(await verifyOwnership(s))) return
    await getSupabaseAdmin()
      .from("project_env_vars")
      .delete()
      .eq("id", formData.get("id") as string)
      .eq("project_id", id)

    revalidatePath(`/dashboard/projects/${id}`)
  }

  async function revealEnvVar(formData: FormData): Promise<string> {
    "use server"
    const s = await auth()
    if (!s) redirect("/")
    if (!(await verifyOwnership(s))) return ""
    const { data } = await getSupabaseAdmin()
      .from("project_env_vars")
      .select("value")
      .eq("id", formData.get("id") as string)
      .eq("project_id", id)
      .single()

    if (!data) return ""
    return decrypt(data.value)
  }

  async function updateEnvFilePath(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) redirect("/")
    if (!(await verifyOwnership(s))) return
    const envFilePath = (formData.get("env_file_path") as string).trim() || ".env"
    await getSupabaseAdmin()
      .from("projects")
      .update({ env_file_path: envFilePath })
      .eq("id", id)
      .eq("company_id", s.user.companyId)

    revalidatePath(`/dashboard/projects/${id}`)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-zinc-400 text-sm mt-1">{project.repo_full_name}</p>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Add to your site</h2>
        <p className="text-sm text-zinc-500">Paste this before the closing &lt;/body&gt; tag:</p>
        <pre className="bg-zinc-900 text-zinc-100 text-sm p-4 rounded-xl overflow-x-auto">
          {scriptTag}
        </pre>
      </div>

      <EnvVarsForm
        envVars={envVars ?? []}
        envFilePath={project.env_file_path ?? ".env"}
        addEnvVar={addEnvVar}
        bulkAddEnvVars={bulkAddEnvVars}
        deleteEnvVar={deleteEnvVar}
        revealEnvVar={revealEnvVar}
        updateEnvFilePath={updateEnvFilePath}
      />

      <div className="space-y-3">
        <h2 className="font-semibold">Submissions</h2>
        {project.submissions?.length === 0 && (
          <p className="text-sm text-zinc-400">No submissions yet.</p>
        )}
        {project.submissions?.map((s: any) => (
          <div key={s.id} className="border rounded-xl p-4 space-y-1">
            <div className="text-sm font-medium">{s.user_prompt}</div>
            <div className="text-xs text-zinc-400">
              {s.user_email} · {s.bounty_amount} points · {s.status}
            </div>
            {s.pr_url && (
              <a href={s.pr_url} target="_blank" className="text-xs text-blue-600 hover:underline">
                View PR &rarr;
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
