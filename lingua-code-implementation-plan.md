# Lingua Code — Full Implementation Plan

## Purpose of This Document

This is a step-by-step implementation plan for building the Lingua Code MVP. Each phase is self-contained. Build and verify each phase before moving to the next. Every file that needs to exist is listed explicitly.

---

## What We Are Building

A platform where:
1. A company signs up, connects their GitHub repo, and gets a `<script>` tag
2. That script tag injects a widget onto their site
3. Any user on that site can click "Improve this" — the page transitions to a full-screen sandbox view running the real React app, exactly as it looks in localhost
4. A floating toolbar at the bottom of the screen lets the user type prompts; an LLM edits files in the sandbox; the user sees live changes in the full viewport
5. The user submits with a bounty amount + their email → a GitHub PR is opened

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth v5 (GitHub OAuth — for companies only)
- **Database**: Supabase (Postgres)
- **Sandbox**: E2B (`@e2b/code-interpreter`)
- **LLM**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **GitHub**: Octokit (`@octokit/rest`)
- **Widget**: Vanilla JS bundle (no framework — must be self-contained)
- **Hosting**: Vercel
- **Styling**: Tailwind CSS

---

## Repository Structure

```
lingua-code/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Company dashboard
│   │   └── projects/
│   │       ├── new/page.tsx            # Create project form
│   │       └── [id]/page.tsx           # Project detail + script tag
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── sandbox/
│   │   │   ├── create/route.ts         # POST: spin up sandbox
│   │   │   ├── prompt/route.ts         # POST: send prompt to LLM
│   │   │   ├── submit/route.ts         # POST: open PR, kill sandbox
│   │   │   └── [id]/route.ts           # DELETE: kill sandbox
│   │   └── projects/
│   │       └── [scriptTagId]/route.ts  # GET: project config for widget
│   ├── layout.tsx
│   └── page.tsx                        # Marketing / login page
├── components/
│   ├── ProjectForm.tsx
│   ├── ScriptTagDisplay.tsx
│   └── SubmissionsList.tsx
├── lib/
│   ├── supabase.ts
│   ├── github.ts
│   ├── sandbox.ts
│   ├── llm.ts
│   └── auth.ts
├── types/
│   └── index.ts
│   └── next-auth.d.ts
├── widget/
│   ├── src/
│   │   ├── index.js                    # Widget entry point
│   │   ├── overlay.js                  # Full-screen overlay + toolbar UI
│   │   └── api.js                      # API calls from widget
│   ├── package.json
│   └── build.js
├── public/
│   └── widget.js                       # Built widget bundle (output)
├── supabase/
│   └── schema.sql
├── vercel.json
├── .env.local
└── package.json
```

---

## Environment Variables

Create `.env.local` with all of these before starting:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# GitHub OAuth App (create at github.com/settings/developers)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# E2B
E2B_API_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Phase 1: Project Setup

### Step 1.1 — Install dependencies

```bash
npm install @supabase/supabase-js next-auth@beta \
  @octokit/rest @anthropic-ai/sdk @e2b/code-interpreter \
  lucide-react clsx tailwind-merge

npm install --save-dev esbuild
```

### Step 1.2 — Create Supabase schema

Run this SQL in the Supabase SQL editor:

```sql
-- supabase/schema.sql

create table companies (
  id uuid primary key default gen_random_uuid(),
  github_id text unique not null,
  github_login text not null,
  github_token text not null,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  repo_url text not null,
  repo_full_name text not null,       -- e.g. "acme/frontend"
  default_branch text not null default 'main',
  install_command text not null default 'npm install',
  dev_command text not null default 'npm run dev',
  dev_port integer not null default 3000,
  script_tag_id text unique not null default gen_random_uuid()::text,
  created_at timestamptz default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_prompt text not null,
  user_email text not null,
  bounty_amount integer not null,
  pr_url text,
  pr_number integer,
  status text not null default 'pending',   -- pending | merged | rejected
  created_at timestamptz default now()
);

alter table companies enable row level security;
alter table projects enable row level security;
alter table submissions enable row level security;
```

