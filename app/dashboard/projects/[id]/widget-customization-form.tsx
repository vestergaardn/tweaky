"use client"

import { useState, useRef } from "react"

interface Props {
  projectId: string
  scriptTagId: string
  initialConfig: {
    widget_launch_type: "button" | "text-link"
    widget_button_color: string
    widget_button_text: string
    widget_icon_only: boolean
    widget_logo_url: string | null
    widget_welcome_message: string | null
  }
  updateWidgetConfig: (formData: FormData) => Promise<void>
}

export function WidgetCustomizationForm({
  projectId,
  scriptTagId,
  initialConfig,
  updateWidgetConfig,
}: Props) {
  const [launchType, setLaunchType] = useState(initialConfig.widget_launch_type)
  const [buttonColor, setButtonColor] = useState(initialConfig.widget_button_color)
  const [buttonText, setButtonText] = useState(initialConfig.widget_button_text)
  const [iconOnly, setIconOnly] = useState(initialConfig.widget_icon_only)
  const [logoUrl, setLogoUrl] = useState(initialConfig.widget_logo_url)
  const [welcomeMessage, setWelcomeMessage] = useState(initialConfig.widget_welcome_message ?? "")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const WELCOME_MAX = 150

  async function handleSave() {
    setSaving(true)
    const fd = new FormData()
    fd.set("widget_launch_type", launchType)
    fd.set("widget_button_color", buttonColor)
    fd.set("widget_button_text", buttonText)
    fd.set("widget_icon_only", iconOnly ? "true" : "false")
    fd.set("widget_welcome_message", welcomeMessage)
    await updateWidgetConfig(fd)
    setSaving(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.set("file", file)
    const res = await fetch(`/api/projects/${projectId}/logo`, {
      method: "POST",
      body: fd,
    })
    if (res.ok) {
      const { url } = await res.json()
      setLogoUrl(url)
    }
    setUploading(false)
  }

  async function handleLogoRemove() {
    setUploading(true)
    const res = await fetch(`/api/projects/${projectId}/logo`, {
      method: "DELETE",
    })
    if (res.ok) {
      setLogoUrl(null)
    }
    setUploading(false)
  }

  // Compute contrasting text color for preview
  function textColor(hex: string) {
    const c = hex.replace("#", "")
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? "#18181b" : "#ffffff"
  }

  const triggerSnippet = `<a href="#" data-tweaky-trigger data-project-id="${scriptTagId}">Suggest changes</a>`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-zinc-700">Widget customization</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Customize how the Tweaky widget appears on your site.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form fields */}
        <div className="space-y-5">
          {/* Launch type */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-700">Launch type</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="radio"
                  name="launch_type"
                  value="button"
                  checked={launchType === "button"}
                  onChange={() => setLaunchType("button")}
                  className="accent-zinc-900"
                />
                Floating button
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="radio"
                  name="launch_type"
                  value="text-link"
                  checked={launchType === "text-link"}
                  onChange={() => setLaunchType("text-link")}
                  className="accent-zinc-900"
                />
                Inline text link
              </label>
            </div>
            {launchType === "text-link" && (
              <div className="mt-2">
                <p className="text-xs text-zinc-500 mb-1">
                  Place this element in your HTML where you want the trigger:
                </p>
                <pre className="bg-zinc-900 text-zinc-100 text-xs rounded-lg p-3 overflow-x-auto">
                  <code>{triggerSnippet}</code>
                </pre>
              </div>
            )}
          </fieldset>

          {/* Button color */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Button color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={buttonColor}
                onChange={(e) => setButtonColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-zinc-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={buttonColor}
                onChange={(e) => setButtonColor(e.target.value)}
                className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm font-mono w-28"
                maxLength={7}
              />
            </div>
          </div>

          {/* Button text */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Button text</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                disabled={iconOnly}
                className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm flex-1 disabled:opacity-50"
                placeholder="✦ Tweak this"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-600 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={iconOnly}
                  onChange={(e) => setIconOnly(e.target.checked)}
                  className="accent-zinc-900"
                />
                Icon only
              </label>
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Logo</label>
            <p className="text-xs text-zinc-500">
              Shown at the top of the editor panel. Max 2MB, PNG/JPEG/SVG/WebP.
            </p>
            <div className="flex items-center gap-3">
              {logoUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-8 rounded border border-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    disabled={uploading}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="text-sm text-zinc-600"
              />
              {uploading && <span className="text-xs text-zinc-400">Uploading...</span>}
            </div>
          </div>

          {/* Welcome message */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Welcome message</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => {
                if (e.target.value.length <= WELCOME_MAX) {
                  setWelcomeMessage(e.target.value)
                }
              }}
              rows={3}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="e.g. Got a suggestion? Describe a change and we'll review it!"
            />
            <div className="text-xs text-zinc-400 text-right">
              {welcomeMessage.length}/{WELCOME_MAX}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-zinc-900 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-zinc-700">Preview</div>

          {/* Button preview */}
          <div className="border border-zinc-200 rounded-lg p-6 bg-zinc-50 flex items-end justify-end min-h-[120px] relative">
            <span className="text-xs text-zinc-400 absolute top-3 left-3">Launcher</span>
            {launchType === "button" ? (
              <button
                style={{
                  background: buttonColor,
                  color: textColor(buttonColor),
                  border: "none",
                  borderRadius: "9999px",
                  padding: iconOnly ? "10px 14px" : "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {iconOnly ? "✦" : buttonText || "✦ Tweak this"}
              </button>
            ) : (
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{
                  color: buttonColor,
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "underline",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {buttonText || "Suggest changes"}
              </a>
            )}
          </div>

          {/* Chat header preview */}
          <div className="border border-zinc-200 rounded-lg overflow-hidden">
            <span className="text-xs text-zinc-400 px-3 pt-2 block bg-zinc-50">Editor panel</span>
            <div
              style={{ background: buttonColor }}
              className="h-11 flex items-center px-4 gap-2"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-7" style={{ filter: "brightness(0) invert(1)" }} />
              ) : (
                <span
                  style={{ color: textColor(buttonColor) }}
                  className="text-sm font-semibold opacity-90"
                >
                  ✦ Tweaky
                </span>
              )}
            </div>
            {/* Tabs preview */}
            <div className="flex border-b border-zinc-200 bg-white">
              <div
                className="px-4 py-2 text-xs font-semibold"
                style={{ borderBottom: `2px solid ${buttonColor}`, color: "#18181b" }}
              >
                Chat
              </div>
              <div className="px-4 py-2 text-xs font-semibold text-zinc-400">
                History
              </div>
            </div>
            {/* Welcome message preview */}
            <div className="bg-white p-4 min-h-[80px]">
              {welcomeMessage ? (
                <div className="bg-zinc-100 text-zinc-800 text-xs p-2.5 rounded-xl rounded-bl max-w-[80%]">
                  {welcomeMessage}
                </div>
              ) : (
                <div className="text-xs text-zinc-300 italic">No welcome message</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
