"use client"

import { useState } from "react"

type EnvVar = { id: string; key: string }

export function EnvVarsForm({
  envVars,
  envFilePath,
  addEnvVar,
  bulkAddEnvVars,
  deleteEnvVar,
  revealEnvVar,
  updateEnvFilePath,
}: {
  envVars: EnvVar[]
  envFilePath: string
  addEnvVar: (formData: FormData) => Promise<void>
  bulkAddEnvVars: (formData: FormData) => Promise<void>
  deleteEnvVar: (formData: FormData) => Promise<void>
  revealEnvVar: (formData: FormData) => Promise<string>
  updateEnvFilePath: (formData: FormData) => Promise<void>
}) {
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [bulkText, setBulkText] = useState("")
  const [showBulk, setShowBulk] = useState(envVars.length === 0)

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
        <h2 className="font-semibold">Environment Variables</h2>
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

      {/* Env file path */}
      <form action={updateEnvFilePath} className="flex items-center gap-2">
        <label className="text-sm text-zinc-500 shrink-0">File path:</label>
        <input
          name="env_file_path"
          defaultValue={envFilePath}
          className="border rounded px-2 py-1 text-sm flex-1 outline-none focus:ring-2 focus:ring-zinc-900"
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
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <button
            type="submit"
            disabled={!bulkText.trim()}
            className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            Import Variables
          </button>
        </form>
      )}

      {/* Existing vars */}
      {envVars.length > 0 && (
        <div className="border rounded-xl divide-y">
          {envVars.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-mono font-medium">{v.key}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-400 text-xs">
                  {revealed[v.id] ?? "••••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => handleReveal(v.id)}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  {revealed[v.id] ? "Hide" : "Reveal"}
                </button>
                <form action={deleteEnvVar}>
                  <input type="hidden" name="id" value={v.id} />
                  <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                    Delete
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
          className="border rounded-lg px-3 py-2 text-sm font-mono flex-1 outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <input
          name="value"
          placeholder="value"
          required
          className="border rounded-lg px-3 py-2 text-sm font-mono flex-1 outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <button
          type="submit"
          className="bg-zinc-100 hover:bg-zinc-200 px-4 py-2 rounded-lg text-sm font-medium"
        >
          Add
        </button>
      </form>
    </div>
  )
}
