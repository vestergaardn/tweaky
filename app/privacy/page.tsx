import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function Privacy() {
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

        {/* Right column — privacy policy */}
        <div className="orchestration max-w-[444px] text-white text-[15px] font-normal leading-[25px] font-sans">
          <p className="font-bold mb-6" style={{ "--stagger": 0 } as React.CSSProperties}>
            Privacy Policy
          </p>

          <p className="text-white/50 mb-8" style={{ "--stagger": 1 } as React.CSSProperties}>
            Last updated: April 7, 2026
          </p>

          <p className="font-bold mb-3" style={{ "--stagger": 2 } as React.CSSProperties}>
            What we collect
          </p>
          <p className="mb-6" style={{ "--stagger": 3 } as React.CSSProperties}>
            When you sign in with GitHub, we store your GitHub username and an
            access token scoped to your repositories. If you connect Vercel, we
            store an OAuth token to read your environment variables. We store
            environment variables you provide, encrypted at rest with
            AES-256-GCM.
          </p>

          <p className="font-bold mb-3" style={{ "--stagger": 4 } as React.CSSProperties}>
            How we use it
          </p>
          <p className="mb-6" style={{ "--stagger": 5 } as React.CSSProperties}>
            Your GitHub token is used to clone repositories and open pull
            requests on your behalf. Your Vercel token is used solely to import
            environment variables you select. Environment variables are injected
            into sandboxed containers to run your application — they are never
            included in pull requests or exposed to end users.
          </p>

          <p className="font-bold mb-3" style={{ "--stagger": 6 } as React.CSSProperties}>
            Third-party services
          </p>
          <p className="mb-6" style={{ "--stagger": 7 } as React.CSSProperties}>
            We use Supabase for data storage, E2B for sandboxed code execution,
            and Anthropic for AI-powered code generation. Your source code and
            environment variables may be processed by these services in the
            course of running Tweaky.
          </p>

          <p className="font-bold mb-3" style={{ "--stagger": 8 } as React.CSSProperties}>
            Data retention
          </p>
          <p className="mb-6" style={{ "--stagger": 9 } as React.CSSProperties}>
            You can delete your projects and environment variables at any time
            from the dashboard. Disconnecting Vercel immediately removes your
            Vercel token. Sandboxed containers are ephemeral and destroyed after
            use.
          </p>

          <p className="font-bold mb-3" style={{ "--stagger": 10 } as React.CSSProperties}>
            Contact
          </p>
          <p style={{ "--stagger": 11 } as React.CSSProperties}>
            Questions about this policy? Reach out at{" "}
            <a
              href="mailto:hello@tweaky.dev"
              className="underline underline-offset-2 hover:opacity-70"
            >
              hello@tweaky.dev
            </a>
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
