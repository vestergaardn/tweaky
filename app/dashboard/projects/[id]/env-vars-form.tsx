"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Eye, EyeOff, Trash2 } from "lucide-react"
import { VercelImportModal } from "./vercel-import-modal"

type EnvVar = { id: string; key: string }

export function EnvVarsForm({
  envVars,
  envFilePath,
  projectId,
  vercelConnected,
  addEnvVar,
  bulkAddEnvVars,
  deleteEnvVar,
  revealEnvVar,
  updateEnvFilePath,
}: {
  envVars: EnvVar[]
  envFilePath: string
  projectId: string
  vercelConnected: boolean
  addEnvVar: (formData: FormData) => Promise<void>
  bulkAddEnvVars: (formData: FormData) => Promise<void>
  deleteEnvVar: (formData: FormData) => Promise<void>
  revealEnvVar: (formData: FormData) => Promise<string>
  updateEnvFilePath: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [bulkText, setBulkText] = useState("")
  const [showBulk, setShowBulk] = useState(envVars.length === 0)
  const [showVercelModal, setShowVercelModal] = useState(false)

  async function handleReveal(id: string) {
    if (revealed[id]) {
      setRevealed((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    const fd = new FormData()
    fd.set("id", id)
    const value = await revealEnvVar(fd)
    setRevealed((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound size={16} className="text-zinc-400" />
          Environment Variables
        </h2>
        <div className="flex items-center gap-3">
          {vercelConnected ? (
            <button
              type="button"
              onClick={() => setShowVercelModal(true)}
              className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
            >
              <svg width="13" height="13" viewBox="0 0 76 65" fill="currentColor"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" /></svg>
              Import from Vercel
            </button>
          ) : (
            <a
              href={`/api/vercel/connect?returnTo=/dashboard/projects/${projectId}`}
              className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
            >
              <svg width="13" height="13" viewBox="0 0 76 65" fill="currentColor"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" /></svg>
              Connect Vercel
            </a>
          )}
          {envVars.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulk(!showBulk)}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              {showBulk ? "Hide bulk paste" : "Bulk paste"}
            </button>
          )}
        </div>
      </div>

      {showVercelModal && (
        <VercelImportModal
          projectId={projectId}
          onClose={() => setShowVercelModal(false)}
          onImported={() => router.refresh()}
        />
      )}

      {/* Env file path */}
      <form action={updateEnvFilePath} className="flex items-center gap-2">
        <label className="text-sm text-zinc-500 shrink-0">File path:</label>
        <input
          name="env_file_path"
          defaultValue={envFilePath}
          className="border rounded px-2 py-1 text-sm flex-1 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:border-zinc-400"
        />
        <button
          type="submit"
          className="text-xs bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded"
        >
          Save
        </button>
      </form>

      {/* Bulk paste */}
      {showBulk && (
        <form action={bulkAddEnvVars} className="space-y-2">
          <p className="text-sm text-zinc-500">
            Paste your <code className="bg-zinc-100 px-1 rounded">.env</code> file contents:
          </p>
          <textarea
            name="bulk"
            rows={8}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`DB_URL=mongodb+srv://...\nAPI_KEY=sk-...\nSECRET=mysecret`}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:border-zinc-400 placeholder:text-zinc-300"
          />
          <button
            type="submit"
            disabled={!bulkText.trim()}
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            Import Variables
          </button>
        </form>
      )}

      {/* Existing vars */}
      {envVars.length > 0 && (
        <div className="border rounded-xl divide-y">
          {envVars.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-zinc-50 transition-colors">
              <span className="font-mono font-medium">{v.key}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-400 text-xs">
                  {revealed[v.id] ?? "••••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => handleReveal(v.id)}
                  className="text-zinc-400 hover:text-zinc-600 p-1 rounded"
                  title={revealed[v.id] ? "Hide" : "Reveal"}
                >
                  {revealed[v.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <form action={deleteEnvVar}>
                  <input type="hidden" name="id" value={v.id} />
                  <button
                    type="submit"
                    className="text-zinc-400 hover:text-red-500 p-1 rounded"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add single var */}
      <form action={addEnvVar} className="flex gap-2">
        <input
          name="key"
          placeholder="KEY"
          required
          className="border rounded-lg px-3 py-2 text-sm font-mono flex-1 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:border-zinc-400"
        />
        <input
          name="value"
          placeholder="value"
          required
          className="border rounded-lg px-3 py-2 text-sm font-mono flex-1 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:border-zinc-400"
        />
        <button
          type="submit"
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium"
        >
          Add
        </button>
      </form>
    </div>
  )
}
