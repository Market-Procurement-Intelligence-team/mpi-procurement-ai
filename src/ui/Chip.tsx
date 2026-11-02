import type { ReactNode } from "react"

/**
 * Status chip. waiting: open or needs action. neutral: draft or info.
 * negative: rejected, declined, expired, late. positive: verified, approved, done.
 */
export type ChipTone = "waiting" | "neutral" | "negative" | "positive"

const TONES: Record<ChipTone, { chip: string; dot: string }> = {
  waiting: { chip: "bg-orange-tint text-navy", dot: "bg-orange" },
  neutral: { chip: "bg-navy-tint text-navy", dot: "bg-navy" },
  negative: { chip: "bg-red-tint text-red-text", dot: "bg-red" },
  positive: { chip: "bg-navy text-white", dot: "bg-white" },
}

export default function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  const t = TONES[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${t.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      {children}
    </span>
  )
}
