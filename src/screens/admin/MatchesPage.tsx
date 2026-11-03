/**
 * Admin: AI matches to review. Each open request shows the suppliers MPI's
 * matching suggested, best first. Approving one invites it to quote (up to 3
 * per request); rejecting keeps it out. The admin sees real company names
 * and the budget; suppliers never see the budget.
 */

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  Inbox,
  Lock,
  MapPin,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Truck,
  X,
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
import Chip from "../../ui/Chip"
import EmptyState from "../../ui/EmptyState"
import { Alert } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"

// ---------------------------------------------------------------- formatting

const day = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

function daysLeft(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()
  const d = Math.round(ms / 86_400_000)
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`
  if (d === 0) return "due today"
  return `${d} day${d === 1 ? "" : "s"} left`
}

function place(city: string | null, state: string | null): string | null {
  return [city, state].filter(Boolean).join(", ") || null
}

function budget(min: number | null, max: number | null): string | null {
  if (min && max) return `${rupees(min)} to ${rupees(max)}`
  if (max) return `up to ${rupees(max)}`
  if (min) return `from ${rupees(min)}`
  return null
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.")

// ---------------------------------------------------------------- small parts

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-[15px] text-navy">{children}</dd>
    </div>
  )
}

/** Three dots for the 3 invitation slots. */
function Slots({ used }: { used: number }) {
  const full = used >= MAX_APPROVED
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ${full ? "bg-navy text-white" : "bg-orange-tint text-navy"}`}
    >
      {full ? (
        <Lock size={13} aria-hidden="true" />
      ) : (
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: MAX_APPROVED }, (_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i < used ? "bg-orange" : "bg-white ring-1 ring-orange/60"}`} />
          ))}
        </span>
      )}
      Approved {used} of {MAX_APPROVED}
      {full && " · full"}
    </span>
  )
}

function ScoreBar({ score, faded }: { score: number; faded: boolean }) {
  const value = Math.max(0, Math.min(100, Math.round(score)))
  return (
    <div className="w-full sm:w-44">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Match</span>
        <span className="text-navy">
          <span className="font-display text-[20px] font-bold">{value}</span>
          <span className="text-sm text-muted"> / 100</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-tint" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Match score">
        <div className={`h-full rounded-full ${faded ? "bg-input" : "btn-gradient"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- one supplier row

interface RowProps {
  item: QueueMatch
  rank: number
  slot: number | null
  full: boolean
  busy: boolean
  onApprove: () => void
  onReject: (note: string) => void
}

function SupplierRow({ item, rank, slot, full, busy, onApprove, onReject }: RowProps) {
  const { match, supplier, mayBeLate } = item
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState("")
  const status = match.status
  const byHand = match.suggested_by === "admin"
  const where = place(supplier.city, supplier.state)

  return (
    <li
      className={`rounded-lg border-[1.5px] p-4 sm:p-5 ${
        status === "approved"
          ? "border-navy/30 bg-white"
          : status === "rejected"
            ? "border-line bg-page/60"
            : "border-line bg-white"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* who */}
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-display text-[15px] font-bold ${
              status === "rejected" ? "bg-navy-tint text-muted" : "bg-navy text-white"
            }`}
            aria-label={`Rank ${rank}`}
          >
            {rank}
          </span>
          <div className="min-w-0">
            <p className={`text-[17px] font-semibold ${status === "rejected" ? "text-muted line-through decoration-1" : "text-navy"}`}>
              {supplier.name}
            </p>
            <p className="text-[13px] text-muted">{supplier.code}</p>

            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-navy">
              {where && (
                <li className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-muted" aria-hidden="true" />
                  {where}
                </li>
              )}
              {match.estimated_delivery_date && (
                <li className="flex items-center gap-1.5">
                  <Truck size={15} className="text-muted" aria-hidden="true" />
                  Est. delivery {day(match.estimated_delivery_date)}
                </li>
              )}
              <li>Certs: {supplier.certifications.length ? supplier.certifications.join(", ") : "none listed"}</li>
              {supplier.capacityBookedPct !== null && <li>Capacity: {supplier.capacityBookedPct}% booked</li>}
            </ul>

            <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Why it matches">
              {mayBeLate && (
                <li className="inline-flex items-center gap-1 rounded-md bg-red-tint px-2 py-0.5 text-[12.5px] font-semibold text-red-text">
                  <AlertTriangle size={13} aria-hidden="true" />
                  May be late
                </li>
              )}
              {match.reasons.map((r) => (
                <li key={r} className="rounded-md bg-navy-tint px-2 py-0.5 text-[12.5px] font-medium text-navy">
                  {r}
                </li>
              ))}
            </ul>

            {status === "rejected" && match.review_note && (
              <p className="mt-2.5 rounded-md bg-red-tint px-3 py-2 text-[13.5px] text-red-text">
                <span className="font-semibold">Note:</span> {match.review_note}
              </p>
            )}
          </div>
        </div>

        {/* score */}
        <div className="lg:w-44">
          {byHand ? (
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy">
              <Plus size={15} aria-hidden="true" />
              Added by MPI
            </span>
          ) : (
            <ScoreBar score={match.score} faded={status === "rejected"} />
          )}
        </div>

        {/* actions */}
        <div className="flex flex-wrap items-center gap-2 lg:w-[19rem] lg:justify-end">
          {status === "approved" && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-[13px] font-semibold text-white">
                <Check size={14} aria-hidden="true" />
                Approved{slot ? ` · slot ${slot} of ${MAX_APPROVED}` : ""}
              </span>
              <p className="mt-1 text-[13px] text-muted">Invitation to quote sent</p>
            </div>
          )}
          {status === "rejected" && <Chip tone="negative">Rejected</Chip>}
          {status === "suggested" &&
            (full ? (
              <div className="text-right">
                <Button variant="secondary" disabled className="!border-line !text-muted">
                  <Lock size={15} aria-hidden="true" />
                  Slots full
                </Button>
                <p className="mt-1 max-w-56 text-[12.5px] text-muted">3 suppliers are already invited for this request.</p>
              </div>
            ) : (
              !rejecting && (
                <>
                  <Button variant="secondary" busy={busy} onClick={() => setRejecting(true)}>
                    <X size={16} aria-hidden="true" />
                    Reject
                  </Button>
                  <Button busy={busy} onClick={onApprove}>
                    <Send size={16} aria-hidden="true" />
                    Approve and invite
                  </Button>
                </>
              )
            ))}
        </div>
      </div>

      {status === "suggested" && rejecting && (
        <form
          className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            onReject(note.trim())
          }}
        >
          <label className="flex-1">
            <span className="text-[14px] font-semibold text-navy">Reason (optional, only MPI sees it)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: delivery too far, no spare capacity"
              className="mt-1 min-h-11 w-full rounded-md border-[1.5px] border-input bg-white px-3 text-[15px] text-navy focus:border-orange focus:outline-none focus:ring-[3px] focus:ring-orange/30"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" busy={busy}>
              Reject supplier
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}

// ---------------------------------------------------------------- add by hand

function AddByHand({
  item,
  onAdded,
  onCancel,
}: {
  item: QueueRequest
  onAdded: () => Promise<void>
  onCancel: () => void
}) {
  const [suppliers, setSuppliers] = useState<SupplierForReview[] | null>(null)
  const [choice, setChoice] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const already = new Set(item.matches.map((m) => m.match.vendor_org_id))
    listSuppliers("verified")
      .then((all) => {
        const free = all.filter((s) => !already.has(s.organisation.id))
        // Suppliers that serve the request's category first.
        const cat = item.request.category_id
        free.sort((a, b) => Number(cat ? b.categoryIds.includes(cat) : 0) - Number(cat ? a.categoryIds.includes(cat) : 0))
        setSuppliers(free)
      })
      .catch((err) => {
        setSuppliers([])
        setError(errorText(err))
      })
  }, [item])

  const cat = item.request.category_id

  return (
    <div className="border-t border-line bg-white px-5 py-4 sm:px-6">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!choice) return
          setBusy(true)
          setError(null)
          try {
            await addMatchByHand(item.request.id, choice)
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
            <option value="">
              {suppliers === null ? "Loading suppliers…" : suppliers.length ? "Choose a supplier" : "No other verified suppliers"}
            </option>
            {suppliers?.map((s) => (
              <option key={s.organisation.id} value={s.organisation.id}>
                {s.organisation.name}
                {place(s.organisation.city, s.organisation.state) ? ` · ${place(s.organisation.city, s.organisation.state)}` : ""}
                {cat && !s.categoryIds.includes(cat) ? " · other category" : ""}
              </option>
            ))}
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
      <p className="mt-2 text-[13px] text-muted">It joins the list below and still needs approving like any other supplier.</p>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- tabs

type ListTab = "review" | "reviewed" | "all"
type DetailTab = "waiting" | "approved" | "rejected" | "details"

const needsReview = (q: QueueRequest) => q.waitingCount > 0 && q.approvedCount < MAX_APPROVED

function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  small = false,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
  label: string
  small?: boolean
}) {
  return (
    <div role="tablist" aria-label={label} className="-mb-px flex gap-1 overflow-x-auto">
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
              small ? "min-h-10 text-[14px]" : "min-h-12 text-[15px]"
            } ${active ? "border-orange text-navy" : "border-transparent text-muted hover:text-navy"}`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[12px] font-bold ${
                  active ? "bg-navy text-white" : "bg-navy-tint text-navy"
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

// ---------------------------------------------------------------- list (left)

function RequestList({
  items,
  selectedId,
  onSelect,
}: {
  items: QueueRequest[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (!items.length) {
    return <p className="px-5 py-10 text-center text-muted">Nothing here right now.</p>
  }
  return (
    <ul>
      {items.map((q) => {
        const selected = q.request.id === selectedId
        const left = daysLeft(q.request.needed_by)
        const full = q.approvedCount >= MAX_APPROVED
        return (
          <li key={q.request.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onSelect(q.request.id)}
              aria-current={selected || undefined}
              className={`block w-full border-l-[3px] px-4 py-3.5 text-left transition-colors ${
                selected ? "border-orange bg-navy-tint/70" : "border-transparent hover:bg-navy-tint/40"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-navy">{q.request.title}</span>
                {needsReview(q) && (
                  <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 text-[12px] font-bold text-navy">
                    {q.waitingCount} new
                  </span>
                )}
              </span>
              <span className="mt-1 block truncate text-[13px] text-muted">{q.buyerName || "Unknown buyer"}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-navy">
                <span className="inline-flex items-center gap-1.5">
                  {full ? (
                    <Lock size={12} aria-hidden="true" />
                  ) : (
                    <span className="flex gap-0.5" aria-hidden="true">
                      {Array.from({ length: MAX_APPROVED }, (_, i) => (
                        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < q.approvedCount ? "bg-orange" : "bg-line"}`} />
                      ))}
                    </span>
                  )}
                  {q.approvedCount} of {MAX_APPROVED} invited
                </span>
                {left && (
                  <span className={`inline-flex items-center gap-1 ${left.includes("overdue") ? "text-red-text" : "text-muted"}`}>
                    <CalendarClock size={12} aria-hidden="true" />
                    {left}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- detail (right)

function RequestDetails({ item }: { item: QueueRequest }) {
  const { request, lines, categoryName } = item
  const where = place(request.delivery_city, request.delivery_state)
  const money = budget(request.budget_min, request.budget_max)
  const left = daysLeft(request.needed_by)
  return (
    <div className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Category">{categoryName ?? "Not set"}</Fact>
        <Fact label="Needed by">
          {day(request.needed_by) ?? "No date"}
          {left && <span className="block text-[13px] text-muted">{left}</span>}
        </Fact>
        <Fact label="Deliver to">{where ?? "Remote, anywhere in India"}</Fact>
        <Fact label="Required certifications">
          {request.required_certifications.length ? request.required_certifications.join(", ") : "None"}
        </Fact>
      </dl>

      {money && (
        <p className="inline-flex flex-wrap items-center gap-2 rounded-md bg-navy-tint px-3 py-2 text-[14px] text-navy">
          <Lock size={14} aria-hidden="true" />
          <span className="font-semibold">Budget: {money}</span>
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">Hidden from suppliers</span>
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border-[1.5px] border-line">
        <table className="w-full min-w-[28rem] text-left text-[14px]">
          <thead className="bg-navy-tint/60 text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Item</th>
              <th className="px-4 py-2.5 text-right font-semibold">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {lines.length ? (
              lines.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-4 py-3 text-navy">{l.description}</td>
                  <td className="px-4 py-3 text-right text-navy">
                    {Number(l.quantity).toLocaleString("en-IN")} {l.unit}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-muted">
                  No items listed
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {request.description && (
        <div>
          <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted">Description</h4>
          <p className="mt-1 whitespace-pre-line text-[15px] text-navy">{request.description}</p>
        </div>
      )}
    </div>
  )
}

function DetailPanel({
  item,
  tab,
  onTab,
  onBack,
  reload,
}: {
  item: QueueRequest
  tab: DetailTab
  onTab: (t: DetailTab) => void
  onBack: () => void
  reload: () => Promise<void>
}) {
  const { request, buyerName, categoryName, matches, approvedCount, waitingCount } = item
  const [busyId, setBusyId] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const full = approvedCount >= MAX_APPROVED
  const left = daysLeft(request.needed_by)
  const where = place(request.delivery_city, request.delivery_state)

  // A new request clears the old messages.
  useEffect(() => {
    setError(null)
    setNotice(null)
    setAdding(false)
  }, [request.id])

  // Rank = position by score among everything suggested for this request.
  const rankOf = new Map(
    [...matches].sort((a, b) => b.match.score - a.match.score).map((m, i) => [m.match.id, i + 1]),
  )
  const approved = matches.filter((m) => m.match.status === "approved")
  const waiting = matches.filter((m) => m.match.status === "suggested")
  const rejected = matches.filter((m) => m.match.status === "rejected")
  const shown = tab === "approved" ? approved : tab === "rejected" ? rejected : waiting

  async function act(id: string, job: () => Promise<void>) {
    setBusyId(id)
    setError(null)
    setNotice(null)
    try {
      await job()
      await reload()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusyId(null)
    }
  }

  async function recalculate() {
    setRecalculating(true)
    setError(null)
    setNotice(null)
    try {
      const n = await recalculateMatches(request.id)
      await reload()
      setNotice(n ? `Suggestions updated: ${n} supplier${n === 1 ? "" : "s"} waiting for review.` : "Suggestions updated. No new suppliers fit this request.")
      if (n) onTab("waiting")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setRecalculating(false)
    }
  }

  const empty: Record<Exclude<DetailTab, "details">, string> = {
    waiting: full
      ? "All 3 invitations are sent, so no more suppliers can be approved."
      : "No suppliers waiting. Try Recalculate, or add one by hand.",
    approved: "No supplier approved yet.",
    rejected: "No supplier rejected.",
  }

  return (
    <section className="overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)]" aria-label={request.title}>
      <div className="accent-line h-1" />

      <header className="border-b border-line px-5 pt-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-[14px] font-semibold text-navy lg:hidden"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          All requests
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-tint px-3 py-1 text-[13px] font-semibold text-navy">
            <Building2 size={13} aria-hidden="true" />
            {buyerName || "Unknown buyer"}
          </span>
          <Slots used={approvedCount} />
        </div>

        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-bold leading-tight text-navy">{request.title}</h2>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
              {categoryName && <span>{categoryName}</span>}
              <span className="inline-flex items-center gap-1">
                <CalendarClock size={14} aria-hidden="true" />
                {day(request.needed_by) ?? "No date"}
                {left && ` · ${left}`}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} aria-hidden="true" />
                {where ?? "Remote"}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAdding((a) => !a)} disabled={adding || full}>
              <Plus size={16} aria-hidden="true" />
              Add by hand
            </Button>
            <Button variant="secondary" busy={recalculating} onClick={recalculate}>
              <RefreshCcw size={16} aria-hidden="true" />
              Recalculate
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <TabBar<DetailTab>
            small
            label="Request sections"
            value={tab}
            onChange={onTab}
            tabs={[
              { id: "waiting", label: "To review", count: waitingCount },
              { id: "approved", label: "Approved", count: approved.length },
              { id: "rejected", label: "Rejected", count: rejected.length },
              { id: "details", label: "Request details" },
            ]}
          />
        </div>
      </header>

      {adding && (
        <AddByHand
          item={item}
          onCancel={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false)
            await reload()
            onTab("waiting")
          }}
        />
      )}

      <div className="px-5 py-5 sm:px-6" role="tabpanel">
        {(error || notice) && (
          <div className="mb-4">
            <Alert tone={error ? "error" : "info"}>{error ?? notice}</Alert>
          </div>
        )}

        {tab === "details" ? (
          <RequestDetails item={item} />
        ) : shown.length === 0 ? (
          <p className="rounded-lg bg-page px-4 py-8 text-center text-muted">{empty[tab]}</p>
        ) : (
          <ol className="space-y-3">
            {shown.map((m) => (
              <SupplierRow
                key={m.match.id}
                item={m}
                rank={rankOf.get(m.match.id) ?? 0}
                slot={m.match.status === "approved" ? approved.indexOf(m) + 1 : null}
                full={full}
                busy={busyId === m.match.id}
                onApprove={() => act(m.match.id, () => reviewMatch(m.match.id, true))}
                onReject={(note) => act(m.match.id, () => reviewMatch(m.match.id, false, note || undefined))}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- summary cards

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000)
}

function Summary({ queue, onPick }: { queue: QueueRequest[]; onPick: (tab: ListTab) => void }) {
  const toReview = queue.filter(needsReview)
  const suppliersWaiting = toReview.reduce((n, q) => n + q.waitingCount, 0)
  const invited = queue.reduce((n, q) => n + q.approvedCount, 0)
  const full = queue.filter((q) => q.approvedCount >= MAX_APPROVED).length
  const urgent = toReview.filter((q) => {
    const d = daysUntil(q.request.needed_by)
    return d !== null && d <= 7
  }).length
  const oldest = toReview.reduce<number | null>((max, q) => {
    const age = Math.floor((Date.now() - new Date(q.request.created_at).getTime()) / 86_400_000)
    return max === null || age > max ? age : max
  }, null)

  const cards = [
    {
      label: "Requests to review",
      value: toReview.length,
      hint: oldest === null ? "All caught up" : oldest === 0 ? "Oldest sent today" : `Oldest waiting ${oldest} day${oldest === 1 ? "" : "s"}`,
      icon: Inbox,
      onClick: () => onPick("review"),
      strong: toReview.length > 0,
    },
    {
      label: "Suppliers waiting",
      value: suppliersWaiting,
      hint: "Suggested by MPI's matching",
      icon: Sparkles,
      onClick: () => onPick("review"),
    },
    {
      label: "Invitations sent",
      value: invited,
      hint: `${full} of ${queue.length} request${queue.length === 1 ? "" : "s"} full (3 of 3)`,
      icon: Send,
      onClick: () => onPick("reviewed"),
    },
    {
      label: "Needed within 7 days",
      value: urgent,
      hint: urgent ? "Review these first" : "Nothing urgent",
      icon: CalendarClock,
      onClick: () => onPick("review"),
      warn: urgent > 0,
    },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onClick}
          className={`group rounded-xl border-[1.5px] p-4 text-left shadow-[0_1px_3px_rgba(21,35,61,0.08)] transition-colors sm:p-5 ${
            c.strong ? "border-navy bg-navy text-white hover:bg-navy-2" : "border-line bg-white hover:border-navy/40"
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className={`text-[13px] font-semibold ${c.strong ? "text-white/80" : "text-muted"}`}>{c.label}</span>
            <span
              className={`rounded-md p-1.5 ${
                c.strong ? "bg-white/10 text-orange" : c.warn ? "bg-red-tint text-red-text" : "bg-orange-tint text-navy"
              }`}
            >
              <c.icon size={16} aria-hidden="true" />
            </span>
          </span>
          <span className={`mt-2 block font-display text-[30px] font-bold leading-none ${c.warn ? "text-red-text" : ""}`}>
            {c.value}
          </span>
          <span className={`mt-2 block text-[13px] ${c.strong ? "text-white/75" : "text-muted"}`}>{c.hint}</span>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- page

export default function MatchesPage() {
  const [queue, setQueue] = useState<QueueRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()

  const listTab = (params.get("list") as ListTab | null) ?? "review"
  const selectedId = params.get("r")
  const detailTabParam = params.get("tab") as DetailTab | null

  const reload = useCallback(async () => {
    try {
      setQueue(await listMatchQueue())
      setError(null)
    } catch (err) {
      setQueue((q) => q ?? [])
      setError(errorText(err))
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
        description="MPI's matching suggests suppliers for each request. Approving one invites it to quote, up to 3 per request."
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {queue === null ? (
        <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]" aria-label="Loading requests">
          <div className="h-96 animate-pulse rounded-xl bg-white" />
          <div className="hidden h-96 animate-pulse rounded-xl bg-white lg:block" />
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
        <Summary queue={queue} onPick={(t) => update({ list: t, r: null, tab: null })} />
        <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          {/* list */}
          <aside
            className={`overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)] lg:sticky lg:top-24 ${
              selected ? "hidden lg:block" : ""
            }`}
          >
            <div className="border-b border-line px-2">
              <TabBar<ListTab>
                label="Requests"
                value={listTab}
                onChange={(t) => update({ list: t, r: null, tab: null })}
                tabs={[
                  { id: "review", label: "To review", count: lists.review.length },
                  { id: "reviewed", label: "Reviewed", count: lists.reviewed.length },
                  { id: "all", label: "All", count: lists.all.length },
                ]}
              />
            </div>
            <div className="lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto">
              <RequestList items={visible} selectedId={selectedId} onSelect={(id) => update({ r: id, tab: null })} />
            </div>
          </aside>

          {/* detail */}
          <div className={selected ? "" : "hidden lg:block"}>
            {selected ? (
              <DetailPanel
                item={selected}
                tab={detailTab}
                onTab={(t) => update({ tab: t })}
                onBack={() => update({ r: null, tab: null })}
                reload={reload}
              />
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-line bg-white/60 p-8 text-center text-muted">
                <Sparkles size={28} className="mb-3 text-navy" aria-hidden="true" />
                Choose a request on the left to see its suppliers.
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </>
  )
}
