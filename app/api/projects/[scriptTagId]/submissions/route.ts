import { getSupabaseAdmin } from "@/lib/supabase"
import { corsResponse, corsOptions } from "@/lib/cors"

export async function OPTIONS() {
  return corsOptions()
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ scriptTagId: string }> }
) {
  const { scriptTagId } = await params
  const url = new URL(req.url)
  const email = url.searchParams.get("email")

  if (!email) {
    return corsResponse({ error: "email query param is required" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("script_tag_id", scriptTagId)
    .single()

  if (!project) {
    return corsResponse({ error: "Not found" }, { status: 404 })
  }

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, user_prompt, pr_url, pr_number, status, created_at")
    .eq("project_id", project.id)
    .eq("user_email", email)
    .order("created_at", { ascending: false })
    .limit(50)

  return corsResponse(submissions ?? [])
}
