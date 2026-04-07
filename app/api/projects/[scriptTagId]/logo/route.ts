import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ scriptTagId: string }> }
) {
  const { scriptTagId: id } = await params
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  // Verify ownership
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("id", id)
    .eq("company_id", companyId)
  if (!count) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type. Allowed: PNG, JPEG, SVG, WebP" }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Max 2MB" }, { status: 400 })
  }

  const ext = file.name.split(".").pop() || "png"
  const path = `${id}/logo.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("project-logos")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from("project-logos")
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl

  await supabase
    .from("projects")
    .update({ widget_logo_url: publicUrl })
    .eq("id", id)

  return NextResponse.json({ url: publicUrl })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ scriptTagId: string }> }
) {
  const { scriptTagId: id } = await params
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("id", id)
    .eq("company_id", companyId)
  if (!count) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // List and remove all files in the project's logo folder
  const { data: files } = await supabase.storage
    .from("project-logos")
    .list(id)

  if (files?.length) {
    await supabase.storage
      .from("project-logos")
      .remove(files.map((f) => `${id}/${f.name}`))
  }

  await supabase
    .from("projects")
    .update({ widget_logo_url: null })
    .eq("id", id)

  return NextResponse.json({ ok: true })
}
