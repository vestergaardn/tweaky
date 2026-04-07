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

  const { data: project } = await getSupabaseAdmin()
    .from("projects")
    .select("id, name, dev_port, widget_launch_type, widget_button_color, widget_button_text, widget_icon_only, widget_logo_url, widget_welcome_message")
    .eq("script_tag_id", scriptTagId)
    .single()

  if (!project) return corsResponse({ error: "Not found" }, { status: 404 })
  return corsResponse(project)
}
