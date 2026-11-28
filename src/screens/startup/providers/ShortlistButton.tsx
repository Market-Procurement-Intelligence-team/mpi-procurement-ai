import { Bookmark, BookmarkCheck } from "lucide-react"

/** Save or remove a provider from the startup's shortlist. */
export function ShortlistButton({
  saved,
  busy,
  onToggle,
  onDark = false,
  compact = false,
}: {
  saved: boolean
  busy: boolean
  onToggle: () => void
  onDark?: boolean
  compact?: boolean
}) {
  const Icon = saved ? BookmarkCheck : Bookmark
  const look = saved
    ? onDark
      ? "border-[1.5px] border-white/40 bg-white/10 text-white hover:bg-white/20"
      : "border-[1.5px] border-navy bg-navy text-white hover:bg-ink"
    : "btn-gradient text-navy shadow-sm hover:brightness-95"
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={saved}
      className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "px-3.5 text-[14px]" : "px-5 text-[15px]"} ${look}`}
    >
      <Icon size={17} aria-hidden="true" />
      {saved ? "Shortlisted" : "Shortlist"}
    </button>
  )
}
