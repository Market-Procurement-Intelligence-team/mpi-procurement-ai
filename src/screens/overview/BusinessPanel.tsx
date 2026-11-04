/**
 * "Business through MPI" on the admin Dashboard.
 *
 * - Three headline numbers: order value this month, MPI revenue in 6 months,
 *   and what startups saved.
 * - Monthly order value for the last 6 months as glowing lines on a navy card
 *   (SpendTrend): what startups paid (blue) and what went to suppliers
 *   (orange). The gap between them is MPI's fee and commission invoices.
 * - Order value by category as a donut (CategoryDonut): top 4, then "Other".
 *
 * Until there are at least 2 orders it shows sample figures, clearly labelled.
 */

import { useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { Info, TrendingUp } from "lucide-react"
import { Chip, rupees } from "../supplier/parts"
import CategoryDonut from "./CategoryDonut"
import { monthKey, niceCeil, short } from "./chartMath"
import { Panel } from "./parts"
import { CountUp } from "./SpendPanel"
import SpendTrend, { type TrendWords } from "./SpendTrend"

export interface BusinessEntry {
  /** When the order was placed (ISO date). */
  at: string
  category: string
  /** What the startup pays, GST included. */
  value: number
  /** What the supplier receives after commission. */
  toSupplier: number
  /** MPI's fee + commission, before GST. */
  revenue: number
  /** What the startup saved vs. the usual price. */
  saved: number
}

const MONTHS = 6
const BLUE = "#8EC5FF"
const WORDS: TrendWords = {
  low: "to suppliers",
  high: "order value",
  gap: "MPI fee & commission invoices",
  highColor: BLUE,
  gapText: "#047857",
  caption: "Monthly order value",
}

function sampleEntries(now: Date): BusinessEntry[] {
  const rows: [number, string, number][] = [
    [5, "Packaging", 92000],
    [5, "Marketing", 48000],
    [4, "Packaging", 118000],
    [4, "Prototyping", 63000],
    [3, "Packaging", 131000],
    [3, "Legal", 35000],
    [2, "Marketing", 76000],
    [2, "Prototyping", 88000],
    [1, "Packaging", 154000],
    [1, "Marketing", 52000],
    [0, "Packaging", 126000],
    [0, "Prototyping", 71000],
  ]
  return rows.map(([ago, category, value]) => ({
    at: new Date(now.getFullYear(), now.getMonth() - ago, 10).toISOString(),
    category,
    value,
    toSupplier: Math.round(value * 0.93),
    revenue: Math.round(value * 0.06),
    saved: Math.round(value * 0.07),
  }))
}

export default function BusinessPanel({ entries }: { entries: BusinessEntry[] }) {
  const [show, setShow] = useState<"chart" | "table">("chart")
  const now = new Date()
  const sample = entries.length < 2
  const rows = sample ? sampleEntries(now) : entries

  const months = Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1)
    const inMonth = rows.filter((r) => monthKey(new Date(r.at)) === monthKey(d))
    const toSupplier = inMonth.reduce((n, r) => n + r.toSupplier, 0)
    return {
      key: monthKey(d),
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      long: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      // SpendTrend's lower line and the gap above it.
      spent: toSupplier,
      saved: Math.max(0, inMonth.reduce((n, r) => n + r.value, 0) - toSupplier),
      orders: inMonth.length,
    }
  })
  const max = niceCeil(Math.max(1, ...months.map((m) => m.spent + m.saved)))
  const thisMonth = months[MONTHS - 1]
  const lastMonth = months[MONTHS - 2]
  const valueOf = (m: (typeof months)[number]) => m.spent + m.saved
  const revenue = rows.reduce((n, r) => n + r.revenue, 0)
  const saved = rows.reduce((n, r) => n + r.saved, 0)
  const total = rows.reduce((n, r) => n + r.value, 0)

  const byCat = new Map<string, number>()
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.value)
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  const cats = sorted.length > 4 ? [...sorted.slice(0, 4), ["Other", sorted.slice(4).reduce((n, [, v]) => n + v, 0)] as [string, number]] : sorted

  const change =
    valueOf(thisMonth) === 0
      ? valueOf(lastMonth) > 0
        ? `nothing yet; ${rupees(valueOf(lastMonth))} in ${lastMonth.label}`
        : "nothing yet this month"
      : valueOf(lastMonth) > 0
      ? `${valueOf(thisMonth) >= valueOf(lastMonth) ? "up" : "down"} ${Math.abs(Math.round(((valueOf(thisMonth) - valueOf(lastMonth)) / valueOf(lastMonth)) * 100))}% on ${lastMonth.label}`
      : "first orders in a while"

  return (
    <Panel title="Business through MPI" icon={TrendingUp} action={sample ? <Chip tone="line">Sample data</Chip> : undefined}>
      <MotionConfig reducedMotion="user">
        <div className="@container px-4 py-4 sm:px-5">
          {sample && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-orange/40 bg-orange-tint px-3.5 py-2.5 text-[13.5px] text-navy" role="note">
              <Info size={17} className="mt-0.5 shrink-0 text-red-text" aria-hidden="true" />
              <span>
                <b>These are sample figures, not real data.</b> Real numbers show here once there are 2 or more orders
                {entries.length ? ` (there ${entries.length === 1 ? "is" : "are"} ${entries.length} so far)` : ""}.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
            <div className="rounded-lg bg-page px-3.5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Order value this month</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-navy">
                <CountUp value={valueOf(thisMonth)} />
              </p>
              <p className="text-[12.5px] text-muted">{change}</p>
            </div>
            <div className="rounded-lg bg-[#ecfdf5] px-3.5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#065f46]">MPI revenue, 6 months</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-[#047857]">
                <CountUp value={revenue} />
              </p>
              <p className="text-[12.5px] text-[#065f46]">fees + commission, before GST</p>
            </div>
            <div className="col-span-2 rounded-lg bg-page px-3.5 py-3 @xl:col-span-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Startups saved</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-navy">
                <CountUp value={saved} />
              </p>
              <p className="text-[12.5px] text-muted">
                on {rupees(total)} of orders ({total ? Math.round((saved / (total + saved)) * 100) : 0}% vs. usual price)
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-[14px] font-bold text-navy">Monthly order value</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {show === "chart" && (
                  <span className="flex items-center gap-3 text-[12px] text-muted" aria-hidden="true">
                    <span className="flex items-center gap-1.5">
                      <span className="h-[3px] w-4 rounded-full" style={{ background: BLUE }} />
                      Order value
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-[3px] w-4 rounded-full bg-orange" />
                      To suppliers
                    </span>
                    <span className="hidden @md:inline">gap = MPI invoices</span>
                  </span>
                )}
                <span className="inline-flex rounded-lg bg-page p-0.5" role="group" aria-label="Show monthly order value as">
                  {(["chart", "table"] as const).map((v) => (
                    <motion.button
                      key={v}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShow(v)}
                      aria-pressed={show === v}
                      className={`rounded-md px-3 py-1 text-[12.5px] font-bold transition-colors ${show === v ? "btn-gradient text-navy shadow-sm" : "text-muted hover:text-navy"}`}
                    >
                      {v === "chart" ? "Chart" : "Table"}
                    </motion.button>
                  ))}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={show}
                  initial={{ opacity: 0, y: 8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.99 }}
                  transition={{ duration: 0.2 }}
                >
                  {show === "chart" ? (
                    <SpendTrend months={months} max={max} short={short} words={WORDS} />
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="w-full min-w-[460px] text-left text-[13.5px]">
                        <thead className="bg-page text-[12px] uppercase tracking-[0.04em] text-muted">
                          <tr>
                            <th className="px-4 py-2.5 font-semibold">Month</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Order value</th>
                            <th className="px-4 py-2.5 text-right font-semibold">To suppliers</th>
                            <th className="px-4 py-2.5 text-right font-semibold">MPI invoices</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Orders</th>
                          </tr>
                        </thead>
                        <tbody>
                          {months.map((m, i) => (
                            <motion.tr
                              key={m.key}
                              className={`border-t border-line ${i === months.length - 1 ? "font-semibold" : ""}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                            >
                              <td className="px-4 py-2.5 text-navy">{m.long}</td>
                              <td className="px-4 py-2.5 text-right text-navy">{rupees(m.spent + m.saved)}</td>
                              <td className="px-4 py-2.5 text-right text-muted">{rupees(m.spent)}</td>
                              <td className="px-4 py-2.5 text-right text-[#047857]">{rupees(m.saved)}</td>
                              <td className="px-4 py-2.5 text-right text-muted">{m.orders}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-4">
            <h3 className="text-[14px] font-bold text-navy">Order value by category</h3>
            <CategoryDonut cats={cats} short={short} />
          </div>
        </div>
      </MotionConfig>
    </Panel>
  )
}
