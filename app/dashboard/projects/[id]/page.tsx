import { redirect } from "next/navigation"

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // TODO: restore auth + Supabase data fetching once env vars are configured
  redirect("/dashboard")
}
