/**
 * Monthly spend as smooth glowing lines on a navy card, for the startup
 * Dashboard (in the style of rivanah's reference image).
 *
 * - Orange line and fill: what the startup paid each month.
 * - Mint line: the usual price for the same orders. The mint band between
 *   the two lines is what MPI saved.
 * - The lines draw themselves in and the fills sweep in from the left.
 * - Hover (or tap) a month for a guide line, dots and the exact amounts.
 * - A hidden table carries the numbers for screen readers.
 */

import { useId, useState } from "react"
import { motion } from "motion/react"
import { rupees } from "../supplier/parts"
import { smooth, type MonthPoint } from "./chartMath"

const VW = 1000
const VH = 300
const PAD_X = 28 // keeps the first and last month off the edges
const PAD_TOP = 18
const SAMPLES = 100
const ORANGE = "#F09A47"
const MINT = "#8BE3B8"
const CHART_H = "clamp(200px, 22vw, 260px)"

export default function SpendTrend({ months, max, short }: { months: MonthPoint[]; max: number; short: (n: number) => string }) {
  const id = useId().replace(/:/g, "")
  const [active, setActive] = useState<number | null>(null)
  const last = months.length - 1

  const x = (t: number) => PAD_X + t * (VW - 2 * PAD_X) // t in 0..1
  const y = (v: number) => VH - (v / max) * (VH - PAD_TOP)
  const paid = smooth(months.map((m) => m.spent), SAMPLES)
  const usual = smooth(months.map((m) => m.saved), SAMPLES).map((s, j) => paid[j] + s)
  const line = (ys: number[]) => ys.map((v, j) => `${j ? "L" : "M"}${x(j / SAMPLES).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const area = (ys: number[]) => `${line(ys)} L${x(1)},${VH} L${x(0)},${VH} Z`

  const px = (i: number) => (x(i / last) / VW) * 100 // % from the left
  const py = (v: number) => (y(v) / VH) * 100 // % from the top
  const ticks = [0.25, 0.5, 0.75, 1]
  const a = active !== null ? months[active] : null

  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = ((e.clientX - r.left) / r.width) * VW
    const i = Math.round(((t - PAD_X) / (VW - 2 * PAD_X)) * last)
    setActive(Math.min(last, Math.max(0, i)))
  }

  return (
    <div
      className="rounded-xl px-3 pb-3 pt-4 sm:px-4"
      style={{ background: "radial-gradient(120% 120% at 0% 0%, #1f3256 0%, #15233d 55%, #111c31 100%)", boxShadow: "0 6px 20px rgba(21,35,61,0.25)" }}
    >
      <div className="grid" style={{ gridTemplateColumns: "2.4rem minmax(0, 1fr)" }}>
        {/* amount labels */}
        <div className="relative" style={{ height: CHART_H }} aria-hidden="true">
          {ticks.map((f) => (
            <span key={f} className="absolute right-2 -translate-y-1/2 text-[11px] text-white/55" style={{ top: `${py(max * f)}%` }}>
              {short(max * f)}
            </span>
          ))}
        </div>

        <div className="min-w-0">
          <div
            className="relative touch-none"
            style={{ height: CHART_H }}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
            aria-hidden="true"
          >
            {/* faint guide lines */}
            {ticks.map((f) => (
              <span key={f} className="absolute inset-x-0 h-px bg-white/[0.08]" style={{ top: `${py(max * f)}%` }} />
            ))}
            <span className="absolute inset-x-0 bottom-0 h-px bg-white/25" />

            <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <linearGradient id={`${id}-paid`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={ORANGE} stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id={`${id}-usual`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={MINT} stopOpacity="0.38" />
                  <stop offset="100%" stopColor={MINT} stopOpacity="0.04" />
                </linearGradient>
                <filter id={`${id}-glow`} x="-5%" y="-20%" width="110%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <clipPath id={`${id}-sweep`}>
                  <motion.rect x="0" y="0" height={VH} initial={{ width: 0 }} animate={{ width: VW }} transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.15 }} />
                </clipPath>
              </defs>

              <g clipPath={`url(#${id}-sweep)`}>
                <path d={area(usual)} fill={`url(#${id}-usual)`} />
                <path d={area(paid)} fill={`url(#${id}-paid)`} />
              </g>
              <motion.path
                d={line(usual)}
                fill="none"
                stroke={MINT}
                strokeWidth="3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                filter={`url(#${id}-glow)`}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
              />
              <motion.path
                d={line(paid)}
                fill="none"
                stroke={ORANGE}
                strokeWidth="3.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                filter={`url(#${id}-glow)`}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
              />
            </svg>

            {/* this month: a soft pulsing dot and its amount */}
            {months[last].spent > 0 && active !== last && (
              <motion.span
                className="absolute"
                style={{ left: `${px(last)}%`, top: `${py(months[last].spent)}%` }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.6, type: "spring", stiffness: 300, damping: 18 }}
              >
                <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-orange/50 motion-safe:animate-ping" />
                <span className="absolute -left-[5px] -top-[5px] h-2.5 w-2.5 rounded-full bg-orange ring-2 ring-white" />
                <span className="absolute bottom-3 right-1 whitespace-nowrap text-[12px] font-bold text-white">{short(months[last].spent)}</span>
              </motion.span>
            )}

            {/* hover: guide line, dots and tooltip */}
            {a && active !== null && (
              <>
                <motion.span
                  className="absolute bottom-0 w-px bg-white/40"
                  style={{ left: `${px(active)}%`, top: `${py(a.spent + a.saved)}%` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
                {[
                  { v: a.spent + a.saved, c: MINT },
                  { v: a.spent, c: ORANGE },
                ].map((d) => (
                  <motion.span
                    key={d.c}
                    className="absolute -ml-[7px] -mt-[7px] h-3.5 w-3.5 rounded-full ring-[3px] ring-[#15233d]"
                    style={{ left: `${px(active)}%`, top: `${py(d.v)}%`, background: d.c }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  />
                ))}
                <motion.div
                  key={active}
                  className="pointer-events-none absolute z-10 w-max max-w-[210px] rounded-lg border border-white/15 bg-white px-3 py-2 text-[12.5px] leading-snug text-navy shadow-xl"
                  style={{
                    left: `${px(active)}%`,
                    top: `${py(a.spent + a.saved)}%`,
                    translate: `${active === 0 ? "-8%" : active === last ? "-92%" : "-50%"} calc(-100% - 14px)`,
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                >
                  <span className="block font-bold">{a.long}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: ORANGE }} />
                    {rupees(a.spent)} paid
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: MINT }} />
                    {rupees(a.spent + a.saved)} usual price
                  </span>
                  <span className="mt-0.5 block font-semibold text-[#047857]">
                    {rupees(a.saved)} saved · {a.orders} order{a.orders === 1 ? "" : "s"}
                  </span>
                </motion.div>
              </>
            )}
          </div>

          {/* month names */}
          <div className="relative mt-2 h-5" aria-hidden="true">
            {months.map((m, i) => (
              <span
                key={m.key}
                className={`absolute -translate-x-1/2 text-[12.5px] ${i === last ? "font-bold text-white" : active === i ? "font-semibold text-white" : "text-white/60"}`}
                style={{ left: `${px(i)}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>Monthly spend</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Paid</th>
            <th>Usual price</th>
            <th>Saved</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <td>{m.long}</td>
              <td>{rupees(m.spent)}</td>
              <td>{rupees(m.spent + m.saved)}</td>
              <td>{rupees(m.saved)}</td>
              <td>{m.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
