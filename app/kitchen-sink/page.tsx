"use client"

import { useEffect } from "react"

export default function KitchenSinkPage() {
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "/widget.js"
    script.setAttribute("data-project-id", "kitchen-sink")
    document.body.appendChild(script)
    return () => {
      script.remove()
      // Clean up widget DOM if it was injected
      document.getElementById("lc-trigger")?.remove()
      document.getElementById("lc-overlay")?.remove()
    }
  }, [])

  return (
    <div style={{ minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <nav
        style={{
          height: 56,
          background: "#3b82f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          color: "#fff",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>Acme Inc</span>
        <div style={{ display: "flex", gap: 20, fontSize: 14 }}>
          <span>Home</span>
          <span>Products</span>
          <span>About</span>
          <span style={{ opacity: 0.7 }}>Contact</span>
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          JD
        </div>
      </nav>

      <div style={{ padding: "48px 24px", maxWidth: 640 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#18181b", marginBottom: 8 }}>
          Welcome back, John
        </h1>
        <p style={{ fontSize: 15, color: "#71717a", lineHeight: 1.6, marginBottom: 32 }}>
          Your dashboard is looking great. Here are your latest metrics.
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Revenue", value: "$12,450", change: "+12%" },
            { label: "Users", value: "1,284", change: "+8%" },
            { label: "Orders", value: "342", change: "+23%" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#71717a", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#18181b" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>{s.change}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#18181b", marginBottom: 12 }}>
            Recent Activity
          </h2>
          {[
            "New order #1042 from Sarah",
            "User signup: mike@example.com",
            "Payment received: $299",
            "Inventory alert: Widget Pro low stock",
          ].map((item, i) => (
            <div
              key={i}
              style={{
                padding: "10px 0",
                borderBottom: i < 3 ? "1px solid #f3f4f6" : "none",
                fontSize: 14,
                color: "#374151",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
