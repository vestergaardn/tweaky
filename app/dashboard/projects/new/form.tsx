"use client"

import { useEffect, useState } from "react"

type Repo = {
  full_name: string
  name: string
  html_url: string
  default_branch: string
  private: boolean
}

export function NewProjectForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>
}) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Repo | null>(null)
  const [name, setName] = useState("")

  useEffect(() => {
    fetch("/api/github/repos")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setRepos(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  function selectRepo(repo: Repo) {
    setSelected(repo)
    setName(repo.name)
    setSearch("")
  }

  return (
    <form action={action} className="space-y-4">
      {/* Hidden fields populated from selected repo */}
      <input type="hidden" name="repo_url" value={selected?.html_url ?? ""} />
      <input type="hidden" name="default_branch" value={selected?.default_branch ?? "main"} />

      {/* Repo picker */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-700">GitHub repository</label>
        {selected ? (
          <div className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm bg-zinc-50">
            <span className="flex items-center gap-2">
              <span className="font-medium">{selected.full_name}</span>
              {selected.private && (
                <span className="text-xs bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded">private</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-zinc-400 hover:text-zinc-600 text-sm"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <input
              type="text"
              placeholder={loading ? "Loading repos..." : "Search your repositories..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-sm outline-none"
              autoFocus
            />
            {!loading && (
              <ul className="max-h-56 overflow-y-auto border-t divide-y">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-zinc-400">No repos found</li>
                ) : (
                  filtered.map((repo) => (
                    <li key={repo.full_name}>
                      <button
                        type="button"
                        onClick={() => selectRepo(repo)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between"
                      >
                        <span>{repo.full_name}</span>
                        <span className="flex items-center gap-2 text-xs text-zinc-400">
                          {repo.private && (
                            <span className="bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">private</span>
                          )}
                          <span>{repo.default_branch}</span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Project name — auto-filled from repo but editable */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-700">Project name</label>
        <input
          name="name"
          placeholder="My App"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <Field name="install_command" label="Install command" placeholder="npm install" />
      <Field name="dev_command" label="Dev command" placeholder="npm run dev" />
      <Field name="dev_port" label="Dev port" placeholder="3000" />

      <button
        type="submit"
        disabled={!selected}
        className="w-full bg-zinc-900 text-white py-2.5 rounded-lg font-medium disabled:opacity-40"
      >
        Create Project
      </button>
    </form>
  )
}

function Field({
  name,
  label,
  placeholder,
}: {
  name: string
  label: string
  placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
      />
    </div>
  )
}
