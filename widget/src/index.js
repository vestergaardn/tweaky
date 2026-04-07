import { openOverlay } from "./overlay.js"
import { fetchProjectConfig } from "./api.js"

const scriptTag =
  document.currentScript ||
  document.querySelector("script[data-project-id]")

const projectId = scriptTag?.getAttribute("data-project-id")

if (!projectId) {
  console.error("[Tweaky] Missing data-project-id on script tag")
} else {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(projectId))
  } else {
    init(projectId)
  }
}

async function init(projectId) {
  let config
  try {
    config = await fetchProjectConfig(projectId)
  } catch (e) {
    console.error("[Tweaky] Failed to load config, using defaults", e)
    config = {}
  }

  const launchType = config.widget_launch_type || "button"
  const buttonColor = config.widget_button_color || "#18181b"
  const buttonText = config.widget_button_text || "\u2726 Tweak this"
  const iconOnly = config.widget_icon_only || false

  function textColorForBg(hex) {
    const c = hex.replace("#", "")
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#18181b" : "#fff"
  }

  function launchOverlay(triggerEl) {
    if (triggerEl) triggerEl.style.display = "none"
    openOverlay(projectId, config, () => {
      if (triggerEl) triggerEl.style.display = ""
    })
  }

  if (launchType === "text-link") {
    // Attach to existing elements with [data-tweaky-trigger]
    const triggers = document.querySelectorAll("[data-tweaky-trigger]")
    triggers.forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault()
        launchOverlay(null)
      })
    })
    if (!triggers.length) {
      console.warn("[Tweaky] Launch type is text-link but no [data-tweaky-trigger] elements found")
    }
  } else {
    // Create floating button
    const btn = document.createElement("button")
    btn.id = "lc-trigger"
    btn.textContent = iconOnly ? "\u2726" : buttonText
    const fgColor = textColorForBg(buttonColor)
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      background: ${buttonColor};
      color: ${fgColor};
      border: none;
      border-radius: 9999px;
      padding: ${iconOnly ? "12px 14px" : "10px 20px"};
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      font-family: system-ui, -apple-system, sans-serif;
      letter-spacing: -0.01em;
      transition: transform 0.15s, box-shadow 0.15s;
    `
    btn.onmouseenter = () => {
      btn.style.transform = "scale(1.04)"
      btn.style.boxShadow = "0 6px 28px rgba(0,0,0,0.3)"
    }
    btn.onmouseleave = () => {
      btn.style.transform = "scale(1)"
      btn.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)"
    }

    document.body.appendChild(btn)

    btn.addEventListener("click", () => {
      launchOverlay(btn)
    })
  }
}
