const scriptTag =
  document.currentScript ||
  document.querySelector("script[data-project-id]")
const API_URL = scriptTag
  ? new URL(scriptTag.src).origin
  : window.location.origin

export async function callCreateSandbox(projectId) {
  const res = await fetch(`${API_URL}/api/sandbox/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scriptTagId: projectId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Failed to create sandbox")
  }
  return res.json()
}

export async function callPrompt(sandboxId, prompt) {
  const res = await fetch(`${API_URL}/api/sandbox/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sandboxId, prompt }),
  })
  if (!res.ok) throw new Error("Failed to apply prompt")
  return res.json()
}

export async function callSubmit({ sandboxId, projectId, prompt, bountyAmount, userEmail }) {
  const res = await fetch(`${API_URL}/api/sandbox/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sandboxId, scriptTagId: projectId, prompt, bountyAmount, userEmail }),
  })
  if (!res.ok) throw new Error("Failed to submit PR")
  return res.json()
}

export function callKillSandbox(sandboxId) {
  fetch(`${API_URL}/api/sandbox/${sandboxId}`, { method: "DELETE" }).catch(() => {})
}

export async function fetchProjectConfig(projectId) {
  const res = await fetch(`${API_URL}/api/projects/${projectId}`)
  if (!res.ok) throw new Error("Failed to fetch project config")
  return res.json()
}

export async function fetchSubmissions(projectId, email) {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/submissions?email=${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error("Failed to fetch submissions")
  return res.json()
}
