import { Sandbox } from "@e2b/code-interpreter"
import { getSupabaseAdmin } from "@/lib/supabase"
import { decrypt } from "@/lib/crypto"
import { corsResponse, corsOptions } from "@/lib/cors"
import path from "path"

export const maxDuration = 120

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  try {
    const { scriptTagId } = await req.json()

    const supabase = getSupabaseAdmin()

    const { data: project } = await supabase
      .from("projects")
      .select("*, companies(github_token)")
      .eq("script_tag_id", scriptTagId)
      .single()

    if (!project) return corsResponse({ error: "Not found" }, { status: 404 })

    // Fetch and decrypt env vars for this project
    const { data: envVarRows } = await supabase
      .from("project_env_vars")
      .select("key, value")
      .eq("project_id", project.id)

    const envString = (envVarRows ?? [])
      .map((row) => `${row.key}=${decrypt(row.value)}`)
      .join("\n")

    const githubToken = (project.companies as any)?.github_token
    if (!githubToken) {
      return corsResponse({ error: "GitHub token not configured" }, { status: 500 })
    }

    // Step 1: Resolve GitHub tarball redirect URL (temporary CDN link, no auth needed)
    const [owner, repo] = project.repo_full_name.split("/")
    const branch = project.default_branch || "main"
    let tarballUrl: string
    try {
      const tarballRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/tarball/${branch}`,
        { headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json" }, redirect: "manual" },
      )
      const location = tarballRes.headers.get("location")
      if (!location) {
        const body = await tarballRes.text().catch(() => "")
        console.error("[sandbox/create] GitHub tarball request failed:", tarballRes.status, body)
        return corsResponse(
          { error: `GitHub repo download failed (${tarballRes.status}): check token permissions and repo access` },
          { status: 500 },
        )
      }
      tarballUrl = location
    } catch (dlErr) {
      const msg = dlErr instanceof Error ? dlErr.message : String(dlErr)
      console.error("[sandbox/create] GitHub tarball request failed:", msg)
      return corsResponse({ error: `GitHub repo download failed: ${msg}` }, { status: 500 })
    }

    let sandbox: Awaited<ReturnType<typeof Sandbox.create>>
    try {
      sandbox = await Sandbox.create({
        timeoutMs: 60 * 60 * 1000,
      })
    } catch (e) {
      console.error("[sandbox/create] E2B sandbox creation failed:", e)
      return corsResponse({ error: "Failed to create sandbox — check E2B_API_KEY" }, { status: 500 })
    }

    // Download and extract tarball directly inside the sandbox (avoids binary transfer via files API)
    try {
      const extract = await sandbox.commands.run(
        `mkdir -p /home/user/app && curl -fsSL "$TARBALL_URL" | tar xz --strip-components=1 -C /home/user/app`,
        { timeoutMs: 120_000, envs: { TARBALL_URL: tarballUrl } },
      )
      if (extract.exitCode !== 0) {
        const detail = (extract.stderr || extract.stdout || "unknown error").trim()
        console.error("[sandbox/create] Repo extract failed:", detail)
        await sandbox.kill()
        return corsResponse({ error: `Repo extract failed: ${detail}` }, { status: 500 })
      }
    } catch (extractErr: any) {
      const detail = extractErr?.stderr || extractErr?.stdout || ""
      const msg = detail.trim() || (extractErr instanceof Error ? extractErr.message : String(extractErr))
      console.error("[sandbox/create] Repo extract failed:", msg)
      await sandbox.kill()
      return corsResponse({ error: `Repo extract failed: ${msg}` }, { status: 500 })
    }

    // Init a git repo so the submit route can use git diff to detect changes
    try {
      await sandbox.commands.run(
        'cd /home/user/app && git init && git add -A && git commit -m "initial"',
        { timeoutMs: 60_000 },
      )
    } catch {
      // Non-fatal — submit route will still work via file reads
    }

    // Step 2: Write .env file (if the project has env vars)
    if (envString) {
      const envPath = path.resolve("/home/user/app", project.env_file_path ?? ".env")
      if (!envPath.startsWith("/home/user/app/")) {
        await sandbox.kill()
        return corsResponse({ error: "Invalid env file path" }, { status: 400 })
      }
      await sandbox.files.write(envPath, envString)
    }

    // Step 3: Install dependencies
    try {
      const installResult = await sandbox.commands.run(project.install_command || "npm install", { cwd: "/home/user/app", timeoutMs: 120_000 })
      if (installResult.exitCode !== 0) {
        console.error("[sandbox/create] Install failed:", installResult.stderr)
        await sandbox.kill()
        return corsResponse({ error: `Install failed: ${installResult.stderr.slice(-500)}` }, { status: 500 })
      }
    } catch (installErr: any) {
      const detail = installErr?.stderr || installErr?.stdout || ""
      const msg = detail.trim() || (installErr instanceof Error ? installErr.message : String(installErr))
      console.error("[sandbox/create] Install failed:", msg)
      await sandbox.kill()
      return corsResponse({ error: `Install failed: ${msg.slice(-500)}` }, { status: 500 })
    }

    // Step 4: Start dev server in background
    sandbox.commands.run(project.dev_command || "npm run dev", { cwd: "/home/user/app", background: true })
    await new Promise((r) => setTimeout(r, 5000))

    const previewHost = sandbox.getHost(project.dev_port ?? 3000)
    const previewUrl = `https://${previewHost}`

    return corsResponse({
      sandboxId: sandbox.sandboxId,
      previewUrl,
    })
  } catch (error) {
    console.error("[sandbox/create] Error:", error)
    return corsResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
