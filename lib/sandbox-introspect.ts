import type { Sandbox } from "@e2b/code-interpreter"

export type ProjectInfo = {
  framework: "nextjs" | "vite" | "cra" | "express" | "generic"
  hasPackageJson: boolean
  sourceDirs: string[]
}

export const INTROSPECT_CMD = `cd /home/user/app && echo '---TREE---' && find . -maxdepth 4 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*' | sort | head -200 && echo '---PKG---' && (cat package.json 2>/dev/null || echo '{}')`

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out",
  ".turbo", ".cache", "coverage", "__pycache__", ".svelte-kit",
])

const CONFIG_DIRS = new Set([
  ".github", ".vscode", ".husky", ".changeset",
])

const SOURCE_EXTENSIONS = /\.(tsx?|jsx?|css|vue|svelte|astro)$/
const CONFIG_FILES = new Set(["package.json", "tsconfig.json"])

const MAX_FILE_BYTES = 150_000

export function parseIntrospection(stdout: string): ProjectInfo {
  const treeStart = stdout.indexOf("---TREE---")
  const pkgStart = stdout.indexOf("---PKG---")

  const treePart = treeStart >= 0 && pkgStart >= 0
    ? stdout.slice(treeStart + 10, pkgStart).trim()
    : ""
  const pkgPart = pkgStart >= 0
    ? stdout.slice(pkgStart + 9).trim()
    : "{}"

  let pkg: Record<string, any> = {}
  let hasPackageJson = false
  try {
    pkg = JSON.parse(pkgPart)
    hasPackageJson = Object.keys(pkg).length > 0
  } catch {
    // empty or invalid — hasPackageJson stays false
  }

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  let framework: ProjectInfo["framework"] = "generic"
  if (allDeps["next"]) framework = "nextjs"
  else if (allDeps["react-scripts"]) framework = "cra"
  else if (allDeps["vite"]) framework = "vite"
  else if (allDeps["express"] && !allDeps["react"]) framework = "express"

  // Extract top-level directories from tree listing
  const sourceDirs: string[] = []
  for (const line of treePart.split("\n")) {
    const trimmed = line.trim()
    // Match lines like "./src" or "./app" (one level deep)
    const match = trimmed.match(/^\.\/([^/]+)$/)
    if (!match) continue
    const dir = match[1]
    if (SKIP_DIRS.has(dir) || CONFIG_DIRS.has(dir)) continue
    // Check it appears as a parent in the tree (i.e. it's a directory, not a file)
    const isDir = treePart.split("\n").some((l) => l.trim().startsWith(`./${dir}/`))
    if (isDir) sourceDirs.push(dir)
  }

  return { framework, hasPackageJson, sourceDirs }
}

export async function discoverSourceFiles(
  sandbox: Sandbox,
  appDir = "/home/user/app",
): Promise<Record<string, string>> {
  const skipArgs = [...SKIP_DIRS]
    .flatMap((d) => ["-not", "-path", `*/${d}/*`])
    .join(" ")

  const findResult = await sandbox.commands.run(
    `find ${appDir} -maxdepth 8 -type f ${skipArgs} | head -500`,
    { timeoutMs: 10_000 },
  )

  const allPaths = findResult.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  const sourcePaths = allPaths.filter((p) => {
    const name = p.split("/").pop() || ""
    return SOURCE_EXTENSIONS.test(name) || CONFIG_FILES.has(name)
  })

  // Skip lockfiles and large generated files
  const skipFiles = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"])
  const filtered = sourcePaths.filter((p) => {
    const name = p.split("/").pop() || ""
    return !skipFiles.has(name)
  })

  const result: Record<string, string> = {}
  let totalBytes = 0

  for (const fullPath of filtered) {
    if (totalBytes >= MAX_FILE_BYTES) break
    try {
      const content = await sandbox.files.read(fullPath)
      totalBytes += content.length
      const relPath = fullPath.replace(`${appDir}/`, "")
      result[relPath] = content
    } catch {
      // File unreadable — skip
    }
  }

  return result
}

export function buildSystemPrompt(info: ProjectInfo, filePaths: string[]): string {
  const frameworkDesc: Record<ProjectInfo["framework"], string> = {
    nextjs: "a Next.js application",
    vite: "a Vite-based application",
    cra: "a Create React App application",
    express: "an Express.js backend application",
    generic: "a JavaScript/TypeScript project",
  }

  const dirs = info.sourceDirs.length > 0
    ? `Source directories: ${info.sourceDirs.join(", ")}`
    : "Source files are in the project root"

  const fileList = filePaths
    .map((f) => `  - ${f}`)
    .join("\n")

  return `You are a code editor for ${frameworkDesc[info.framework]}.
${dirs}

You have access to the following source files:
${fileList}

Make only the changes needed to fulfil the user's request.

RULES:
- Respond with ONLY a JSON object. No explanation. No markdown fences.
- The JSON must have a "files" key: an array of {path, content} objects.
- "path" is relative to the project root (e.g. "src/components/Navbar.tsx").
- Only include files that need to change.
- Preserve all existing functionality unrelated to the request.

Example:
{"files": [{"path": "src/App.tsx", "content": "..."}]}`
}
