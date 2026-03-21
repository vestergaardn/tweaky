# Lingua Code — Full Implementation Plan

## Purpose of This Document

This is a step-by-step implementation plan for building the Lingua Code MVP. Each phase is self-contained. Build and verify each phase before moving to the next. Every file that needs to exist is listed explicitly.

---

## What We Are Building

A platform where:
1. A company signs up, connects their GitHub repo, and gets a `<script>` tag
2. That script tag injects a widget onto their site
3. Any user on that site can open the widget, which spins up a live sandbox running the real React app
4. The user types natural language prompts; an LLM edits files in the sandbox; the user sees live changes in an iframe
5. The user submits with a bounty amount + their email → a GitHub PR is opened

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth v5 (GitHub OAuth — for companies only)
- **Database**: Supabase (Postgres + auto-generated types)
- **Sandbox**: E2B (`@e2b/code-interpreter` package)
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
│   │   ├── page.tsx                  # Company dashboard
│   │   └── projects/
│   │       ├── new/page.tsx          # Create project form
│   │       └── [id]/page.tsx         # Project detail + script tag
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── sandbox/
│   │   │   ├── create/route.ts       # POST: spin up sandbox
│   │   │   ├── prompt/route.ts       # POST: send prompt to LLM
│   │   │   ├── submit/route.ts       # POST: open PR, kill sandbox
│   │   │   └── [id]/route.ts         # DELETE: kill sandbox
│   │   └── projects/
│   │       └── [scriptTagId]/route.ts # GET: project config for widget
│   ├── layout.tsx
│   └── page.tsx                      # Marketing / login page
├── components/
│   ├── ProjectForm.tsx
│   ├── ScriptTagDisplay.tsx
│   └── SubmissionsList.tsx
├── lib/
│   ├── supabase.ts                   # Supabase client
│   ├── github.ts                     # Octokit helpers
│   ├── sandbox.ts                    # E2B helpers
│   ├── llm.ts                        # Claude API helpers
│   └── auth.ts                       # NextAuth config
├── types/
│   └── index.ts                      # Shared TypeScript types
├── widget/
│   ├── src/
│   │   ├── index.js                  # Widget entry point
│   │   ├── panel.js                  # Side panel UI
│   │   ├── iframe.js                 # Preview iframe logic
│   │   └── api.js                    # API calls from widget
│   ├── package.json
│   └── build.js                      # esbuild config
├── public/
│   └── widget.js                     # Built widget bundle (output)
├── supabase/
│   └── schema.sql                    # DB schema
├── .env.local                        # Environment variables
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

### Step 1.1 — Initialise Next.js project

```bash
npx create-next-app@latest lingua-code --typescript --tailwind --app --no-src-dir
cd lingua-code
```

### Step 1.2 — Install dependencies

```bash
npm install @supabase/supabase-js next-auth@beta @auth/supabase-adapter \
  @octokit/rest @anthropic-ai/sdk @e2b/code-interpreter \
  @radix-ui/react-dialog @radix-ui/react-slot \
  class-variance-authority clsx tailwind-merge lucide-react

npm install --save-dev esbuild @types/node
```

### Step 1.3 — Create Supabase schema

Run this SQL in the Supabase SQL editor:

```sql
-- supabase/schema.sql

create table companies (
  id uuid primary key default gen_random_uuid(),
  github_id text unique not null,
  github_login text not null,
  github_token text not null,  -- encrypted at rest via Supabase vault
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  repo_url text not null,           -- e.g. https://github.com/acme/frontend
  repo_full_name text not null,     -- e.g. acme/frontend
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
  bounty_amount integer not null,   -- in cents or points for MVP
  pr_url text,
  pr_number integer,
  status text not null default 'pending',  -- pending | merged | rejected
  created_at timestamptz default now()
);

-- RLS: companies can only see their own data
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
          scope: "read:user user:email repo",  // repo scope needed to open PRs
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "github" && account.access_token) {
        // Upsert company record on login
        await supabaseAdmin.from("companies").upsert({
          github_id: String(account.providerAccountId),
          github_login: user.name ?? "",
          github_token: account.access_token,
        }, { onConflict: "github_id" })
      }
      return true
    },
    async session({ session, token }) {
      // Attach company data to session
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

### Step 2.2 — Supabase client

**File: `lib/supabase.ts`**

```typescript
import { createClient } from "@supabase/supabase-js"

