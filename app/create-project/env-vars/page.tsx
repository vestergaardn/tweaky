"use client"

import { useState } from "react"
import { StepNavigation } from "../continue-button"

export default function EnvVarsStep() {
  const [envText, setEnvText] = useState("")

  return (
    <div className="flex w-96 flex-col">
      <h1 className="text-sm font-bold text-white">
        Insert your environment variables
      </h1>

      <div className="mt-6 space-y-3">
        <textarea
          rows={8}
          value={envText}
          onChange={(e) => setEnvText(e.target.value)}
          placeholder={`DB_URL=mongodb+srv://...\nAPI_KEY=sk-...\nSECRET=mysecret`}
          className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm font-mono text-white outline-none placeholder:text-white/30 focus:border-white/40"
        />

        <a
          href="/api/vercel/connect?returnTo=/create-project/env-vars"
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
        >
          <svg width="12" height="12" viewBox="0 0 76 65" fill="currentColor">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          Import from Vercel
        </a>
      </div>

      <StepNavigation
        next="/create-project/customize-widget"
        back="/create-project/connect-repo"
      />
    </div>
  )
}
