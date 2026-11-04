/**
 * Review & send: "Add a scheme". A small card above "What happens next" with
 * an Add a scheme button. It opens a dialog with the government schemes MPI
 * matched to this request; the startup ticks the ones it plans to use and
 * presses Save. They are saved with the request so MPI and the invited
 * suppliers see them. Optional.
 */

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, Check, CheckCircle2, Landmark, Plus, X } from "lucide-react"
import type { Category } from "../../../services/data/catalogue"
import { matchSchemesToRequest, type SchemeSuggestion } from "../../../services/data/schemes"
import Button from "../../../ui/Button"
import { FitRing, fitLabel } from "../../schemes/parts"
import { SOFT_BG } from "../../supplier/parts"
import type { WizardDraft } from "./draft"

/** How many matches the dialog shows (ticked ones are always shown too). */
const TOP = 3


/** Matches the request's schemes again only when what it is about changes. */
function useMatches(draft: WizardDraft, categories: Category[] | null): SchemeSuggestion[] | null {
  const [matches, setMatches] = useState<SchemeSuggestion[] | null>(null)
  const categoryName = categories?.find((c) => c.id === draft.categoryId)?.name ?? null
  const items = draft.items.map((i) => i.itemName || i.description)
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
  return matches
}

function SchemeDialog({
  matches,
  saved,
  onSave,
  onClose,
}: {
  matches: SchemeSuggestion[] | null
  saved: string[]
  onSave: (ids: string[]) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<string[]>(saved)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const shown = useMemo(() => {
    if (!matches) return []
    return [...matches.slice(0, TOP), ...matches.filter((m, i) => i >= TOP && picked.includes(m.scheme.id))]
  }, [matches, picked])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const changed = picked.length !== saved.length || picked.some((id) => !saved.includes(id))

  return (
    <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ zIndex: 70 }}>
      <motion.div className="absolute inset-0 bg-navy/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheme-dialog-title"
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxWidth: 880 }}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6" style={{ background: "#eef1f5", borderBottom: "1px solid #cbd2dc" }}>
          <div>
            <h2 id="scheme-dialog-title" className="flex items-center gap-2 font-display text-[19px] font-bold" style={{ color: "#15233d" }}>
              <Landmark size={19} aria-hidden="true" /> Recommended schemes
            </h2>
            <p className="mt-0.5 text-[13.5px] text-muted">
              Matched to what you're buying. Tick the ones you plan to use. MPI and your supplier will see them, so the supplier can give you the invoices and
              certificates the scheme asks for.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-navy hover:bg-white" aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6" style={{ background: SOFT_BG }}>
          {!matches ? (
            <div className="grid gap-3 md:grid-cols-3" aria-label="Finding schemes">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-white/70" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="rounded-lg bg-white px-4 py-3 text-[14px] text-navy">
              No scheme fits this request closely.{" "}
              <Link to="/startup/schemes" target="_blank" className="font-semibold underline">
                Browse all schemes
              </Link>
            </p>
          ) : (
            <motion.ul className="grid gap-3 md:grid-cols-3" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
              {shown.map((m) => {
                const on = picked.includes(m.scheme.id)
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
          <p className="mt-3 text-[12px] text-muted">A suggestion, not a decision on eligibility. Check the official portal before you apply.</p>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
          <span className="text-[13.5px] font-semibold text-navy">
            {picked.length ? `${picked.length} scheme${picked.length === 1 ? "" : "s"} selected` : "None selected"}
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!changed}
              onClick={() => {
                onSave(picked)
                onClose()
              }}
            >
              Save
            </Button>
          </span>
        </footer>
      </motion.div>
    </div>
  )
}

export default function SchemePicker({
  draft,
  categories,
  update,
}: {
  draft: WizardDraft
  categories: Category[] | null
  update: (patch: Partial<WizardDraft>) => void
}) {
  const matches = useMatches(draft, categories)
  const [open, setOpen] = useState(false)
  const chosen = (matches ?? []).filter((m) => draft.schemeIds.includes(m.scheme.id))
  const count = matches ? Math.min(TOP, matches.length) : null

  return (
    <section className="rounded-xl border-[1.5px] border-line p-5 shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={{ background: SOFT_BG }}>
      <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-navy">
        <Landmark size={18} aria-hidden="true" /> Government schemes
      </h2>
      <p className="mt-1 text-[13.5px] text-muted">
        {count == null
          ? "Finding schemes that fit this request…"
          : count
            ? `${count} scheme${count === 1 ? "" : "s"} could lower what you pay for this request.`
            : "No scheme fits this request closely."}{" "}
        Optional.
      </p>
      {chosen.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {chosen.map((m) => (
            <li key={m.scheme.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[13.5px] font-semibold text-navy">
              <CheckCircle2 size={15} className="shrink-0" style={{ color: "#15967B" }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{m.scheme.short_name}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gradient mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-bold text-navy shadow-sm"
      >
        <Plus size={17} aria-hidden="true" />
        Add a scheme
      </button>
      {createPortal(
        <AnimatePresence>
          {open && <SchemeDialog matches={matches} saved={draft.schemeIds} onSave={(ids) => update({ schemeIds: ids })} onClose={() => setOpen(false)} />}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  )
}
