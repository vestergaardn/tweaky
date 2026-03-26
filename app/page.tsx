import Image from "next/image"
import { signIn } from "@/lib/auth"

export default async function Home() {

  return (
    <div className="relative min-h-screen bg-[#171d37] flex items-center justify-center overflow-hidden">
      {/* Aurora background */}
      <Image
        src="/hero-bg.svg"
        alt=""
        fill
        className="object-cover"
        priority
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-0">
          <span className="text-white text-[37px] font-black tracking-tight font-sans">
            T
          </span>
          <Image
            src="/tweaky-w.svg"
            alt=""
            width={51}
            height={38}
            className="rotate-[3.6deg] -mx-0.5"
          />
          <span className="text-white text-[37px] font-black tracking-tight font-sans">
            eaky
          </span>
        </div>

        {/* Tagline */}
        <p className="mt-6 max-w-[400px] text-center text-white text-[34px] font-normal leading-snug">
          Let users improve your application with zero access to code.
        </p>

        {/* Buttons */}
        <div className="mt-8 flex items-center gap-4">
          <form
            action={async () => {
              "use server"
              await signIn("github")
            }}
          >
            <button
              type="submit"
              className="border border-white text-white text-xs font-medium px-4 py-2 rounded-full hover:bg-white/10"
            >
              Sign up with GitHub
            </button>
          </form>

          <a
            href="/manifesto"
            className="border border-white text-white text-xs font-medium px-4 py-2 rounded-full hover:bg-white/10"
          >
            Manifesto
          </a>
        </div>
      </div>
    </div>
  )
}