---

## Phase 2: Auth and Company Login

### Step 2.1 — NextAuth config

**File: `lib/auth.ts`**

```typescript
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { supabaseAdmin } from "./supabase"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          // repo scope is required to open PRs on the company's behalf
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "github" && account.access_token) {
        await supabaseAdmin.from("companies").upsert({
          github_id: String(account.providerAccountId),
          github_login: user.name ?? "",
          github_token: account.access_token,
        }, { onConflict: "github_id" })
      }
      return true
    },
    async session({ session, token }) {
      const { data } = await supabaseAdmin
        .from("companies")
        .select("id, github_login")
        .eq("github_id", String(token.sub))
        .single()
      if (data) {
        session.user.companyId = data.id
        session.user.githubLogin = data.github_login
      }
      return session
    },
  },
})
```

**File: `app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

### Step 2.2 — Extend NextAuth session types

**File: `types/next-auth.d.ts`**

```typescript
import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      companyId: string
      githubLogin: string
    } & DefaultSession["user"]
  }
}
```

### Step 2.3 — Supabase client

**File: `lib/supabase.ts`**

```typescript
import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-side only — never import this in client components or the widget
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

---

## Phase 3: Company Dashboard

### Step 3.1 — Landing / login page

**File: `app/page.tsx`**

Simple marketing page with a "Sign in with GitHub" button. On sign-in, redirect to `/dashboard`.

```typescript
import { signIn } from "@/lib/auth"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Lingua Code</h1>
      <p className="text-zinc-500">Let your users improve your product.</p>
      <form action={async () => {
        "use server"
        await signIn("github", { redirectTo: "/dashboard" })
      }}>
        <button
          type="submit"
          className="bg-zinc-900 text-white px-6 py-3 rounded-lg font-medium"
        >
          Sign in with GitHub
        </button>
      </form>
    </main>
  )
}
```

### Step 3.2 — Dashboard layout (auth guard)

**File: `app/(dashboard)/layout.tsx`**

```typescript
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/")
  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <span className="font-semibold">Lingua Code</span>
        <span className="text-sm text-zinc-500">{session.user.githubLogin}</span>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
```

### Step 3.3 — Dashboard home

**File: `app/(dashboard)/page.tsx`**

```typescript
import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import Link from "next/link"

export default async function Dashboard() {
  const session = await auth()
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("company_id", session!.user.companyId)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <Link
          href="/projects/new"
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New Project
        </Link>
      </div>

      {projects?.length === 0 && (
        <p className="text-zinc-400 text-sm">No projects yet. Create one to get started.</p>
      )}

      <div className="grid gap-4">
        {projects?.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="block bg-white border rounded-xl p-5 hover:border-zinc-400 transition-colors"
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-zinc-400 mt-1">{p.repo_full_name}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

### Step 3.4 — New project form

**File: `app/(dashboard)/projects/new/page.tsx`**

```typescript
import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { redirect } from "next/navigation"

export default function NewProject() {
  async function createProject(formData: FormData) {
    "use server"
    const session = await auth()
    if (!session) redirect("/")

    const repoUrl = formData.get("repo_url") as string
    // Parse "acme/my-app" from "https://github.com/acme/my-app"
    const repoFullName = repoUrl.replace("https://github.com/", "").replace(/\/$/, "")

    const { data } = await supabaseAdmin
      .from("projects")
      .insert({
        company_id: session.user.companyId,
        name: formData.get("name") as string,
        repo_url: repoUrl,
        repo_full_name: repoFullName,
        default_branch: (formData.get("default_branch") as string) || "main",
        install_command: (formData.get("install_command") as string) || "npm install",
        dev_command: (formData.get("dev_command") as string) || "npm run dev",
        dev_port: parseInt((formData.get("dev_port") as string) || "3000"),
      })
      .select()
      .single()

    if (data) redirect(`/projects/${data.id}`)
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">New Project</h1>
      <form action={createProject} className="space-y-4">
        <Field name="name" label="Project name" placeholder="My App" required />
        <Field name="repo_url" label="GitHub repo URL" placeholder="https://github.com/acme/my-app" required />
        <Field name="default_branch" label="Default branch" placeholder="main" />
        <Field name="install_command" label="Install command" placeholder="npm install" />
        <Field name="dev_command" label="Dev command" placeholder="npm run dev" />
        <Field name="dev_port" label="Dev port" placeholder="3000" />
        <button
          type="submit"
          className="w-full bg-zinc-900 text-white py-2.5 rounded-lg font-medium"
        >
          Create Project
        </button>
      </form>
    </div>
  )
}