// Client-side (anon key — limited access)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-side (service role — full access)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

---

## Phase 3: Company Dashboard

### Step 3.1 — Landing / login page

**File: `app/page.tsx`**

Simple page with product description and a "Sign in with GitHub" button. On sign-in, redirect to `/dashboard`.

```typescript
import { signIn } from "@/lib/auth"

export default function Home() {
  return (
    <main>
      <h1>Lingua Code</h1>
      <p>Let your users improve your product. Powered by LLMs.</p>
      <form action={async () => {
        "use server"
        await signIn("github", { redirectTo: "/dashboard" })
      }}>
        <button type="submit">Sign in with GitHub</button>
      </form>
    </main>
  )
}
```

### Step 3.2 — Dashboard layout

**File: `app/(dashboard)/layout.tsx`**

Wraps all dashboard pages. Checks auth — redirects to `/` if not logged in.

```typescript
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({ children }) {
  const session = await auth()
  if (!session) redirect("/")
  return <div>{children}</div>
}
```

### Step 3.3 — Dashboard home page

**File: `app/(dashboard)/page.tsx`**

Fetches and displays the company's projects. Each project shows name, repo URL, and a link to its detail page.

```typescript
import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import Link from "next/link"

export default async function Dashboard() {
  const session = await auth()
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("company_id", session.user.companyId)

  return (
    <div>
      <h1>Your Projects</h1>
      <Link href="/projects/new">+ New Project</Link>
      {projects?.map(p => (
        <Link key={p.id} href={`/projects/${p.id}`}>{p.name}</Link>
      ))}
    </div>
  )
}
```

### Step 3.4 — New project form

**File: `app/(dashboard)/projects/new/page.tsx`**

A form that collects:
- Project name
- GitHub repo URL (e.g. `https://github.com/acme/my-app`)
- Default branch (default: `main`)
- Install command (default: `npm install`)
- Dev command (default: `npm run dev`)
- Dev port (default: `3000`)

On submit (server action), parse the `repo_full_name` from the repo URL, insert into `projects` table, redirect to `/projects/[id]`.

### Step 3.5 — Project detail page (script tag)

**File: `app/(dashboard)/projects/[id]/page.tsx`**

Fetches the project. Displays:
- Project name + repo
- The script tag to copy:

```html
<script src="https://linguacode.dev/widget.js" data-project-id="[script_tag_id]"></script>
```

- List of recent submissions (from `submissions` table) with status, prompt, bounty, PR link

---

## Phase 4: API Routes

### Step 4.1 — Project config endpoint (called by widget)

**File: `app/api/projects/[scriptTagId]/route.ts`**

The widget calls this on load to get project config. Returns only the non-sensitive fields needed to render the widget.

```typescript
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(req, { params }) {
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

Called by the widget when the user opens the panel.

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { scriptTagId } = await req.json()

  // Get project config including the GitHub token
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*, companies(github_token)")
    .eq("script_tag_id", scriptTagId)
    .single()

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const githubToken = project.companies.github_token
  const repoUrl = `https://${githubToken}@github.com/${project.repo_full_name}.git`

  // Spin up sandbox
  const sandbox = await Sandbox.create({
    timeoutMs: 60 * 60 * 1000, // 1 hour max
  })

  // Clone repo
  await sandbox.commands.run(`git clone ${repoUrl} /app`)

  // Install dependencies
  await sandbox.commands.run(project.install_command, { cwd: "/app" })

  // Patch vite config to allow E2B hosts (required for HMR iframe)
  const viteConfigPatch = `
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
`
  await sandbox.files.write("/app/vite.config.js", viteConfigPatch)

  // Start dev server (background — don't await)
  sandbox.commands.run(project.dev_command, { cwd: "/app", background: true })

  // Wait briefly for server to come up
  await new Promise(r => setTimeout(r, 3000))

  const previewUrl = `https://${sandbox.getHost(project.dev_port)}`

  return NextResponse.json({
    sandboxId: sandbox.sandboxId,
    previewUrl,
  })
}
```

**Note:** This is a long-running request. Set `export const maxDuration = 120` for Vercel Pro, or move to a background job for larger repos.

### Step 4.3 — Prompt endpoint

**File: `app/api/sandbox/prompt/route.ts`**

Called each time the user sends a prompt.

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const { sandboxId, prompt } = await req.json()

  // Reconnect to existing sandbox
  const sandbox = await Sandbox.connect(sandboxId)

  // Read all files from the repo
  const files = await readAllFiles(sandbox, "/app/src")

  // Ask Claude to make the change
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8096,
    system: `You are a code editor for a React application. 
