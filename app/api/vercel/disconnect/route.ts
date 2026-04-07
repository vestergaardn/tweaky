import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function POST() {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await getSupabaseAdmin()
    .from("companies")
    .update({ vercel_token: null, vercel_team_id: null })
    .eq("id", companyId)

  return NextResponse.json({ ok: true })
}
