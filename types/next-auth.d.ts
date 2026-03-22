import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      companyId: string
      githubLogin: string
    } & DefaultSession["user"]
  }
}
