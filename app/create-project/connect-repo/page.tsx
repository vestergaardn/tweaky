"use client"

import { useEffect, useState } from "react"
import { Loader2, Search, Lock } from "lucide-react"
import { StepNavigation } from "../continue-button"

type Repo = {
  full_name: string
  name: string
  html_url: string
  default_branch: string
  private: boolean
}

export default function ConnectRepoStep() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Repo | null>(null)

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

  return (
    <div className="flex w-96 flex-col">
      <h1 className="text-sm font-bold text-white">
        Pick a repository to connect
      </h1>

      <div className="mt-6">
        {selected ? (
          <div className="flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-white">
              <span className="font-medium">{selected.full_name}</span>
              {selected.private && (
                <Lock size={12} className="text-white/40" />
              )}
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs font-medium text-white/50 hover:text-white"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/20 bg-white/5">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="text"
                placeholder={
                  loading ? "Loading repos..." : "Search repositories..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent py-2.5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/30"
                autoFocus
              />
              {loading && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/40"
                />
              )}
            </div>
            {!loading && (
              <ul className="max-h-52 overflow-y-auto border-t border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-white/30">
                    No repos found
                  </li>
                ) : (
                  filtered.map((repo) => (
                    <li key={repo.full_name}>
                      <button
                        type="button"
                        onClick={() => setSelected(repo)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <span>{repo.full_name}</span>
                        <span className="flex items-center gap-2 text-xs text-white/30">
                          {repo.private && <Lock size={10} />}
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

      <StepNavigation next="/create-project/env-vars" disabled={!selected} />
    </div>
  )
}
