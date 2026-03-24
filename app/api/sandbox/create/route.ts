import { Sandbox } from "@e2b/code-interpreter"
import { getSupabaseAdmin } from "@/lib/supabase"
import { decrypt } from "@/lib/crypto"
import { corsResponse, corsOptions } from "@/lib/cors"
import { INTROSPECT_CMD, parseIntrospection } from "@/lib/sandbox-introspect"
import path from "path"

export const maxDuration = 120

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined
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

    const [owner, repo] = project.repo_full_name.split("/")
    const branch = project.default_branch || "main"

    // Create sandbox FIRST, then fetch tarball URL to minimize URL expiry risk
    try {
      sandbox = await Sandbox.create({
        timeoutMs: 60 * 60 * 1000,
      })
    } catch (e) {
      console.error("[sandbox/create] E2B sandbox creation failed:", e)
      return corsResponse({ error: "Failed to create sandbox — check E2B_API_KEY" }, { status: 500 })
    }

    // Resolve GitHub tarball redirect URL (temporary CDN link — fetch AFTER sandbox is ready)
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
        await sandbox.kill()
        return corsResponse(
          { error: `GitHub repo download failed (${tarballRes.status}): check token permissions and repo access` },
          { status: 500 },
        )
      }
      tarballUrl = location
    } catch (dlErr) {
      const msg = dlErr instanceof Error ? dlErr.message : String(dlErr)
      console.error("[sandbox/create] GitHub tarball request failed:", msg)
      await sandbox.kill()
      return corsResponse({ error: `GitHub repo download failed: ${msg}` }, { status: 500 })
    }

    // Download and extract tarball directly inside the sandbox (avoids binary transfer via files API)
    try {
      const extract = await sandbox.commands.run(
        `set -o pipefail && mkdir -p /home/user/app && curl -fsSL --retry 2 --retry-delay 3 "$TARBALL_URL" | tar xz --strip-components=1 -C /home/user/app && echo "EXTRACTED: $(ls /home/user/app/ | head -10 | tr '\\n' ' ')"`,
        { timeoutMs: 120_000, envs: { TARBALL_URL: tarballUrl } },
      )
      if (extract.exitCode !== 0) {
        const detail = (extract.stderr || extract.stdout || "unknown error").trim()
        console.error("[sandbox/create] Repo extract failed:", detail)
        await sandbox.kill()
        return corsResponse({ error: `Repo extract failed: ${detail}` }, { status: 500 })
      }
      console.log("[sandbox/create] Extraction:", extract.stdout?.trim())
    } catch (extractErr: any) {
      const detail = extractErr?.stderr || extractErr?.stdout || ""
      const msg = detail.trim() || (extractErr instanceof Error ? extractErr.message : String(extractErr))
      console.error("[sandbox/create] Repo extract failed:", msg)
      await sandbox.kill()
      return corsResponse({ error: `Repo extract failed: ${msg}` }, { status: 500 })
    }

    // Detect project working directory — find where package.json lives
    // If root has package.json, use root. Otherwise, search immediate subdirectories.
    let appDir = "/home/user/app"
    const findPkgResult = await sandbox.commands.run(
      'find /home/user/app -maxdepth 2 -name package.json -not -path "*/node_modules/*" 2>/dev/null | head -5',
      { timeoutMs: 5_000 },
    )
    const pkgCandidates = (findPkgResult.stdout || "").trim().split("\n").filter(Boolean)
    const hasRootPkg = pkgCandidates.some(p => p === "/home/user/app/package.json")

    if (!hasRootPkg) {
      if (pkgCandidates.length > 0) {
        // Use the shallowest package.json found; prefer directories with frontend indicators
        const sorted = pkgCandidates
          .map(p => path.dirname(p))
          .sort((a, b) => {
            // Prefer dirs whose name suggests a frontend app
            const frontendNames = ["client", "frontend", "web", "app", "site"]
            const aIsFrontend = frontendNames.some(n => a.endsWith(`/${n}`)) ? 0 : 1
            const bIsFrontend = frontendNames.some(n => b.endsWith(`/${n}`)) ? 0 : 1
            if (aIsFrontend !== bIsFrontend) return aIsFrontend - bIsFrontend
            // Otherwise prefer shallowest
            return a.split("/").length - b.split("/").length
          })
        appDir = sorted[0]
        console.log(`[sandbox/create] No root package.json, using subdirectory: ${appDir}`)
      } else {
        console.error("[sandbox/create] No package.json found anywhere in repo")
        let dirListing = ""
        try {
          const lsResult = await sandbox.commands.run("ls -la /home/user/app/ 2>&1 | head -20", { timeoutMs: 5_000 })
          dirListing = lsResult.stdout
        } catch { /* best effort */ }
        if (dirListing) console.error("[sandbox/create] Dir contents:", dirListing)
        await sandbox.kill()
        return corsResponse(
          { error: "No package.json found in repository. Check that your project has a package.json." },
          { status: 500 },
        )
      }
    }

    // Introspect the extracted repo to validate and detect project type
    const introspectResult = await sandbox.commands.run(INTROSPECT_CMD, { timeoutMs: 10_000 })
    if (introspectResult.exitCode !== 0) {
      console.error("[sandbox/create] Introspect command failed:", introspectResult.stderr)
    }
    const projectInfo = parseIntrospection(introspectResult.stdout)

    // Init a git repo so the submit route can use git diff to detect changes
    try {
      await sandbox.commands.run(
        `cd ${appDir} && git config --global user.email "sandbox@tweaky.dev" && git config --global user.name "Tweaky Sandbox" && git init && git add -A && git commit -m "initial"`,
        { timeoutMs: 60_000 },
      )
    } catch {
      // Non-fatal — submit route will still work via file reads
    }

    // Write .env file (if the project has env vars)
    if (envString) {
      const envPath = path.resolve(appDir, project.env_file_path ?? ".env")
      if (!envPath.startsWith("/home/user/app/")) {
        await sandbox.kill()
        return corsResponse({ error: "Invalid env file path" }, { status: 400 })
      }
      await sandbox.files.write(envPath, envString)
    }

    // Install dependencies
    try {
      const installCmd = project.install_command || "npm install"
      const installResult = await sandbox.commands.run(`cd ${appDir} && ${installCmd}`, { timeoutMs: 120_000 })
      if (installResult.exitCode !== 0) {
        const stderr = installResult.stderr || ""
        // Try to read the full npm debug log if referenced in stderr
        let fullLog = ""
        const logMatch = stderr.match(/\/home\/user\/\.npm\/_logs\/[^\s]+\.log/)
        if (logMatch) {
          try {
            const logResult = await sandbox.commands.run(`cat ${logMatch[0]}`, { timeoutMs: 5_000 })
            if (logResult.exitCode === 0) fullLog = logResult.stdout
          } catch { /* best effort */ }
        }
        // Also list what's actually in the app dir for diagnosis
        let dirListing = ""
        try {
          const lsResult = await sandbox.commands.run(`ls -la ${appDir}/ 2>&1 | head -20`, { timeoutMs: 5_000 })
          dirListing = lsResult.stdout
        } catch { /* best effort */ }
        console.error("[sandbox/create] Install failed:", stderr)
        if (fullLog) console.error("[sandbox/create] Full npm log:", fullLog)
        if (dirListing) console.error(`[sandbox/create] ${appDir} contents:`, dirListing)
        await sandbox.kill()
        const diagnostic = fullLog || stderr
        return corsResponse({ error: `Install failed: ${diagnostic.slice(-1500)}` }, { status: 500 })
      }
    } catch (installErr: any) {
      const detail = installErr?.stderr || installErr?.stdout || ""
      const msg = detail.trim() || (installErr instanceof Error ? installErr.message : String(installErr))
      console.error("[sandbox/create] Install failed:", msg)
      await sandbox.kill()
      return corsResponse({ error: `Install failed: ${msg.slice(-500)}` }, { status: 500 })
    }

    // Start dev server in background and wait for it to be ready
    const port = project.dev_port ?? 3000
    const devCmd = project.dev_command || "npm run dev"
    sandbox.commands.run(`cd ${appDir} && ${devCmd}`, { background: true })

    // Poll until the server responds (up to 15s, exits early on success)
    try {
      await sandbox.commands.run(
        `for i in $(seq 1 15); do curl -sf -o /dev/null http://localhost:${port} 2>/dev/null && exit 0; sleep 1; done; exit 1`,
        { timeoutMs: 20_000 },
      )
    } catch {
      // Non-fatal — server may need the first real request to finish starting
    }

    const previewHost = sandbox.getHost(port)
    const previewUrl = `https://${previewHost}`

    return corsResponse({
      sandboxId: sandbox.sandboxId,
      previewUrl,
      projectInfo,
      appDir,
    })
  } catch (error) {
    console.error("[sandbox/create] Error:", error)
    if (sandbox) {
      try { await sandbox.kill() } catch { /* best effort */ }
    }
    return corsResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
