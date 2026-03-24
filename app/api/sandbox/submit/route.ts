import { Sandbox } from "@e2b/code-interpreter"
import { Octokit } from "@octokit/rest"
import { getSupabaseAdmin } from "@/lib/supabase"
import { corsResponse, corsOptions } from "@/lib/cors"

export const maxDuration = 120

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  let sandbox: Awaited<ReturnType<typeof Sandbox.connect>> | undefined
  try {
    const { sandboxId, scriptTagId, prompt, bountyAmount, userEmail } = await req.json()

    const { data: project } = await getSupabaseAdmin()
      .from("projects")
      .select("*, companies(github_token)")
      .eq("script_tag_id", scriptTagId)
      .single()

    if (!project) return corsResponse({ error: "Not found" }, { status: 404 })

    const githubToken = (project.companies as any).github_token
    if (!githubToken) {
      return corsResponse({ error: "GitHub token not configured" }, { status: 500 })
    }

    // Connect to the sandbox — most common failure point (sandbox expired/killed)
    try {
      sandbox = await Sandbox.connect(sandboxId)
    } catch (e) {
      console.error("[sandbox/submit] Failed to connect to sandbox:", e)
      return corsResponse(
        { error: "Sandbox expired or unavailable. Please reload the page and try again." },
        { status: 410 },
      )
    }

    // Quick health check — verify sandbox is responsive
    try {
      await sandbox.commands.run("echo ok", { timeoutMs: 5_000 })
    } catch (e) {
      console.error("[sandbox/submit] Sandbox health check failed:", e)
      return corsResponse(
        { error: "Sandbox is not responding. Please reload the page and try again." },
        { status: 410 },
      )
    }

    const octokit = new Octokit({ auth: githubToken })
    const [owner, repo] = project.repo_full_name.split("/")
    const branchName = `tweaky/${Date.now()}`

    // Detect app directory (same logic as create route — find where .git was initialized)
    let appDir = "/home/user/app"
    try {
      const gitDirCheck = await sandbox.commands.run(
        'git -C /home/user/app rev-parse --show-toplevel 2>/dev/null || find /home/user/app -maxdepth 2 -name .git -type d | head -1 | xargs dirname 2>/dev/null || echo /home/user/app',
        { timeoutMs: 5_000 },
      )
      appDir = (gitDirCheck.stdout || "").trim() || "/home/user/app"
    } catch { /* fallback to default */ }

    await sandbox.commands.run(`cd ${appDir} && git add -A`, { timeoutMs: 30_000 })

    const diffResult = await sandbox.commands.run(`cd ${appDir} && git diff --cached HEAD`, { timeoutMs: 30_000 })
    const diff = diffResult.stdout

    const statusResult = await sandbox.commands.run(`cd ${appDir} && git diff --cached --name-status HEAD`, { timeoutMs: 30_000 })
    const fileEntries = statusResult.stdout.trim().split("\n").filter(Boolean).map((line: string) => {
      const [status, ...pathParts] = line.split("\t")
      return { status: status.trim(), path: pathParts.join("\t").trim() }
    })
    const changedPaths = fileEntries.map(e => e.path)

    if (changedPaths.length === 0) {
      return corsResponse({ error: "No changes to submit" }, { status: 400 })
    }

    // Fetch base branch ref from GitHub
    let baseSha: string
    let baseTreeSha: string
    try {
      const { data: baseRef } = await octokit.git.getRef({
        owner, repo, ref: `heads/${project.default_branch}`,
      })
      baseSha = baseRef.object.sha

      const { data: baseCommit } = await octokit.git.getCommit({
        owner, repo, commit_sha: baseSha,
      })
      baseTreeSha = baseCommit.tree.sha
    } catch (e: any) {
      const detail = e?.response?.data?.message || e?.message || String(e)
      console.error("[sandbox/submit] GitHub base ref fetch failed:", detail, e)
      return corsResponse(
        { error: `Failed to fetch base branch from GitHub: ${detail}` },
        { status: 500 },
      )
    }

    // Read changed files from sandbox and create GitHub blobs.
    // Files are read sequentially to avoid overwhelming the sandbox connection limit
    // (the dev server's HMR WebSocket already consumes many of the 1000 allowed connections).
    const treeItems: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = []
    try {
      for (const { status, path: filePath } of fileEntries) {
        if (status === "D") {
          treeItems.push({ path: filePath, mode: "100644" as const, type: "blob" as const, sha: null })
          continue
        }

        const content = await sandbox!.files.read(`${appDir}/${filePath}`)
        const { data: blob } = await octokit.git.createBlob({
          owner, repo,
          content: Buffer.from(content).toString("base64"),
          encoding: "base64",
        })
        treeItems.push({ path: filePath, mode: "100644" as const, type: "blob" as const, sha: blob.sha })
      }
    } catch (e) {
      console.error("[sandbox/submit] File read or blob creation failed:", e)
      const msg = e instanceof Error ? e.message : String(e)
      return corsResponse(
        { error: `Failed to read files or create GitHub blobs: ${msg.slice(-300)}` },
        { status: 500 },
      )
    }

    // Create tree, commit, branch, and PR on GitHub
    try {
      const { data: newTree } = await octokit.git.createTree({
        owner, repo, base_tree: baseTreeSha, tree: treeItems,
      })

      const { data: newCommit } = await octokit.git.createCommit({
        owner, repo,
        message: `[Tweaky] ${prompt}`,
        tree: newTree.sha,
        parents: [baseSha],
      })

      await octokit.git.createRef({
        owner, repo, ref: `refs/heads/${branchName}`, sha: newCommit.sha,
      })

      const { data: pr } = await octokit.pulls.create({
        owner, repo,
        title: `[Tweaky] ${prompt}`,
        head: branchName,
        base: project.default_branch,
        body: `## Tweaky Submission

**Request:** ${prompt}
**Submitted by:** ${userEmail}
**Requested bounty:** ${bountyAmount} points

---

### Diff

\`\`\`diff
${diff}
\`\`\`

---
*Generated by [Tweaky](https://tweaky.dev)*`,
      })

      await getSupabaseAdmin().from("submissions").insert({
        project_id: project.id,
        user_prompt: prompt,
        user_email: userEmail,
        bounty_amount: bountyAmount,
        pr_url: pr.html_url,
        pr_number: pr.number,
        status: "pending",
      })

      await sandbox.kill()

      return corsResponse({ prUrl: pr.html_url })
    } catch (e) {
      console.error("[sandbox/submit] GitHub PR creation failed:", e)
      const msg = e instanceof Error ? e.message : String(e)
      return corsResponse(
        { error: `Failed to create PR on GitHub: ${msg.slice(-300)}` },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("[sandbox/submit] Error:", error)
    if (sandbox) {
      try { await sandbox.kill() } catch { /* best effort */ }
    }
    return corsResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
