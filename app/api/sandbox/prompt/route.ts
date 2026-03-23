import { Sandbox } from "@e2b/code-interpreter"
import Anthropic from "@anthropic-ai/sdk"
import { corsResponse, corsOptions } from "@/lib/cors"

export const maxDuration = 60

export function OPTIONS() { return corsOptions() }

const anthropic = new Anthropic()

export async function POST(req: Request) {
  try {
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
      max_tokens: 8192,
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
      return corsResponse({ error: "LLM returned invalid response" }, { status: 500 })
    }

    for (const file of changedFiles) {
      await sandbox.files.write(`/app/${file.path}`, file.content)
    }

    return corsResponse({
      success: true,
      changedFiles: changedFiles.map((f) => f.path),
    })
  } catch (error) {
    console.error("[sandbox/prompt] Error:", error)
    return corsResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
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