You will receive the full source code of the app and a user request.
Your job is to make the requested change.

RULES:
- Return ONLY a JSON object. No explanation. No markdown.
- The JSON must have a "files" key: an array of objects with "path" and "content".
- Only include files that need to change.
- Paths are relative to /app (e.g. "src/components/Navbar.tsx").
- Preserve all existing functionality not related to the request.

Example response:
{"files": [{"path": "src/components/Navbar.tsx", "content": "...full file content..."}]}`,
    messages: [{
      role: "user",
      content: `Here is the source code:\n\n${JSON.stringify(files)}\n\nUser request: ${prompt}`
    }]
  })

  // Parse Claude's response
  const responseText = message.content[0].type === "text" ? message.content[0].text : ""
  let changedFiles: { path: string; content: string }[] = []

  try {
    const parsed = JSON.parse(responseText)
    changedFiles = parsed.files ?? []
  } catch {
    return NextResponse.json({ error: "LLM returned invalid JSON" }, { status: 500 })
  }

  // Write changed files back to sandbox
  for (const file of changedFiles) {
    await sandbox.files.write(`/app/${file.path}`, file.content)
  }

  return NextResponse.json({ 
    success: true,
    changedFiles: changedFiles.map(f => f.path)
  })
}

// Helper: recursively read all files under a path
async function readAllFiles(sandbox: Sandbox, dirPath: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  
  try {
    const entries = await sandbox.files.list(dirPath)
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      if (entry.type === "dir") {
        const nested = await readAllFiles(sandbox, fullPath)
        Object.assign(result, nested)
      } else if (entry.name.match(/\.(tsx?|jsx?|css|json)$/)) {
        // Only read source files, skip node_modules etc.
        const content = await sandbox.files.read(fullPath)
        result[fullPath.replace("/app/", "")] = content
      }
    }
  } catch {
    // Directory may not exist — skip
  }
  
  return result
}
```

### Step 4.4 — Submit endpoint

**File: `app/api/sandbox/submit/route.ts`**

Called when the user clicks "Submit for Review".

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import { Octokit } from "@octokit/rest"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { sandboxId, scriptTagId, prompt, bountyAmount, userEmail } = await req.json()

  // Get project + GitHub token
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*, companies(github_token)")
    .eq("script_tag_id", scriptTagId)
    .single()

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const sandbox = await Sandbox.connect(sandboxId)
  const octokit = new Octokit({ auth: project.companies.github_token })

  const [owner, repo] = project.repo_full_name.split("/")
  const branchName = `lingua-code/${Date.now()}`

  // Get the git diff from sandbox
  const diffResult = await sandbox.commands.run("git diff HEAD", { cwd: "/app" })
  const diff = diffResult.stdout

  // Get changed file contents from sandbox
  const statusResult = await sandbox.commands.run(
    "git diff --name-only HEAD", 
    { cwd: "/app" }
  )
  const changedPaths = statusResult.stdout.trim().split("\n").filter(Boolean)

  // Get base commit SHA
  const { data: baseRef } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${project.default_branch}`,
  })
  const baseSha = baseRef.object.sha

  // Get base tree SHA
  const { data: baseCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: baseSha,
  })

  // Build tree of changed files
  const treeItems = await Promise.all(changedPaths.map(async (filePath) => {
    const content = await sandbox.files.read(`/app/${filePath}`)
    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(content).toString("base64"),
      encoding: "base64",
    })
    return { path: filePath, mode: "100644" as const, type: "blob" as const, sha: blob.sha }
  }))

  // Create new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: treeItems,
  })

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: `[Lingua Code] ${prompt}`,
    tree: newTree.sha,
    parents: [baseSha],
  })

  // Create branch
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: newCommit.sha,
  })

  // Open PR
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: `[Lingua Code] ${prompt}`,
    head: branchName,
    base: project.default_branch,
    body: `## Lingua Code Submission

**User request:** ${prompt}

**Submitted by:** ${userEmail}

**Requested bounty:** ${bountyAmount} points

---

### Diff

