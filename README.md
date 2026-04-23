# Tweaky

**Let users improve your application with zero access to code.**

## What we're building

Introducing: open-sourced feature development.

10 years ago it was a competitive edge to write software. Simply being able to fix a problem mediocrely was enough, since very few people could write the zeros and ones. Times have changed. Software is everywhere and everyone can write it, so building what users want is the hard part. Today the process is broken.

Users sign up. They hit a wall. Submit feedback. Manager digs in. Adds to backlog. Prioritize and scope. Ship the changes.

With Tweaky, the technical barrier to contributing to software drops to zero. We drop a widget into your app that lets users describe the change they want. We spin up a container of your repository and let them prompt the change into reality. They set a bounty for what they think it's worth and submit the Pull Request for review. If you merge it, they get paid — and you've just built something users want with minimal engineering resources.

## How it works

1. **Sign up** with GitHub and connect the repository you want tweakable.
2. **Bring your env vars** — add them manually or import directly from Vercel so the sandbox can actually run your app.
3. **Customize the widget** — colors, logo, welcome message, launch behavior.
4. **Drop the script tag** into your site:
   ```html
   <script src="https://tweaky.vercel.app/widget.js" data-project-id="YOUR_PROJECT_ID"></script>
   ```
5. **Your users tweak.** They describe a change, preview it in a sandboxed container, set a bounty, and open a PR against your repo.
6. **You review and merge** like any other PR. Merged = contributor gets paid.

## Get started locally

### Prerequisites

- Node.js 20+
- A GitHub OAuth App
- A Supabase project (for projects, companies, encrypted env vars)
- An Anthropic API key (Claude powers the code generation)
- An E2B API key (sandboxed containers for previews)
- *(Optional)* A Vercel OAuth app if you want the "import env vars from Vercel" flow

### Install

```bash
git clone https://github.com/<your-fork>/tweaky.git
cd tweaky
npm install
```

### Configure

Create a `.env.local` with:

```bash
# AI + sandbox
ANTHROPIC_API_KEY=
E2B_API_KEY=

# Auth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXTAUTH_SECRET=        # openssl rand -base64 32
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# Database
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Encrypts env vars at rest
ENV_VAR_ENCRYPTION_KEY= # openssl rand -hex 32

# Optional — Vercel env var import
VERCEL_CLIENT_ID=
VERCEL_CLIENT_SECRET=
```

Apply the Supabase schema in `supabase/` to your project.

### Run

```bash
npm run dev
```

This builds the embeddable widget (`npm run build:widget`) and starts the Next.js dev server at [http://localhost:3000](http://localhost:3000).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · NextAuth 5 (GitHub) · Supabase · Anthropic Claude via the Vercel AI SDK · E2B for sandboxed code execution · Octokit for PR creation · esbuild for the embedded widget.

## Manifesto

The full pitch lives at [`/manifesto`](./app/manifesto/page.tsx) — or read it live at [tweaky.vercel.app/manifesto](https://tweaky.vercel.app/manifesto).