function Field({ name, label, placeholder, required }: {
  name: string; label: string; placeholder: string; required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
      />
    </div>
  )
}
```

### Step 3.5 — Project detail + script tag

**File: `app/(dashboard)/projects/[id]/page.tsx`**

```typescript
import { supabaseAdmin } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  const session = await auth()
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*, submissions(*)")
    .eq("id", params.id)
    .eq("company_id", session!.user.companyId)
    .single()

  if (!project) redirect("/dashboard")

  const scriptTag = `<script src="${process.env.NEXT_PUBLIC_APP_URL}/widget.js" data-project-id="${project.script_tag_id}"></script>`

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-zinc-400 text-sm mt-1">{project.repo_full_name}</p>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Add to your site</h2>
        <p className="text-sm text-zinc-500">Paste this before the closing &lt;/body&gt; tag:</p>
        <pre className="bg-zinc-900 text-zinc-100 text-sm p-4 rounded-xl overflow-x-auto">
          {scriptTag}
        </pre>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Submissions</h2>
        {project.submissions?.length === 0 && (
          <p className="text-sm text-zinc-400">No submissions yet.</p>
        )}
        {project.submissions?.map((s: any) => (
          <div key={s.id} className="border rounded-xl p-4 space-y-1">
            <div className="text-sm font-medium">{s.user_prompt}</div>
            <div className="text-xs text-zinc-400">
              {s.user_email} · {s.bounty_amount} points · {s.status}
            </div>
            {s.pr_url && (
              <a href={s.pr_url} target="_blank" className="text-xs text-blue-600 hover:underline">
                View PR →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Phase 4: API Routes

### Step 4.1 — Project config endpoint

**File: `app/api/projects/[scriptTagId]/route.ts`**

Called by the widget on load. Returns only non-sensitive config.

```typescript
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: { scriptTagId: string } }) {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, name, dev_port")
    .eq("script_tag_id", params.scriptTagId)
    .single()

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(project)
}
```

### Step 4.2 — Create sandbox endpoint

**File: `app/api/sandbox/create/route.ts`**

Called when the user clicks "Improve this". This is the longest-running request — it clones the repo and runs npm install.

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export const maxDuration = 120 // Requires Vercel Pro for > 10s

export async function POST(req: Request) {
  const { scriptTagId } = await req.json()

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*, companies(github_token)")
    .eq("script_tag_id", scriptTagId)
    .single()

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const githubToken = (project.companies as any).github_token
  // Embed token in clone URL so git can authenticate without interactive prompt
  const repoUrl = `https://oauth2:${githubToken}@github.com/${project.repo_full_name}.git`

  const sandbox = await Sandbox.create({
    timeoutMs: 60 * 60 * 1000, // keep alive up to 1 hour
  })

  // Clone the repo
  await sandbox.commands.run(`git clone ${repoUrl} /app`)

  // Install dependencies
  await sandbox.commands.run(project.install_command, { cwd: "/app" })

  // Patch vite.config.js to allow E2B preview hosts and disable HMR.
  // HMR websockets don't work across the E2B proxy — Vite falls back to
  // full-page reload on file change, which is still live feedback.
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

  await sandbox.files.write("/app/vite.config.js", viteConfig)

  // Start dev server in background — do not await
  sandbox.commands.run(project.dev_command, { cwd: "/app", background: true })

  // Give Vite a moment to boot before returning the URL
  await new Promise((r) => setTimeout(r, 4000))

  const previewUrl = `https://${sandbox.getHost(project.dev_port)}`

  return NextResponse.json({
    sandboxId: sandbox.sandboxId,
    previewUrl,
  })
}
```

### Step 4.3 — Prompt endpoint

**File: `app/api/sandbox/prompt/route.ts`**

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

export const maxDuration = 60

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const { sandboxId, prompt } = await req.json()

  const sandbox = await Sandbox.connect(sandboxId)
  const files = await readSourceFiles(sandbox, "/app/src")

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8096,
    system: `You are a code editor for a React application.
You receive the full source code and a user request.
Make only the changes needed to fulfil the request.

RULES:
- Respond with ONLY a JSON object. No explanation. No markdown fences.
- The JSON must have a "files" key: an array of {path, content} objects.
- Only include files that need to change.
- Paths are relative to /app (e.g. "src/components/Navbar.tsx").
- Preserve all existing functionality unrelated to the request.

Example:
{"files": [{"path": "src/components/Navbar.tsx", "content": "...full content..."}]}`,
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

### Step 4.4 — Submit endpoint

**File: `app/api/sandbox/submit/route.ts`**

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import { Octokit } from "@octokit/rest"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(req: Request) {
  const { sandboxId, scriptTagId, prompt, bountyAmount, userEmail } = await req.json()

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*, companies(github_token)")
    .eq("script_tag_id", scriptTagId)
    .single()

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const githubToken = (project.companies as any).github_token
  const sandbox = await Sandbox.connect(sandboxId)
  const octokit = new Octokit({ auth: githubToken })
  const [owner, repo] = project.repo_full_name.split("/")
  const branchName = `lingua-code/${Date.now()}`

  // Get diff for PR body
  const diffResult = await sandbox.commands.run("git diff HEAD", { cwd: "/app" })
  const diff = diffResult.stdout

  // Get list of changed files
  const statusResult = await sandbox.commands.run("git diff --name-only HEAD", { cwd: "/app" })
  const changedPaths = statusResult.stdout.trim().split("\n").filter(Boolean)

  if (changedPaths.length === 0) {
    return NextResponse.json({ error: "No changes to submit" }, { status: 400 })
  }

  // Get base branch SHA
  const { data: baseRef } = await octokit.git.getRef({
    owner, repo, ref: `heads/${project.default_branch}`,
  })
  const baseSha = baseRef.object.sha

  const { data: baseCommit } = await octokit.git.getCommit({
    owner, repo, commit_sha: baseSha,
  })

  // Upload each changed file as a blob
  const treeItems = await Promise.all(
    changedPaths.map(async (filePath) => {
      const content = await sandbox.files.read(`/app/${filePath}`)
      const { data: blob } = await octokit.git.createBlob({
        owner, repo,
        content: Buffer.from(content).toString("base64"),
        encoding: "base64",
      })
      return { path: filePath, mode: "100644" as const, type: "blob" as const, sha: blob.sha }
    })
  )

  // Create new tree, commit, branch, and PR
  const { data: newTree } = await octokit.git.createTree({
    owner, repo, base_tree: baseCommit.tree.sha, tree: treeItems,
  })

  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message: `[Lingua Code] ${prompt}`,
    tree: newTree.sha,
    parents: [baseSha],
  })

  await octokit.git.createRef({
    owner, repo, ref: `refs/heads/${branchName}`, sha: newCommit.sha,
  })

  const { data: pr } = await octokit.pulls.create({
    owner, repo,
    title: `[Lingua Code] ${prompt}`,
    head: branchName,
    base: project.default_branch,
    body: `## Lingua Code Submission

**Request:** ${prompt}
**Submitted by:** ${userEmail}
**Requested bounty:** ${bountyAmount} points

---

### Diff

\`\`\`diff
${diff}
\`\`\`

---
*Generated by [Lingua Code](https://linguacode.dev)*`,
  })

  // Save to DB
  await supabaseAdmin.from("submissions").insert({
    project_id: project.id,
    user_prompt: prompt,
    user_email: userEmail,
    bounty_amount: bountyAmount,
    pr_url: pr.html_url,
    pr_number: pr.number,
    status: "pending",
  })

  await sandbox.kill()

  return NextResponse.json({ prUrl: pr.html_url })
}
```

### Step 4.5 — Kill sandbox endpoint

**File: `app/api/sandbox/[id]/route.ts`**

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import { NextResponse } from "next/server"

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const sandbox = await Sandbox.connect(params.id)
    await sandbox.kill()
  } catch {
    // Already dead — fine
  }
  return NextResponse.json({ success: true })
}
```

---

## Phase 5: The Widget

The widget is a self-contained JS bundle built separately and output to `public/widget.js`. It uses no framework. When triggered, it takes over the full viewport — the company's page is hidden behind a full-screen overlay showing the sandbox running the real app. A floating toolbar at the bottom handles prompts, status, and submission.

### Step 5.1 — Build setup

**File: `widget/package.json`**

```json
{
  "name": "lingua-code-widget",
  "private": true,
  "scripts": {
    "build": "node build.js"
  },
  "devDependencies": {
    "esbuild": "^0.20.0"
  }
}
```

**File: `widget/build.js`**

```javascript
const esbuild = require("esbuild")

esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  minify: true,
  outfile: "../public/widget.js",
  platform: "browser",
  target: ["es2020"],
  define: {
    "process.env.API_URL": JSON.stringify(
      process.env.API_URL || "http://localhost:3000"
    ),
  },
}).catch(() => process.exit(1))
```

### Step 5.2 — Widget entry point

**File: `widget/src/index.js`**

```javascript
import { openOverlay } from "./overlay.js"

const scriptTag =
  document.currentScript ||
  document.querySelector("script[data-project-id]")

const projectId = scriptTag?.getAttribute("data-project-id")

if (!projectId) {
  console.error("[Lingua Code] Missing data-project-id on script tag")
} else {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(projectId))
  } else {
    init(projectId)
  }
}

function init(projectId) {
  const btn = document.createElement("button")
  btn.id = "lc-trigger"
  btn.textContent = "✦ Improve this"
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483646;
    background: #18181b;
    color: #fff;
    border: none;
    border-radius: 9999px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    font-family: system-ui, -apple-system, sans-serif;
    letter-spacing: -0.01em;
    transition: transform 0.15s, box-shadow 0.15s;
  `
  btn.onmouseenter = () => {
    btn.style.transform = "scale(1.04)"
    btn.style.boxShadow = "0 6px 28px rgba(0,0,0,0.3)"
  }
  btn.onmouseleave = () => {
    btn.style.transform = "scale(1)"
    btn.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)"
  }

  document.body.appendChild(btn)

  btn.addEventListener("click", () => {
    btn.style.display = "none"
    openOverlay(projectId, () => {
      btn.style.display = "block"
    })
  })
}
```

### Step 5.3 — Full-screen overlay

**File: `widget/src/overlay.js`**

When opened, covers the entire viewport with the sandbox. The company's original page stays in the DOM but is hidden behind the overlay. A floating toolbar at the bottom contains the prompt input, message history, and submit controls.

```javascript
import { callCreateSandbox, callPrompt, callSubmit, callKillSandbox } from "./api.js"

