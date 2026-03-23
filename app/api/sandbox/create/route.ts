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
      return corsResponse({ error: "GitHub token not configured for this project" }, { status: 500 })
    }
    const repoUrl = `https://oauth2:${githubToken}@github.com/${project.repo_full_name}.git`

    let sandbox: Awaited<ReturnType<typeof Sandbox.create>>
    try {
      sandbox = await Sandbox.create({
        timeoutMs: 60 * 60 * 1000,
      })
    } catch (e) {
      console.error("[sandbox/create] E2B sandbox creation failed:", e)
      return corsResponse({ error: "Failed to create sandbox — check E2B_API_KEY" }, { status: 500 })
    }

    // Step 1: Clone repo
    const cloneResult = await sandbox.commands.run(`git clone ${repoUrl} /app`)
    if (cloneResult.exitCode !== 0) {
      await sandbox.kill()
      return corsResponse({ error: `Git clone failed: ${cloneResult.stderr.replace(/oauth2:[^@]+@/, "oauth2:***@")}` }, { status: 500 })
    }

    // Step 2: Write .env file (if the project has env vars)
    if (envString) {
      const envPath = path.resolve("/app", project.env_file_path ?? ".env")
      if (!envPath.startsWith("/app/")) {
        await sandbox.kill()
        return corsResponse({ error: "Invalid env file path" }, { status: 400 })
      }
      await sandbox.files.write(envPath, envString)
    }

    // Step 3: Install dependencies
    const installResult = await sandbox.commands.run(project.install_command || "npm install", { cwd: "/app" })
    if (installResult.exitCode !== 0) {
      await sandbox.kill()
      return corsResponse({ error: `Install failed: ${installResult.stderr.slice(-500)}` }, { status: 500 })
    }

    // Step 4: Start dev server in background
    sandbox.commands.run(project.dev_command || "npm run dev", { cwd: "/app", background: true })
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