\`\`\`diff
${diff}
\`\`\`

---
*This PR was generated by [Lingua Code](https://linguacode.dev). Merge to pay the bounty.*`,
  })

  // Save submission to DB
  await supabaseAdmin.from("submissions").insert({
    project_id: project.id,
    user_prompt: prompt,
    user_email: userEmail,
    bounty_amount: bountyAmount,
    pr_url: pr.html_url,
    pr_number: pr.number,
    status: "pending",
  })

  // Kill sandbox
  await sandbox.kill()

  return NextResponse.json({ prUrl: pr.html_url })
}
```

### Step 4.5 — Kill sandbox endpoint

**File: `app/api/sandbox/[id]/route.ts`**

Called when user closes the panel without submitting.

```typescript
import { Sandbox } from "@e2b/code-interpreter"
import { NextResponse } from "next/server"

export async function DELETE(req: Request, { params }) {
  try {
    const sandbox = await Sandbox.connect(params.id)
    await sandbox.kill()
  } catch {
    // Sandbox may already be dead — that's fine
  }
  return NextResponse.json({ success: true })
}
```

---

## Phase 5: The Widget

The widget is a self-contained JS bundle. It is built separately and output to `public/widget.js`. It must not depend on React (to avoid version conflicts with the host site).

### Step 5.1 — Build setup

**File: `widget/package.json`**

```json
{
  "name": "lingua-code-widget",
  "private": true,
  "scripts": {
    "build": "node build.js",
    "dev": "node build.js --watch"
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
})
```

### Step 5.2 — Widget entry point

**File: `widget/src/index.js`**

```javascript
import { createPanel } from "./panel.js"

// Read config from script tag
const scriptTag = document.currentScript || 
  document.querySelector('script[data-project-id]')
const projectId = scriptTag?.getAttribute("data-project-id")

if (!projectId) {
  console.error("[Lingua Code] Missing data-project-id on script tag")
} else {
  // Inject button once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(projectId))
  } else {
    init(projectId)
  }
}

