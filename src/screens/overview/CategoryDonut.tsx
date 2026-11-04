/**
 * Spend by category as a donut, for the startup Dashboard.
 * Up to 4 categories get their own colour (checked for colour-blind
 * separation); anything else is folded into a grey "Other". Hover a slice or
 * a legend row to focus it; the centre then shows that category.
 */

import { useId, useState } from "react"
import { motion } from "motion/react"
import { rupees } from "../supplier/parts"

const HUES = ["#3A6BB5", "#E07B2E", "#15967B", "#CF4A3D"]
const OTHER = "#A3ACB9"

/** A lighter version of a hex colour, for the start of each slice's gradient. */
function lighter(hex: string, amount = 0.38): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

export default function CategoryDonut({ cats, short }: { cats: [string, number][]; short: (n: number) => string }) {
  const id = useId().replace(/:/g, "")
  const [focus, setFocus] = useState<string | null>(null)
  const total = cats.reduce((n, [, v]) => n + v, 0)
  if (!total) return <p className="mt-3 text-[13.5px] text-muted">No spend yet.</p>

  // Colour follows the category name, not its rank.
  const named = cats.filter(([n]) => n !== "Other").map(([n]) => n)
  const order = [...named].sort((a, b) => a.localeCompare(b))
  const colour = (name: string) => (name === "Other" ? OTHER : HUES[order.indexOf(name) % HUES.length])

  const R = 54
  const C = 2 * Math.PI * R
  const SW = 20
  const single = cats.length === 1
  const GAP = single ? 0 : 3
  let start = 0
  const slices = cats.map(([name, value], i) => {
    const len = (value / total) * C
    const s = { name, value, len, start, colour: colour(name), i }
    start += len
    return s
  })
  const shown = focus ? slices.find((s) => s.name === focus) : null

  return (
    <div className="mt-3 flex flex-col items-center gap-5 @md:flex-row @md:items-center">
      <div className="relative h-48 w-48 shrink-0 drop-shadow-[0_6px_14px_rgba(21,35,61,0.12)]">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
          <defs>
            {slices.map((s) => (
              <linearGradient key={s.name} id={`${id}-${s.i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={lighter(s.colour)} />
                <stop offset="100%" stopColor={s.colour} />
              </linearGradient>
            ))}
          </defs>
          <circle cx="70" cy="70" r={R} fill="none" stroke="#eef1f6" strokeWidth={SW} />
          {slices.map((s) => (
            <motion.circle
              key={s.name}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={`url(#${id}-${s.i})`}
              strokeWidth={focus === s.name ? SW + 5 : SW}
              strokeLinecap="butt"
              strokeDashoffset={-s.start}
              initial={{ strokeDasharray: `0 ${C}` }}
              animate={{ strokeDasharray: `${single ? C : Math.max(0.01, s.len - GAP)} ${C}`, opacity: focus && focus !== s.name ? 0.35 : 1 }}
              transition={{ strokeDasharray: { duration: 0.9, delay: 0.25 + s.i * 0.12, ease: [0.2, 0.7, 0.2, 1] }, opacity: { duration: 0.2 } }}
              onMouseEnter={() => setFocus(s.name)}
              onMouseLeave={() => setFocus(null)}
              style={{ cursor: "pointer", transition: "stroke-width 0.2s" }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[96px] truncate text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">{shown ? shown.name : "Total"}</span>
          <span className="font-display text-[20px] font-bold leading-tight text-navy">{short(shown ? shown.value : total)}</span>
          {shown && <span className="text-[12px] text-muted">{Math.round((shown.value / total) * 100)}%</span>}
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1" aria-label="Spend by category">
        {slices.map((s) => (
          <li key={s.name}>
            <button
              type="button"
              onMouseEnter={() => setFocus(s.name)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(s.name)}
              onBlur={() => setFocus(null)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] transition-colors ${focus === s.name ? "bg-page" : ""}`}
              aria-label={`${s.name}: ${rupees(s.value)}, ${Math.round((s.value / total) * 100)}%`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, ${lighter(s.colour)}, ${s.colour})` }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-semibold text-navy">{s.name}</span>
              <span className="shrink-0 text-muted">{short(s.value)}</span>
              <span className="w-10 shrink-0 text-right font-semibold text-navy">{Math.round((s.value / total) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
