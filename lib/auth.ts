import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { getSupabaseAdmin } from "./supabase"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          // repo scope is required to open PRs on the company's behalf
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && account.access_token) {
        try {
          const { error } = await getSupabaseAdmin().from("companies").upsert({
            github_id: String(account.providerAccountId),
            github_login: (profile as any)?.login ?? user.name ?? "",
            github_token: account.access_token,
          }, { onConflict: "github_id" })
          if (error) {
            console.error("Failed to upsert company on sign-in:", error)
            return false
          }
        } catch (err) {
          console.error("Sign-in error (check SUPABASE env vars):", err)
          return false
        }
      }
      return true
    },
    async session({ session, token }) {
      try {
        const { data, error } = await getSupabaseAdmin()
          .from("companies")
          .select("id, github_login")
          .eq("github_id", String(token.sub))
          .maybeSingle()
        if (error) {
          console.error("Session company lookup failed:", error, "token.sub:", token.sub)
        } else if (data) {
          session.user.companyId = data.id
          session.user.githubLogin = data.github_login
        } else {
          console.error("No company found for github_id:", token.sub)
        }
      } catch (err) {
        console.error("Session callback error:", err)
      }
      return session
    },
  },
})
