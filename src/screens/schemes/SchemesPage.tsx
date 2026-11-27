/**
 * Government schemes for startups (/startup/schemes) and suppliers (/supplier/schemes).
 *
 * - Suggested for you: the schemes that fit this business best, with the
 *   reasons (suggest_schemes). A suggestion, not a decision on eligibility.
 * - All schemes: search and category filter. Startups see schemes open to
 *   startups; suppliers see schemes open to MSMEs.
 * - Clicking a scheme opens its details in a side panel (?s=<id> keeps it
 *   open on refresh), with a link to the official portal.
 * Details come from the MSME schemes booklet, so the page says to check the
 * portal for current terms.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, Building2, CheckCircle2, FileText, Info, Landmark, ListChecks, Search, Sparkles, Users, X } from "lucide-react"
import { listSchemes, suggestSchemes, type Scheme, type SchemeSuggestion } from "../../services/data/schemes"
import { listCategories } from "../../services/data/catalogue"
import { Alert, BOX, boxBorder } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { Panel } from "../overview/parts"
import { errorText } from "../supplier/parts"
import { FitRing, fitLabel } from "./parts"

type Audience = "startup" | "vendor"

/** Schemes shown in "All schemes" before "Show all". */
const PREVIEW = 9


function Section({ icon: Icon, title, items, numbered }: { icon: typeof Info; title: string; items: string[]; numbered?: boolean }) {
  if (!items.length) return null
  const List = numbered ? "ol" : "ul"
  return (
    <section className="mt-5">
      <h3 className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-[0.04em] text-navy">
        <Icon size={16} aria-hidden="true" /> {title}
      </h3>
      <List className={`mt-2 space-y-1.5 text-[14.5px] text-ink ${numbered ? "list-decimal pl-5" : ""}`}>
        {items.map((t) => (
          <li key={t} className={numbered ? "pl-1" : "flex gap-2"}>
            {!numbered && <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange" aria-hidden="true" />}
            <span>{t}</span>
          </li>
        ))}
      </List>
    </section>
  )
}

/** The side panel with a scheme's full details. */
export function SchemeDrawer({
  scheme,
  fit,
  catName,
  onClose,
  extra,
}: {
  scheme: Scheme
  fit?: SchemeSuggestion
  catName: (id: string) => string | null
  onClose: () => void
  /** Shown at the top of the panel, e.g. the admin on/off switch. */
  extra?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  const cats = scheme.category_ids.map(catName).filter((x): x is string => !!x)
  return (
    <>
      <motion.div className="fixed inset-0 bg-navy/40" style={{ zIndex: 60 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={scheme.short_name}
        className="fixed inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl"
        style={{ zIndex: 70, maxWidth: 560 }}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4" style={{ background: "#eef1f5", borderBottom: "1px solid #cbd2dc" }}>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted">{scheme.ministry ?? "Government of India"}</p>
            <h2 className="mt-0.5 font-display text-[20px] font-bold leading-snug text-navy">{scheme.short_name}</h2>
            <p className="mt-0.5 text-[13px] text-muted">{scheme.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-navy hover:bg-white" aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
          {extra}
          {fit && (
            <div className="rounded-xl border-[1.5px] border-orange bg-orange-tint/40 p-3.5">
              <p className="flex items-center gap-2 text-[14px] font-bold text-navy">
                <Sparkles size={16} aria-hidden="true" /> {fitLabel(fit.score)} for you · {fit.score}/100
              </p>
              <ul className="mt-1.5 space-y-1 text-[13.5px] text-navy">
                {fit.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scheme.max_assistance && (
            <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "#15233d" }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-white/75">Support up to</p>
              <p className="mt-0.5 text-[16px] font-bold leading-snug" style={{ color: "#f09a47" }}>
                {scheme.max_assistance}
              </p>
            </div>
          )}
          {scheme.description && <p className="mt-4 text-[15px] text-ink">{scheme.description}</p>}
          {scheme.nature_of_assistance && (
            <p className="mt-3 text-[14px] text-muted">
              <b className="text-navy">What you get: </b>
              {scheme.nature_of_assistance}
            </p>
          )}
          {cats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <span key={c} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[12.5px] font-semibold text-navy">
                  {c}
                </span>
              ))}
            </div>
          )}
          <Section icon={CheckCircle2} title="Key benefits" items={scheme.key_benefits} />
          <Section icon={Users} title="Who can apply" items={scheme.who_can_apply} />
          <Section icon={ListChecks} title="Eligibility" items={scheme.eligibility} />
          <Section icon={ArrowUpRight} title="How to apply" items={scheme.how_to_apply} numbered />
          <Section icon={FileText} title="Documents you'll need" items={scheme.documents_required} />
          {scheme.contact_office && (
            <p className="mt-5 flex gap-2 text-[14px] text-muted">
              <Building2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <b className="text-navy">Contact: </b>
                {scheme.contact_office}
              </span>
            </p>
          )}
        </div>
        <footer className="border-t border-line px-5 py-3.5">
          <p className="mb-2.5 flex items-start gap-2 text-[12.5px] text-muted">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Amounts and rules change. Check the official portal for current terms before you apply.
          </p>
          {scheme.official_url && (
            <a
              href={scheme.official_url}
              target="_blank"
              rel="noreferrer"
              className="btn-gradient inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-bold text-navy shadow-sm"
            >
              Open official portal <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          )}
        </footer>
      </motion.aside>
    </>
  )
}

export default function SchemesPage({ audience }: { audience: Audience }) {
  const [schemes, setSchemes] = useState<Scheme[] | null>(null)
  /** Every active scheme, so a link to one outside this audience (e.g. from a request) still opens. */
  const [everyScheme, setEveryScheme] = useState<Scheme[]>([])
  const [fits, setFits] = useState<SchemeSuggestion[]>([])
  const [cats, setCats] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const [params, setParams] = useSearchParams()
  const openId = params.get("s")

  useEffect(() => {
    document.title = "Government schemes · MPI"
    let live = true
    void (async () => {
      try {
        const [all, sug, cs] = await Promise.all([listSchemes(), suggestSchemes(6).catch(() => []), listCategories()])
        if (!live) return
        setSchemes(all.filter((s) => s.is_active && (audience === "startup" ? s.for_startups : s.for_msmes)))
        setEveryScheme(all.filter((s) => s.is_active))
        setFits(sug)
        setCats(cs.map((c) => ({ id: c.id, name: c.name })))
      } catch (err) {
        if (live) setError(errorText(err))
      }
    })()
    return () => {
      live = false
    }
  }, [audience])

  const catName = useMemo(() => {
    const m = new Map(cats.map((c) => [c.id, c.name]))
    return (id: string) => m.get(id) ?? null
  }, [cats])
  const fitById = useMemo(() => new Map(fits.map((f) => [f.scheme.id, f])), [fits])
  const usedCats = useMemo(() => cats.filter((c) => schemes?.some((s) => s.category_ids.includes(c.id))), [cats, schemes])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (schemes ?? []).filter(
      (s) =>
        (!cat || s.category_ids.includes(cat)) &&
        (!q || [s.short_name, s.name, s.ministry ?? "", s.description ?? "", ...s.industry_keywords].some((t) => t.toLowerCase().includes(q))),
    )
  }, [schemes, query, cat])

  const open = openId ? (everyScheme.find((s) => s.id === openId) ?? fits.find((f) => f.scheme.id === openId)?.scheme) : undefined
  const show = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (id) n.set("s", id)
        else n.delete("s")
        return n
      },
      { replace: true },
    )

  return (
    <div>
      <PageHeader
        title="Government schemes"
        description={
          audience === "startup"
            ? "Grants, subsidies and loans that can lower what you spend on making your product."
            : "Grants, subsidies and loans that can help your business grow and win more orders."
        }
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {!schemes ? (
        <div className="space-y-4" aria-label="Loading">
          <div className="h-48 animate-pulse rounded-xl bg-page" />
          <div className="h-96 animate-pulse rounded-xl bg-page" />
        </div>
      ) : (
        <div className="space-y-5">
          <Panel title="Suggested for you" icon={Sparkles} action={<span className="text-[13px] font-semibold text-navy">Based on your profile</span>}>
            {fits.length === 0 ? (
              <p className="px-5 py-6 text-[14px] text-muted">
                No strong matches yet. Add your categories and registration details (Udyam, DPIIT) to your profile, and MPI will suggest schemes that fit.
              </p>
            ) : (
              <motion.ul
                className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
              >
                {fits.map((f) => (
                  <motion.li key={f.scheme.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                    <motion.button
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => show(f.scheme.id)}
                      className="flex h-full w-full flex-col rounded-xl border-[1.5px] border-line bg-white p-3.5 text-left transition-shadow hover:border-orange hover:shadow-[0_6px_18px_rgba(240,154,71,0.16)]"
                    >
                      <span className="flex items-start gap-3">
                        <FitRing score={f.score} />
                        <span className="min-w-0">
                          <span className="block font-display text-[15.5px] font-bold leading-snug text-navy">{f.scheme.short_name}</span>
                          <span className="block text-[12.5px] font-semibold text-muted">{fitLabel(f.score)}</span>
                        </span>
                      </span>
                      {f.scheme.max_assistance && <span className="mt-2.5 line-clamp-2 block text-[13.5px] font-semibold text-navy">{f.scheme.max_assistance}</span>}
                      <span className="mt-2 block space-y-0.5">
                        {f.reasons.slice(0, 2).map((r) => (
                          <span key={r} className="flex gap-1.5 text-[12.5px] text-muted">
                            <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#15967B]" aria-hidden="true" />
                            <span className="line-clamp-1">{r}</span>
                          </span>
                        ))}
                      </span>
                    </motion.button>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </Panel>

          <Panel title="All schemes" icon={Landmark} action={<span className="text-[13px] font-semibold text-navy">{shown.length} of {schemes.length}</span>}>
            <div className="flex flex-col gap-3 px-4 pt-3 sm:px-5 lg:flex-row lg:items-center">
              <div className="relative w-full lg:max-w-xs">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search schemes"
                  aria-label="Search schemes"
                  className={`${BOX} ${boxBorder()} min-h-9 pl-9 text-[14px]`}
                />
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="Filter by category">
                {[{ id: null as string | null, name: "All" }, ...usedCats].map((c) => {
                  const on = cat === c.id
                  return (
                    <button
                      key={c.id ?? "all"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setCat(c.id)}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${on ? "btn-gradient text-navy shadow-sm" : "bg-page text-muted hover:text-navy"}`}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
            {shown.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14px] text-muted">No schemes match. Try another word or category.</p>
            ) : (
              <ul className="grid gap-2.5 px-4 pb-4 pt-3 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
                {(all || query || cat ? shown : shown.slice(0, PREVIEW)).map((s) => {
                  const fit = fitById.get(s.id)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => show(s.id)}
                        className="flex h-full w-full flex-col rounded-lg border border-line/80 bg-white px-3.5 py-3 text-left transition-colors hover:border-orange hover:bg-[#fffaf5]"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-[14.5px] font-bold leading-snug text-navy">{s.short_name}</span>
                          {fit && <span className="shrink-0 rounded-full bg-orange px-1.5 py-px text-[11px] font-bold text-navy">Suggested</span>}
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-[12.5px] text-muted">{s.ministry ?? "Government of India"}</span>
                        {s.max_assistance && <span className="mt-1.5 line-clamp-2 block text-[13px] text-ink">{s.max_assistance}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {!all && !query && !cat && shown.length > PREVIEW && (
              <div className="px-4 pb-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setAll(true)}
                  className="w-full rounded-lg border-[1.5px] border-dashed border-line py-2 text-[14px] font-bold text-navy transition-colors hover:border-orange hover:bg-[#fffaf5]"
                >
                  Show all {shown.length} schemes
                </button>
              </div>
            )}
          </Panel>
          <p className="flex items-start gap-2 text-[13px] text-muted">
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            Details come from the Government of India MSME schemes booklet. Suggestions are a guide, not a decision on eligibility. Always check the official portal for current terms.
          </p>
        </div>
      )}

      {/* In a portal so it sits above the top navbar. */}
      {createPortal(
        <AnimatePresence>{open && <SchemeDrawer key={open.id} scheme={open} fit={fitById.get(open.id)} catName={catName} onClose={() => show(null)} />}</AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
