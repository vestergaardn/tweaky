"use client"

import { useState, useEffect } from "react"
import { X, Loader2, Check, AlertTriangle } from "lucide-react"

type VercelProject = { id: string; name: string; framework: string | null }
type ImportResult = { imported: number; skipped: number; skippedKeys: string[] }

export function VercelImportModal({
  projectId,
  onClose,
  onImported,
}: {
  projectId: string
  onClose: () => void
  onImported: () => void
}) {
  const [projects, setProjects] = useState<VercelProject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState("")
  const [environment, setEnvironment] = useState("development")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/vercel/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data)
        if (data.length > 0) setSelectedProject(data[0].id)
      })
      .catch(() => setError("Failed to load Vercel projects"))
      .finally(() => setLoading(false))
  }, [])

  async function handleImport() {
    setImporting(true)
    setError("")
    try {
      const res = await fetch("/api/vercel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vercelProjectId: selectedProject,
          projectId,
          environment,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Import failed")
        return
      }
      const data: ImportResult = await res.json()
      setResult(data)
      if (data.imported > 0) onImported()
    } catch {
      setError("Import failed")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Import from Vercel</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-zinc-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="ml-2 text-sm">Loading Vercel projects...</span>
          </div>
        ) : result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <Check size={18} />
              <span className="text-sm font-medium">
                Imported {result.imported} variable{result.imported !== 1 ? "s" : ""}
              </span>
            </div>
            {result.skipped > 0 && (
              <div className="flex items-start gap-2 text-amber-600">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">
                    {result.skipped} secret variable{result.skipped !== 1 ? "s" : ""} could not be imported
                  </p>
                  <p className="text-zinc-500 mt-1">
                    Vercel doesn&apos;t expose secret/sensitive values via API.
                    You&apos;ll need to add these manually:
                  </p>
                  <ul className="mt-1 font-mono text-xs text-zinc-500">
                    {result.skippedKeys.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {projects.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">
                No projects found in your Vercel account.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">
                    Vercel Project
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.framework ? ` (${p.framework})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">
                    Environment
                  </label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
                  >
                    <option value="development">Development</option>
                    <option value="preview">Preview</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!selectedProject || importing}
                className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                Import
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
