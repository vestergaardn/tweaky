import { Sandbox } from "@e2b/code-interpreter"
import { getSupabaseAdmin } from "@/lib/supabase"
import { decrypt } from "@/lib/crypto"
import { corsResponse, corsOptions } from "@/lib/cors"
import path from "path"

export const maxDuration = 120

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
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

  const githubToken = (project.companies as any).github_token
  const repoUrl = `https://oauth2:${githubToken}@github.com/${project.repo_full_name}.git`

  const sandbox = await Sandbox.create({
    timeoutMs: 60 * 60 * 1000,
  })

  // Step 1: Clone repo
  await sandbox.commands.run(`git clone ${repoUrl} /app`)

  // Step 2: Write .env file (if the project has env vars)
  if (envString) {
    const envPath = path.resolve("/app", project.env_file_path ?? ".env")
    if (!envPath.startsWith("/app/")) {
      return corsResponse({ error: "Invalid env file path" }, { status: 400 })
    }
    await sandbox.files.write(envPath, envString)
  }

  // Step 3: Install dependencies
  await sandbox.commands.run(project.install_command || "npm install", { cwd: "/app" })

  // Step 4: Start dev server in background
  sandbox.commands.run(project.dev_command || "npm run dev", { cwd: "/app", background: true })
  await new Promise((r) => setTimeout(r, 5000))

  const previewHost = sandbox.getHost(project.dev_port)
  const previewUrl = `https://${previewHost}`

  return corsResponse({
    sandboxId: sandbox.sandboxId,
    previewUrl,
  })
}
