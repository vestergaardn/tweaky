import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function Manifesto() {
  return (
    <div className="min-h-screen bg-[#181e39] flex items-center justify-center px-6 py-20">
      <style>{`
        .orchestration {
          padding-bottom: 24px;
        }
        .orchestration > * {
          animation: enter 0.6s ease both;
          animation-delay: calc(var(--stagger) * 120ms);
        }
        @keyframes enter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="w-full max-w-[900px] flex flex-col md:flex-row gap-16 md:gap-24">
        {/* Left column — logo */}
        <div className="flex flex-col justify-between shrink-0">
          <Image
            src="/colour-logo-tweaky.svg"
            alt="Tweaky"
            width={165}
            height={50}
          />
        </div>

        {/* Right column — manifesto text */}
        <div className="orchestration max-w-[444px] text-white text-[15px] font-normal leading-[25px] font-sans">
          <p className="font-bold mb-6" style={{ "--stagger": 0 } as React.CSSProperties}>
            Introducing: open sourced feature development
          </p>

          <p className="mb-6" style={{ "--stagger": 1 } as React.CSSProperties}>
            10 years ago it was a competitive edge to write software. Simply
            being able to fix a problem mediocre was enough, since very few
            people could write the zeros and ones. However, times has changed.
            Software is everywhere and everyone can write it, so building what
            users want is the hard part. Today the process is broken.
          </p>

          <p className="mb-6" style={{ "--stagger": 2 } as React.CSSProperties}>
            Users sign up. They hit a wall. Submit feedback. Manager digs in.
            Adds to backlog. Prioritize and scope. Ship the changes.
          </p>

          <p className="mb-6" style={{ "--stagger": 3 } as React.CSSProperties}>
            With Tweaky, the technical barrier to contributing to software drops
            to zero. We allow users to tweak and improve your application, but
            with no access to source code.
          </p>

          <p style={{ "--stagger": 4 } as React.CSSProperties}>
            We spin up a container of your repository and allow users to prompt
            changes. The user tells what they think the change is worth and
            submit the Pull Request for review. If you merge the changes, they
            get paid - and you&apos;ve just build something users want, but with
            minimal engineering resources.
          </p>
        </div>
      </div>

      {/* Return to homepage */}
      <Link
        href="/"
        className="fixed bottom-12 left-12 flex items-center gap-2 text-white text-[15px] hover:opacity-70"
      >
        <ArrowLeft size={17} />
        Return to homepage
      </Link>
    </div>
  )
}
