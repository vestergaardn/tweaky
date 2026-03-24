import { Sandbox } from "@e2b/code-interpreter"
import { CommandExitError } from "e2b"
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

    // Stage all changes and detect what the user modified
    await sandbox.git.add(appDir, { all: true, timeoutMs: 30_000 })

    let diff: string
    let changedEntries: { status: string; file: string }[]
    try {
      const diffResult = await sandbox.commands.run(`cd ${appDir} && git diff --cached HEAD`, { timeoutMs: 30_000 })
      diff = diffResult.stdout
      const statusResult = await sandbox.commands.run(`cd ${appDir} && git diff --cached --name-status HEAD`, { timeoutMs: 30_000 })
      changedEntries = statusResult.stdout.trim().split("\n").filter(Boolean).map((line) => {
        const [status, ...rest] = line.split("\t")
        return { status: status.charAt(0), file: rest.join("\t") }
      })
    } catch (e) {
      console.error("[sandbox/submit] Failed to get diff:", e)
      return corsResponse({ error: "Failed to detect changes" }, { status: 500 })
    }

    if (changedEntries.length === 0) {
      return corsResponse({ error: "No changes to submit" }, { status: 400 })
    }

    // The sandbox has an unrelated git history (tarball → git init), so diffs can't
    // be applied cleanly onto origin. Instead we copy the changed files directly:
    // 1. Save each changed file's content to /tmp
    // 2. Checkout a branch from origin/main
    // 3. Write the files back, delete removed files
    // 4. Commit and push
    const commitMessage = `[Tweaky] ${prompt}`
    try {
      // Save changed files to /tmp before switching branches (checkout overwrites working tree)
      const tmpDir = "/tmp/tweaky-files"
      await sandbox.commands.run(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}`, { timeoutMs: 5_000 })
      for (const entry of changedEntries) {
        if (entry.status === "D") continue // deleted files — handled after checkout
        // Preserve directory structure under /tmp/tweaky-files
        const dirPart = entry.file.includes("/") ? entry.file.substring(0, entry.file.lastIndexOf("/")) : ""
        if (dirPart) {
          await sandbox.commands.run(`mkdir -p ${tmpDir}/${dirPart}`, { timeoutMs: 5_000 })
        }
        await sandbox.commands.run(`cp "${appDir}/${entry.file}" "${tmpDir}/${entry.file}"`, { timeoutMs: 10_000 })
      }

      // Add GitHub remote with token auth and fetch the default branch
      const remoteUrl = `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`
      await sandbox.git.remoteAdd(appDir, "origin", remoteUrl, {
        overwrite: true,
        timeoutMs: 10_000,
      })

      try {
        await sandbox.commands.run(
          `cd ${appDir} && git fetch origin ${defaultBranch}`,
          { timeoutMs: 60_000 },
        )
      } catch (e) {
        console.error("[sandbox/submit] git fetch failed:", e)
        return corsResponse({ error: "Failed to fetch from GitHub repository" }, { status: 500 })
      }

      // Create a new branch from upstream
      await sandbox.commands.run(
        `cd ${appDir} && git checkout -b ${branchName} origin/${defaultBranch}`,
        { timeoutMs: 10_000 },
      )

      // Copy saved files back and handle deletions
      for (const entry of changedEntries) {
        if (entry.status === "D") {
          await sandbox.commands.run(`cd ${appDir} && rm -f "${entry.file}"`, { timeoutMs: 5_000 })
        } else {
          // Ensure parent directory exists (file may be new in a new directory)
          const dirPart = entry.file.includes("/") ? entry.file.substring(0, entry.file.lastIndexOf("/")) : ""
          if (dirPart) {
            await sandbox.commands.run(`mkdir -p "${appDir}/${dirPart}"`, { timeoutMs: 5_000 })
          }
          await sandbox.commands.run(`cp "${tmpDir}/${entry.file}" "${appDir}/${entry.file}"`, { timeoutMs: 10_000 })
        }
      }

      await sandbox.git.add(appDir, { all: true, timeoutMs: 30_000 })
      await sandbox.git.commit(appDir, commitMessage, {
        authorName: "Tweaky",
        authorEmail: "bot@tweaky.dev",
        timeoutMs: 30_000,
      })

      // Push the branch to GitHub
      try {
        await sandbox.git.push(appDir, {
          remote: "origin",
          branch: branchName,
          username: "x-access-token",
          password: githubToken,
          timeoutMs: 60_000,
        })
      } catch (e) {
        const detail = e instanceof CommandExitError ? e.stderr : (e instanceof Error ? e.message : String(e))
        console.error("[sandbox/submit] git push failed:", detail)
        return corsResponse({ error: "Failed to push changes to GitHub" }, { status: 500 })
      }
    } catch (e) {
      console.error("[sandbox/submit] Git operations failed:", e)
      const msg = e instanceof CommandExitError
        ? `${e.message} | stderr: ${e.stderr}`
        : (e instanceof Error ? e.message : String(e))
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
