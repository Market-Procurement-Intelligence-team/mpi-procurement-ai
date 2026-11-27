/**
 * Shared pieces for the supplier screens: date and money helpers, the navy
 * summary cards, tabs, chips and a small toast. Same look as the admin
 * matches screen.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { CheckCircle2, type LucideIcon } from "lucide-react"
import { motion } from "motion/react"
import type { Json } from "../../lib/database.types"

// ---------------------------------------------------------------- helpers

export const day = (iso: string | null, withYear = false) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
      })
    : null

export const rupees = (n: number, paise = false) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: paise ? 2 : 0, minimumFractionDigits: 0 })}`

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000)
}

export function daysLeft(iso: string | null): string | null {
  const d = daysUntil(iso)
  if (d === null) return null
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`
  if (d === 0) return "due today"
  return `${d} day${d === 1 ? "" : "s"} left`
}

export const place = (city: string | null, state: string | null) => [city, state].filter(Boolean).join(", ") || null

export const qty = (n: number, unit: string) => `${Number(n).toLocaleString("en-IN")} ${unit}`

export const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.")

/** "2 h 15 min" style time left, from milliseconds. */
export function timeLeftText(ms: number): string {
  if (ms <= 0) return "time is up"
  const mins = Math.ceil(ms / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** "3 hours ago" style. */
export function ago(iso: string | null): string | null {
  if (!iso) return null
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? "" : "s"} ago`
}

/** A request line's specs as short "key: value" parts. */
export function specsText(specs: Json): string | null {
  if (!specs) return null
  if (typeof specs === "string") return specs || null
  if (Array.isArray(specs)) return specs.filter(Boolean).join(" · ") || null
  if (typeof specs === "object") {
    const parts = Object.entries(specs)
      .filter(([, v]) => v !== null && v !== "" && v !== undefined)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    return parts.join(" · ") || null
  }
  return null
}

/** Payment terms in words from the stored code or label. */
export function termsText(terms: string | null | undefined): string {
  if (!terms || terms === "30_70") return "30% before work starts, 70% on delivery"
  if (terms === "full_advance") return "100% advance before work starts"
  return terms
}

/** A panel with the brand gradient border on all four sides. */
/** Light grey-to-peach panel background (like the order header), used on panels app-wide. */
export const SOFT_BG = "linear-gradient(to bottom right, #e8ecf3, rgba(232,236,243,0.6), rgba(253,235,217,0.5)), #ffffff"

export const GRADIENT_PANEL = {
  border: "2.5px solid transparent",
  background:
    "linear-gradient(to bottom right, #e8ecf3, rgba(232,236,243,0.6), rgba(253,235,217,0.5)) padding-box, linear-gradient(#fff, #fff) padding-box, conic-gradient(from 0deg, #15233d, #f09a47, #ec8d49, #db4230, #f09a47, #15233d) border-box",
} as const

// ---------------------------------------------------------------- parts

export function Chip({ tone = "line", children }: { tone?: "navy" | "orange" | "red" | "line" | "green"; children: ReactNode }) {
  const tones = {
    navy: "bg-navy text-white",
    orange: "bg-orange-tint text-navy",
    red: "bg-red-tint text-red-text",
    line: "border border-line bg-white text-muted",
    green: "bg-navy-tint text-navy",
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export interface SummaryItem {
  id: string
  label: string
  value: number | string
  hint: string
  icon: LucideIcon
  dot?: boolean
  /** A small change note, e.g. "+2 this week". */
  trend?: string
  /** A shortcut label shown at the bottom, e.g. "Review quotes". */
  cta?: string
  /** "good" shows the number in green (money saved). */
  tone?: "good"
}

/** The navy summary cards on top of a screen. */
export function SummaryCards({ items, selected, onPick }: { items: SummaryItem[]; selected: string | null; onPick: (id: string) => void }) {
  return (
    <motion.div
      className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {items.map((i) => (
        <motion.button
          key={i.id}
          type="button"
          onClick={() => onPick(i.id)}
          aria-pressed={selected === i.id}
          variants={{
            hidden: { opacity: 0, y: 18 },
            show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } },
          }}
          whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 18 } }}
          whileTap={{ scale: 0.97 }}
          className="group relative flex flex-col overflow-hidden rounded-xl px-4 py-2.5 text-left shadow-[0_3px_10px_rgba(21,35,61,0.2)] transition-shadow duration-200 hover:shadow-[0_12px_26px_rgba(21,35,61,0.3)]"
          style={{
            border: "2.5px solid transparent",
            background: [
              "radial-gradient(120% 90% at 100% 0%, rgba(240,154,71,0.22) 0%, rgba(240,154,71,0) 55%) padding-box",
              "linear-gradient(135deg, #15233d 0%, #1b2c4a 60%, #233653 100%) padding-box",
              selected === i.id
                ? "conic-gradient(from 0deg, #f09a47, #ec8d49, #db4230, #ec8d49, #f09a47) border-box"
                : "linear-gradient(#15233d, #15233d) border-box",
            ].join(", "),
          }}
        >
          <span
            className="pointer-events-none absolute -bottom-8 -right-8 h-20 w-20 rounded-full border-[8px] border-white/[0.04]"
            aria-hidden="true"
          />
          <span className="flex items-start justify-between gap-3">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white">{i.label}</span>
            <span className="btn-gradient shrink-0 rounded-lg p-1.5 text-navy shadow-[0_2px_6px_rgba(240,154,71,0.3)]" aria-hidden="true">
              <i.icon size={14} strokeWidth={2.2} />
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span className={`font-display text-[23px] font-bold leading-none tracking-tight ${i.tone === "good" ? "text-[#6ee7b7]" : "text-orange"}`}>{i.value}</span>
            {i.trend && <span className="rounded-full bg-white/10 px-1.5 py-px text-[11.5px] font-semibold text-white/85">{i.trend}</span>}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-white/70">
            {i.dot && <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden="true" />}
            {i.hint}
          </span>
          {i.cta && (
            <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-bold text-orange group-hover:underline">
              {i.cta} <span aria-hidden="true">→</span>
            </span>
          )}
        </motion.button>
      ))}
    </motion.div>
  )
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex min-w-0 gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-[3px] px-3 text-[15px] font-semibold transition-colors ${
              active ? "border-orange text-navy" : "border-transparent text-muted hover:text-navy"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`rounded-full px-2 py-px text-[12px] font-bold ${active ? "bg-orange text-navy" : "bg-navy-tint text-navy"}`}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function useToast() {
  const [text, setText] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((t: string) => {
    setText(t)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setText(null), 3500)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const node = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      {text && (
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-3 text-[14.5px] font-semibold text-white shadow-lg">
          <CheckCircle2 size={17} className="text-orange" aria-hidden="true" />
          {text}
        </div>
      )}
    </div>
  )
  return [show, node] as const
}

/** Re-renders every `ms` so countdowns stay current. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}
