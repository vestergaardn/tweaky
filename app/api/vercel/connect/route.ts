import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { auth } from "@/lib/auth"

function signState(companyId: string, returnTo: string): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ""
  const payload = `${companyId}:${returnTo}`
  const hmac = createHmac("sha256", secret).update(payload).digest("hex")
  return Buffer.from(JSON.stringify({ companyId, returnTo, hmac })).toString(
    "base64url"
  )
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const returnTo =
    req.nextUrl.searchParams.get("returnTo") || "/dashboard"

  const clientId = process.env.VERCEL_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Vercel integration not configured" },
      { status: 500 }
    )
  }

  const state = signState(companyId, returnTo)
  const redirectUri = `${req.nextUrl.origin}/api/vercel/callback`

  const url = new URL("https://vercel.com/integrations/tweaky/new")
  url.searchParams.set("state", state)

  return NextResponse.redirect(url.toString())
}
