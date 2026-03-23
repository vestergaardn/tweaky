import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NewProjectForm } from "./form"

export default function NewProject() {
  async function createProject(formData: FormData) {
    "use server"
    const session = await auth()
    const companyId = session?.user?.companyId
    if (!companyId) redirect("/")

    const name = formData.get("name") as string
    const repoUrl = formData.get("repo_url") as string
    const repoFullName = formData.get("repo_full_name") as string
    const defaultBranch = formData.get("default_branch") as string
    const installCommand = (formData.get("install_command") as string) || "npm install"
    const devCommand = (formData.get("dev_command") as string) || "npm run dev"
    const devPort = parseInt((formData.get("dev_port") as string) || "3000", 10)
    const envFilePath = (formData.get("env_file_path") as string) || ".env"

    const { error } = await getSupabaseAdmin().from("projects").insert({
      company_id: companyId,
      name,
      repo_url: repoUrl,
      repo_full_name: repoFullName,
      default_branch: defaultBranch || "main",
      install_command: installCommand,
      dev_command: devCommand,
      dev_port: devPort,
      env_file_path: envFilePath,
    })

    if (error) {
      console.error("Failed to create project:", error)
      throw new Error("Failed to create project")
    }

    redirect("/dashboard")
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">New Project</h1>
      <NewProjectForm action={createProject} />
    </div>
  )
}
