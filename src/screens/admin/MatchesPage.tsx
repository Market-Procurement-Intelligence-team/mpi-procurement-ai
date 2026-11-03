/**
 * Admin: AI matches to review.
 *
 * Left: the queue of open requests (To review / Reviewed / All).
 * Right: one request, with sub-tabs for its suppliers (to review, approved,
 * rejected) and its full details. Each supplier is one stacked card: name and
 * score badge on top, facts, a fit checklist against the request's own needs,
 * and the decision buttons along the bottom.
 *
 * Approving invites the supplier to quote (up to 3 per request). The admin
 * sees real names and the budget; suppliers never see the budget.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Inbox,
  Lock,
  MapPin,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Truck,
  X,
  XCircle,
} from "lucide-react"
import {
  addMatchByHand,
  listMatchQueue,
  listSuppliers,
  MAX_APPROVED,
  recalculateMatches,
  reviewMatch,
  type QueueMatch,
  type QueueRequest,
  type SupplierForReview,
} from "../../services/data/admin"
import Button from "../../ui/Button"
import EmptyState from "../../ui/EmptyState"
import { Alert } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"

// ---------------------------------------------------------------- helpers

const day = (iso: string | null, withYear = false) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
      })
    : null

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000)
}

function daysLeft(iso: string | null): string | null {
  const d = daysUntil(iso)
  if (d === null) return null
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`
  if (d === 0) return "due today"
  return `${d} day${d === 1 ? "" : "s"} left`
}

const place = (city: string | null, state: string | null) => [city, state].filter(Boolean).join(", ") || null

function budget(min: number | null, max: number | null): string | null {
  if (min && max) return `${rupees(min)} to ${rupees(max)}`
  if (max) return `up to ${rupees(max)}`
  if (min) return `from ${rupees(min)}`
  return null
}

/** Demo records carry "Demo · " in their names; the screen shows a small tag instead. */
const cleanName = (name: string) => name.replace(/^Demo\s*·\s*/i, "")

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.")

const needsReview = (q: QueueRequest) => q.waitingCount > 0 && q.approvedCount < MAX_APPROVED

function quantityText(q: QueueRequest): string | null {
  if (!q.lines.length) return null
  if (q.lines.length > 1) return `${q.lines.length} items`
  const l = q.lines[0]
  return `${Number(l.quantity).toLocaleString("en-IN")} ${l.unit}`
}

// ---------------------------------------------------------------- small parts

function DemoTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-line px-2 py-px text-[11.5px] font-semibold text-muted">
      Demo
    </span>
  )
}

function SlotDots({ used, size = "md", dark = false }: { used: number; size?: "sm" | "md"; dark?: boolean }) {
  const dot = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"
  if (used >= MAX_APPROVED) return <Lock size={size === "sm" ? 12 : 14} aria-hidden="true" />
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: MAX_APPROVED }, (_, i) => (
        <span key={i} className={`${dot} rounded-full ${i < used ? "bg-orange" : dark ? "bg-white/25" : "bg-line"}`} />
      ))}
    </span>
  )
}

type Band = { word: string; box: string; ring: string; track: string }

function band(score: number): Band {
  if (score >= 85) return { word: "Strong match", box: "bg-navy text-white", ring: "#f09a47", track: "rgba(255,255,255,0.18)" }
  if (score >= 70) return { word: "Good match", box: "bg-orange-tint text-navy", ring: "#15233d", track: "rgba(21,35,61,0.12)" }
  return { word: "Weak match", box: "border-[1.5px] border-line bg-white text-muted", ring: "#a3adba", track: "#e8ecf3" }
}

