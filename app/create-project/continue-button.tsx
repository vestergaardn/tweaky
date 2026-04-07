import Link from "next/link"
import { ArrowRight, ArrowLeft } from "lucide-react"

export function StepNavigation({
  next,
  back,
  disabled,
}: {
  next: string
  back?: string
  disabled?: boolean
}) {
  return (
    <div className="mt-10 flex items-center gap-3">
      {back && (
        <Link
          href={back}
          className="inline-flex items-center gap-2 rounded-md border border-white/30 px-5 py-2 text-xs font-medium text-white/60 hover:border-white hover:text-white hover:bg-white/10"
        >
          <ArrowLeft size={12} />
          Back
        </Link>
      )}
      {disabled ? (
        <span className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-2 text-xs font-medium text-white/30 cursor-not-allowed">
          Continue
          <ArrowRight size={12} />
        </span>
      ) : (
        <Link
          href={next}
          className="inline-flex items-center gap-2 rounded-md border border-white px-5 py-2 text-xs font-medium text-white hover:bg-white/10"
        >
          Continue
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}
