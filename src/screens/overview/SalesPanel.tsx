/**
 * "Sales & earnings" on the supplier Dashboard.
 *
 * - Three headline numbers: earned this month, earned in 6 months, quotes won.
 * - Monthly sales for the last 6 months as glowing lines on a navy card
 *   (SpendTrend): what you invoiced (blue) and what you receive (orange). The
 *   gap between them is MPI's commission.
 * - Sales by category as a donut (CategoryDonut): top 4, the rest in "Other".
 *
 * Until the supplier has at least 2 orders it shows sample figures, clearly
 * labelled, so the panel isn't empty in a demo.
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

export interface SaleEntry {
  /** When the order was placed (ISO date). */
  at: string
  category: string
  /** What the supplier invoices the buyer, GST included. */
  invoiced: number
  /** What the supplier receives after MPI's commission. */
  payout: number
}

const MONTHS = 6
const BLUE = "#3A6BB5"
const WORDS: TrendWords = { low: "you receive", high: "invoiced", gap: "MPI commission", highColor: BLUE, gapText: "#4b5567", caption: "Monthly sales" }

function sampleEntries(now: Date): SaleEntry[] {
  const rows: [number, string, number][] = [
    [5, "Packaging", 46000],
    [5, "Labels & printing", 18000],
    [4, "Packaging", 52000],
    [4, "Raw materials", 31000],
    [3, "Packaging", 61000],
    [3, "Labels & printing", 22000],
    [2, "Raw materials", 44000],
    [2, "Packaging", 39000],
    [1, "Packaging", 73000],
    [1, "Labels & printing", 26000],
    [0, "Packaging", 58000],
    [0, "Raw materials", 35000],
  ]
  return rows.map(([ago, category, invoiced]) => ({
    at: new Date(now.getFullYear(), now.getMonth() - ago, 10).toISOString(),
    category,
    invoiced,
    payout: Math.round(invoiced * 0.965),
  }))
}

export default function SalesPanel({ entries, won, decided }: { entries: SaleEntry[]; won: number; decided: number }) {
  const [show, setShow] = useState<"chart" | "table">("chart")
  const now = new Date()
  const sample = entries.length < 2
  const rows = sample ? sampleEntries(now) : entries

  const months = Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1)
    const inMonth = rows.filter((r) => monthKey(new Date(r.at)) === monthKey(d))
    const payout = inMonth.reduce((n, r) => n + r.payout, 0)
    return {
      key: monthKey(d),
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      long: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      // SpendTrend's lower line and the gap above it.
      spent: payout,
      saved: Math.max(0, inMonth.reduce((n, r) => n + r.invoiced, 0) - payout),
      orders: inMonth.length,
    }
  })
  const max = niceCeil(Math.max(1, ...months.map((m) => m.spent + m.saved)))
  const thisMonth = months[MONTHS - 1]
  const lastMonth = months[MONTHS - 2]
  const earned = rows.reduce((n, r) => n + r.payout, 0)
  const sWon = sample ? 9 : won
  const sDecided = sample ? 14 : decided

  const byCat = new Map<string, number>()
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.invoiced)
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  const cats = sorted.length > 4 ? [...sorted.slice(0, 4), ["Other", sorted.slice(4).reduce((n, [, v]) => n + v, 0)] as [string, number]] : sorted

  const change =
    thisMonth.spent === 0
      ? lastMonth.spent > 0
        ? `nothing yet; ${rupees(lastMonth.spent)} in ${lastMonth.label}`
        : "nothing yet this month"
      : lastMonth.spent > 0
      ? `${thisMonth.spent >= lastMonth.spent ? "up" : "down"} ${Math.abs(Math.round(((thisMonth.spent - lastMonth.spent) / lastMonth.spent) * 100))}% on ${lastMonth.label}`
      : "first sale in a while"

  return (
    <Panel title="Sales & earnings" icon={TrendingUp} action={sample ? <Chip tone="line">Sample data</Chip> : undefined}>
      <MotionConfig reducedMotion="user">
        <div className="@container px-4 py-4 sm:px-5">
          {sample && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-orange/40 bg-orange-tint px-3.5 py-2.5 text-[13.5px] text-navy" role="note">
              <Info size={17} className="mt-0.5 shrink-0 text-red-text" aria-hidden="true" />
              <span>
                <b>These are sample figures, not your data.</b> Your real sales show here after your 2nd order through MPI{entries.length ? ` (you have ${entries.length} so far)` : ""}.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
            <div className="rounded-lg bg-page px-3.5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Earned this month</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-navy">
                <CountUp value={thisMonth.spent} />
              </p>
              <p className="text-[12.5px] text-muted">{change}</p>
            </div>
            <div className="rounded-lg bg-[#ecfdf5] px-3.5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#065f46]">Earned in 6 months</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-[#047857]">
                <CountUp value={earned} />
              </p>
              <p className="text-[12.5px] text-[#065f46]">
                from {rows.length} order{rows.length === 1 ? "" : "s"} through MPI
              </p>
            </div>
            <div className="col-span-2 rounded-lg bg-page px-3.5 py-3 @xl:col-span-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Quotes won</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-navy">
                {sDecided ? `${Math.round((sWon / sDecided) * 100)}%` : "–"}
              </p>
              <p className="text-[12.5px] text-muted">
                {sDecided ? `${sWon} of ${sDecided} decided quote${sDecided === 1 ? "" : "s"}` : "shows once buyers decide on your quotes"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-[14px] font-bold text-navy">Monthly sales</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {show === "chart" && (
                  <span className="flex items-center gap-3 text-[12px] text-muted" aria-hidden="true">
                    <span className="flex items-center gap-1.5">
                      <span className="h-[3px] w-4 rounded-full" style={{ background: BLUE }} />
                      Invoiced
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-[3px] w-4 rounded-full bg-[#E07B2E]" />
                      You receive
                    </span>
                    <span className="hidden @md:inline">gap = MPI commission</span>
                  </span>
                )}
                <span className="inline-flex rounded-lg bg-page p-0.5" role="group" aria-label="Show monthly sales as">
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
                        <th className="px-4 py-2.5 text-right font-semibold">Invoiced</th>
                        <th className="px-4 py-2.5 text-right font-semibold">MPI commission</th>
                        <th className="px-4 py-2.5 text-right font-semibold">You receive</th>
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
                          <td className="px-4 py-2.5 text-right text-muted">{rupees(m.spent + m.saved)}</td>
                          <td className="px-4 py-2.5 text-right text-muted">{rupees(m.saved)}</td>
                          <td className="px-4 py-2.5 text-right text-navy">{rupees(m.spent)}</td>
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
            <h3 className="text-[14px] font-bold text-navy">Sales by category</h3>
            <CategoryDonut cats={cats} short={short} />
          </div>
        </div>
      </MotionConfig>
    </Panel>
  )
}
