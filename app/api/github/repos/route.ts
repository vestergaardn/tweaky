import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function GET() {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) {
    return NextResponse.json([], { status: 401 })
  }

  const { data: company, error } = await getSupabaseAdmin()
    .from("companies")
    .select("github_token")
    .eq("id", companyId)
    .single()

  if (error || !company?.github_token) {
    console.error("Failed to get GitHub token:", error)
    return NextResponse.json([], { status: 500 })
  }

  const repos: any[] = []
  let page = 1
  while (page <= 5) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&sort=updated&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${company.github_token}`,
          Accept: "application/vnd.github+json",
        },
      },
    )
    if (!res.ok) {
      console.error("GitHub API error:", res.status, await res.text())
      break
    }
    const batch = await res.json()
    if (batch.length === 0) break
    repos.push(...batch)
    if (batch.length < 100) break
    page++
  }

  const result = repos.map((r: any) => ({
    full_name: r.full_name,
    name: r.name,
    html_url: r.html_url,
    default_branch: r.default_branch,
    private: r.private,
  }))

  return NextResponse.json(result)
}
