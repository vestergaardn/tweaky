import { Sandbox } from "@e2b/code-interpreter"
import { corsResponse, corsOptions } from "@/lib/cors"

export function OPTIONS() { return corsOptions() }

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const sandbox = await Sandbox.connect(id)
    await sandbox.kill()
  } catch {
    // Already dead — fine
  }
  return corsResponse({ success: true })
}
