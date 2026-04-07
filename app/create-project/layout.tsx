import Image from "next/image"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Timeline } from "./timeline"

export default async function CreateProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/")
  return (
    <div className="relative flex min-h-screen bg-[#181e39] overflow-hidden">
      {/* Gradient blob — positioned left, partially off-screen */}
      <Image
        src="/onboarding-gradient.svg"
        alt=""
        width={720}
        height={773}
        className="pointer-events-none absolute -left-[306px] top-0"
        priority
      />

      {/* Tweaky logo */}
      <div className="absolute left-10 top-6 z-10 flex items-center gap-0">
        <span className="text-white text-[16.5px] font-black tracking-tight font-sans">
          T
        </span>
        <Image
          src="/tweaky-w.svg"
          alt=""
          width={23}
          height={18}
          className="rotate-[3.6deg] -mx-0.5"
        />
        <span className="text-white text-[16.5px] font-black tracking-tight font-sans">
          eaky
        </span>
      </div>

      {/* Left sidebar with timeline */}
      <aside className="relative z-10 flex w-56 flex-col justify-center pl-10">
        <Timeline />
      </aside>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center -ml-56">
        {children}
      </main>
    </div>
  )
}