function init(projectId) {
  // Inject floating button
  const button = document.createElement("button")
  button.id = "lingua-code-btn"
  button.textContent = "✦ Improve this"
  button.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999998;
    background: #18181b;
    color: #fff;
    border: none;
    border-radius: 9999px;
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    font-family: system-ui, sans-serif;
  `
  document.body.appendChild(button)

  let panelOpen = false
  button.addEventListener("click", () => {
    if (!panelOpen) {
      panelOpen = true
      button.textContent = "✕ Close"
      createPanel(projectId, () => {
        panelOpen = false
        button.textContent = "✦ Improve this"
      })
    }
  })
}
```

### Step 5.3 — Panel UI

**File: `widget/src/panel.js`**

The panel is injected as a Shadow DOM element to fully isolate its CSS from the host site.

```javascript
import { callCreateSandbox, callPrompt, callSubmit, callKillSandbox } from "./api.js"

export function createPanel(projectId, onClose) {
  // Create host element + shadow root
  const host = document.createElement("div")
  host.id = "lingua-code-panel-host"
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: "open" })

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      :host { all: initial; }
      
      .panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 420px;
        height: 100vh;
        background: #fff;
        border-left: 1px solid #e4e4e7;
        display: flex;
        flex-direction: column;
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: -8px 0 32px rgba(0,0,0,0.1);
      }

      .header {
        padding: 16px;
        border-bottom: 1px solid #e4e4e7;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .header-title {
        font-size: 14px;
        font-weight: 600;
        color: #18181b;
      }

      .preview-area {
        flex: 1;
        background: #f4f4f5;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .preview-area iframe {
        width: 100%;
        height: 100%;
        border: none;
      }

      .loading-state {
        text-align: center;
        color: #71717a;
        font-size: 13px;
      }

      .spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #e4e4e7;
        border-top-color: #18181b;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        margin: 0 auto 12px;
      }

      @keyframes spin { to { transform: rotate(360deg); } }

      .chat-area {
        padding: 12px;
        border-top: 1px solid #e4e4e7;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .messages {
        max-height: 140px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .message {
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.4;
      }

      .message.user {
        background: #18181b;
        color: #fff;
        align-self: flex-end;
        max-width: 85%;
      }

      .message.assistant {
        background: #f4f4f5;
        color: #18181b;
        align-self: flex-start;
        max-width: 85%;
      }

      .input-row {
        display: flex;
        gap: 8px;
      }

      .prompt-input {
        flex: 1;
        border: 1px solid #e4e4e7;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        resize: none;
        min-height: 38px;
        max-height: 100px;
      }

      .prompt-input:focus {
        border-color: #18181b;
      }

      .send-btn {
        background: #18181b;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
      }

      .send-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .submit-section {
        padding: 12px;
        border-top: 1px solid #e4e4e7;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .submit-section label {
        font-size: 12px;
        color: #71717a;
        font-weight: 500;
      }

      .submit-row {
        display: flex;
        gap: 8px;
      }

      .submit-section input {
        flex: 1;
        border: 1px solid #e4e4e7;
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
      }

      .submit-section input:focus {
        border-color: #18181b;
      }

      .submit-btn {
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
      }

      .submit-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .status-bar {
        padding: 6px 12px;
        font-size: 11px;
        color: #71717a;
        background: #fafafa;
        border-top: 1px solid #e4e4e7;
        text-align: center;
      }
    </style>

    <div class="panel">
      <div class="header">
        <span class="header-title">✦ Lingua Code</span>
        <button id="close-btn" style="background:none;border:none;cursor:pointer;color:#71717a;font-size:18px">×</button>
      </div>

      <div class="preview-area" id="preview-area">
        <div class="loading-state">
          <div class="spinner"></div>
          <div>Starting your sandbox…</div>
        </div>
      </div>

      <div class="messages" id="messages"></div>

      <div class="chat-area">
        <div class="input-row">
          <textarea 
            class="prompt-input" 
            id="prompt-input" 
            placeholder="Describe a change…" 
            rows="1"
            disabled
          ></textarea>
          <button class="send-btn" id="send-btn" disabled>Send</button>
        </div>
      </div>

      <div class="submit-section" id="submit-section" style="display:none">
        <label>Submit for review</label>
        <input type="email" id="user-email" placeholder="Your email" />
        <div class="submit-row">
          <input type="number" id="bounty-amount" placeholder="Bounty (points)" min="1" />
          <button class="submit-btn" id="submit-btn">Submit PR →</button>
        </div>
      </div>

      <div class="status-bar" id="status-bar">Initialising…</div>
    </div>
  `

  let sandboxId = null
  let hasChanges = false
  let isBusy = false

  const previewArea = shadow.getElementById("preview-area")
  const messagesEl = shadow.getElementById("messages")
  const promptInput = shadow.getElementById("prompt-input")
  const sendBtn = shadow.getElementById("send-btn")
  const submitSection = shadow.getElementById("submit-section")
  const submitBtn = shadow.getElementById("submit-btn")
  const statusBar = shadow.getElementById("status-bar")

  function setStatus(text) {
    statusBar.textContent = text
  }

  function addMessage(role, text) {
    const el = document.createElement("div")
    el.className = `message ${role}`
    el.textContent = text
    messagesEl.appendChild(el)
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  // Close button
  shadow.getElementById("close-btn").addEventListener("click", async () => {
    if (sandboxId) {
      callKillSandbox(sandboxId)
    }
    host.remove()
    onClose()
  })

  // Create sandbox on open
  ;(async () => {
    try {
      setStatus("Starting sandbox — cloning repo and installing dependencies…")
      const { sandboxId: sid, previewUrl } = await callCreateSandbox(projectId)
      sandboxId = sid

      // Show preview iframe
      previewArea.innerHTML = `<iframe src="${previewUrl}" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"></iframe>`

      // Enable prompt input
      promptInput.disabled = false
      sendBtn.disabled = false
      setStatus("Ready — describe a change")
    } catch (err) {
      setStatus("Failed to start sandbox. Please try again.")
      console.error("[Lingua Code]", err)
    }
  })()

  // Send prompt
  async function sendPrompt() {
    const prompt = promptInput.value.trim()
    if (!prompt || isBusy || !sandboxId) return

    isBusy = true
    sendBtn.disabled = true
    promptInput.disabled = true
    addMessage("user", prompt)
    promptInput.value = ""
    setStatus("Applying changes…")

    try {
      const { changedFiles } = await callPrompt(sandboxId, prompt)
      addMessage("assistant", `Changed: ${changedFiles.join(", ")}`)
      hasChanges = true
      submitSection.style.display = "block"
      setStatus("Changes applied — review in the preview above")
    } catch (err) {
      addMessage("assistant", "Something went wrong. Please try again.")
      setStatus("Error applying changes")
    } finally {
      isBusy = false
      sendBtn.disabled = false
      promptInput.disabled = false
      promptInput.focus()
    }
  }

  sendBtn.addEventListener("click", sendPrompt)
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendPrompt()
    }
  })

  // Submit PR
  submitBtn.addEventListener("click", async () => {
    const email = shadow.getElementById("user-email").value.trim()
    const bounty = shadow.getElementById("bounty-amount").value.trim()

    if (!email || !bounty) {
      setStatus("Please enter your email and bounty amount")
      return
    }

    submitBtn.disabled = true
    setStatus("Opening PR…")

    try {
      const lastPrompt = messagesEl.querySelector(".message.user:last-of-type")?.textContent ?? "Improvement"
      const { prUrl } = await callSubmit({
        sandboxId,
        projectId,
        prompt: lastPrompt,
        bountyAmount: parseInt(bounty),
        userEmail: email,
      })

      previewArea.innerHTML = `
        <div style="text-align:center;padding:24px;color:#18181b;font-family:system-ui">
          <div style="font-size:32px;margin-bottom:12px">🎉</div>
          <div style="font-weight:600;margin-bottom:8px">PR opened!</div>
          <a href="${prUrl}" target="_blank" style="color:#16a34a;font-size:13px">View on GitHub →</a>
        </div>
      `
      submitSection.style.display = "none"
      setStatus("Submitted — waiting for review")
      sandboxId = null
    } catch (err) {
      setStatus("Failed to submit. Please try again.")
      submitBtn.disabled = false
    }
  })
}
```

### Step 5.4 — API calls from widget

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
  if (!res.ok) throw new Error("Failed to submit")
  return res.json()
}

export function callKillSandbox(sandboxId) {
  // Fire and forget
  fetch(`${API_URL}/api/sandbox/${sandboxId}`, { method: "DELETE" }).catch(() => {})
}
```

