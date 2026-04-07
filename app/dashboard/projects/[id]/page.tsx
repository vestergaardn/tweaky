import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { encrypt, decrypt } from "@/lib/crypto"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { CopyButton } from "./copy-button"
import { EnvVarsForm } from "./env-vars-form"
import { WidgetCustomizationForm } from "./widget-customization-form"

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

  const { data: envVarRows } = await supabase
    .from("project_env_vars")
    .select("id, key")
    .eq("project_id", id)
    .order("created_at")

  const { data: company } = await supabase
    .from("companies")
    .select("vercel_token")
    .eq("id", companyId)
    .single()
  const vercelConnected = !!company?.vercel_token

  const pagePath = `/dashboard/projects/${id}`

  async function verifyOwnership() {
    "use server"
    const s = await auth()
    if (!s?.user?.companyId) redirect("/")
    const { count } = await getSupabaseAdmin()
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("id", id)
      .eq("company_id", s.user.companyId)
    if (!count) redirect("/dashboard")
    return s
  }

  async function addEnvVar(formData: FormData) {
    "use server"
    await verifyOwnership()
    const key = (formData.get("key") as string).trim()
    const value = formData.get("value") as string
    if (!key || !value) return
    await getSupabaseAdmin().from("project_env_vars").upsert(
      { project_id: id, key, value: encrypt(value) },
      { onConflict: "project_id,key" }
    )
    revalidatePath(pagePath)
  }

  async function bulkAddEnvVars(formData: FormData) {
    "use server"
    await verifyOwnership()
    const bulk = formData.get("bulk") as string
    if (!bulk?.trim()) return
    const lines = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
    const rows = lines
      .map((l) => {
        const eqIdx = l.indexOf("=")
        if (eqIdx < 1) return null
        return { key: l.slice(0, eqIdx).trim(), value: l.slice(eqIdx + 1) }
      })
      .filter(Boolean) as { key: string; value: string }[]
    if (rows.length === 0) return
    const db = getSupabaseAdmin()
    for (const row of rows) {
      await db.from("project_env_vars").upsert(
        { project_id: id, key: row.key, value: encrypt(row.value) },
        { onConflict: "project_id,key" }
      )
    }
    revalidatePath(pagePath)
  }

  async function deleteEnvVar(formData: FormData) {
    "use server"
    await verifyOwnership()
    const envVarId = formData.get("id") as string
    await getSupabaseAdmin().from("project_env_vars").delete().eq("id", envVarId).eq("project_id", id)
    revalidatePath(pagePath)
  }

  async function revealEnvVar(formData: FormData): Promise<string> {
    "use server"
    await verifyOwnership()
    const envVarId = formData.get("id") as string
    const { data } = await getSupabaseAdmin()
      .from("project_env_vars")
      .select("value")
      .eq("id", envVarId)
      .eq("project_id", id)
      .single()
    if (!data) return ""
    return decrypt(data.value)
  }

  async function updateWidgetConfig(formData: FormData) {
    "use server"
    await verifyOwnership()
    const launchType = formData.get("widget_launch_type") as string
    const buttonColor = formData.get("widget_button_color") as string
    const buttonText = formData.get("widget_button_text") as string
    const iconOnly = formData.get("widget_icon_only") === "true"
    const welcomeMessage = (formData.get("widget_welcome_message") as string) || null

    await getSupabaseAdmin()
      .from("projects")
      .update({
        widget_launch_type: launchType,
        widget_button_color: buttonColor,
        widget_button_text: buttonText,
        widget_icon_only: iconOnly,
        widget_welcome_message: welcomeMessage?.slice(0, 150) || null,
      })
      .eq("id", id)
    revalidatePath(pagePath)
  }

  async function updateEnvFilePath(formData: FormData) {
    "use server"
    await verifyOwnership()
    const envFilePath = (formData.get("env_file_path") as string)?.trim() || ".env"
    await getSupabaseAdmin()
      .from("projects")
      .update({ env_file_path: envFilePath })
      .eq("id", id)
    revalidatePath(pagePath)
  }

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

      <WidgetCustomizationForm
        projectId={id}
        scriptTagId={project.script_tag_id}
        initialConfig={{
          widget_launch_type: project.widget_launch_type ?? "button",
          widget_button_color: project.widget_button_color ?? "#18181b",
          widget_button_text: project.widget_button_text ?? "✦ Tweak this",
          widget_icon_only: project.widget_icon_only ?? false,
          widget_logo_url: project.widget_logo_url ?? null,
          widget_welcome_message: project.widget_welcome_message ?? null,
        }}
        updateWidgetConfig={updateWidgetConfig}
      />

      <EnvVarsForm
        envVars={envVarRows ?? []}
        envFilePath={project.env_file_path ?? ".env"}
        projectId={id}
        vercelConnected={vercelConnected}
        addEnvVar={addEnvVar}
        bulkAddEnvVars={bulkAddEnvVars}
        deleteEnvVar={deleteEnvVar}
        revealEnvVar={revealEnvVar}
        updateEnvFilePath={updateEnvFilePath}
      />
    </div>
  )
}
