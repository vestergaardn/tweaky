import { callCreateSandbox, callPrompt, callSubmit, callKillSandbox } from "./api.js"

export function openOverlay(projectId, onClose) {
  document.body.style.overflow = "hidden"

  const overlay = document.createElement("div")
  overlay.id = "lc-overlay"
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #f4f4f5;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
  `

  overlay.innerHTML = `
    <style>
      #lc-overlay * { box-sizing: border-box; }

      #lc-topbar {
        height: 44px;
        background: #18181b;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        flex-shrink: 0;
      }
      #lc-topbar-title {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        opacity: 0.9;
      }
      #lc-close-btn {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        font-size: 20px;
        opacity: 0.6;
        line-height: 1;
        padding: 0;
      }
      #lc-close-btn:hover { opacity: 1; }

      #lc-preview {
        flex: 1;
        position: relative;
        overflow: hidden;
      }
      #lc-preview iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
      }
      #lc-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: #71717a;
        font-size: 14px;
      }
      #lc-spinner {
        width: 28px;
        height: 28px;
        border: 2.5px solid #e4e4e7;
        border-top-color: #18181b;
        border-radius: 50%;
        animation: lc-spin 0.7s linear infinite;
      }
      @keyframes lc-spin { to { transform: rotate(360deg); } }

      #lc-toolbar {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: min(680px, calc(100vw - 32px));
        background: #fff;
        border: 1px solid #e4e4e7;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.15);
        overflow: hidden;
      }

      #lc-messages {
        max-height: 160px;
        overflow-y: auto;
        padding: 10px 12px 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #lc-messages:empty { display: none; }
      .lc-msg {
        padding: 7px 11px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.45;
        max-width: 88%;
      }
      .lc-msg.user { background: #18181b; color: #fff; align-self: flex-end; }
      .lc-msg.assistant { background: #f4f4f5; color: #18181b; align-self: flex-start; }

      #lc-input-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 10px 12px;
      }
      #lc-prompt {
        flex: 1;
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        resize: none;
        min-height: 38px;
        max-height: 120px;
        outline: none;
        line-height: 1.4;
      }
      #lc-prompt:focus { border-color: #18181b; }
      #lc-prompt:disabled { background: #fafafa; }
      #lc-send {
        background: #18181b;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 9px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        height: 38px;
      }
      #lc-send:disabled { opacity: 0.35; cursor: not-allowed; }

      #lc-submit-section {
        border-top: 1px solid #f4f4f5;
        padding: 10px 12px;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      #lc-email, #lc-bounty {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 7px 11px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
      }
      #lc-email:focus, #lc-bounty:focus { border-color: #18181b; }
      #lc-email { flex: 1; }
      #lc-bounty { width: 130px; }
      #lc-submit {
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
      }
      #lc-submit:disabled { opacity: 0.35; cursor: not-allowed; }

      #lc-status {
        padding: 5px 12px 8px;
        font-size: 11px;
        color: #a1a1aa;
        text-align: center;
      }
    </style>

    <div id="lc-topbar">
      <span id="lc-topbar-title">\u2726 Tweaky \u2014 Sandbox Preview</span>
      <button id="lc-close-btn">\u00d7</button>
    </div>

    <div id="lc-preview">
      <div id="lc-loading">
        <div id="lc-spinner"></div>
        <span>Starting sandbox \u2014 cloning repo and installing dependencies\u2026</span>
      </div>
    </div>

    <div id="lc-toolbar">
      <div id="lc-messages"></div>
      <div id="lc-input-row">
        <textarea id="lc-prompt" placeholder="Describe a change\u2026" rows="1" disabled></textarea>
        <button id="lc-send" disabled>Send</button>
      </div>
      <div id="lc-submit-section" style="display:none">
        <input type="email" id="lc-email" placeholder="Your email" />
        <input type="number" id="lc-bounty" placeholder="Bounty (points)" min="1" />
        <button id="lc-submit">Submit PR \u2192</button>
      </div>
      <div id="lc-status">Initialising\u2026</div>
    </div>
  `

  document.body.appendChild(overlay)

  let sandboxId = null
  let isBusy = false
  const allPrompts = []

  const loading = overlay.querySelector("#lc-loading")
  const preview = overlay.querySelector("#lc-preview")
  const messages = overlay.querySelector("#lc-messages")
  const promptEl = overlay.querySelector("#lc-prompt")
  const sendBtn = overlay.querySelector("#lc-send")
  const submitSection = overlay.querySelector("#lc-submit-section")
  const submitBtn = overlay.querySelector("#lc-submit")
  const statusEl = overlay.querySelector("#lc-status")

  function setStatus(text) { statusEl.textContent = text }

  function addMessage(role, text) {
    const el = document.createElement("div")
    el.className = `lc-msg ${role}`
    el.textContent = text
    messages.appendChild(el)
    messages.scrollTop = messages.scrollHeight
  }

  function closeOverlay() {
    document.body.style.overflow = ""
    if (sandboxId) callKillSandbox(sandboxId)
    overlay.remove()
    onClose()
  }

  overlay.querySelector("#lc-close-btn").addEventListener("click", closeOverlay)

  // Boot sandbox
  ;(async () => {
    try {
      setStatus("Cloning repo and installing dependencies \u2014 this may take a minute\u2026")
      const { sandboxId: sid, previewUrl } = await callCreateSandbox(projectId)
      sandboxId = sid

      loading.style.display = "none"
      const iframe = document.createElement("iframe")
      iframe.src = previewUrl
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms allow-popups allow-modals")
      iframe.setAttribute("allow", "clipboard-read; clipboard-write")
      preview.appendChild(iframe)

      promptEl.disabled = false
      sendBtn.disabled = false
      setStatus("Ready \u2014 the app is running live. Describe a change below.")
    } catch (err) {
      loading.innerHTML = `
        <div style="color:#ef4444;font-size:20px;margin-bottom:4px;">\u2716</div>
        <span style="color:#71717a;">Failed to start sandbox. Please close and try again.</span>
      `
      setStatus("Something went wrong.")
      console.error("[Tweaky]", err)
    }
  })()

  async function sendPrompt() {
    const prompt = promptEl.value.trim()
    if (!prompt || isBusy || !sandboxId) return

    isBusy = true
    allPrompts.push(prompt)
    sendBtn.disabled = true
    promptEl.disabled = true
    promptEl.value = ""
    addMessage("user", prompt)
    setStatus("Applying changes\u2026")

    try {
      const { changedFiles } = await callPrompt(sandboxId, prompt)
      addMessage("assistant", `Done \u2014 changed: ${changedFiles.join(", ")}`)
      submitSection.style.display = "flex"
      setStatus("Changes applied. Review the app above, then submit your PR.")
    } catch {
      addMessage("assistant", "Something went wrong. Please try again.")
      setStatus("Error applying changes.")
    } finally {
      isBusy = false
      sendBtn.disabled = false
      promptEl.disabled = false
      promptEl.focus()
    }
  }

  sendBtn.addEventListener("click", sendPrompt)
  promptEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendPrompt()
    }
  })

  submitBtn.addEventListener("click", async () => {
    const email = overlay.querySelector("#lc-email").value.trim()
    const bounty = overlay.querySelector("#lc-bounty").value.trim()

    if (!email || !bounty) {
      setStatus("Please enter your email and a bounty amount.")
      return
    }

    submitBtn.disabled = true
    setStatus("Opening PR on GitHub\u2026")

    try {
      const { prUrl } = await callSubmit({
        sandboxId,
        projectId,
        prompt: allPrompts.join("\n"),
        bountyAmount: parseInt(bounty, 10),
        userEmail: email,
      })

      const successContainer = document.createElement("div")
      successContainer.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;color:#18181b;"

      const emoji = document.createElement("div")
      emoji.style.fontSize = "48px"
      emoji.textContent = "\ud83c\udf89"

      const title = document.createElement("div")
      title.style.cssText = "font-size:20px;font-weight:700"
      title.textContent = "PR opened!"

      const subtitle = document.createElement("div")
      subtitle.style.cssText = "font-size:14px;color:#71717a"
      subtitle.textContent = "The company will review your change."

      const link = document.createElement("a")
      link.href = /^https:\/\/github\.com\//.test(prUrl) ? prUrl : "#"
      link.target = "_blank"
      link.style.cssText = "color:#18181b;font-size:14px;font-weight:500;text-decoration:none;border-bottom:1px solid #18181b;"
      link.textContent = "View on GitHub \u2192"

      successContainer.append(emoji, title, subtitle, link)
      preview.replaceChildren(successContainer)
      submitSection.style.display = "none"
      setStatus("Submitted successfully.")
      sandboxId = null
    } catch {
      setStatus("Failed to submit. Please try again.")
      submitBtn.disabled = false
    }
  })
}
