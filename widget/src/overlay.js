import { callCreateSandbox, callPrompt, callSubmit, callKillSandbox, fetchSubmissions } from "./api.js"

export function openOverlay(projectId, config, onClose) {
  document.body.style.overflow = "hidden"

  const accentColor = config?.widget_button_color || "#18181b"
  const logoUrl = config?.widget_logo_url || null
  const welcomeMessage = config?.widget_welcome_message || null

  function textColorForBg(hex) {
    const c = hex.replace("#", "")
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#18181b" : "#fff"
  }

  const topBarFg = textColorForBg(accentColor)

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

  const titleContent = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="height:28px;max-width:160px;object-fit:contain;" />`
    : `<span id="lc-topbar-title" style="font-size:13px;font-weight:600;letter-spacing:-0.01em;opacity:0.9;">\u2726 Tweaky \u2014 Sandbox Preview</span>`

  overlay.innerHTML = `
    <style>
      #lc-overlay * { box-sizing: border-box; }

      /* ── Top bar ── */
      #lc-topbar {
        height: 44px;
        background: ${accentColor};
        color: ${topBarFg};
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        flex-shrink: 0;
      }
      #lc-topbar-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      #lc-chat-toggle {
        background: none;
        border: none;
        color: ${topBarFg};
        cursor: pointer;
        font-size: 13px;
        opacity: 0.6;
        padding: 4px 8px;
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 6px;
      }
      #lc-chat-toggle:hover { opacity: 1; }
      #lc-close-btn {
        background: none;
        border: none;
        color: ${topBarFg};
        cursor: pointer;
        font-size: 20px;
        opacity: 0.6;
        line-height: 1;
        padding: 0;
      }
      #lc-close-btn:hover { opacity: 1; }

      /* ── Main layout ── */
      #lc-main {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      /* ── Preview ── */
      #lc-preview {
        flex: 1;
        position: relative;
        overflow: hidden;
        min-width: 0;
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
        border-top-color: ${accentColor};
        border-radius: 50%;
        animation: lc-spin 0.7s linear infinite;
      }
      @keyframes lc-spin { to { transform: rotate(360deg); } }

      /* ── Chat side panel ── */
      #lc-panel {
        width: 380px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-left: 1px solid #e4e4e7;
        background: #fff;
        transition: width 0.25s ease, opacity 0.25s ease;
        overflow: hidden;
      }
      #lc-panel.collapsed {
        width: 0;
        border-left: none;
        opacity: 0;
      }

      /* ── Tabs ── */
      #lc-tabs {
        display: flex;
        border-bottom: 1px solid #e4e4e7;
        flex-shrink: 0;
      }
      .lc-tab {
        flex: 1;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 600;
        color: #a1a1aa;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
      }
      .lc-tab:hover { color: #71717a; }
      .lc-tab.active {
        color: #18181b;
        border-bottom-color: ${accentColor};
      }
      #lc-tab-collapse {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.5;
        flex-shrink: 0;
      }
      #lc-tab-collapse:hover { opacity: 1; }

      /* ── Tab content ── */
      #lc-chat-content, #lc-history-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #lc-history-content { display: none; }

      /* ── Messages ── */
      #lc-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 8px;
      }
      .lc-msg {
        padding: 10px 14px;
        font-size: 13px;
        line-height: 1.5;
        max-width: 88%;
        animation: lc-msg-in 0.25s ease-out;
      }
      @keyframes lc-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .lc-msg.user {
        background: #18181b;
        color: #fff;
        align-self: flex-end;
        border-radius: 14px 14px 4px 14px;
      }
      .lc-msg.assistant {
        background: #f4f4f5;
        color: #18181b;
        align-self: flex-start;
        border-radius: 14px 14px 14px 4px;
      }

      /* ── Input pill ── */
      #lc-input-pill {
        margin: 12px;
        border: 1px solid #e4e4e7;
        border-radius: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        min-height: 104px;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        background: #fff;
      }
      #lc-prompt {
        flex: 1;
        border: none;
        outline: none;
        background: none;
        resize: none;
        padding: 16px 16px 8px;
        font-size: 13px;
        font-family: inherit;
        line-height: 1.5;
        color: #18181b;
      }
      #lc-prompt::placeholder { color: #a1a1aa; }
      #lc-prompt:disabled { opacity: 0.5; }
      #lc-send {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #18181b;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        align-self: flex-end;
        margin: 0 12px 12px 0;
        flex-shrink: 0;
        transition: background 0.15s ease;
      }
      #lc-send:disabled { background: #e4e4e7; cursor: not-allowed; }

      /* ── Submit section ── */
      #lc-submit-section {
        border-top: 1px solid #f4f4f5;
        padding: 12px;
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
      #lc-bounty { width: 110px; }
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

      /* ── Status ── */
      #lc-status {
        padding: 6px 16px 10px;
        font-size: 11px;
        color: #a1a1aa;
        text-align: center;
        flex-shrink: 0;
      }

      /* ── History ── */
      #lc-history-list {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      #lc-history-email-form {
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
      }
      #lc-history-email-form input {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        width: 100%;
        max-width: 260px;
      }
      #lc-history-email-form input:focus { border-color: #18181b; }
      #lc-history-email-form button {
        background: #18181b;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 8px 20px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }
      #lc-history-email-form button:disabled { opacity: 0.5; cursor: not-allowed; }
      .lc-history-item {
        padding: 12px;
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        margin-bottom: 8px;
      }
      .lc-history-item:last-child { margin-bottom: 0; }
      .lc-history-prompt {
        font-size: 13px;
        color: #18181b;
        line-height: 1.4;
        margin-bottom: 6px;
      }
      .lc-history-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #a1a1aa;
      }
      .lc-history-badge {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .lc-badge-merged { background: #dcfce7; color: #16a34a; }
      .lc-badge-rejected { background: #fee2e2; color: #dc2626; }
      .lc-badge-pending { background: #fef9c3; color: #a16207; }
      .lc-history-empty {
        text-align: center;
        color: #a1a1aa;
        font-size: 13px;
        padding: 32px 16px;
      }
    </style>

    <div id="lc-topbar">
      ${titleContent}
      <div id="lc-topbar-actions">
        <button id="lc-chat-toggle" title="Toggle chat panel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M2.5 7h9M2.5 10.5h5" stroke="${topBarFg}" stroke-width="1.3" stroke-linecap="round"/></svg>
          Chat
        </button>
        <button id="lc-close-btn">\u00d7</button>
      </div>
    </div>

    <div id="lc-main">
      <div id="lc-preview">
        <div id="lc-loading">
          <div id="lc-spinner"></div>
          <span>Starting sandbox \u2014 cloning repo and installing dependencies\u2026</span>
        </div>
      </div>

      <div id="lc-panel">
        <div id="lc-tabs">
          <button class="lc-tab active" data-tab="chat">Chat</button>
          <button class="lc-tab" data-tab="history">History</button>
          <button id="lc-tab-collapse" title="Collapse panel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="#71717a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <div id="lc-chat-content">
          <div id="lc-messages"></div>

          <div id="lc-input-pill">
            <textarea id="lc-prompt" placeholder="Describe a change\u2026" rows="1" disabled></textarea>
            <button id="lc-send" disabled>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M8 3L3 8M8 3L13 8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>

          <div id="lc-submit-section" style="display:none">
            <input type="email" id="lc-email" placeholder="Your email" />
            <input type="number" id="lc-bounty" placeholder="Bounty (pts)" min="1" />
            <button id="lc-submit">Submit PR \u2192</button>
          </div>

          <div id="lc-status">Initialising\u2026</div>
        </div>

        <div id="lc-history-content">
          <div id="lc-history-email-form">
            <p style="font-size:13px;color:#71717a;text-align:center;">Enter your email to see your past submissions.</p>
            <input type="email" id="lc-history-email" placeholder="your@email.com" />
            <button id="lc-history-load">Show history</button>
          </div>
          <div id="lc-history-list" style="display:none"></div>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  let sandboxId = null
  let isBusy = false
  const allPrompts = []
  let historyCache = null

  const loading = overlay.querySelector("#lc-loading")
  const preview = overlay.querySelector("#lc-preview")
  const panel = overlay.querySelector("#lc-panel")
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

  // Show welcome message if configured
  if (welcomeMessage) {
    addMessage("assistant", welcomeMessage)
  }

  // Auto-scroll when messages area content changes
  const scrollObserver = new ResizeObserver(() => {
    messages.scrollTop = messages.scrollHeight
  })
  scrollObserver.observe(messages)

  // Auto-expanding textarea
  promptEl.addEventListener("input", () => {
    promptEl.style.height = "auto"
    const lineHeight = parseFloat(getComputedStyle(promptEl).lineHeight) || 20
    const maxHeight = lineHeight * 4
    promptEl.style.height = Math.min(promptEl.scrollHeight, maxHeight) + "px"
  })

  // ── Tab switching ──
  const tabs = overlay.querySelectorAll(".lc-tab")
  const chatContent = overlay.querySelector("#lc-chat-content")
  const historyContent = overlay.querySelector("#lc-history-content")

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab")
      tabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")

      if (target === "chat") {
        chatContent.style.display = "flex"
        historyContent.style.display = "none"
      } else {
        chatContent.style.display = "none"
        historyContent.style.display = "flex"
      }
    })
  })

  // ── History tab ──
  const historyEmailInput = overlay.querySelector("#lc-history-email")
  const historyLoadBtn = overlay.querySelector("#lc-history-load")
  const historyEmailForm = overlay.querySelector("#lc-history-email-form")
  const historyList = overlay.querySelector("#lc-history-list")

  historyLoadBtn.addEventListener("click", async () => {
    const email = historyEmailInput.value.trim()
    if (!email) return

    historyLoadBtn.disabled = true
    historyLoadBtn.textContent = "Loading..."

    try {
      const submissions = await fetchSubmissions(projectId, email)
      historyCache = submissions
      renderHistory(submissions)
      historyEmailForm.style.display = "none"
      historyList.style.display = "block"
    } catch {
      historyLoadBtn.textContent = "Failed — try again"
    } finally {
      historyLoadBtn.disabled = false
      if (historyLoadBtn.textContent === "Loading...") {
        historyLoadBtn.textContent = "Show history"
      }
    }
  })

  historyEmailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      historyLoadBtn.click()
    }
  })

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  function renderHistory(submissions) {
    if (!submissions.length) {
      historyList.innerHTML = `<div class="lc-history-empty">No submissions found for this email.</div>`
      return
    }

    historyList.innerHTML = submissions.map((s) => {
      const badgeClass = s.status === "merged" ? "lc-badge-merged" : s.status === "rejected" ? "lc-badge-rejected" : "lc-badge-pending"
      const promptText = s.user_prompt.length > 80 ? s.user_prompt.slice(0, 80) + "\u2026" : s.user_prompt
      const prLink = s.pr_url ? `<a href="${s.pr_url}" target="_blank" rel="noopener" style="color:${accentColor};text-decoration:none;font-weight:500;">PR #${s.pr_number}</a>` : ""

      return `
        <div class="lc-history-item">
          <div class="lc-history-prompt">${escapeHtml(promptText)}</div>
          <div class="lc-history-meta">
            <span class="lc-history-badge ${badgeClass}">${s.status}</span>
            ${prLink}
            <span>${timeAgo(s.created_at)}</span>
          </div>
        </div>
      `
    }).join("")
  }

  function escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }

  // Collapse / expand panel
  const chatToggle = overlay.querySelector("#lc-chat-toggle")
  function updateToggleStyle() {
    const isCollapsed = panel.classList.contains("collapsed")
    chatToggle.style.opacity = isCollapsed ? "1" : "0.6"
    chatToggle.style.background = isCollapsed ? "rgba(255,255,255,0.15)" : "none"
  }
  chatToggle.addEventListener("click", () => {
    panel.classList.toggle("collapsed")
    updateToggleStyle()
  })
  overlay.querySelector("#lc-tab-collapse").addEventListener("click", () => {
    panel.classList.add("collapsed")
    updateToggleStyle()
  })

  function closeOverlay() {
    scrollObserver.disconnect()
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
    promptEl.style.height = "auto"
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
