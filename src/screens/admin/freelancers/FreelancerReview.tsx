/**
 * Admin: the Freelancers tab of Supplier verification
 * (/admin/verification?who=freelancers).
 *
 * Top: the Freelancers on/off switch, sliding filter pills with counts and a
 * one-line headline (how many wait, how long the oldest has waited).
 * Left: the queue. Each row shows the anonymous code with the real name in
 * grey, city, categories, when it was sent, how complete it is, and PAN /
 * bank ticks. Right: the selected freelancer (ReviewPanel).
 * URL: fl = filter, p = selected freelancer (the review notification opens ?p=).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import { CircleCheck, CircleX, Clock, Minus, Search, UserRound } from "lucide-react"
import { listCategories, type Category } from "../../../services/data/catalogue"
import {
  freelancersOpen,
  listProviderQueueFacts,
  listProvidersForReview,
  setFreelancersEnabled,
  type ProviderForReview,
  type ProviderQueueFacts,
} from "../../../services/data/providers"
import EmptyState from "../../../ui/EmptyState"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import Switch from "../../../ui/Switch"
import { ago, errorText, GRADIENT_PANEL, useToast } from "../../supplier/parts"
import ReviewPanel from "./ReviewPanel"
import { FILTERS, filterOf, latestCheck, quickReady, type Filter } from "./shared"

export default function FreelancerReview() {
  const [items, setItems] = useState<ProviderForReview[] | null>(null)
  const [facts, setFacts] = useState<Map<string, ProviderQueueFacts>>(new Map())
  const [categories, setCategories] = useState<Category[]>([])
  const [open, setOpen] = useState<boolean | null>(null)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [params, setParams] = useSearchParams()
  const [toast, toastNode] = useToast()
  const selectedId = params.get("p")

  const reload = useCallback(async () => {
    try {
      const [list, cats, on] = await Promise.all([listProvidersForReview(), listCategories().catch(() => []), freelancersOpen().catch(() => null)])
      setItems(list)
      setCategories(cats)
      setOpen(on)
      setFacts(await listProviderQueueFacts(list.map((i) => i.org.id)))
      setError(null)
    } catch (err) {
      setError(errorText(err))
      setItems((s) => s ?? [])
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const all = useMemo(() => items ?? [], [items])
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const categoryName = useCallback((id: string | null) => (id ? (names.get(id) ?? null) : null), [names])

  const counts = useMemo(() => {
    const c = Object.fromEntries(FILTERS.map((f) => [f.id, 0])) as Record<Filter, number>
    for (const i of all) c[filterOf(i.profile)]++
    return c
  }, [all])

  const selected = all.find((i) => i.org.id === selectedId) ?? null
  const filterParam = params.get("fl") as Filter | null
  const filter: Filter = FILTERS.some((f) => f.id === filterParam) ? (filterParam as Filter) : selected ? filterOf(selected.profile) : counts.review ? "review" : "live"

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = all.filter((i) => filterOf(i.profile) === filter).filter((i) => !q || [i.org.display_name, i.org.name, i.org.city ?? "", i.profile.legal_name ?? ""].some((t) => t.toLowerCase().includes(q)))
    // Oldest first while waiting, so no one waits too long.
    if (filter === "review") list.sort((a, b) => (a.profile.submitted_at ?? "").localeCompare(b.profile.submitted_at ?? ""))
    return list
  }, [all, filter, query])

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) (v === null ? p.delete(k) : p.set(k, v))
    setParams(p, { replace: true })
  }

  useEffect(() => {
    if (!selectedId && shown.length && window.matchMedia("(min-width: 1024px)").matches) {
      const p = new URLSearchParams(params)
      p.set("p", shown[0].org.id)
      setParams(p, { replace: true })
    }
  }, [selectedId, shown, params, setParams])

  async function toggleOpen() {
    if (open === null) return
    setSwitching(true)
    try {
      await setFreelancersEnabled(!open)
      setOpen(!open)
      toast(open ? "Freelancers switched off" : "Freelancers switched on")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSwitching(false)
    }
  }

  const waiting = all.filter((i) => filterOf(i.profile) === "review")
  const oldest = waiting.reduce<string | null>((o, i) => (i.profile.submitted_at && (!o || i.profile.submitted_at < o) ? i.profile.submitted_at : o), null)

  if (items === null)
    return (
      <div className="space-y-4" aria-label="Loading">
        <div className="h-16 animate-pulse rounded-xl bg-page" />
        <div className="h-80 animate-pulse rounded-xl bg-page" />
      </div>
    )

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      {/* Switch + headline */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3" style={GRADIENT_PANEL}>
        <p className="flex items-center gap-2 text-[15px] text-navy">
          <Clock size={17} className="text-orange-2" aria-hidden="true" />
          {waiting.length ? (
            <span>
              <b>
                {waiting.length} profile{waiting.length === 1 ? "" : "s"} waiting
              </b>
              {oldest ? `, oldest sent ${ago(oldest)}` : ""} · {counts.live} live
            </span>
          ) : (
            <span>
              <b>Nothing waiting for review.</b> {counts.live} live
            </span>
          )}
        </p>
        {open !== null && (
          <span className="flex items-center gap-2.5 rounded-lg border border-line/70 bg-white px-3 py-1.5 text-[14px] font-semibold text-navy">
            Freelancers {open ? "on" : "off"}
            <Switch on={open} busy={switching} label="Freelancers on for startups and sign-up" onChange={() => void toggleOpen()} />
          </span>
        )}
      </div>
      {open === false && (
        <p className="text-[13.5px] text-muted">Freelancers are off: startups don't see them and new freelancers can't join. You can still review profiles.</p>
      )}

      {/* Filter pills */}
      <div role="tablist" aria-label="Freelancer status" className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const on = f.id === filter
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => update({ fl: f.id, p: null })}
              className={`relative flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors ${on ? "text-navy" : "border border-line bg-white text-navy hover:bg-navy-tint"}`}
            >
              {on && <motion.span layoutId="fl-filter" className="btn-gradient absolute inset-0 rounded-full shadow-sm" transition={{ type: "spring", stiffness: 450, damping: 36 }} />}
              <span className="relative">{f.label}</span>
              <span className={`relative rounded-full px-1.5 py-px text-[12px] font-bold ${on ? "bg-white/70" : "bg-navy-tint"}`}>{counts[f.id]}</span>
            </button>
          )
        })}
      </div>

      {all.length === 0 ? (
        <EmptyState icon={UserRound} title="No freelancers yet" body="When a freelancer joins, their profile shows up here to be reviewed." />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[23rem_minmax(0,1fr)]">
          <aside className={`h-fit min-w-0 overflow-hidden rounded-xl border-[1.5px] border-line bg-white soft-panel shadow-[0_1px_3px_rgba(21,35,61,0.08)] lg:sticky lg:top-24 ${selected ? "hidden lg:block" : ""}`}>
            <div className="relative p-3">
              <Search size={16} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search code, name or city"
                aria-label="Search freelancers"
                className={`${BOX} ${boxBorder()} min-h-10 pl-9 text-[14.5px]`}
              />
            </div>
            <Queue items={shown} facts={facts} categoryName={categoryName} selectedId={selectedId} onSelect={(id) => update({ p: id })} />
          </aside>
          <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={selected?.org.id ?? "none"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                {selected ? (
                  <ReviewPanel
                    item={selected}
                    categoryName={categoryName}
                    onBack={() => update({ p: null })}
                    onDone={async (msg) => {
                      toast(msg)
                      await reload()
                    }}
                  />
                ) : (
                  <EmptyState icon={UserRound} title="Pick a freelancer" body="Choose a profile on the left to review it." />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  )
}

// ---------------------------------------------------------------- queue

function Queue({
  items,
  facts,
  categoryName,
  selectedId,
  onSelect,
}: {
  items: ProviderForReview[]
  facts: Map<string, ProviderQueueFacts>
  categoryName: (id: string | null) => string | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (!items.length) return <p className="px-5 pb-10 pt-6 text-center text-muted">Nothing here right now.</p>
  return (
    <ul className="space-y-2 px-3 pb-3">
      {items.map((i) => {
        const f = facts.get(i.org.id)
        const on = i.org.id === selectedId
        const pct = quickReady(i.profile, f)
        const cats = (f?.categoryIds ?? []).map(categoryName).filter(Boolean) as string[]
        const when = i.profile.status === "pending_review" ? `Sent ${ago(i.profile.submitted_at)}` : i.profile.reviewed_at ? `Reviewed ${ago(i.profile.reviewed_at)}` : `Joined ${ago(i.org.created_at)}`
        return (
          <li key={i.org.id}>
            <button
              type="button"
              onClick={() => onSelect(i.org.id)}
              aria-current={on || undefined}
              className={`w-full rounded-lg border-[1.5px] py-3 pr-3.5 text-left transition-colors ${
                on ? "border-l-[5px] border-orange bg-orange-tint/45 pl-3 shadow-[0_2px_8px_rgba(240,154,71,0.25)]" : "border-line bg-white pl-[calc(0.75rem+3.5px)] hover:border-orange/60"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-snug text-navy">{i.org.display_name}</span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">
                    {i.profile.legal_name || i.org.name}
                    {i.org.city ? ` · ${i.org.city}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-muted">{when}</span>
              </span>
              {cats.length > 0 && (
                <span className="mt-2 flex flex-wrap gap-1">
                  {cats.slice(0, 2).map((c) => (
                    <span key={c} className="rounded-full bg-navy-tint px-2 py-0.5 text-[11.5px] font-semibold text-navy">
                      {c}
                    </span>
                  ))}
                  {cats.length > 2 && <span className="rounded-full bg-navy-tint px-2 py-0.5 text-[11.5px] font-semibold text-navy">+{cats.length - 2}</span>}
                </span>
              )}
              <span className="mt-2.5 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #f09a47, #e5683a)" }} />
                </span>
                <span className="text-[12px] font-semibold text-navy">{pct}% filled</span>
              </span>
              <span className="mt-2 flex gap-3 text-[12px] font-semibold text-navy">
                <CheckTick label="PAN" status={latestCheck(f, "identity_pan")} />
                <CheckTick label="Bank" status={latestCheck(f, "bank")} />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function CheckTick({ label, status }: { label: string; status: string | null }) {
  const look =
    status === "verified"
      ? { icon: CircleCheck, cls: "text-[#047857]", text: "checked" }
      : status === "pending"
        ? { icon: Clock, cls: "text-orange-2", text: "to check" }
        : status === "rejected"
          ? { icon: CircleX, cls: "text-red-text", text: "rejected" }
          : { icon: Minus, cls: "text-muted", text: "not sent" }
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${look.text}`}>
      <look.icon size={13} className={look.cls} aria-hidden="true" /> {label} <span className="font-normal text-muted">{look.text}</span>
    </span>
  )
}
