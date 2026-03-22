import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { supabaseAdmin } from "./supabase"

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
    async signIn({ user, account }) {
      if (account?.provider === "github" && account.access_token) {
        await supabaseAdmin.from("companies").upsert({
          github_id: String(account.providerAccountId),
          github_login: user.name ?? "",
          github_token: account.access_token,
        }, { onConflict: "github_id" })
      }
      return true
    },
    async session({ session, token }) {
      const { data } = await supabaseAdmin
        .from("companies")
        .select("id, github_login")
        .eq("github_id", String(token.sub))
        .single()
      if (data) {
        session.user.companyId = data.id
        session.user.githubLogin = data.github_login
      }
      return session
    },
  },
})
