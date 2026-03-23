# Lingua Code — Implementation Plan Updates
## Changes required to support full MERN stack sandboxes

---

## Context

The existing implementation plan was written assuming the sandboxed app is a simple Vite + React frontend with a single `npm run dev` command. To support the Airbnb clone demo (and any future full-stack app), three things need to change:

1. The sandbox create endpoint needs to start two processes and write two `.env` files
2. The prompt endpoint needs to read from both `client/src/` and `api/` directories
3. The LLM system prompt needs to describe a full-stack codebase

These are targeted changes to **Phase 4.2** and **Phase 4.3** only. Everything else in the existing plan stays the same.

---

## New Environment Variables

Add these to `.env.local` alongside the existing ones. These are the shared demo credentials injected into every sandbox session.

```bash
# Demo app credentials — injected into sandbox at runtime
DEMO_MONGODB_URL=mongodb+srv://...
DEMO_JWT_SECRET=some_long_random_string
DEMO_SESSION_SECRET=another_long_random_string
DEMO_CLOUDINARY_NAME=
DEMO_CLOUDINARY_API_KEY=
DEMO_CLOUDINARY_API_SECRET=
```

---

## Phase 4.2 — Replace `app/api/sandbox/create/route.ts`

Replace the entire file with the following. Key differences from the original:

- Gets E2B host URLs for **both port 4000 and port 5173** before writing any files
- Writes **two `.env` files** — one for the API, one for the client — with the correct URLs injected
- Runs **`yarn install` in parallel** in both `api/` and `client/` directories
- Starts the **API process first**, waits 3 seconds for MongoDB to connect, then starts the client
- Patches `vite.config.js` to allow E2B preview hosts (same as before)
- Returns the **client URL** (port 5173) as the preview URL

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export const maxDuration = 120

export async function POST(req: Request) {
  const { scriptTagId } = await req.json()

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*, companies(github_token)")
    .eq("script_tag_id", scriptTagId)
    .single()

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const githubToken = (project.companies as any).github_token
  const repoUrl = `https://oauth2:${githubToken}@github.com/${project.repo_full_name}.git`

  const sandbox = await Sandbox.create({
    timeoutMs: 60 * 60 * 1000,
  })

  // Step 1: Clone repo
  await sandbox.commands.run(`git clone ${repoUrl} /app`)

  // Step 2: Get both host URLs upfront — needed before writing .env files
  const apiHost = sandbox.getHost(4000)
  const clientHost = sandbox.getHost(project.dev_port)
  const apiUrl = `https://${apiHost}`
  const clientUrl = `https://${clientHost}`

  // Step 3: Write API .env
  const apiEnv = [
    `PORT=4000`,
    `DB_URL=${process.env.DEMO_MONGODB_URL}`,
    `JWT_SECRET=${process.env.DEMO_JWT_SECRET}`,
    `JWT_EXPIRY=20d`,
    `COOKIE_TIME=7`,
    `SESSION_SECRET=${process.env.DEMO_SESSION_SECRET}`,
    `CLOUDINARY_NAME=${process.env.DEMO_CLOUDINARY_NAME}`,
    `CLOUDINARY_API_KEY=${process.env.DEMO_CLOUDINARY_API_KEY}`,
    `CLOUDINARY_API_SECRET=${process.env.DEMO_CLOUDINARY_API_SECRET}`,
    `CLIENT_URL=${clientUrl}`,
  ].join("\n")

  await sandbox.files.write("/app/api/.env", apiEnv)

  // Step 4: Write client .env
  const clientEnv = [
    `VITE_BASE_URL=${apiUrl}`,
    `VITE_GOOGLE_CLIENT_ID=`,
  ].join("\n")

  await sandbox.files.write("/app/client/.env", clientEnv)

  // Step 5: Install dependencies in parallel
  await Promise.all([
    sandbox.commands.run("yarn install", { cwd: "/app/api" }),
    sandbox.commands.run("yarn install", { cwd: "/app/client" }),
  ])

  // Step 6: Start API in background, wait for MongoDB to connect
  sandbox.commands.run("yarn start", { cwd: "/app/api", background: true })
  await new Promise((r) => setTimeout(r, 3000))

  // Step 7: Patch vite.config.js to allow E2B preview hosts
  const viteConfig = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: ${project.dev_port},
    strictPort: true,
    hmr: false,
    allowedHosts: ['.e2b.app', '.e2b.dev'],
  },
})
`.trim()

  await sandbox.files.write("/app/client/vite.config.js", viteConfig)

  // Step 8: Start client in background
  sandbox.commands.run("yarn dev", { cwd: "/app/client", background: true })
  await new Promise((r) => setTimeout(r, 5000))

  return NextResponse.json({
    sandboxId: sandbox.sandboxId,
    previewUrl: clientUrl,
  })
}
```

