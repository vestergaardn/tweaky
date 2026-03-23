import Image from "next/image"
import { auth, signIn } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-background flex flex-col items-center overflow-hidden">
      <div className="mt-[70px]">
        <Image src="/Group 1.svg" alt="Tweaky" width={144} height={32} />
      </div>

      <div className="flex flex-col items-center mt-[133px]">
        <p className="text-center text-neutral-800 text-2xl font-medium">
          Crowdsourced feature development
        </p>

        <h1 className="max-w-[730px] mt-4 text-center text-neutral-800 text-6xl font-bold leading-tight">
          Let users improve your application with zero access to code.
        </h1>

        <form
          action={async () => {
            "use server"
            await signIn("github")
          }}
          className="mt-8"
        >
          <button
            type="submit"
            className="gradient-btn px-6 py-3.5 text-white text-1.5xl font-normal rounded-[500px]"
          >
            Connect repo
          </button>
        </form>
      </div>
    </div>
  )
}
