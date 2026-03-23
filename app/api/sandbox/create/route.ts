import { Sandbox } from "@e2b/code-interpreter"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export const maxDuration = 120

export async function POST(req: Request) {
  const { scriptTagId } = await req.json()

  const { data: project } = await getSupabaseAdmin()
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
