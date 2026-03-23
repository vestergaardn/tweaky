import { openOverlay } from "./overlay.js"

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

function init(projectId) {
  const btn = document.createElement("button")
  btn.id = "lc-trigger"
  btn.textContent = "\u2726 Tweak this"
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483646;
    background: #18181b;
    color: #fff;
    border: none;
    border-radius: 9999px;
    padding: 10px 20px;
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
    btn.style.display = "none"
    openOverlay(projectId, () => {
      btn.style.display = "block"
    })
  })
}
