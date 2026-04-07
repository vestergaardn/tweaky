import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { encrypt } from "@/lib/crypto"

export async function POST(req: NextRequest) {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { vercelProjectId, projectId, environment } = await req.json()
  if (!vercelProjectId || !projectId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Verify the Tweaky project belongs to this company
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("id", projectId)
    .eq("company_id", companyId)
  if (!count) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  // Get Vercel token
  const { data: company } = await supabase
    .from("companies")
    .select("vercel_token, vercel_team_id")
    .eq("id", companyId)
    .single()

  if (!company?.vercel_token) {
    return NextResponse.json({ error: "Vercel not connected" }, { status: 400 })
  }

  // Fetch env vars from Vercel
  const url = new URL(
    `https://api.vercel.com/v9/projects/${vercelProjectId}/env`
  )
  url.searchParams.set("decrypt", "true")
  if (company.vercel_team_id) {
    url.searchParams.set("teamId", company.vercel_team_id)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${company.vercel_token}` },
  })

  if (!res.ok) {
    console.error("Vercel env API error:", res.status)
    return NextResponse.json({ error: "Failed to fetch Vercel env vars" }, { status: 502 })
  }

  const data = await res.json()
  const envVars: { key: string; value: string; type: string; target: string[] }[] =
    data.envs || []

  // Filter by environment if specified
  const filtered = environment
    ? envVars.filter((e) => e.target?.includes(environment))
    : envVars

  let imported = 0
  let skipped = 0
  const skippedKeys: string[] = []

  for (const env of filtered) {
    // Secret/sensitive types return empty values from Vercel API
    if (!env.value) {
      skipped++
      skippedKeys.push(env.key)
      continue
    }

    await supabase.from("project_env_vars").upsert(
      { project_id: projectId, key: env.key, value: encrypt(env.value) },
      { onConflict: "project_id,key" }
    )
    imported++
  }

  return NextResponse.json({ imported, skipped, skippedKeys })
}
