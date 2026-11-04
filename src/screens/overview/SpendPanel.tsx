/**
 * "Spend & savings" on the startup Dashboard.
 *
 * - Two headline numbers: spent this month and total saved with MPI.
 * - Monthly spend for the last 6 months: glowing trend lines on a navy card
 *   (SpendTrend: paid vs. usual price, the gap is the saving).
 * - Spend by category as a donut (CategoryDonut): top 4, the rest in "Other".
 *
 * Until the startup has at least 2 orders it shows sample figures, clearly
 * labelled, so the panel isn't empty in a demo.
 */

import { useEffect, useState } from "react"
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { BarChart3, Info } from "lucide-react"
import { Chip, rupees } from "../supplier/parts"
import CategoryDonut from "./CategoryDonut"
import { monthKey, niceCeil, short } from "./chartMath"
import { Panel } from "./parts"
import SpendTrend from "./SpendTrend"

export interface SpendEntry {
  /** When the order was placed (ISO date). */
  at: string
  category: string
  /** What the startup pays, GST included. */
  amount: number
  /** Saved vs. the usual price. */
  saved: number
}

const MONTHS = 6

function sampleEntries(now: Date): SpendEntry[] {
  const rows: [number, string, number, number][] = [
    [5, "Packaging", 42000, 3800],
    [5, "Raw materials", 65000, 5200],
    [4, "Packaging", 38000, 3100],
    [4, "Electronics", 54000, 4900],
    [3, "Raw materials", 88000, 7600],
    [3, "Logistics", 21000, 1500],
    [2, "Packaging", 47000, 4200],
    [2, "Electronics", 36000, 2900],
    [1, "Raw materials", 72000, 6100],
    [1, "Logistics", 18000, 1200],
    [0, "Packaging", 29000, 2600],
    [0, "Electronics", 41000, 3700],
  ]
  return rows.map(([ago, category, amount, saved]) => ({
    at: new Date(now.getFullYear(), now.getMonth() - ago, 10).toISOString(),
    category,
    amount,
    saved,
  }))
}

export default function SpendPanel({ entries, orderCount }: { entries: SpendEntry[]; orderCount: number }) {
  const [show, setShow] = useState<"chart" | "table">("chart")
  const now = new Date()
  const sample = entries.length < 2
  const rows = sample ? sampleEntries(now) : entries

  const months = Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1)
    const inMonth = rows.filter((r) => monthKey(new Date(r.at)) === monthKey(d))
    return {
      key: monthKey(d),
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      long: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      spent: inMonth.reduce((n, r) => n + r.amount, 0),
      saved: inMonth.reduce((n, r) => n + r.saved, 0),
      orders: inMonth.length,
    }
  })
  // Each bar is the usual price: what you paid (navy) plus what you saved (green).
  const max = niceCeil(Math.max(1, ...months.map((m) => m.spent + m.saved)))
  const thisMonth = months[MONTHS - 1]
  const lastMonth = months[MONTHS - 2]

  const spent = rows.reduce((n, r) => n + r.amount, 0)
  const saved = rows.reduce((n, r) => n + r.saved, 0)
  const pct = spent + saved > 0 ? Math.round((saved / (spent + saved)) * 100) : 0

  const byCat = new Map<string, number>()
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount)
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  const cats = sorted.length > 4 ? [...sorted.slice(0, 4), ["Other", sorted.slice(4).reduce((n, [, v]) => n + v, 0)] as [string, number]] : sorted

  const change =
    thisMonth.spent === 0
      ? lastMonth.spent > 0
        ? `nothing yet; ${rupees(lastMonth.spent)} in ${lastMonth.label}`
        : "nothing yet this month"
      : lastMonth.spent > 0
      ? `${thisMonth.spent >= lastMonth.spent ? "up" : "down"} ${Math.abs(Math.round(((thisMonth.spent - lastMonth.spent) / lastMonth.spent) * 100))}% on ${lastMonth.label}`
      : "first spend in a while"

  return (
    <Panel title="Spend & savings" icon={BarChart3} action={sample ? <Chip tone="line">Sample data</Chip> : undefined}>
      <MotionConfig reducedMotion="user">
        <div className="@container px-4 py-4 sm:px-5">
          {sample && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-orange/40 bg-orange-tint px-3.5 py-2.5 text-[13.5px] text-navy" role="note">
              <Info size={17} className="mt-0.5 shrink-0 text-red-text" aria-hidden="true" />
              <span>
                <b>These are sample figures, not your data.</b> Your real spend shows here after your 2nd order{orderCount ? ` (you have ${orderCount} so far)` : ""}.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
            <div className="rounded-lg bg-page px-3.5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Spent this month</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-navy">
                <CountUp value={thisMonth.spent} />
              </p>
              <p className="text-[12.5px] text-muted">{change}</p>
            </div>
            <div className="rounded-lg bg-[#ecfdf5] px-3.5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#065f46]">Total saved</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-[#047857]">
                <CountUp value={saved} />
              </p>
              <p className="text-[12.5px] text-[#065f46]">{pct}% less than the usual price</p>
            </div>
            <div className="col-span-2 rounded-lg bg-page px-3.5 py-3 @xl:col-span-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Spent in 6 months</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-tight text-navy">
                <CountUp value={spent} />
              </p>
              <p className="text-[12.5px] text-muted">
                {rows.length} order{rows.length === 1 ? "" : "s"}, biggest month {months.reduce((a, b) => (b.spent > a.spent ? b : a)).label}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-[14px] font-bold text-navy">Monthly spend</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {show === "chart" && (
              <span className="flex items-center gap-3 text-[12px] text-muted" aria-hidden="true">
                <span className="flex items-center gap-1.5">
                  <span className="h-[3px] w-4 rounded-full bg-orange" />
                  Paid
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-[3px] w-4 rounded-full bg-[#8BE3B8]" />
                  Usual price
                </span>
                <span className="hidden @md:inline">gap = saved</span>
              </span>
              )}
              <span className="inline-flex rounded-lg bg-page p-0.5" role="group" aria-label="Show monthly spend as">
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
                <SpendTrend months={months} max={max} short={short} />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[460px] text-left text-[13.5px]">
                    <thead className="bg-page text-[12px] uppercase tracking-[0.04em] text-muted">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Month</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Paid</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Usual price</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Saved</th>
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
                          <td className="px-4 py-2.5 text-right text-navy">{rupees(m.spent)}</td>
                          <td className="px-4 py-2.5 text-right text-muted">{rupees(m.spent + m.saved)}</td>
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
            <h3 className="text-[14px] font-bold text-navy">By category</h3>
            <CategoryDonut cats={cats} short={short} />
          </div>
        </div>
      </MotionConfig>
    </Panel>
  )
}

/** A rupee amount that counts up from 0 when it first shows. */
export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const n = useMotionValue(reduce ? value : 0)
  const text = useTransform(n, (v) => rupees(Math.round(v)))
  useEffect(() => {
    if (reduce) {
      n.set(value)
      return
    }
    const controls = animate(n, value, { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] })
    return () => controls.stop()
  }, [value, reduce, n])
  // One text node that Motion updates in place, so the number is never repeated.
  return <motion.span>{text}</motion.span>
}
