import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function GET() {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) {
    return NextResponse.json([], { status: 401 })
  }

  const { data: company } = await getSupabaseAdmin()
    .from("companies")
    .select("vercel_token, vercel_team_id")
    .eq("id", companyId)
    .single()

  if (!company?.vercel_token) {
    return NextResponse.json([], { status: 401 })
  }

  const url = new URL("https://api.vercel.com/v9/projects")
  url.searchParams.set("limit", "100")
  if (company.vercel_team_id) {
    url.searchParams.set("teamId", company.vercel_team_id)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${company.vercel_token}` },
  })

  if (!res.ok) {
    console.error("Vercel projects API error:", res.status)
    return NextResponse.json([], { status: 502 })
  }

  const data = await res.json()
  const projects = (data.projects || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    framework: p.framework,
  }))

  return NextResponse.json(projects)
}
