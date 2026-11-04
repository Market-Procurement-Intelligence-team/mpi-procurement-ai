/**
 * Admin: Government schemes (/admin/schemes).
 *
 * The same schemes startups and suppliers see, with an on/off switch on each.
 * A switched-off scheme is hidden from everyone else (it stays saved, and can
 * be switched on again). Switching off asks to confirm first; switching on
 * saves straight away. Also shows how many sent requests picked each scheme.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import { EyeOff, Landmark, Layers, Search, ToggleRight, TrendingUp } from "lucide-react"
import { countSchemePicks, listSchemes, setSchemeActive, type Scheme } from "../../services/data/schemes"
import { listCategories } from "../../services/data/catalogue"
import { Alert, BOX, boxBorder } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { Panel } from "../overview/parts"
import { errorText, SummaryCards, useToast } from "../supplier/parts"
import { SchemeDrawer } from "./SchemesPage"

type Filter = "all" | "on" | "off"

/** A small on/off switch. */
function Switch({ on, busy, label, onChange }: { on: boolean; busy?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60"
      style={{ background: on ? "linear-gradient(105deg, #f09a47, #ec8d49, #e5683a)" : "#cbd2dc" }}
    >
      <motion.span
        className="block h-5 w-5 rounded-full bg-white shadow"
        animate={{ x: on ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  )
}

export default function AdminSchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[] | null>(null)
  const [picks, setPicks] = useState<Map<string, number>>(new Map())
  const [cats, setCats] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  /** The scheme waiting for "Switch off" to be confirmed. */
  const [confirmOff, setConfirmOff] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [toast, toastNode] = useToast()
  const openId = params.get("s")

  const reload = useCallback(async () => {
    try {
      const [all, counts, cs] = await Promise.all([listSchemes(), countSchemePicks().catch(() => new Map<string, number>()), listCategories()])
      setSchemes(all)
      setPicks(counts)
      setCats(new Map(cs.map((c) => [c.id, c.name])))
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [])

  useEffect(() => {
    document.title = "Government schemes · MPI admin"
    void reload()
  }, [reload])

  const onCount = schemes?.filter((s) => s.is_active).length ?? 0
  const offCount = (schemes?.length ?? 0) - onCount
  const totalPicks = [...picks.values()].reduce((a, b) => a + b, 0)
  const top = useMemo(() => {
    const best = [...picks.entries()].sort((a, b) => b[1] - a[1])[0]
    return best ? schemes?.find((s) => s.id === best[0])?.short_name : undefined
  }, [picks, schemes])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (schemes ?? [])
      .filter((s) => (filter === "on" ? s.is_active : filter === "off" ? !s.is_active : true))
      .filter((s) => !q || [s.short_name, s.name, s.ministry ?? ""].some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => (picks.get(b.id) ?? 0) - (picks.get(a.id) ?? 0) || a.short_name.localeCompare(b.short_name))
  }, [schemes, filter, query, picks])

  const save = async (s: Scheme, active: boolean) => {
    setBusy(s.id)
    try {
      await setSchemeActive(s.id, active)
      setSchemes((list) => list?.map((x) => (x.id === s.id ? { ...x, is_active: active } : x)) ?? null)
      toast(active ? `${s.short_name} is on. Startups and suppliers can see it.` : `${s.short_name} is off and hidden.`)
      setConfirmOff(null)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }
  const toggle = (s: Scheme) => (s.is_active ? setConfirmOff(s.id) : void save(s, true))

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
  const open = openId ? schemes?.find((s) => s.id === openId) : undefined

  return (
    <div>
      <PageHeader title="Government schemes" description="Choose which schemes startups and suppliers see. A switched-off scheme is hidden from them, and you can switch it on again any time." />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {!schemes ? (
        <div className="space-y-4" aria-label="Loading">
          <div className="h-24 animate-pulse rounded-xl bg-page" />
          <div className="h-96 animate-pulse rounded-xl bg-page" />
        </div>
      ) : (
        <>
          <SummaryCards
            selected={filter === "all" ? "all" : filter}
            onPick={(id) => (id === "all" || id === "on" || id === "off" ? setFilter(id) : setFilter("all"))}
            items={[
              { id: "all", label: "All schemes", value: schemes.length, hint: "from the MSME schemes booklet", icon: Landmark },
              { id: "on", label: "Switched on", value: onCount, hint: "shown to startups and suppliers", icon: ToggleRight },
              { id: "off", label: "Switched off", value: offCount, hint: offCount ? "hidden from everyone else" : "none hidden", icon: EyeOff, dot: offCount > 0 },
              { id: "picks", label: "Picked on requests", value: totalPicks, hint: top ? `most picked: ${top}` : "none picked yet", icon: TrendingUp },
            ]}
          />

          <Panel title="Schemes" icon={Layers} action={<span className="text-[13px] font-semibold text-navy">{shown.length} shown</span>}>
            <div className="flex flex-col gap-3 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="relative w-full sm:max-w-xs">
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
              <span className="inline-flex rounded-lg bg-page p-0.5" role="group" aria-label="Show">
                {(["all", "on", "off"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1 text-[13px] font-bold transition-colors ${filter === f ? "btn-gradient text-navy shadow-sm" : "text-muted hover:text-navy"}`}
                  >
                    {f === "all" ? "All" : f === "on" ? "On" : "Off"}
                  </button>
                ))}
              </span>
            </div>

            {shown.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14px] text-muted">No schemes match.</p>
            ) : (
              <ul className="grid gap-2.5 px-4 pb-4 pt-3 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
                {shown.map((s) => {
                  const n = picks.get(s.id) ?? 0
                  const asking = confirmOff === s.id
                  return (
                    <li
                      key={s.id}
                      className="flex flex-col rounded-lg border bg-white px-3.5 py-3 transition-colors"
                      style={{ borderColor: s.is_active ? "rgba(203,210,220,0.8)" : "#cbd2dc", background: s.is_active ? "#ffffff" : "#f4f6f9" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => show(s.id)} className="min-w-0 text-left hover:underline">
                          <span className={`block text-[14.5px] font-bold leading-snug ${s.is_active ? "text-navy" : "text-muted"}`}>{s.short_name}</span>
                          <span className="mt-0.5 line-clamp-1 block text-[12.5px] text-muted">{s.ministry ?? "Government of India"}</span>
                        </button>
                        <Switch on={s.is_active} busy={busy === s.id} label={`${s.short_name} shown to startups and suppliers`} onChange={() => toggle(s)} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${s.is_active ? "bg-[#ecfdf5] text-[#047857]" : "bg-page text-muted"}`}>{s.is_active ? "On" : "Off"}</span>
                        {s.for_startups && <span className="rounded-full bg-navy-tint px-2 py-0.5 font-semibold text-navy">Startups</span>}
                        {s.for_msmes && <span className="rounded-full bg-navy-tint px-2 py-0.5 font-semibold text-navy">MSMEs</span>}
                        <span className={`ml-auto font-semibold ${n ? "text-navy" : "text-muted"}`}>
                          {n ? `Picked on ${n} request${n === 1 ? "" : "s"}` : "Not picked yet"}
                        </span>
                      </div>
                      <AnimatePresence>
                        {asking && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="mt-2.5 rounded-lg border-[1.5px] border-orange bg-orange-tint/50 p-2.5 text-[13px] text-navy">
                              Hide it from startups and suppliers?{n ? ` It stays saved on the ${n} request${n === 1 ? "" : "s"} that picked it.` : ""}
                              <span className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  disabled={busy === s.id}
                                  onClick={() => void save(s, false)}
                                  className="btn-gradient rounded-md px-3 py-1 text-[12.5px] font-bold text-navy shadow-sm disabled:opacity-60"
                                >
                                  Switch off
                                </button>
                                <button type="button" onClick={() => setConfirmOff(null)} className="rounded-md border border-line bg-white px-3 py-1 text-[12.5px] font-bold text-navy">
                                  Cancel
                                </button>
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </>
      )}

      {createPortal(
        <AnimatePresence>
          {open && (
            <SchemeDrawer
              key={open.id}
              scheme={open}
              catName={(id) => cats.get(id) ?? null}
              onClose={() => show(null)}
              extra={
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-line bg-page px-3.5 py-3">
                  <span className="text-[14px] text-navy">
                    <b>{open.is_active ? "Shown" : "Hidden"}</b> to startups and suppliers
                    <span className="block text-[12.5px] text-muted">
                      {(picks.get(open.id) ?? 0) ? `Picked on ${picks.get(open.id)} request${picks.get(open.id) === 1 ? "" : "s"}` : "Not picked on any request yet"}
                    </span>
                  </span>
                  <Switch on={open.is_active} busy={busy === open.id} label={`${open.short_name} shown to startups and suppliers`} onChange={() => toggle(open)} />
                </div>
              }
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
      {toastNode}
    </div>
  )
}