---

## Phase 4.3 — Replace `app/api/sandbox/prompt/route.ts`

Replace the entire file with the following. Key differences from the original:

- Reads from **both `/app/client/src` and `/app/api`** instead of just `/app/src`
- Explicitly **skips `node_modules` and `.git`** directories to avoid reading thousands of files
- Updated **LLM system prompt** describes a full-stack app and tells Claude how to reference both frontend and backend paths

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

export const maxDuration = 60

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const { sandboxId, prompt } = await req.json()

  const sandbox = await Sandbox.connect(sandboxId)

  // Read from both client and api directories
  const [clientFiles, apiFiles] = await Promise.all([
    readSourceFiles(sandbox, "/app/client/src"),
    readSourceFiles(sandbox, "/app/api"),
  ])

  const files = { ...clientFiles, ...apiFiles }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8096,
    system: `You are a code editor for a full-stack MERN application (MongoDB, Express, React, Node.js).
You have access to both the React frontend (client/src/) and the Express backend (api/).
The frontend runs on port 5173. The backend API runs on port 4000.

Make only the changes needed to fulfil the user's request.

RULES:
- Respond with ONLY a JSON object. No explanation. No markdown fences.
- The JSON must have a "files" key: an array of {path, content} objects.
- Only include files that need to change.
- Frontend paths are relative to /app e.g. "client/src/components/Navbar.jsx"
- Backend paths are relative to /app e.g. "api/routes/listing.js"
- Preserve all existing functionality unrelated to the request.
- When changing the API, update the frontend to match if needed, and vice versa.

Example:
{"files": [{"path": "client/src/components/Navbar.jsx", "content": "..."}, {"path": "api/routes/listing.js", "content": "..."}]}`,
    messages: [{
      role: "user",
      content: `Source code:\n\n${JSON.stringify(files, null, 2)}\n\nRequest: ${prompt}`,
    }],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""

  let changedFiles: { path: string; content: string }[] = []
  try {
    changedFiles = JSON.parse(text).files ?? []
  } catch {
    return NextResponse.json({ error: "LLM returned invalid response" }, { status: 500 })
  }

  for (const file of changedFiles) {
    await sandbox.files.write(`/app/${file.path}`, file.content)
  }

  return NextResponse.json({
    success: true,
    changedFiles: changedFiles.map((f) => f.path),
  })
}

async function readSourceFiles(
  sandbox: Sandbox,
  dirPath: string
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  try {
    const entries = await sandbox.files.list(dirPath)
    for (const entry of entries) {
      // Always skip these — they are huge and irrelevant
      if (entry.name === "node_modules" || entry.name === ".git") continue

      const fullPath = `${dirPath}/${entry.name}`

      if (entry.type === "dir") {
        Object.assign(result, await readSourceFiles(sandbox, fullPath))
      } else if (/\.(tsx?|jsx?|css|json)$/.test(entry.name)) {
        result[fullPath.replace("/app/", "")] = await sandbox.files.read(fullPath)
      }
    }
  } catch {
    // Directory may not exist — skip silently
  }

  return result
}
```

---

## No Other Changes Required

Everything else in the existing implementation plan stays exactly as written:

- Phase 1 (setup) — unchanged
- Phase 2 (auth) — unchanged
- Phase 3 (dashboard) — unchanged
- Phase 4.1 (project config endpoint) — unchanged
- Phase 4.4 (submit endpoint) — unchanged
- Phase 4.5 (kill endpoint) — unchanged
- Phase 5 (widget) — unchanged
- Phase 6 (build) — unchanged
- Phase 7 (types) — unchanged
- Phase 8 (Vercel) — unchanged
