import { NextResponse } from "next/server"

export async function GET() {
  // TODO: restore auth + GitHub repo fetching once env vars are configured
  return NextResponse.json([])
}
