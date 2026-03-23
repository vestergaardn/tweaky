import { redirect } from "next/navigation"
import { NewProjectForm } from "./form"

export default function NewProject() {
  async function createProject(formData: FormData) {
    "use server"
    // TODO: restore auth + Supabase insert once env vars are configured
    redirect("/dashboard")
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">New Project</h1>
      <NewProjectForm action={createProject} />
    </div>
  )
}
