import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { redirect } from "next/navigation"
import { NewProjectForm } from "./form"

export default function NewProject() {
  async function createProject(formData: FormData) {
    "use server"
    const session = await auth()
    if (!session) redirect("/")

    const repoUrl = formData.get("repo_url") as string
    const repoFullName = repoUrl.replace("https://github.com/", "").replace(/\/$/, "")

    const { data } = await getSupabaseAdmin()
      .from("projects")
      .insert({
        company_id: session.user.companyId,
        name: formData.get("name") as string,
        repo_url: repoUrl,
        repo_full_name: repoFullName,
        default_branch: (formData.get("default_branch") as string) || "main",
        install_command: (formData.get("install_command") as string) || "npm install",
        dev_command: (formData.get("dev_command") as string) || "npm run dev",
        dev_port: parseInt((formData.get("dev_port") as string) || "3000"),
      })
      .select()
      .single()

    if (data) redirect(`/dashboard/projects/${data.id}`)
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">New Project</h1>
      <NewProjectForm action={createProject} />
    </div>
  )
}