export function openOverlay(projectId, onClose) {
  document.body.style.overflow = "hidden"

  const overlay = document.createElement("div")
  overlay.id = "lc-overlay"
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #f4f4f5;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
  `

  overlay.innerHTML = `
    <style>
      #lc-overlay * { box-sizing: border-box; }

      #lc-topbar {
        height: 44px;
        background: #18181b;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        flex-shrink: 0;
      }
      #lc-topbar-title {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        opacity: 0.9;
      }
      #lc-close-btn {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        font-size: 20px;
        opacity: 0.6;
        line-height: 1;
        padding: 0;
      }
      #lc-close-btn:hover { opacity: 1; }

      #lc-preview {
        flex: 1;
        position: relative;
        overflow: hidden;
      }
      #lc-preview iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
      }
      #lc-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: #71717a;
        font-size: 14px;
      }
      #lc-spinner {
        width: 28px;
        height: 28px;
        border: 2.5px solid #e4e4e7;
        border-top-color: #18181b;
        border-radius: 50%;
        animation: lc-spin 0.7s linear infinite;
      }
      @keyframes lc-spin { to { transform: rotate(360deg); } }

      #lc-toolbar {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: min(680px, calc(100vw - 32px));
        background: #fff;
        border: 1px solid #e4e4e7;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.15);
        overflow: hidden;
      }

      #lc-messages {
        max-height: 160px;
        overflow-y: auto;
        padding: 10px 12px 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #lc-messages:empty { display: none; }
      .lc-msg {
        padding: 7px 11px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.45;
        max-width: 88%;
      }
      .lc-msg.user { background: #18181b; color: #fff; align-self: flex-end; }
      .lc-msg.assistant { background: #f4f4f5; color: #18181b; align-self: flex-start; }

      #lc-input-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 10px 12px;
      }
      #lc-prompt {
        flex: 1;
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        resize: none;
        min-height: 38px;
        max-height: 120px;
        outline: none;
        line-height: 1.4;
      }
      #lc-prompt:focus { border-color: #18181b; }
      #lc-prompt:disabled { background: #fafafa; }
      #lc-send {
        background: #18181b;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 9px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        height: 38px;
      }
      #lc-send:disabled { opacity: 0.35; cursor: not-allowed; }

      #lc-submit-section {
        border-top: 1px solid #f4f4f5;
        padding: 10px 12px;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      #lc-email, #lc-bounty {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 7px 11px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
      }
      #lc-email:focus, #lc-bounty:focus { border-color: #18181b; }
      #lc-email { flex: 1; }
      #lc-bounty { width: 130px; }
      #lc-submit {
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
      }
      #lc-submit:disabled { opacity: 0.35; cursor: not-allowed; }

      #lc-status {
        padding: 5px 12px 8px;
        font-size: 11px;
        color: #a1a1aa;
        text-align: center;
      }
    </style>

    <div id="lc-topbar">
      <span id="lc-topbar-title">✦ Lingua Code — Sandbox Preview</span>
      <button id="lc-close-btn">×</button>
    </div>

    <div id="lc-preview">
      <div id="lc-loading">
        <div id="lc-spinner"></div>
        <span>Starting sandbox — cloning repo and installing dependencies…</span>
      </div>
    </div>

    <div id="lc-toolbar">
      <div id="lc-messages"></div>
      <div id="lc-input-row">
        <textarea id="lc-prompt" placeholder="Describe a change…" rows="1" disabled></textarea>
        <button id="lc-send" disabled>Send</button>
      </div>
      <div id="lc-submit-section" style="display:none">
        <input type="email" id="lc-email" placeholder="Your email" />
        <input type="number" id="lc-bounty" placeholder="Bounty (points)" min="1" />
        <button id="lc-submit">Submit PR →</button>
      </div>
      <div id="lc-status">Initialising…</div>
    </div>
  `

  document.body.appendChild(overlay)

  let sandboxId = null
  let isBusy = false
  let lastPrompt = ""

  const loading = overlay.querySelector("#lc-loading")
  const preview = overlay.querySelector("#lc-preview")
  const messages = overlay.querySelector("#lc-messages")
  const promptEl = overlay.querySelector("#lc-prompt")
  const sendBtn = overlay.querySelector("#lc-send")
  const submitSection = overlay.querySelector("#lc-submit-section")
  const submitBtn = overlay.querySelector("#lc-submit")
  const statusEl = overlay.querySelector("#lc-status")

  function setStatus(text) { statusEl.textContent = text }

  function addMessage(role, text) {
    const el = document.createElement("div")
    el.className = `lc-msg ${role}`
    el.textContent = text
    messages.appendChild(el)
    messages.scrollTop = messages.scrollHeight
  }

  function closeOverlay() {
    document.body.style.overflow = ""
    if (sandboxId) callKillSandbox(sandboxId)
    overlay.remove()
    onClose()
  }

  overlay.querySelector("#lc-close-btn").addEventListener("click", closeOverlay)

  // Boot sandbox
  ;(async () => {
    try {
      setStatus("Cloning repo and installing dependencies — this may take a minute…")
      const { sandboxId: sid, previewUrl } = await callCreateSandbox(projectId)
      sandboxId = sid

      loading.style.display = "none"
      const iframe = document.createElement("iframe")
      iframe.src = previewUrl
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms allow-popups allow-modals")
      iframe.setAttribute("allow", "clipboard-read; clipboard-write")
      preview.appendChild(iframe)

      promptEl.disabled = false
      sendBtn.disabled = false
      setStatus("Ready — the app is running live. Describe a change below.")
    } catch (err) {
      setStatus("Failed to start sandbox. Please close and try again.")
      console.error("[Lingua Code]", err)
    }
  })()

  async function sendPrompt() {
    const prompt = promptEl.value.trim()
    if (!prompt || isBusy || !sandboxId) return

    isBusy = true
    lastPrompt = prompt
    sendBtn.disabled = true
    promptEl.disabled = true
    promptEl.value = ""
    addMessage("user", prompt)
    setStatus("Applying changes…")

    try {
      const { changedFiles } = await callPrompt(sandboxId, prompt)
      addMessage("assistant", `Done — changed: ${changedFiles.join(", ")}`)
      submitSection.style.display = "flex"
      setStatus("Changes applied. Review the app above, then submit your PR.")
    } catch {
      addMessage("assistant", "Something went wrong. Please try again.")
      setStatus("Error applying changes.")
    } finally {
      isBusy = false
      sendBtn.disabled = false
      promptEl.disabled = false
      promptEl.focus()
    }
  }

  sendBtn.addEventListener("click", sendPrompt)
  promptEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendPrompt()
    }
  })

  submitBtn.addEventListener("click", async () => {
    const email = overlay.querySelector("#lc-email").value.trim()
    const bounty = overlay.querySelector("#lc-bounty").value.trim()

    if (!email || !bounty) {
      setStatus("Please enter your email and a bounty amount.")
      return
    }

    submitBtn.disabled = true
    setStatus("Opening PR on GitHub…")

    try {
      const { prUrl } = await callSubmit({
        sandboxId,
        projectId,
        prompt: lastPrompt,
        bountyAmount: parseInt(bounty, 10),
        userEmail: email,
      })

      preview.innerHTML = `
        <div style="
          position:absolute;inset:0;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:16px;
          font-family:system-ui,sans-serif;color:#18181b;
        ">
          <div style="font-size:48px">🎉</div>
          <div style="font-size:20px;font-weight:700">PR opened!</div>
          <div style="font-size:14px;color:#71717a">The company will review your change.</div>
          <a href="${prUrl}" target="_blank" style="
            color:#16a34a;font-size:14px;font-weight:500;
            text-decoration:none;border-bottom:1px solid #16a34a;
          ">View on GitHub →</a>
        </div>
      `
      submitSection.style.display = "none"
      setStatus("Submitted successfully.")
      sandboxId = null
    } catch {
      setStatus("Failed to submit. Please try again.")
      submitBtn.disabled = false
    }
  })
}
```