/** Score out of 100 with a ring and a band word. */
function ScoreBadge({ score, faded }: { score: number; faded: boolean }) {
  const value = Math.max(0, Math.min(100, Math.round(score)))
  const b = faded ? band(0) : band(value)
  const r = 13
  const c = 2 * Math.PI * r
  return (
    <div className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 ${b.box}`} aria-label={`Match score ${value} out of 100, ${b.word}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r={r} fill="none" stroke={b.track} strokeWidth="3" />
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke={b.ring}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
          transform="rotate(-90 16 16)"
        />
        <text x="16" y="19.8" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">
          {value}
        </text>
      </svg>
      <span className="leading-tight">
        <span className="block text-[11px] opacity-80">out of 100</span>
        <span className="block text-[12.5px] font-bold">{b.word}</span>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- fit checklist

type FitState = "met" | "missing" | "check"
interface Fit {
  state: FitState
  label: string
}

const FIT_STYLE: Record<FitState, { chip: string; icon: typeof Check }> = {
  met: { chip: "border-navy/25 bg-navy-tint text-navy", icon: CheckCircle2 },
  missing: { chip: "border-red/40 bg-red-tint text-red-text", icon: XCircle },
  check: { chip: "border-orange/60 bg-orange-tint text-navy", icon: AlertTriangle },
}

/** Each of the request's own needs, checked against what the supplier told MPI. */
function fitChecklist(q: QueueRequest, m: QueueMatch): Fit[] {
  const fits: Fit[] = []
  const { match, supplier, mayBeLate } = m
  const reasons = match.reasons.map((r) => r.toLowerCase())

  if (q.categoryName) {
    const serves = reasons.some((r) => r.startsWith("supplies") || r.startsWith("makes"))
    fits.push(serves ? { state: "met", label: q.categoryName } : { state: "check", label: `${q.categoryName}: not listed` })
  }

  const has = new Set(supplier.certifications.map((c) => c.toLowerCase()))
  for (const cert of q.request.required_certifications) {
    fits.push(has.has(cert.toLowerCase()) ? { state: "met", label: cert } : { state: "missing", label: `${cert} missing` })
  }

  if (q.request.needed_by) {
    if (mayBeLate) fits.push({ state: "missing", label: `May miss ${day(q.request.needed_by)}` })
    else if (match.estimated_delivery_date) fits.push({ state: "met", label: `By ${day(q.request.needed_by)}` })
    else fits.push({ state: "check", label: "Delivery date unknown" })
  }

  if (supplier.capacityBookedPct !== null) {
    fits.push(
      supplier.capacityBookedPct >= 80
        ? { state: "check", label: `${supplier.capacityBookedPct}% booked` }
        : { state: "met", label: "Has spare capacity" },
    )
  }
  return fits
}

/** Reasons the checklist doesn't already show, such as "Based in Bengaluru". */
function extraReasons(m: QueueMatch): string[] {
  return m.match.reasons.filter((r) => {
    const x = r.toLowerCase()
    return !(
      x.startsWith("supplies") ||
      x.startsWith("makes") ||
      x.startsWith("has iso") ||
      x.startsWith("has ") ||
      x.startsWith("can deliver") ||
      x.startsWith("added by mpi")
    )
  })
}

// ---------------------------------------------------------------- supplier card

interface CardProps {
  q: QueueRequest
  item: QueueMatch
  rank: number
  slot: number | null
  full: boolean
  busy: boolean
  focused: boolean
  onApprove: () => void
  onReject: (note: string) => void
}

function SupplierCard({ q, item, rank, slot, full, busy, focused, onApprove, onReject }: CardProps) {
  const { match, supplier } = item
  const ref = useRef<HTMLLIElement>(null)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState("")
  const status = match.status
  const byHand = match.suggested_by === "admin"
  const where = place(supplier.city, supplier.state)
  const name = cleanName(supplier.name)
  const fits = fitChecklist(q, item)
  const extras = extraReasons(item)

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [focused])

  return (
    <li
      ref={ref}
      tabIndex={-1}
      className={`overflow-hidden rounded-xl border-[1.5px] border-l-[5px] bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)] outline-none transition-shadow ${
        status === "rejected" ? "!border-l-line" : byHand ? "!border-l-navy" : match.score >= 85 ? "!border-l-navy" : match.score >= 70 ? "!border-l-orange" : "!border-l-input"
      } ${
        focused ? "border-orange shadow-[0_0_0_3px_rgba(240,154,71,0.25)]" : status === "rejected" ? "border-line bg-page/50" : "border-line"
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* name + score */}
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-display text-[14px] font-bold ${
              status === "rejected" ? "bg-navy-tint text-muted" : "bg-navy text-white"
            }`}
            aria-label={`Rank ${rank}`}
          >
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3
                title={name}
                className={`truncate text-[17px] font-semibold ${status === "rejected" ? "text-muted line-through decoration-1" : "text-navy"}`}
              >
                {name}
              </h3>
              {supplier.isDemo && <DemoTag />}
            </div>
            <p className="truncate text-[13px] text-muted">{supplier.code}</p>
          </div>
          {byHand ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-navy-tint px-2.5 py-1.5 text-[12.5px] font-semibold text-navy">
              <Plus size={14} aria-hidden="true" />
              Added by MPI
            </span>
          ) : (
            <ScoreBadge score={match.score} faded={status === "rejected"} />
          )}
        </div>

        {/* facts */}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-navy">
          {where && (
            <li className="inline-flex items-center gap-1.5">
              <MapPin size={14} className="text-muted" aria-hidden="true" />
              {where}
            </li>
          )}
          {match.estimated_delivery_date && (
            <li className="inline-flex items-center gap-1.5">
              <Truck size={14} className="text-muted" aria-hidden="true" />
              Delivers {day(match.estimated_delivery_date)}
            </li>
          )}
          <li className="text-muted">
            Certs: <span className="text-navy">{supplier.certifications.length ? supplier.certifications.join(", ") : "none listed"}</span>
          </li>
          {supplier.capacityBookedPct !== null && (
            <li className="text-muted">
              Capacity: <span className="text-navy">{supplier.capacityBookedPct}% booked</span>
            </li>
          )}
        </ul>

        {/* fit checklist */}
        {fits.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Fit against this request">
            {fits.map((f) => {
              const s = FIT_STYLE[f.state]
              return (
                <li key={f.label} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${s.chip}`}>
                  <s.icon size={13} aria-hidden="true" />
                  <span className="sr-only">{f.state === "met" ? "Meets: " : f.state === "missing" ? "Missing: " : "Check: "}</span>
                  {f.label}
                </li>
              )
            })}
          </ul>
        )}
        {extras.length > 0 && <p className="mt-2 text-[13px] text-muted">Also: {extras.join(" · ")}</p>}

        {status === "rejected" && match.review_note && (
          <p className="mt-3 rounded-md bg-red-tint px-3 py-2 text-[13.5px] text-red-text">
            <span className="font-semibold">Reason:</span> {match.review_note}
          </p>
        )}
      </div>

      {/* action bar */}
      {status === "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-navy-tint/50 px-4 py-2.5 sm:px-5">
          <span className="text-[13px] text-muted">Invitation to quote sent{match.reviewed_at ? ` ${day(match.reviewed_at)}` : ""}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-[13px] font-semibold text-white">
            <Check size={14} aria-hidden="true" />
            Approved{slot ? ` · slot ${slot} of ${MAX_APPROVED}` : ""}
          </span>
        </div>
      )}
      {status === "rejected" && (
        <div className="border-t border-line px-4 py-2.5 text-[13px] font-semibold text-red-text sm:px-5">
          Rejected{match.reviewed_at ? ` ${day(match.reviewed_at)}` : ""}
        </div>
      )}
      {status === "suggested" && (
        <div className="border-t border-line px-4 py-2.5 sm:px-5">
          {full ? (
            <p className="flex items-center gap-2 py-1.5 text-[13.5px] text-muted">
              <Lock size={14} aria-hidden="true" />
              3 suppliers are already invited, so this one can't be approved.
            </p>
          ) : rejecting ? (
            <form
              className="flex flex-col gap-2 py-1 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                onReject(note.trim())
              }}
            >
              <label className="flex-1">
                <span className="text-[13.5px] font-semibold text-navy">Reason (optional, only MPI sees it)</span>
                <input
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="For example: no FSC certificate"
                  className="mt-1 min-h-11 w-full rounded-md border-[1.5px] border-input bg-white px-3 text-[15px] text-navy focus:border-orange focus:outline-none focus:ring-[3px] focus:ring-orange/30"
                />
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" busy={busy}>
                  Reject
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border-[1.5px] border-red bg-white px-4 text-[15px] font-bold text-red-text transition-colors hover:bg-red hover:text-white disabled:opacity-50"
              >
                <X size={16} aria-hidden="true" />
                Reject
              </button>
              <Button busy={busy} onClick={onApprove}>
                <Send size={16} aria-hidden="true" />
                Approve and invite
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------- tabs

type ListTab = "review" | "reviewed" | "all"
type DetailTab = "waiting" | "approved" | "rejected" | "details"

function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  small = false,
  dark = false,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
  label: string
  small?: boolean
  dark?: boolean
}) {
  return (
    <div role="tablist" aria-label={label} className="-mb-px flex min-w-0 gap-1 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`flex shrink-0 items-center gap-2 border-b-[3px] px-3 font-semibold transition-colors ${
              small ? "min-h-11 text-[14px]" : "min-h-12 text-[15px]"
            } ${
              active
                ? `border-orange ${dark ? "text-white" : "text-navy"}`
                : `border-transparent ${dark ? "text-white/60 hover:text-white" : "text-muted hover:text-navy"}`
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[12px] font-bold ${
                  dark ? (active ? "bg-orange text-navy" : "bg-white/10 text-white") : active ? "bg-orange text-navy" : "bg-white text-navy ring-1 ring-line"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- summary strip

function SummaryStrip({ queue, selected, onPick }: { queue: QueueRequest[]; selected: string | null; onPick: (t: ListTab, card: string) => void }) {
  const toReview = queue.filter(needsReview)
  const waiting = toReview.reduce((n, q) => n + q.waitingCount, 0)
  const full = queue.filter((q) => q.approvedCount >= MAX_APPROVED).length
  const urgent = toReview.filter((q) => {
    const d = daysUntil(q.request.needed_by)
    return d !== null && d <= 7
  }).length
  const oldest = toReview.reduce<number | null>((max, q) => {
    const age = Math.floor((Date.now() - new Date(q.request.created_at).getTime()) / 86_400_000)
    return max === null || age > max ? age : max
  }, null)

  const items: { label: string; value: number; hint: string; tab: ListTab; icon: typeof Plus; tone?: "strong" | "warn" }[] = [
    {
      label: "To review",
      value: toReview.length,
      hint: oldest === null ? "all caught up" : oldest === 0 ? "oldest from today" : `oldest ${oldest}d`,
      tab: "review",
      icon: Inbox,
      tone: toReview.length ? "strong" : undefined,
    },
    { label: "Suppliers waiting", value: waiting, hint: "suggested by MPI", tab: "review", icon: Sparkles },
    { label: "Requests full", value: full, hint: `of ${queue.length} open`, tab: "reviewed", icon: Lock },
    { label: "Due within 7 days", value: urgent, hint: urgent ? "review first" : "nothing urgent", tab: "review", icon: CalendarClock, tone: urgent ? "warn" : undefined },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {items.map((i) => (
        <button
          key={i.label}
          type="button"
          onClick={() => onPick(i.tab, i.label)}
          aria-pressed={selected === i.label}
          className="group relative flex flex-col overflow-hidden rounded-xl px-4 py-3 text-left shadow-[0_3px_10px_rgba(21,35,61,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(21,35,61,0.26)]"
          style={{
            border: "2.5px solid transparent",
            background: [
              "radial-gradient(120% 90% at 100% 0%, rgba(240,154,71,0.22) 0%, rgba(240,154,71,0) 55%) padding-box",
              "linear-gradient(135deg, #15233d 0%, #1b2c4a 60%, #233653 100%) padding-box",
              // Brand gradient border on the selected card only.
              selected === i.label
                ? "conic-gradient(from 0deg, #f09a47, #ec8d49, #db4230, #ec8d49, #f09a47) border-box"
                : "linear-gradient(#15233d, #15233d) border-box",
            ].join(", "),
          }}
        >
          {/* soft ring decoration */}
          <span
            className="pointer-events-none absolute -bottom-8 -right-8 h-20 w-20 rounded-full border-[8px] border-white/[0.04]"
            aria-hidden="true"
          />
          <span className="flex items-start justify-between gap-3">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white">{i.label}</span>
            <span className="btn-gradient shrink-0 rounded-lg p-1.5 text-navy shadow-[0_2px_6px_rgba(240,154,71,0.3)]" aria-hidden="true">
              <i.icon size={14} strokeWidth={2.2} />
            </span>
          </span>
          <span className={`mt-0.5 font-display text-[26px] font-bold leading-none tracking-tight text-orange`}>
            {i.value}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/70">
            {i.tone && <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden="true" />}
            {i.hint}
          </span>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- queue (left)

function QueueList({ items, selectedId, onSelect }: { items: QueueRequest[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!items.length) return <p className="px-5 py-10 text-center text-white/65">Nothing here right now.</p>
  return (
    <ul>
      {items.map((q) => {
        const selected = q.request.id === selectedId
        const left = daysLeft(q.request.needed_by)
        const overdue = (daysUntil(q.request.needed_by) ?? 1) < 0
        return (
          <li key={q.request.id} className="border-b border-white/10 last:border-b-0">
            <button
              type="button"
              onClick={() => onSelect(q.request.id)}
              aria-current={selected || undefined}
              className={`flex w-full items-start gap-3 border-l-[3px] px-4 py-3 text-left transition-colors ${
                selected ? "border-orange bg-orange/20" : "border-transparent hover:bg-orange/10"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-white" title={q.request.title}>
                  {q.request.title}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-white/65">
                  {cleanName(q.buyerName) || "Unknown buyer"}
                  {left && <span className={overdue ? "font-semibold text-orange" : ""}> · {left}</span>}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                {needsReview(q) ? (
                  <span className="rounded-full bg-orange px-2 py-0.5 text-[12px] font-bold text-navy">{q.waitingCount} new</span>
                ) : (
                  <span className="text-[12px] font-semibold text-white/60">{q.approvedCount >= MAX_APPROVED ? "Full" : "Reviewed"}</span>
                )}
                <span className="inline-flex items-center gap-1 text-[12px] text-white/70" aria-label={`${q.approvedCount} of ${MAX_APPROVED} invited`}>
                  <SlotDots used={q.approvedCount} size="sm" dark />
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- add by hand

function AddByHand({ q, onAdded, onCancel }: { q: QueueRequest; onAdded: () => Promise<void>; onCancel: () => void }) {
  const [suppliers, setSuppliers] = useState<SupplierForReview[] | null>(null)
  const [choice, setChoice] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cat = q.request.category_id

  useEffect(() => {
    const already = new Set(q.matches.map((m) => m.match.vendor_org_id))
    listSuppliers("verified")
      .then((all) => {
        const free = all.filter((s) => !already.has(s.organisation.id))
        free.sort((a, b) => Number(cat ? b.categoryIds.includes(cat) : 0) - Number(cat ? a.categoryIds.includes(cat) : 0))
        setSuppliers(free)
      })
      .catch((err) => {
        setSuppliers([])
        setError(errorText(err))
      })
  }, [q, cat])

  return (
    <div className="border-b border-line bg-orange-tint/40 px-5 py-4 sm:px-6">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!choice) return
          setBusy(true)
          setError(null)
          try {
            await addMatchByHand(q.request.id, choice)
            await onAdded()
          } catch (err) {
            setError(errorText(err))
            setBusy(false)
          }
        }}
      >
        <label className="flex-1">
          <span className="text-[14px] font-semibold text-navy">Add a verified supplier the AI didn't suggest</span>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            disabled={!suppliers?.length}
            className="mt-1 min-h-11 w-full rounded-md border-[1.5px] border-input bg-white px-3 text-[15px] text-navy focus:border-orange focus:outline-none focus:ring-[3px] focus:ring-orange/30"
          >
            <option value="">{suppliers === null ? "Loading suppliers…" : suppliers.length ? "Choose a supplier" : "No other verified suppliers"}</option>
            {suppliers?.map((s) => {
              const where = place(s.organisation.city, s.organisation.state)
              return (
                <option key={s.organisation.id} value={s.organisation.id}>
                  {cleanName(s.organisation.name)}
                  {where ? ` · ${where}` : ""}
                  {cat && !s.categoryIds.includes(cat) ? " · other category" : ""}
                </option>
              )
            })}
          </select>
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={!choice}>
            Add to the list
          </Button>
        </div>
      </form>
      <p className="mt-2 text-[13px] text-muted">It joins "To review" and still needs approving like any other supplier.</p>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- request details tab

function DetailsTab({ q }: { q: QueueRequest }) {
  const { request, lines } = q
  const money = budget(request.budget_min, request.budget_max)
  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="grid border-b border-line last:border-b-0 sm:grid-cols-[12rem_1fr]">
      <dt className="bg-navy-tint/70 px-4 pt-3 text-[13.5px] font-semibold text-navy sm:py-3">{label}</dt>
      <dd className="px-4 pb-3 pt-1 text-[15px] text-navy sm:py-3">{children}</dd>
    </div>
  )
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border-[1.5px] border-line bg-white">
        <table className="w-full min-w-[26rem] text-left text-[14.5px]">
          <thead className="bg-navy text-[12px] uppercase tracking-wide text-white">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Item</th>
              <th className="px-4 py-2.5 text-right font-semibold">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {lines.length ? (
              lines.map((l) => (
                <tr key={l.id} className="border-t border-line even:bg-navy-tint/40">
                  <td className="px-4 py-3 text-navy">{l.description}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-navy">
                    {Number(l.quantity).toLocaleString("en-IN")} {l.unit}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-muted">No items listed</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <dl className="overflow-hidden rounded-xl border-[1.5px] border-line bg-white">
        <Row label="Buyer">{cleanName(q.buyerName) || "Unknown"}</Row>
        <Row label="Category">{q.categoryName ?? "Not set"}</Row>
        <Row label="Needed by">
          {day(request.needed_by, true) ?? "No date"}
          {daysLeft(request.needed_by) && <span className="text-muted"> · {daysLeft(request.needed_by)}</span>}
        </Row>
        <Row label="Deliver to">{place(request.delivery_city, request.delivery_state) ?? "Remote, anywhere in India"}</Row>
        <Row label="Certifications">{request.required_certifications.length ? request.required_certifications.join(", ") : "None required"}</Row>
        <Row label="Budget">
          {money ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {money}
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-tint px-2 py-0.5 text-[12px] font-semibold text-navy ring-1 ring-orange/40">
                <Lock size={12} aria-hidden="true" />
                Hidden from suppliers
              </span>
            </span>
          ) : (
            "Not given"
          )}
        </Row>
        {request.description && <Row label="Description">{request.description}</Row>}
        <Row label="Sent">{day(request.created_at, true)}</Row>
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------- request panel (right)

function RequestPanel({
  q,
  tab,
  onTab,
  onBack,
  reload,
  toast,
}: {
  q: QueueRequest
  tab: DetailTab
  onTab: (t: DetailTab) => void
  onBack: () => void
  reload: () => Promise<QueueRequest[] | null>
  toast: (text: string) => void
}) {
  const { request, matches, approvedCount, waitingCount } = q
  const [busyId, setBusyId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = approvedCount >= MAX_APPROVED
  const left = daysLeft(request.needed_by)
  const overdue = (daysUntil(request.needed_by) ?? 1) < 0
  const where = place(request.delivery_city, request.delivery_state)
  const money = budget(request.budget_min, request.budget_max)
  const qty = quantityText(q)

  useEffect(() => {
    setError(null)
    setAdding(false)
    setFocusId(null)
  }, [request.id])

  const rankOf = new Map([...matches].sort((a, b) => b.match.score - a.match.score).map((m, i) => [m.match.id, i + 1]))
  const approved = matches.filter((m) => m.match.status === "approved")
  const waiting = matches.filter((m) => m.match.status === "suggested")
  const rejected = matches.filter((m) => m.match.status === "rejected")
  const shown = tab === "approved" ? approved : tab === "rejected" ? rejected : waiting

  async function decide(m: QueueMatch, approve: boolean, note?: string) {
    setBusyId(m.match.id)
    setError(null)
    try {
      await reviewMatch(m.match.id, approve, note)
      const fresh = await reload()
      const name = cleanName(m.supplier.name)
      toast(approve ? `Invited ${name} to quote` : `Rejected ${name}`)
      // Focus the next supplier still waiting on this request.
      const next = fresh?.find((x) => x.request.id === request.id)?.matches.find((x) => x.match.status === "suggested")
      setFocusId(next?.match.id ?? null)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusyId(null)
    }
  }

  async function recalculate() {
    setRecalculating(true)
    setError(null)
    try {
      const n = await recalculateMatches(request.id)
      await reload()
      toast(n ? `Suggestions updated: ${n} waiting` : "Suggestions updated: no new suppliers fit")
      if (n) onTab("waiting")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setRecalculating(false)
    }
  }

  const empty: Record<Exclude<DetailTab, "details">, string> = {
    waiting: full ? "All 3 invitations are sent. Nothing more to approve here." : "No suppliers waiting. Recalculate suggestions, or add one by hand.",
    approved: "No supplier approved yet.",
    rejected: "No supplier rejected.",
  }

  return (
    <section
      className="overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)]"
      style={{
        border: "2.5px solid transparent",
        background:
          "linear-gradient(#fff, #fff) padding-box, conic-gradient(from 0deg, #15233d, #f09a47, #ec8d49, #db4230, #f09a47, #15233d) border-box",
      }}
      aria-label={request.title}
    >

      <header className="border-b-[1.5px] border-line bg-gradient-to-br from-navy-tint via-navy-tint/60 to-orange-tint/50 px-5 pt-4 sm:px-6">
        <button type="button" onClick={onBack} className="mb-2 inline-flex min-h-10 items-center gap-1.5 text-[14px] font-semibold text-navy lg:hidden">
          <ArrowLeft size={16} aria-hidden="true" />
          All requests
        </button>

        <div className="flex items-start justify-between gap-4">
          <h2 className="min-w-0 font-display text-[21px] font-bold leading-tight text-navy sm:text-[23px]">{request.title}</h2>
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ${
              full ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-orange/50"
            }`}
          >
            <SlotDots used={approvedCount} dark={full} />
            {approvedCount} of {MAX_APPROVED} invited
          </span>
        </div>

        {/* facts as pills */}
        <ul className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]">
          <li className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 font-semibold text-white">
            <Building2 size={14} className="text-orange" aria-hidden="true" />
            {cleanName(q.buyerName) || "Unknown buyer"}
            {q.buyerIsDemo && <span className="rounded-full bg-white/15 px-1.5 text-[11px] font-semibold">Demo</span>}
          </li>
          {q.categoryName && <li className="rounded-full bg-white px-3 py-1 font-medium text-navy ring-1 ring-line">{q.categoryName}</li>}
          {qty && <li className="rounded-full bg-white px-3 py-1 font-medium text-navy ring-1 ring-line">{qty}</li>}
          <li
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ring-1 ${
              overdue ? "bg-red-tint text-red-text ring-red/30" : "bg-white text-navy ring-line"
            }`}
          >
            <CalendarClock size={14} className={overdue ? "" : "text-orange-2"} aria-hidden="true" />
            {day(request.needed_by) ?? "No date"}
            {left && <span className={overdue ? "font-semibold" : "text-muted"}>· {left}</span>}
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-medium text-navy ring-1 ring-line">
            <MapPin size={14} className="text-orange-2" aria-hidden="true" />
            {where ?? "Remote"}
          </li>
          {money && (
            <li className="inline-flex items-center gap-1.5 rounded-full bg-orange-tint px-3 py-1 font-semibold text-navy ring-1 ring-orange/40" title="Hidden from suppliers">
              <Lock size={13} aria-hidden="true" />
              {money}
              <span className="font-medium text-muted">· hidden from suppliers</span>
            </li>
          )}
        </ul>

        <div className="mt-3 flex flex-wrap-reverse items-center justify-between gap-x-3 gap-y-2">
          <TabBar<DetailTab>
            small
            label="Request sections"
            value={tab}
            onChange={onTab}
            tabs={[
              { id: "waiting", label: "To review", count: waitingCount },
              { id: "approved", label: "Approved", count: approved.length },
              { id: "rejected", label: "Rejected", count: rejected.length },
              { id: "details", label: "Details" },
            ]}
          />
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={full || adding}
              className="btn-gradient inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 text-[13px] font-bold text-navy shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={14} aria-hidden="true" />
              Add suppliers
            </button>
            <button
              type="button"
              onClick={recalculate}
              disabled={recalculating}
              className="btn-gradient inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 text-[13px] font-bold text-navy shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCcw size={14} className={recalculating ? "animate-spin" : ""} aria-hidden="true" />
              Recalculate
            </button>
          </div>
        </div>
      </header>

      {adding && (
        <AddByHand
          q={q}
          onCancel={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false)
            await reload()
            toast("Supplier added to the list")
            onTab("waiting")
          }}
        />
      )}

      <div className="bg-page/60 px-4 py-5 sm:px-6" role="tabpanel">
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {recalculating && (
          <p className="mb-4 flex items-center gap-2 text-[14px] text-muted">
            <RefreshCcw size={15} className="animate-spin" aria-hidden="true" />
            Recalculating suggestions…
          </p>
        )}

        {tab === "details" ? (
          <DetailsTab q={q} />
        ) : shown.length === 0 ? (
          <p className="rounded-xl border-[1.5px] border-dashed border-orange/50 bg-white px-4 py-8 text-center text-muted">{empty[tab]}</p>
        ) : (
          <ol className="space-y-3">
            {shown.map((m) => (
              <SupplierCard
                key={m.match.id}
                q={q}
                item={m}
                rank={rankOf.get(m.match.id) ?? 0}
                slot={m.match.status === "approved" ? approved.indexOf(m) + 1 : null}
                full={full}
                busy={busyId === m.match.id}
                focused={focusId === m.match.id}
                onApprove={() => decide(m, true)}
                onReject={(note) => decide(m, false, note || undefined)}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- toast

function useToast() {
  const [text, setText] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((t: string) => {
    setText(t)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setText(null), 3500)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const node = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      {text && (
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-3 text-[14.5px] font-semibold text-white shadow-lg">
          <CheckCircle2 size={17} className="text-orange" aria-hidden="true" />
          {text}
        </div>
      )}
    </div>
  )
  return [show, node] as const
}

// ---------------------------------------------------------------- page

export default function MatchesPage() {
  const [queue, setQueue] = useState<QueueRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [toast, toastNode] = useToast()
  const [pickedCard, setPickedCard] = useState<string | null>(null)

  const listTab = (params.get("list") as ListTab | null) ?? "review"
  const selectedId = params.get("r")
  const detailTabParam = params.get("tab") as DetailTab | null

  const reload = useCallback(async () => {
    try {
      const fresh = await listMatchQueue()
      setQueue(fresh)
      setError(null)
      return fresh
    } catch (err) {
      setQueue((q) => q ?? [])
      setError(errorText(err))
      return null
    }
  }, [])

  useEffect(() => {
    document.title = "AI matches to review · MPI"
    void reload()
  }, [reload])

  const lists: Record<ListTab, QueueRequest[]> = {
    review: queue?.filter(needsReview) ?? [],
    reviewed: queue?.filter((q) => !needsReview(q)) ?? [],
    all: queue ?? [],
  }
  // Due soonest first (no date last), then oldest.
  for (const k of Object.keys(lists) as ListTab[]) {
    lists[k] = [...lists[k]].sort((a, b) => {
      const da = daysUntil(a.request.needed_by) ?? Infinity
      const db = daysUntil(b.request.needed_by) ?? Infinity
      return da - db || a.request.created_at.localeCompare(b.request.created_at)
    })
  }
  const visible = lists[listTab]
  const selected = queue?.find((q) => q.request.id === selectedId) ?? null

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  // On wide screens, open the first request of the list straight away.
  useEffect(() => {
    if (!queue || selectedId || !visible.length) return
    if (window.matchMedia("(min-width: 1024px)").matches) update({ r: visible[0].request.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, selectedId, listTab])

  const detailTab: DetailTab =
    detailTabParam ?? (selected && selected.waitingCount === 0 ? (selected.approvedCount ? "approved" : "details") : "waiting")

  return (
    <>
      <PageHeader
        title="AI matches to review"
        description="Approving a supplier invites it to quote, up to 3 per request. Suppliers never see the budget."
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {queue === null ? (
        <div className="space-y-5" aria-label="Loading requests">
          <div className="h-16 animate-pulse rounded-xl bg-white" />
          <div className="grid gap-5 lg:grid-cols-[25rem_minmax(0,1fr)]">
            <div className="h-96 animate-pulse rounded-xl bg-white" />
            <div className="hidden h-96 animate-pulse rounded-xl bg-white lg:block" />
          </div>
        </div>
      ) : queue.length === 0 ? (
        !error && (
          <EmptyState
            icon={Sparkles}
            title="Nothing to review"
            body="When a startup sends a request, the suppliers MPI suggests for it appear here for your approval."
          />
        )
      ) : (
        <>
          <SummaryStrip
            queue={queue}
            selected={pickedCard ?? (listTab === "review" ? "To review" : listTab === "reviewed" ? "Requests full" : null)}
            onPick={(t, card) => {
              setPickedCard(card)
              update({ list: t, r: null, tab: null })
            }}
          />
          <div className="grid items-start gap-5 lg:grid-cols-[25rem_minmax(0,1fr)]">
            <aside
              className={`overflow-hidden rounded-xl bg-navy shadow-[0_2px_8px_rgba(21,35,61,0.18)] lg:sticky lg:top-24 ${
                selected ? "hidden lg:block" : ""
              }`}
            >
              <div className="border-b border-white/10 px-2">
                <TabBar<ListTab>
                  dark
                  label="Requests"
                  value={listTab}
                  onChange={(t) => {
                    setPickedCard(null)
                    update({ list: t, r: null, tab: null })
                  }}
                  tabs={[
                    { id: "review", label: "To review", count: lists.review.length },
                    { id: "reviewed", label: "Reviewed", count: lists.reviewed.length },
                    { id: "all", label: "All", count: lists.all.length },
                  ]}
                />
              </div>
              <div className="lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
                <QueueList items={visible} selectedId={selectedId} onSelect={(id) => update({ r: id, tab: null })} />
              </div>
            </aside>

            <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
              {selected ? (
                <RequestPanel
                  q={selected}
                  tab={detailTab}
                  onTab={(t) => update({ tab: t })}
                  onBack={() => update({ r: null, tab: null })}
                  reload={reload}
                  toast={toast}
                />
              ) : (
                <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-line bg-white/60 p-8 text-center text-muted">
                  <Sparkles size={28} className="mb-3 text-navy" aria-hidden="true" />
                  Choose a request to see its suppliers.
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {toastNode}
    </>
  )
}