---

## Phase 6: Build and Serve Widget

### Step 6.1 — Add widget build to package.json

In the root `package.json`, add:

```json
{
  "scripts": {
    "build:widget": "cd widget && npm install && node build.js",
    "dev": "npm run build:widget && next dev",
    "build": "npm run build:widget && next build"
  }
}
```

### Step 6.2 — Serve widget.js statically

`public/widget.js` is automatically served by Next.js at `/widget.js`. No extra config needed.

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

### Step 8.1 — Vercel config

Create `vercel.json` in project root:

```json
{
  "functions": {
    "app/api/sandbox/create/route.ts": {
      "maxDuration": 120
    },
    "app/api/sandbox/prompt/route.ts": {
      "maxDuration": 60
    },
    "app/api/sandbox/submit/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### Step 8.2 — Environment variables

Add all variables from `.env.local` to your Vercel project settings. Update `NEXTAUTH_URL` to your production domain.

---

## Build Order Summary

Build and test in this exact order:

1. **Phase 1** — Project setup, dependencies, Supabase schema
2. **Phase 2** — Auth (verify GitHub login works, company row created)
3. **Phase 3** — Dashboard (verify project CRUD works, script tag displays)
4. **Phase 4.1** — Project config endpoint (test with curl)
5. **Phase 4.2** — Sandbox create endpoint (test E2B spins up, URL returns)
6. **Phase 4.3** — Prompt endpoint (test LLM edits a file in sandbox)
7. **Phase 4.4** — Submit endpoint (test PR appears in GitHub)
8. **Phase 4.5** — Kill endpoint
9. **Phase 5** — Widget (build bundle, test by adding script tag to a local React app)
10. **Phase 6** — Wire widget build into Next.js build
11. **Phase 8** — Deploy to Vercel

---

## Known Limitations (Do Not Fix in MVP)

- **Vite config overwrite**: The sandbox overwrites the company's `vite.config.js` to allow E2B hosts. This is fine for MVP but a real integration should merge configs.
- **No streaming**: LLM response waits for full completion before writing files. Streaming can be added later.
- **Full file context**: All `src/` files are sent to Claude on every prompt. Fine for small apps; will hit token limits on large repos.
- **Single-turn LLM**: Each prompt is a fresh call. Multi-turn conversation history is not maintained.
- **No sandbox pre-warming**: Cold start includes `git clone` + `npm install`. For large repos this may take 2+ minutes.
- **Manual bounty payment**: Bounty amount is stored and shown in PR but paid manually outside the system.