### Step 5.4 — API calls

**File: `widget/src/api.js`**

```javascript
const API_URL = process.env.API_URL

export async function callCreateSandbox(projectId) {
  const res = await fetch(`${API_URL}/api/sandbox/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scriptTagId: projectId }),
  })
  if (!res.ok) throw new Error("Failed to create sandbox")
  return res.json()
}

export async function callPrompt(sandboxId, prompt) {
  const res = await fetch(`${API_URL}/api/sandbox/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sandboxId, prompt }),
  })
  if (!res.ok) throw new Error("Failed to apply prompt")
  return res.json()
}

export async function callSubmit({ sandboxId, projectId, prompt, bountyAmount, userEmail }) {
  const res = await fetch(`${API_URL}/api/sandbox/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sandboxId, scriptTagId: projectId, prompt, bountyAmount, userEmail }),
  })
  if (!res.ok) throw new Error("Failed to submit PR")
  return res.json()
}

export function callKillSandbox(sandboxId) {
  fetch(`${API_URL}/api/sandbox/${sandboxId}`, { method: "DELETE" }).catch(() => {})
}
```

---

## Phase 6: Wire Widget Into Build

**Update root `package.json` scripts:**

```json
{
  "scripts": {
    "build:widget": "cd widget && npm install && node build.js",
    "dev": "npm run build:widget && next dev",
    "build": "npm run build:widget && next build"
  }
}
```

`public/widget.js` is automatically served by Next.js at `/widget.js`.

---

## Phase 7: TypeScript Types

**File: `types/index.ts`**

```typescript
export interface Project {
  id: string
  company_id: string
  name: string
  repo_url: string
  repo_full_name: string
  default_branch: string
  install_command: string
  dev_command: string
  dev_port: number
  script_tag_id: string
  created_at: string
}

