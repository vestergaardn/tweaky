import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase"
import { Octokit } from "@octokit/rest"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: company } = await getSupabaseAdmin()
    .from("companies")
    .select("github_token")
    .eq("id", session.user.companyId)
    .single()

  if (!company?.github_token) {
    return NextResponse.json({ error: "No GitHub token found" }, { status: 400 })
  }

  const octokit = new Octokit({ auth: company.github_token })

  const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    sort: "updated",
    per_page: 100,
    visibility: "all",
  })

  return NextResponse.json(
    repos.map((r) => ({
      full_name: r.full_name,
      name: r.name,
      html_url: r.html_url,
      default_branch: r.default_branch,
      private: r.private,
    }))
  )
}
