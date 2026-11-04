/**
 * Admin: Supplier verification (/admin/verification).
 *
 * Summary cards on top. Left: suppliers under tabs (To review, Needs details,
 * Verified, Not approved = not approved or paused) with search. Right: one supplier:
 * - Registration checks done for the admin: GSTIN and Udyam present and in
 *   the right format, PAN matches the GSTIN, profile filled in.
 * - Business details from the supplier's profile.
 * - Decision: verify, ask for more details, reject, pause, with a note the
 *   supplier sees. The database also refuses to verify without GSTIN + Udyam.
 *
 * The admin sees real company names next to the MPI alias.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock,
  Factory,
  FileQuestion,
  MapPin,
  PauseCircle,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { listSuppliers, setVerification, type SupplierForReview, type VerificationStatus } from "../../services/data/admin"
import { listCategories, type Category } from "../../services/data/catalogue"
import Button from "../../ui/Button"
import EmptyState from "../../ui/EmptyState"
import { Alert, BOX, boxBorder } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { ago, Chip, day, errorText, GRADIENT_PANEL, SummaryCards, useToast } from "../supplier/parts"

type ListTab = "review" | "needs_info" | "verified" | "closed"

const TAB_STATUSES: Record<ListTab, VerificationStatus[]> = {
  review: ["pending", "under_review"],
  needs_info: ["needs_info"],
  verified: ["verified"],
  closed: ["rejected", "suspended"],
}

const TABS: { id: ListTab; label: string }[] = [
  { id: "review", label: "To review" },
  { id: "needs_info", label: "Needs details" },
  { id: "verified", label: "Verified" },
  { id: "closed", label: "Not approved" },
]

const STATUS: Record<VerificationStatus, { label: string; tone: "navy" | "orange" | "red" | "line" | "green" }> = {
  pending: { label: "Waiting", tone: "orange" },
  under_review: { label: "Being checked", tone: "navy" },
  needs_info: { label: "Needs details", tone: "red" },
  verified: { label: "Verified", tone: "green" },
  rejected: { label: "Not approved", tone: "line" },
  suspended: { label: "Paused", tone: "red" },
  not_required: { label: "Not required", tone: "line" },
}

const SIZE: Record<string, string> = { micro: "Micro enterprise", small: "Small enterprise", medium: "Medium enterprise" }

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const UDYAM_RE = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/

interface Check {
  ok: boolean | null // null = can't tell (missing input)
  label: string
  detail: string
}

function checksFor(s: SupplierForReview): Check[] {
  const o = s.organisation
  const gstin = o.gstin?.trim().toUpperCase() ?? ""
  const udyam = o.udyam_number?.trim().toUpperCase() ?? ""
  const pan = s.details?.pan_number?.trim().toUpperCase() ?? ""
  return [
    {
      ok: gstin ? GSTIN_RE.test(gstin) : false,
      label: "GSTIN",
      detail: !gstin ? "Missing. Needed before verifying." : GSTIN_RE.test(gstin) ? `${gstin} · format looks right` : `${gstin} · format looks wrong (15 characters, e.g. 27ABCDE1234F1Z5)`,
    },
    {
      ok: udyam ? UDYAM_RE.test(udyam) : false,
      label: "Udyam registration",
      detail: !udyam ? "Missing. Needed before verifying." : UDYAM_RE.test(udyam) ? `${udyam} · format looks right` : `${udyam} · format looks wrong (e.g. UDYAM-MH-26-0012345)`,
    },
    {
      ok: !pan || !gstin ? null : PAN_RE.test(pan) && gstin.slice(2, 12) === pan,
      label: "PAN matches GSTIN",
      detail: !pan ? "No PAN given" : !gstin ? "No GSTIN to compare with" : gstin.slice(2, 12) === pan ? `${pan} is inside the GSTIN` : `${pan} doesn't match the GSTIN (${gstin.slice(2, 12)})`,
    },
    {
      ok: s.categoryIds.length > 0 && !!(o.city && s.details?.factory_address),
      label: "Profile filled in",
      detail: [
        s.categoryIds.length ? `${s.categoryIds.length} categor${s.categoryIds.length === 1 ? "y" : "ies"}` : "no categories",
        o.city ? "location" : "no location",
        s.details?.factory_address ? "factory address" : "no factory address",
      ].join(" · "),
    },
  ]
}

// ---------------------------------------------------------------- list

function SupplierList({ items, selectedId, onSelect }: { items: SupplierForReview[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!items.length) return <p className="px-5 py-10 text-center text-muted">Nothing here right now.</p>
  return (
    <ul className="space-y-2 p-3">
      {items.map((s) => {
        const o = s.organisation
        const selected = o.id === selectedId
        const st = STATUS[o.verification_status]
        const missing = !o.gstin || !o.udyam_number
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onSelect(o.id)}
              aria-current={selected || undefined}
              className={`flex w-full items-start gap-3 rounded-lg border-[1.5px] py-3 pr-3.5 text-left transition-colors ${
                selected
                  ? "border-l-[5px] border-orange bg-orange-tint/45 pl-3 shadow-[0_2px_8px_rgba(240,154,71,0.25)]"
                  : "border-line bg-white pl-[calc(0.75rem+3.5px)] hover:border-orange/60"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-navy">{o.name}</span>
                <span className="mt-1 block text-[12.5px] text-muted">
                  {o.display_name}
                  {o.city ? ` · ${o.city}` : ""}
                </span>
                <span className="block text-[12.5px] text-muted">Signed up {ago(o.created_at)}</span>
                {missing && o.verification_status !== "verified" && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-red-text">
                    <CircleAlert size={13} aria-hidden="true" /> {!o.gstin && !o.udyam_number ? "GSTIN and Udyam missing" : !o.gstin ? "GSTIN missing" : "Udyam missing"}
                  </span>
                )}
              </span>
              <Chip tone={st.tone}>{st.label}</Chip>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- detail

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-page px-3 py-2.5">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">{label}</p>
      <p className="text-[14.5px] font-semibold text-navy">{children}</p>
    </div>
  )
}

function Pills({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-[14px] text-muted">{empty}</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[13px] font-semibold text-navy">
          {t}
        </span>
      ))}
    </div>
  )
}

type Action = { status: VerificationStatus; label: string; icon: typeof BadgeCheck; primary?: boolean; needsNote?: boolean }

function actionsFor(status: VerificationStatus): Action[] {
  const verify: Action = { status: "verified", label: "Verify supplier", icon: BadgeCheck, primary: true }
  const ask: Action = { status: "needs_info", label: "Ask for more details", icon: FileQuestion, needsNote: true }
  const reject: Action = { status: "rejected", label: "Don't approve", icon: XCircle, needsNote: true }
  const check: Action = { status: "under_review", label: "Mark as being checked", icon: Clock }
  switch (status) {
    case "pending":
      return [verify, check, ask, reject]
    case "under_review":
      return [verify, ask, reject]
    case "needs_info":
      return [verify, check, reject]
    case "verified":
      return [{ status: "suspended", label: "Pause supplier", icon: PauseCircle, needsNote: true }]
    case "suspended":
      return [{ ...verify, label: "Verify again" }, reject]
    default:
      return [check, verify]
  }
}

function SupplierPanel({
  supplier,
  categories,
  onBack,
  onDone,
}: {
  supplier: SupplierForReview
  categories: Map<string, string>
  onBack: () => void
  onDone: (msg: string) => Promise<void>
}) {
  const o = supplier.organisation
  const d = supplier.details
  const checks = checksFor(supplier)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<VerificationStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canVerify = !!(o.gstin && o.udyam_number)
  const st = STATUS[o.verification_status]

  const act = async (a: Action) => {
    if (a.needsNote && !note.trim()) return setError("Write a short note so the supplier knows why.")
    if (a.status === "verified" && !canVerify) return setError("Add the GSTIN and Udyam number first. Ask the supplier for them.")
    setBusy(a.status)
    setError(null)
    try {
      await setVerification(o.id, a.status, note.trim() || undefined)
      setNote("")
      await onDone(`${o.name}: ${STATUS[a.status].label.toLowerCase()}`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="@container overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={GRADIENT_PANEL} aria-label={o.name}>
      <div className="bg-gradient-to-br from-navy-tint via-navy-tint/60 to-orange-tint/50 px-5 py-4 sm:px-6">
        <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy lg:hidden">
          <ArrowLeft size={16} aria-hidden="true" /> All suppliers
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-muted">
              {o.display_name} · signed up {day(o.created_at, true)}
            </p>
            <h2 className="font-display text-[22px] font-bold leading-tight text-navy">{o.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-navy">
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} className="text-muted" aria-hidden="true" />
                {[o.city, o.state].filter(Boolean).join(", ") || "Location not given"}
              </span>
              {d?.enterprise_type && (
                <span className="inline-flex items-center gap-1">
                  <Building2 size={14} className="text-muted" aria-hidden="true" />
                  {SIZE[d.enterprise_type] ?? d.enterprise_type}
                </span>
              )}
              {o.is_demo && <Chip tone="line">Demo account</Chip>}
            </p>
          </div>
          <div className="text-right">
            <Chip tone={st.tone}>{st.label}</Chip>
            {o.verified_at && o.verification_status === "verified" && <p className="mt-1 text-[12.5px] text-muted">since {day(o.verified_at, true)}</p>}
          </div>
        </div>
        {o.verification_note && (
          <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-[13.5px] text-navy ring-1 ring-line">
            <span className="font-semibold">Last note to the supplier:</span> {o.verification_note}
          </p>
        )}
      </div>

      <div className="space-y-6 bg-white px-5 py-5 sm:px-6">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-navy">
            <ShieldCheck size={17} aria-hidden="true" /> Registration checks
          </h3>
          <p className="text-[13px] text-muted">Done automatically from what the supplier typed. Please still check the numbers on the government portals.</p>
          <motion.ul className="mt-3 grid gap-2 @2xl:grid-cols-2" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
            {checks.map((c) => (
              <motion.li
                key={c.label}
                variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${c.ok === true ? "border-[#a7f3d0] bg-[#ecfdf5]" : c.ok === false ? "border-red/30 bg-red-tint/60" : "border-line bg-page"}`}
              >
                {c.ok === true ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#047857]" aria-label="Passed" />
                ) : c.ok === false ? (
                  <XCircle size={18} className="mt-0.5 shrink-0 text-red-text" aria-label="Problem" />
                ) : (
                  <CircleAlert size={18} className="mt-0.5 shrink-0 text-muted" aria-label="Can't check" />
                )}
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-navy">{c.label}</span>
                  <span className="block break-words text-[13px] text-muted">{c.detail}</span>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-navy">
            <Factory size={17} aria-hidden="true" /> Business details
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2 @2xl:grid-cols-4">
            <Fact label="Turnover">{d?.turnover_band || "–"}</Fact>
            <Fact label="Monthly capacity">{d?.monthly_capacity || "–"}</Fact>
            <Fact label="Lead time">{d?.lead_time_days ? `${d.lead_time_days} days` : "–"}</Fact>
            <Fact label="Ships across India">{d ? (d.pan_india_dispatch ? "Yes" : "No") : "–"}</Fact>
          </div>
          {d?.factory_address && <p className="mt-2 text-[13.5px] text-navy"><span className="font-semibold">Factory:</span> {d.factory_address}</p>}
          <div className="mt-4 grid gap-4 @2xl:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Categories</p>
              <Pills items={supplier.categoryIds.map((id) => categories.get(id) ?? "Unknown")} empty="None chosen" />
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Certifications</p>
              <Pills items={d?.certifications ?? []} empty="None given" />
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Machinery</p>
              <Pills items={d?.machinery ?? []} empty="None given" />
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Quality testing</p>
              <Pills items={d?.quality_testing_facilities ?? []} empty="None given" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-[1.5px] border-orange bg-orange-tint/30 p-4">
          <h3 className="text-[15px] font-bold text-navy">Your decision</h3>
          <label htmlFor="vnote" className="mt-2 block text-sm font-semibold text-navy">
            Note to the supplier <span className="font-normal text-muted">(they see it; needed to ask for details, not approve or pause)</span>
          </label>
          <textarea
            id="vnote"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. Your Udyam number has too few digits. Please check it and save your profile again."
            className={`${BOX} ${boxBorder()} mt-1.5 py-2.5`}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {actionsFor(o.verification_status).map((a) => (
              <Button
                key={a.status}
                variant={a.primary ? "primary" : "secondary"}
                busy={busy === a.status}
                disabled={busy !== null || (a.status === "verified" && !canVerify)}
                onClick={() => void act(a)}
              >
                <a.icon size={17} aria-hidden="true" />
                {a.label}
              </Button>
            ))}
          </div>
          {!canVerify && o.verification_status !== "verified" && (
            <p className="mt-2 text-[13px] text-muted">Verify becomes available once the supplier adds both the GSTIN and Udyam number.</p>
          )}
          {error && (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- page

export default function VerificationPage() {
  const [suppliers, setSuppliers] = useState<SupplierForReview[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [toast, toastNode] = useToast()
  const selectedId = params.get("s")

  const reload = useCallback(async () => {
    try {
      const [list, cats] = await Promise.all([listSuppliers(), listCategories().catch(() => [])])
      setSuppliers(list)
      setCategories(cats)
      setError(null)
    } catch (err) {
      setError(errorText(err))
      setSuppliers((s) => s ?? [])
    }
  }, [])

  useEffect(() => {
    document.title = "Supplier verification · MPI admin"
    void reload()
  }, [reload])

  const all = useMemo(() => suppliers ?? [], [suppliers])
  const lists = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (s: SupplierForReview) =>
      !q || [s.organisation.name, s.organisation.display_name, s.organisation.city ?? "", s.organisation.gstin ?? ""].some((t) => t.toLowerCase().includes(q))
    const shown = all.filter(match)
    const by = (tab: ListTab) => shown.filter((s) => TAB_STATUSES[tab].includes(s.organisation.verification_status))
    // Oldest sign-ups first while waiting, so no one waits too long.
    const oldestFirst = (xs: SupplierForReview[]) => [...xs].sort((a, b) => a.organisation.created_at.localeCompare(b.organisation.created_at))
    return { review: oldestFirst(by("review")), needs_info: by("needs_info"), verified: by("verified"), closed: by("closed") }
  }, [all, query])

  const listTab = (params.get("list") as ListTab | null) ?? (lists.review.length ? "review" : "verified")
  const shown = lists[listTab]
  const selected = all.find((s) => s.organisation.id === selectedId) ?? null
  const catNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  useEffect(() => {
    if (!selectedId && shown.length && window.matchMedia("(min-width: 1024px)").matches) {
      const p = new URLSearchParams(params)
      p.set("s", shown[0].organisation.id)
      setParams(p, { replace: true })
    }
  }, [selectedId, shown, params, setParams])

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) (v === null ? p.delete(k) : p.set(k, v))
    setParams(p, { replace: true })
  }

  const count = (statuses: VerificationStatus[]) => all.filter((s) => statuses.includes(s.organisation.verification_status)).length
  const waiting = count(["pending"])
  const checking = count(["under_review"])
  const needsInfo = count(["needs_info"])
  const verified = count(["verified"])

  return (
    <div>
      <PageHeader title="Supplier verification" description="Check each supplier's registration before they can receive requests from startups." />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {suppliers === null ? (
        <div className="space-y-4" aria-label="Loading">
          <div className="h-24 animate-pulse rounded-xl bg-page" />
          <div className="h-80 animate-pulse rounded-xl bg-page" />
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No suppliers yet" body="When a supplier signs up, they show up here to be verified." />
      ) : (
        <>
          <SummaryCards
            selected={listTab === "review" ? "waiting" : listTab === "needs_info" ? "info" : listTab === "verified" ? "verified" : null}
            onPick={(id) => update({ list: id === "info" ? "needs_info" : id === "verified" ? "verified" : "review", s: null })}
            items={[
              { id: "waiting", label: "Waiting", value: waiting, hint: waiting ? "not looked at yet" : "none waiting", icon: Clock, dot: waiting > 0, cta: waiting ? "Review now" : undefined },
              { id: "checking", label: "Being checked", value: checking, hint: checking ? "started, not decided" : "none in progress", icon: ShieldCheck },
              { id: "info", label: "Needs details", value: needsInfo, hint: needsInfo ? "waiting for the supplier" : "none", icon: FileQuestion },
              { id: "verified", label: "Verified", value: verified, tone: "good", hint: `of ${all.length} supplier${all.length === 1 ? "" : "s"}`, icon: BadgeCheck },
            ]}
          />
          <div className="grid gap-5 lg:grid-cols-[23rem_minmax(0,1fr)]">
            <aside className={`h-fit overflow-hidden rounded-xl border-[1.5px] border-line bg-white soft-panel shadow-[0_1px_3px_rgba(21,35,61,0.08)] lg:sticky lg:top-24 ${selected ? "hidden lg:block" : ""}`}>
              <div role="tablist" aria-label="Suppliers" className="grid grid-cols-2 gap-1.5 border-b border-line p-3">
                {TABS.map((t) => {
                  const on = listTab === t.id
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => update({ list: t.id, s: null })}
                      className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 text-[14px] font-semibold transition-colors ${
                        on ? "btn-gradient text-navy shadow-sm" : "bg-page text-navy hover:bg-navy-tint"
                      }`}
                    >
                      {t.label}
                      <span className={`rounded-full px-1.5 py-px text-[12px] font-bold ${on ? "bg-white/70 text-navy" : "bg-white text-navy"}`}>{lists[t.id].length}</span>
                    </motion.button>
                  )
                })}
              </div>
              <div className="relative px-3 pt-3">
                <Search size={16} className="pointer-events-none absolute left-6 top-1/2 mt-1.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, city or GSTIN"
                  aria-label="Search suppliers"
                  className={`${BOX} ${boxBorder()} min-h-10 pl-9 text-[14.5px]`}
                />
              </div>
              <SupplierList items={shown} selectedId={selectedId} onSelect={(id) => update({ s: id })} />
            </aside>
            <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={selected?.organisation.id ?? "none"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  {selected ? (
                    <SupplierPanel
                      supplier={selected}
                      categories={catNames}
                      onBack={() => update({ s: null })}
                      onDone={async (msg) => {
                        toast(msg)
                        await reload()
                      }}
                    />
                  ) : (
                    <EmptyState icon={ShieldCheck} title="Pick a supplier" body="Choose a supplier on the left to check their registration." />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
      {toastNode}
    </div>
  )
}