export interface Submission {
  id: string
  project_id: string
  user_prompt: string
  user_email: string
  bounty_amount: number
  pr_url: string | null
  pr_number: number | null
  status: "pending" | "merged" | "rejected"
  created_at: string
}
```

---

## Phase 8: Vercel Deployment

**File: `vercel.json`**

```json
{
  "functions": {
    "app/api/sandbox/create/route.ts": { "maxDuration": 120 },
    "app/api/sandbox/prompt/route.ts": { "maxDuration": 60 },
    "app/api/sandbox/submit/route.ts": { "maxDuration": 60 }
  }
}
```

Add all `.env.local` variables to Vercel project settings. Update `NEXTAUTH_URL` to your production domain.

---

## Build Order

Work through phases in this exact order. Verify each before moving on.

1. **Phase 1** — Install deps, run Supabase schema
2. **Phase 2** — Auth: verify GitHub login works and a `companies` row is created in Supabase
3. **Phase 3** — Dashboard: verify project CRUD works and script tag renders correctly
4. **Phase 4.1** — Project config endpoint: test with `curl`
5. **Phase 4.2** — Sandbox create: verify E2B spins up and the returned URL opens a live React app in your browser
6. **Phase 4.3** — Prompt: verify LLM edits a file and the change is visible in the sandbox
7. **Phase 4.4** — Submit: verify a PR appears on GitHub with the diff and bounty in the description
8. **Phase 4.5** — Kill endpoint
9. **Phase 5** — Widget: build bundle, test by adding the script tag to a separate local React app
10. **Phase 6** — Wire widget build into Next.js scripts
11. **Phase 8** — Deploy to Vercel

---

## Known Limitations (Do Not Fix in MVP)

- **Vite config overwrite**: The sandbox writes a fresh `vite.config.js`. Complex existing configs will be lost. Fine for MVP.
- **HMR disabled**: Vite HMR websockets don't reliably traverse the E2B proxy. Disabled in favour of full-page reload, which still gives live feedback after each change.
- **No streaming**: Claude's response is awaited in full before files are written. Streaming can be added later for a snappier feel.
- **Full file context per prompt**: All `src/` files are sent to Claude on every prompt. Fine for small apps; will hit token limits on large repos.
- **Single-turn LLM**: No conversation history is maintained across prompts. Each is a fresh call with the current file state.
- **No sandbox pre-warming**: Cold start includes `git clone` + `npm install`. Large repos may take 2+ minutes. A clear loading message is shown.
- **Manual bounty payment**: Bounty is stored in DB and shown in the PR description. Payment happens outside the system.
