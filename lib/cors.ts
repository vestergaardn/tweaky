import { NextResponse } from "next/server"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export function corsResponse(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(key, value)
  }
  return res
}

export function corsOptions() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
