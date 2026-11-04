/**
 * Review & send: government schemes that fit this request. The startup ticks
 * the ones it plans to use; they are saved with the request so MPI and the
 * invited suppliers see them. Optional.
 */

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { motion } from "motion/react"
import { ArrowUpRight, Check, CheckCircle2, Landmark } from "lucide-react"
import type { Category } from "../../../services/data/catalogue"
import { matchSchemesToRequest, type SchemeSuggestion } from "../../../services/data/schemes"
import { FitRing, fitLabel } from "../../schemes/parts"
import type { WizardDraft } from "./draft"

/** How many matches to show (ticked ones are always shown too). */
const TOP = 3

export default function SchemePicker({
  draft,
  categories,
  update,
}: {
  draft: WizardDraft
  categories: Category[] | null
  update: (patch: Partial<WizardDraft>) => void
}) {
  const [matches, setMatches] = useState<SchemeSuggestion[] | null>(null)
  const categoryName = categories?.find((c) => c.id === draft.categoryId)?.name ?? null
  const items = draft.items.map((i) => i.itemName || i.description)
  // Re-match only when what the request is about changes.
  const key = JSON.stringify([draft.categoryId, categoryName, draft.title, draft.description, items, draft.certifications])

  useEffect(() => {
    let live = true
    const [categoryId, catName, title, description, its, certifications] = JSON.parse(key) as [string | null, string | null, string, string, string[], string[]]
    setMatches(null)
    matchSchemesToRequest({ categoryId, categoryName: catName, title, description, items: its, certifications })
      .then((m) => live && setMatches(m))
      .catch(() => live && setMatches([]))
    return () => {
      live = false
    }
  }, [key])

  const shown = useMemo(() => {
    if (!matches) return []
    const top = matches.slice(0, TOP)
    const extra = matches.filter((m, i) => i >= TOP && draft.schemeIds.includes(m.scheme.id))
    return [...top, ...extra]
  }, [matches, draft.schemeIds])

  const toggle = (id: string) =>
    update({ schemeIds: draft.schemeIds.includes(id) ? draft.schemeIds.filter((x) => x !== id) : [...draft.schemeIds, id] })

  return (
    <section className="overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6" style={{ background: "#eef1f5", borderBottom: "1px solid #cbd2dc" }}>
        <h3 className="flex items-center gap-2 font-display text-[17px] font-bold" style={{ color: "#15233d" }}>
          <Landmark size={18} aria-hidden="true" /> Schemes that can help with this request
        </h3>
        <span className="text-[13px] font-semibold text-navy">Optional</span>
      </header>
      <div className="px-5 py-4 sm:px-6">
        <p className="text-[14px] text-muted">
          MPI matched these government schemes to what you're buying. Tick the ones you plan to use. MPI and your supplier will see them, so the
          supplier can give you the invoices and certificates the scheme asks for.
        </p>
        {!matches ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3" aria-label="Finding schemes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-page" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="mt-3 rounded-lg bg-page px-4 py-3 text-[14px] text-navy">
            No scheme fits this request closely.{" "}
            <Link to="/startup/schemes" target="_blank" className="font-semibold underline">
              Browse all schemes
            </Link>
          </p>
        ) : (
          <motion.ul
            className="mt-3 grid gap-3 md:grid-cols-3"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          >
            {shown.map((m) => {
              const on = draft.schemeIds.includes(m.scheme.id)
              return (
                <motion.li key={m.scheme.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="relative">
                  <motion.button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => toggle(m.scheme.id)}
                    className="flex h-full w-full flex-col rounded-xl p-3.5 pb-9 text-left transition-shadow"
                    style={
                      on
                        ? { border: "2px solid transparent", background: "linear-gradient(#fff8f1, #fff8f1) padding-box, linear-gradient(135deg, #f09a47, #ec8d49, #db4230) border-box", boxShadow: "0 6px 18px rgba(240,154,71,0.18)" }
                        : { border: "2px solid #dfe4eb", background: "#fff" }
                    }
                  >
                    <span className="flex items-start gap-2.5">
                      <FitRing score={m.score} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-bold leading-snug text-navy">{m.scheme.short_name}</span>
                        <span className="block text-[12px] font-semibold text-muted">{fitLabel(m.score)}</span>
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${on ? "btn-gradient text-navy" : "border-[1.5px] border-input bg-white"}`}
                        aria-hidden="true"
                      >
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                    </span>
                    {m.scheme.max_assistance && <span className="mt-2 line-clamp-2 block text-[13px] font-semibold text-navy">{m.scheme.max_assistance}</span>}
                    <span className="mt-1.5 block space-y-0.5">
                      {m.reasons.slice(0, 2).map((r) => (
                        <span key={r} className="flex gap-1.5 text-[12.5px] text-muted">
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: "#15967B" }} aria-hidden="true" />
                          <span className="line-clamp-2">{r}</span>
                        </span>
                      ))}
                    </span>
                  </motion.button>
                  <Link
                    to={`/startup/schemes?s=${m.scheme.id}`}
                    target="_blank"
                    className="absolute bottom-3 left-3.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy hover:underline"
                  >
                    Details <ArrowUpRight size={13} aria-hidden="true" />
                  </Link>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
        {draft.schemeIds.length > 0 && (
          <p className="mt-3 text-[13px] font-semibold text-navy">
            {draft.schemeIds.length} scheme{draft.schemeIds.length === 1 ? "" : "s"} will go with your request.
          </p>
        )}
        <p className="mt-2 text-[12px] text-muted">A suggestion, not a decision on eligibility. Check the official portal before you apply.</p>
      </div>
    </section>
  )
}
