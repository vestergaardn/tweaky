import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase"

function verifyState(stateStr: string): { companyId: string; returnTo: string } | null {
  try {
    const { companyId, returnTo, hmac } = JSON.parse(
      Buffer.from(stateStr, "base64url").toString()
    )
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ""
    const expected = createHmac("sha256", secret)
      .update(`${companyId}:${returnTo}`)
      .digest("hex")
    if (hmac !== expected) return null
    return { companyId, returnTo }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 })
  }

  const verified = verifyState(state)
  if (!verified) {
    return NextResponse.json({ error: "Invalid state" }, { status: 403 })
  }

  const clientId = process.env.VERCEL_CLIENT_ID
  const clientSecret = process.env.VERCEL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Vercel integration not configured" }, { status: 500 })
  }

  const redirectUri = `${req.nextUrl.origin}/api/vercel/callback`

  const tokenRes = await fetch("https://api.vercel.com/v2/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    console.error("Vercel token exchange failed:", await tokenRes.text())
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 })
  }

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token
  const teamId = tokenData.team_id || null

  if (!accessToken) {
    return NextResponse.json({ error: "No access token received" }, { status: 502 })
  }

  await getSupabaseAdmin()
    .from("companies")
    .update({ vercel_token: accessToken, vercel_team_id: teamId })
    .eq("id", verified.companyId)

  return NextResponse.redirect(new URL(verified.returnTo, req.nextUrl.origin).toString())
}
