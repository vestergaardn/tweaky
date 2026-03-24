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

    const [owner, repo] = project.repo_full_name.split("/")
    const branchName = `tweaky/${Date.now()}`
    const defaultBranch = project.default_branch || "main"

    // Detect app directory (same logic as create route — find where .git was initialized)
    let appDir = "/home/user/app"
    try {
      const gitDirCheck = await sandbox.commands.run(
        'git -C /home/user/app rev-parse --show-toplevel 2>/dev/null || find /home/user/app -maxdepth 2 -name .git -type d | head -1 | xargs dirname 2>/dev/null || echo /home/user/app',
        { timeoutMs: 5_000 },
      )
      appDir = (gitDirCheck.stdout || "").trim() || "/home/user/app"
    } catch { /* fallback to default */ }

    // Stage all changes and capture the diff before modifying git state
    await sandbox.commands.run(`cd ${appDir} && git add -A`, { timeoutMs: 30_000 })

    const diffResult = await sandbox.commands.run(`cd ${appDir} && git diff --cached HEAD`, { timeoutMs: 30_000 })
    const diff = diffResult.stdout

    const statusResult = await sandbox.commands.run(`cd ${appDir} && git diff --cached --name-status HEAD`, { timeoutMs: 30_000 })
    const changedFiles = statusResult.stdout.trim().split("\n").filter(Boolean)

    if (changedFiles.length === 0) {
      return corsResponse({ error: "No changes to submit" }, { status: 400 })
    }

    // Push changes to GitHub via git protocol instead of REST API.
    // This avoids the blob/tree/commit/ref API calls that consume rate limits.
    // The only REST API call needed is PR creation (1 call instead of 5+N).
    try {
      // Commit the user's changes locally
      await sandbox.git.commit(appDir, `[Tweaky] ${prompt}`)

      // Save the diff to a file for fallback conflict resolution
      await sandbox.files.write(`${appDir}/.tweaky-diff.patch`, diff)

      // Add GitHub remote with token auth and fetch the default branch
      const remoteUrl = `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`
      await sandbox.git.remoteAdd(appDir, "origin", remoteUrl)
      const fetchResult = await sandbox.commands.run(
        `cd ${appDir} && git fetch origin ${defaultBranch}`,
        { timeoutMs: 60_000 },
      )
      if (fetchResult.exitCode !== 0) {
        console.error("[sandbox/submit] git fetch failed:", fetchResult.stderr)
        return corsResponse({ error: "Failed to fetch from GitHub repository" }, { status: 500 })
      }

      // Rebase our commit(s) on top of the remote default branch so history is clean
      const rebaseResult = await sandbox.commands.run(
        `cd ${appDir} && git rebase origin/${defaultBranch}`,
        { timeoutMs: 60_000 },
      )
      if (rebaseResult.exitCode !== 0) {
        // Rebase failed (conflicts) — abort and apply diff on a fresh branch instead
        await sandbox.commands.run(`cd ${appDir} && git rebase --abort`, { timeoutMs: 10_000 })
        await sandbox.commands.run(
          `cd ${appDir} && git checkout -b ${branchName} origin/${defaultBranch}`,
          { timeoutMs: 10_000 },
        )
        const applyResult = await sandbox.commands.run(
          `cd ${appDir} && git apply --index --3way .tweaky-diff.patch`,
          { timeoutMs: 30_000 },
        )
        if (applyResult.exitCode !== 0) {
          console.error("[sandbox/submit] git apply failed:", applyResult.stderr)
          return corsResponse(
            { error: "Changes conflict with the latest version of the codebase. Please try again." },
            { status: 409 },
          )
        }
        await sandbox.git.commit(appDir, `[Tweaky] ${prompt}`)
      } else {
        // Rebase succeeded — create the branch name at HEAD
        await sandbox.commands.run(
          `cd ${appDir} && git checkout -b ${branchName}`,
          { timeoutMs: 10_000 },
        )
      }

      // Push the branch to GitHub via git protocol (no REST API rate limit impact)
      const pushResult = await sandbox.git.push(appDir, {
        remote: "origin",
        branch: branchName,
        username: "x-access-token",
        password: githubToken,
        timeoutMs: 60_000,
      })
      if (pushResult.exitCode !== 0) {
        console.error("[sandbox/submit] git push failed:", pushResult.stderr)
        return corsResponse({ error: "Failed to push changes to GitHub" }, { status: 500 })
      }
    } catch (e) {
      console.error("[sandbox/submit] Git operations failed:", e)
      const msg = e instanceof Error ? e.message : String(e)
      return corsResponse({ error: `Failed to push changes: ${msg}` }, { status: 500 })
    }

    // Create the PR — this is the only GitHub REST API call needed
    try {
      const octokit = new Octokit({ auth: githubToken })
      const { data: pr } = await octokit.pulls.create({
        owner, repo,
        title: `[Tweaky] ${prompt}`,
        head: branchName,
        base: defaultBranch,
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
