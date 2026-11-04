/**
 * Startup: one request. Compare the quotes, negotiate the price, approve one.
 *
 * Top: the request with its status, then navy summary cards (quotes in,
 * lowest full cost, best score, your private budget). Tabs:
 * - Quotes: one card per quote, scored out of 100, showing what the startup
 *   really pays (supplier invoice, MPI fee, full cost). Negotiate price opens
 *   the price talks for that quote; Approve quote places the order.
 * - Suppliers: the suppliers MPI approved, with score, reasons and whether
 *   they have quoted.
 * - Request: the items, budget (private), certificates and original words.
 *
 * Suppliers appear as "MPI Verified Supplier #…". The budget is only shown
 * here, to the startup.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Handshake,
  History,
  Lock,
  MapPin,
  Package,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
  X,
} from "lucide-react"
import { getPriceBreakdown, compareOffers, approveQuoteAtPrice, type OfferScore, type PriceBreakdown } from "../../../services/data/money"
import {
  listOffersForRequest,
  MAX_OFFERS_PER_QUOTE,
  offerStatus,
  proposePrice,
  respondToPrice,
  timeLeftToReply,
  type Offer,
} from "../../../services/data/negotiation"
import { listQuotesForRequest, type QuoteWithLines } from "../../../services/data/quotes"
import { cancelRequest, getRequestDetail, type RequestDetail } from "../../../services/data/requests"
import { listCategories, type Category } from "../../../services/data/catalogue"
import Button from "../../../ui/Button"
import { RequestSchemeChips } from "../../schemes/parts"
import EmptyState from "../../../ui/EmptyState"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import VoiceTextArea from "../../../ui/VoiceTextArea"
import {
  ago,
  Chip,
  day,
  daysLeft,
  daysUntil,
  errorText,
  GRADIENT_PANEL,
  place,
  qty,
  rupees,
  specsText,
  SummaryCards,
  TabBar,
  termsText,
  timeLeftText,
  useNow,
  useToast,
} from "../../supplier/parts"

type Tab = "quotes" | "suppliers" | "request"

const STATUS: Record<RequestDetail["request"]["status"], { label: string; tone: "navy" | "orange" | "red" | "line" }> = {
  draft: { label: "Draft", tone: "line" },
  open: { label: "Finding suppliers", tone: "orange" },
  comparing: { label: "Quotes in", tone: "orange" },
  ordered: { label: "Ordered", tone: "navy" },
  cancelled: { label: "Cancelled", tone: "red" },
}

const num = (s: string) => {
  const n = Number(s.replace(/,/g, ""))
  return Number.isFinite(n) ? n : NaN
}

function budgetText(min: number | null, max: number | null): string | null {
  if (min && max) return `${rupees(min)} to ${rupees(max)}`
  if (max) return `up to ${rupees(max)}`
  if (min) return `from ${rupees(min)}`
  return null
}

// ---------------------------------------------------------------- small parts

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(score)))
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-label={`Score ${v} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8ecf3" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f09a47"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[14px] font-bold text-navy">{v}</span>
    </span>
  )
}

function Row({ label, value, strong = false, minus = false }: { label: ReactNode; value: number; strong?: boolean; minus?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-line pt-2" : ""}`}>
      <dt className={strong ? "font-bold text-navy" : "text-muted"}>{label}</dt>
      <dd className={strong ? "font-display text-[17px] font-bold text-navy" : "font-semibold text-navy"}>
        {minus ? "−" : ""}
        {rupees(value)}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------- quote card

interface QuoteView {
  quote: QuoteWithLines
  score: OfferScore | undefined
  breakdown: PriceBreakdown | null
  offers: Offer[]
}

function QuoteCard({
  view,
  badges,
  selected,
  ordered,
  onNegotiate,
  onApprove,
}: {
  view: QuoteView
  badges: string[]
  selected: boolean
  ordered: boolean
  onNegotiate: () => void
  onApprove: () => void
}) {
  const { quote, score, breakdown } = view
  const b = breakdown?.buyer
  const [showLines, setShowLines] = useState(false)
  const open = view.offers.find((o) => offerStatus(o) === "open")
  const accepted = quote.status === "accepted"

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl bg-white transition-shadow ${
        selected ? "shadow-[0_8px_22px_rgba(21,35,61,0.16)]" : "border-[1.5px] border-line shadow-[0_1px_3px_rgba(21,35,61,0.08)] hover:shadow-[0_6px_18px_rgba(21,35,61,0.1)]"
      }`}
      style={selected ? GRADIENT_PANEL : undefined}
    >
      {badges.length > 0 && (
        <div className="btn-gradient flex flex-wrap items-center gap-2 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.05em] text-navy">
          <Award size={14} aria-hidden="true" />
          {badges.join(" · ")}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[15.5px] font-bold text-navy">
              {quote.supplierName}
              <ShieldCheck size={15} className="shrink-0 text-orange" aria-label="Verified by MPI" />
            </p>
            <p className="text-[12.5px] text-muted">
              Quote{quote.version > 1 ? ` version ${quote.version}` : ""} · sent {ago(quote.submitted_at)}
            </p>
          </div>
          {score && <ScoreRing score={score.score} />}
        </div>

        <div className="mt-4 rounded-lg bg-navy px-4 py-3 text-white">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">Full cost to you</p>
          <p className="font-display text-[28px] font-bold leading-tight text-orange">{rupees(b?.total_cost ?? quote.total ?? 0)}</p>
          <p className="text-[12.5px] text-white/70">Supplier price, GST and MPI's fee, all in</p>
        </div>

        {b && (
          <dl className="mt-3 space-y-1.5 text-[14px]">
            <Row label="Supplier's invoice (incl. GST)" value={b.supplier_invoice} />
            {b.volume_benefit > 0 && <Row label="MPI volume benefit, already applied" value={b.volume_benefit} minus />}
            {b.negotiated_discount > 0 && <Row label="Negotiated discount, already applied" value={b.negotiated_discount} minus />}
            <Row label="MPI fee (incl. GST)" value={b.mpi_fee_invoice} />
            {b.pass_through > 0 && <Row label="Paid directly (ad spend, fees)" value={b.pass_through} />}
            <Row label="You pay at checkout" value={b.checkout_total} strong />
          </dl>
        )}
        {breakdown?.savings && breakdown.savings.net > 0 && (
          <p className="mt-2 flex items-center gap-1.5 rounded-md bg-orange-tint px-2.5 py-1.5 text-[13px] font-semibold text-navy">
            <Sparkles size={14} aria-hidden="true" /> You save about {rupees(breakdown.savings.net)} ({Math.round(breakdown.savings.pct)}%) vs. buying alone
          </p>
        )}

        <ul className="mt-3 space-y-1.5 text-[13.5px] text-navy">
          <li className="flex items-center gap-2">
            <Truck size={15} className="text-muted" aria-hidden="true" />
            {quote.lead_time_days ? `Delivery in ${quote.lead_time_days} days after order` : "Delivery time not given"}
          </li>
          {quote.valid_until && (
            <li className={`flex items-center gap-2 ${(daysUntil(quote.valid_until) ?? 9) <= 2 ? "font-semibold text-red-text" : ""}`}>
              <CalendarClock size={15} className="text-muted" aria-hidden="true" />
              Price valid until {day(quote.valid_until)} ({daysLeft(quote.valid_until)})
            </li>
          )}
          <li className="flex items-center gap-2">
            <Wallet size={15} className="text-muted" aria-hidden="true" />
            {termsText(quote.payment_terms ?? breakdown?.payment_terms)}
          </li>
        </ul>

        {score && score.reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {score.reasons.map((r) => (
              <span key={r} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[12px] font-semibold text-navy">
                {r}
              </span>
            ))}
          </div>
        )}

        {quote.notes && <p className="mt-3 rounded-md border-l-4 border-orange bg-page px-3 py-2 text-[13px] text-navy">“{quote.notes}”</p>}

        <button
          type="button"
          onClick={() => setShowLines((v) => !v)}
          aria-expanded={showLines}
          className="mt-3 inline-flex items-center gap-1 self-start text-[13.5px] font-semibold text-navy hover:underline"
        >
          <ChevronDown size={15} className={`transition-transform ${showLines ? "rotate-180" : ""}`} aria-hidden="true" />
          {showLines ? "Hide" : "See"} line items ({quote.lines.length})
        </button>
        {showLines && (
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-[13px]">
            {quote.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 px-3 py-2">
                <span className="min-w-0 text-navy">
                  {l.description}
                  <span className="block text-muted">
                    {Number(l.quantity).toLocaleString("en-IN")} × {rupees(Number(l.unit_price), true)} · GST {Number(l.tax_rate)}%
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-navy">{rupees(Number(l.quantity) * Number(l.unit_price))}</span>
              </li>
            ))}
          </ul>
        )}

        {open && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-orange-tint px-3 py-2 text-[13px] text-navy">
            <Handshake size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {open.proposed_by === "buyer"
              ? `Your offer of ${rupees(open.proposed_total)} is waiting for the supplier (${timeLeftText(timeLeftToReply(open))} left).`
              : `The supplier suggests ${rupees(open.proposed_total)}. Reply within ${timeLeftText(timeLeftToReply(open))}.`}
          </p>
        )}

        <div className="mt-auto pt-4">
          {accepted ? (
            <p className="flex items-center justify-center gap-2 rounded-md bg-navy px-3 py-2.5 text-[14.5px] font-bold text-white">
              <BadgeCheck size={17} className="text-orange" aria-hidden="true" /> You approved this quote
            </p>
          ) : ordered ? (
            <p className="rounded-md bg-page px-3 py-2.5 text-center text-[13.5px] text-muted">Not chosen</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" className="min-h-10 px-3 text-[14px]" onClick={onNegotiate}>
                <Handshake size={16} aria-hidden="true" /> Negotiate
              </Button>
              <Button className="min-h-10 px-3 text-[14px]" onClick={onApprove} disabled={!b}>
                <Check size={16} aria-hidden="true" /> Approve
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------- approve

function ApprovePanel({ view, onCancel, onDone }: { view: QuoteView; onCancel: () => void; onDone: (orderId: string) => Promise<void> }) {
  const b = view.breakdown?.buyer
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!b) return null
  const steps = b.schedule

  async function approve() {
    setBusy(true)
    setError(null)
    try {
      const orderId = await approveQuoteAtPrice(view.quote.id, b!.checkout_total)
      await onDone(orderId)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="approve" className="scroll-mt-24 mt-5 overflow-hidden rounded-xl shadow-[0_6px_18px_rgba(21,35,61,0.12)]" style={GRADIENT_PANEL}>
      <div className="bg-gradient-to-br from-navy-tint via-navy-tint/60 to-orange-tint/50 px-5 py-4">
        <h2 className="font-display text-[20px] font-bold text-navy">Approve {view.quote.supplierName}'s quote?</h2>
        <p className="text-[14px] text-muted">This places the order. The other suppliers are told they weren't chosen this time.</p>
      </div>
      <div className="grid gap-4 bg-white p-5 md:grid-cols-2">
        <div className="rounded-lg bg-navy p-4 text-white">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">You pay at checkout</p>
          <p className="font-display text-[30px] font-bold text-orange">{rupees(b.checkout_total)}</p>
          <p className="text-[13px] text-white/75">
            Supplier {rupees(b.supplier_invoice)} + MPI fee {rupees(b.mpi_fee_invoice)}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-navy">When you pay</p>
          <ol className="mt-2 space-y-2">
            {steps.map((s, i) => (
              <li key={s.seq} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-page/60 px-3 py-2 text-[14px]">
                <span className="text-navy">
                  <strong>{i === 0 ? "Before work starts" : "On delivery"}</strong>{" "}
                  <span className="text-muted">
                    ({s.pct}% of the supplier's invoice{s.mpi_fee_part > 0 ? " + MPI fee" : ""})
                  </span>
                </span>
                <strong className="text-navy">{rupees(s.amount)}</strong>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12.5px] text-muted">Payment terms are set by MPI for this category.</p>
        </div>
      </div>
      {error && (
        <div className="bg-white px-5">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line bg-white px-5 py-4">
        <Button busy={busy} onClick={approve}>
          <CheckCircle2 size={17} aria-hidden="true" /> Approve and place order
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- negotiate

const OFFER_STATUS: Record<Offer["status"], { label: string; tone: "navy" | "orange" | "red" | "line" }> = {
  open: { label: "Waiting for reply", tone: "orange" },
  accepted: { label: "Accepted", tone: "navy" },
  declined: { label: "Declined", tone: "red" },
  countered: { label: "Countered", tone: "line" },
  withdrawn: { label: "Withdrawn", tone: "line" },
  expired: { label: "Expired", tone: "line" },
}

function NegotiatePanel({
  view,
  now,
  onClose,
  onDone,
}: {
  view: QuoteView
  now: Date
  onClose: () => void
  onDone: (message: string) => Promise<void>
}) {
  const { quote, offers } = view
  const current = quote.total ?? 0
  const open = offers.find((o) => offerStatus(o, now) === "open")
  const left = Math.max(0, MAX_OFFERS_PER_QUOTE - offers.filter((o) => o.quote_id === quote.id).length)
  const [amount, setAmount] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key)
    setError(null)
    try {
      await fn()
      setAmount("")
      setMessage("")
      await onDone(done)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  function checkAmount(limit: number): number | null {
    const v = num(amount)
    if (!Number.isFinite(v) || v <= 0) {
      setError("Enter the total you want to pay, incl. GST.")
      return null
    }
    if (v >= limit) {
      setError(`Your offer should be below ${rupees(limit)}.`)
      return null
    }
    return v
  }

  const supplierCounter = open && open.proposed_by === "vendor" ? open : null
  const myOpen = open && open.proposed_by === "buyer" ? open : null
  const ceiling = supplierCounter ? supplierCounter.proposed_total : current

  return (
    <section id="negotiate" className="scroll-mt-24 mt-5 overflow-hidden rounded-xl shadow-[0_6px_18px_rgba(21,35,61,0.12)]" style={GRADIENT_PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-br from-orange-tint via-orange-tint/60 to-navy-tint/60 px-5 py-4">
        <div>
          <h2 className="font-display text-[20px] font-bold text-navy">Negotiate with {quote.supplierName}</h2>
          <p className="text-[14px] text-muted">Current quote {rupees(current)} incl. GST. Only the total price is negotiated.</p>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="navy">
            <Handshake size={13} aria-hidden="true" /> Offers left: {left} of {MAX_OFFERS_PER_QUOTE}
          </Chip>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted hover:bg-white hover:text-navy">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="grid gap-5 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {supplierCounter && (
            <div className="rounded-lg border-[1.5px] border-orange bg-orange-tint/60 p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">Your reply is needed</p>
              <p className="font-display text-[22px] font-bold text-navy">The supplier suggests {rupees(supplierCounter.proposed_total)}</p>
              {supplierCounter.message && <p className="mt-1 text-[14px] italic text-navy">“{supplierCounter.message}”</p>}
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-red-text">
                <Clock size={14} aria-hidden="true" /> {timeLeftText(timeLeftToReply(supplierCounter, now))} left to reply
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  busy={busy === "accept"}
                  disabled={busy !== null}
                  onClick={() => run("accept", () => respondToPrice(supplierCounter.id, "accept"), "Price agreed. The quote is updated.")}
                >
                  Accept {rupees(supplierCounter.proposed_total)}
                </Button>
                <Button
                  variant="secondary"
                  busy={busy === "decline"}
                  disabled={busy !== null}
                  onClick={() => run("decline", () => respondToPrice(supplierCounter.id, "decline"), "Declined. The quote keeps its price.")}
                >
                  Decline
                </Button>
              </div>
            </div>
          )}

          {myOpen ? (
            <div className="rounded-lg border border-line bg-page/60 p-4">
              <p className="text-[15px] text-navy">
                Your offer of <strong>{rupees(myOpen.proposed_total)}</strong> is with the supplier.
                <span className="ml-1 font-semibold">{timeLeftText(timeLeftToReply(myOpen, now))} left for them to reply.</span>
              </p>
              <Button
                variant="ghost"
                className="mt-2 min-h-9 px-3 text-[14px] text-red-text"
                busy={busy === "withdraw"}
                onClick={() => run("withdraw", () => respondToPrice(myOpen.id, "withdraw"), "Offer withdrawn")}
              >
                Withdraw my offer
              </Button>
            </div>
          ) : left === 0 && !supplierCounter ? (
            <Alert tone="info">All 3 offers on this quote are used. You can still approve it at {rupees(current)}.</Alert>
          ) : (
            <div>
              <label htmlFor="offer" className="mb-1.5 block text-sm font-semibold text-navy">
                {supplierCounter ? "Or offer another price" : "Your offer"}, total incl. GST
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-52">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted">₹</span>
                  <input
                    id="offer"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                    className={`${BOX} ${boxBorder()} min-h-12 pl-7 font-display text-[18px] font-bold`}
                  />
                </div>
                {[3, 5, 8].map((p) => {
                  const v = Math.round(ceiling * (1 - p / 100))
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(String(v))}
                      className="min-h-10 rounded-full bg-navy-tint px-3 text-[13px] font-semibold text-navy hover:bg-orange-tint"
                    >
                      −{p}%: {rupees(v)}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4">
                <VoiceTextArea
                  label="Message to the supplier (optional)"
                  value={message}
                  onChange={setMessage}
                  rows={3}
                  placeholder="e.g. We order every month, so we'd like a better rate for this first batch."
                />
              </div>
              <Button
                className="mt-3"
                busy={busy === "send"}
                disabled={busy !== null}
                onClick={() => {
                  const v = checkAmount(ceiling)
                  if (v === null) return
                  if (supplierCounter) {
                    void run("send", () => respondToPrice(supplierCounter.id, "counter", { counterTotal: v, message: message.trim() || undefined }), "Your offer was sent")
                  } else {
                    void run("send", () => proposePrice(quote.id, v, message.trim() || undefined), "Your offer was sent to the supplier")
                  }
                }}
              >
                <Send size={16} aria-hidden="true" /> Send offer
              </Button>
            </div>
          )}
          {error && <Alert>{error}</Alert>}
          <p className="flex items-start gap-2 rounded-lg bg-navy-tint/60 px-3.5 py-2.5 text-[13px] text-navy">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Up to 3 offers per quote. Each side has 24 hours to reply, or the offer expires and the price stays as it was. The
            supplier never sees your budget.
          </p>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-navy">
            <History size={16} className="text-orange" aria-hidden="true" /> History
          </h3>
          <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
            {offers.map((o) => {
              const st = OFFER_STATUS[offerStatus(o, now)]
              return (
                <li key={o.id} className="relative">
                  <span
                    className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ${o.proposed_by === "buyer" ? "bg-orange" : "bg-navy"}`}
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-muted">
                      {o.proposed_by === "buyer" ? "Your offer" : "Supplier"} · {day(o.created_at)}
                    </p>
                    <Chip tone={st.tone}>{st.label}</Chip>
                  </div>
                  <p className="font-display text-[16px] font-bold text-navy">{rupees(o.proposed_total)}</p>
                  {o.message && <p className="text-[12.5px] italic text-muted">“{o.message}”</p>}
                  {o.response_message && <p className="text-[12.5px] text-navy">Reply: {o.response_message}</p>}
                </li>
              )
            })}
            {offers.length === 0 && <li className="text-[13px] text-muted">No offers yet.</li>}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- suppliers tab

function SuppliersTab({ detail, quotes }: { detail: RequestDetail; quotes: QuoteWithLines[] }) {
  if (!detail.matches.length) {
    return <EmptyState icon={Sparkles} title="Suppliers coming soon" body="MPI is checking the best suppliers for this request. You'll get a message when they're approved." />
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {detail.matches.map(({ match, supplier }) => {
        const inv = detail.invitations.find((i) => i.vendor_org_id === match.vendor_org_id)
        const quoted = quotes.some((q) => q.vendor_org_id === match.vendor_org_id)
        const state = quoted
          ? { label: "Quote sent", tone: "navy" as const }
          : inv?.status === "declined"
            ? { label: "Not quoting", tone: "line" as const }
            : inv?.status === "viewed"
              ? { label: "Looking at it", tone: "orange" as const }
              : { label: "Invited", tone: "orange" as const }
        return (
          <article key={match.id} className="rounded-xl border-[1.5px] border-line bg-white p-4 shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-navy">
                  {supplier.displayName}
                  <ShieldCheck size={15} className="shrink-0 text-orange" aria-label="Verified by MPI" />
                </p>
                <p className="flex items-center gap-1 text-[13px] text-muted">
                  <MapPin size={13} aria-hidden="true" />
                  {place(supplier.city, supplier.state) ?? "India"}
                </p>
              </div>
              <ScoreRing score={match.score} />
            </div>
            {match.estimated_delivery_date && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-page px-3 py-2 text-[13.5px] text-navy">
                <Truck size={15} aria-hidden="true" /> Can deliver by about <strong>{day(match.estimated_delivery_date)}</strong>
              </p>
            )}
            {match.reasons.length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Why MPI picked them</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {match.reasons.map((r) => (
                    <span key={r} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[12px] font-semibold text-navy">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <Chip tone={state.tone}>{state.label}</Chip>
              {supplier.certifications.length > 0 && <span className="text-[12px] text-muted">{supplier.certifications.join(", ")}</span>}
            </div>
          </article>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- request tab

function RequestTab({ detail, category }: { detail: RequestDetail; category: Category | undefined }) {
  const { request, lines } = detail
  const budget = budgetText(request.budget_min, request.budget_max)
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <div className="overflow-x-auto rounded-xl border-[1.5px] border-line bg-white">
          <table className="w-full min-w-[32rem] text-[14px]">
            <thead className="bg-navy text-left text-[12px] uppercase tracking-[0.05em] text-white">
              <tr>
                <th className="px-4 py-2.5 font-semibold">What you need</th>
                <th className="px-4 py-2.5 text-right font-semibold">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const specs = specsText(l.specs)
                return (
                  <tr key={l.id} className={i % 2 ? "bg-page/60" : "bg-white"}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-navy">{l.description}</p>
                      {specs && <p className="text-[13px] text-muted">{specs}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">{qty(l.quantity, l.unit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {request.requirement_text && (
          <div className="rounded-xl border-[1.5px] border-line bg-white p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">In your words</p>
            <p className="mt-1 whitespace-pre-line text-[14.5px] text-navy">{request.requirement_text}</p>
          </div>
        )}
      </div>
      <dl className="h-fit overflow-hidden rounded-xl border-[1.5px] border-line bg-white text-[14px]">
        {[
          ["Category", category?.name ?? "Not set"],
          ["Needed by", request.needed_by ? `${day(request.needed_by, true)} (${daysLeft(request.needed_by)})` : "Flexible"],
          ["Deliver to", place(request.delivery_city, request.delivery_state) ?? "Not set"],
          ["Certificates", request.required_certifications.join(", ") || "None asked"],
          ["Sent", day(request.created_at, true) ?? ""],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr] border-b border-line last:border-b-0">
            <dt className="bg-navy-tint/60 px-3 py-2.5 font-semibold text-navy">{k}</dt>
            <dd className="px-3 py-2.5 text-navy">{v}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[7.5rem_1fr] border-b border-line">
          <dt className="bg-navy-tint/60 px-3 py-2.5 font-semibold text-navy">Schemes</dt>
          <dd className="px-3 py-2.5 text-navy">
            <RequestSchemeChips ids={request.scheme_ids ?? []} linkBase="/startup/schemes" empty="None chosen" />
          </dd>
        </div>
        <div className="grid grid-cols-[7.5rem_1fr]">
          <dt className="bg-orange-tint px-3 py-2.5 font-semibold text-navy">Budget</dt>
          <dd className="px-3 py-2.5 text-navy">
            {budget ?? "Not given"}
            <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
              <Lock size={12} aria-hidden="true" /> Private to you and MPI
            </span>
          </dd>
        </div>
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------- page

interface Loaded {
  detail: RequestDetail
  quotes: QuoteWithLines[]
  scores: OfferScore[]
  breakdowns: Map<string, PriceBreakdown | null>
  offers: Offer[]
  category: Category | undefined
}

export default function RequestDetailPage() {
  const { requestId } = useParams()
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [panel, setPanel] = useState<{ kind: "negotiate" | "approve"; quoteId: string } | null>(null)
  const [cancelAsk, setCancelAsk] = useState(false)
  const [toast, toastNode] = useToast()
  const now = useNow()

  const load = useCallback(async () => {
    if (!requestId) return
    try {
      const [detail, quotes, offers, cats] = await Promise.all([
        getRequestDetail(requestId),
        listQuotesForRequest(requestId),
        listOffersForRequest(requestId),
        listCategories(),
      ])
      const live = quotes.filter((q) => q.status === "submitted" || q.status === "accepted")
      const [scores, breakdownList] = await Promise.all([
        live.some((q) => q.status === "submitted") ? compareOffers(requestId).catch(() => []) : Promise.resolve([]),
        Promise.all(live.map((q) => getPriceBreakdown(q.id).catch(() => null))),
      ])
      setData({
        detail,
        quotes: live,
        scores,
        breakdowns: new Map(live.map((q, i) => [q.id, breakdownList[i]])),
        offers,
        category: cats.find((c) => c.id === detail.request.category_id),
      })
      document.title = `${detail.request.title} · MPI`
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [requestId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (panel) window.setTimeout(() => document.getElementById(panel.kind)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }, [panel])

  const views = useMemo<QuoteView[]>(() => {
    if (!data) return []
    const rank = new Map(data.scores.map((s) => [s.quote_id, s.rank]))
    return data.quotes
      .map((quote) => ({
        quote,
        score: data.scores.find((s) => s.quote_id === quote.id),
        breakdown: data.breakdowns.get(quote.id) ?? null,
        // Offers follow a quote across versions: an accepted price reissues it.
        offers: data.offers.filter((o) => o.vendor_org_id === quote.vendor_org_id),
      }))
      .sort((a, b) => (rank.get(a.quote.id) ?? 99) - (rank.get(b.quote.id) ?? 99))
  }, [data])

  if (!data) {
    return error ? (
      <Alert>{error}</Alert>
    ) : (
      <div className="space-y-4" aria-label="Loading">
        <div className="h-24 animate-pulse rounded-xl bg-page" />
        <div className="h-64 animate-pulse rounded-xl bg-page" />
      </div>
    )
  }

  const { detail, category } = data
  const { request } = detail
  const st = STATUS[request.status]
  const ordered = request.status === "ordered" || !!detail.order
  const canAct = !ordered && request.status !== "cancelled"
  const tab = (params.get("tab") as Tab | null) ?? "quotes"
  const setTab = (t: string) => setParams({ tab: t }, { replace: true })

  const costs = views.map((v) => v.breakdown?.buyer?.total_cost ?? v.quote.total ?? Infinity)
  const lowest = Math.min(...costs)
  const best = views.reduce<QuoteView | null>((acc, v) => (v.score && (!acc?.score || v.score.score > acc.score.score) ? v : acc), null)
  const budget = budgetText(request.budget_min, request.budget_max)
  const where = place(request.delivery_city, request.delivery_state)
  const itemsQty = detail.lines.length === 1 ? qty(detail.lines[0].quantity, detail.lines[0].unit) : `${detail.lines.length} items`
  const selected = panel ? views.find((v) => v.quote.id === panel.quoteId) : undefined

  async function done(message: string) {
    toast(message)
    await load()
  }

  return (
    <div>
      <Link to="/startup/requests" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> My requests
      </Link>

      <div className="mt-3 mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip tone={st.tone}>{st.label}</Chip>
            {category && <span className="rounded-full bg-navy-tint px-3 py-0.5 text-[12.5px] font-semibold text-navy">{category.name}</span>}
          </div>
          <h1 className="font-display text-[26px] font-bold leading-tight text-navy sm:text-[30px]">{request.title}</h1>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-navy">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={15} className="text-muted" aria-hidden="true" />
              {request.needed_by ? `Needed by ${day(request.needed_by)} (${daysLeft(request.needed_by)})` : "Flexible date"}
            </span>
            {where && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} className="text-muted" aria-hidden="true" />
                {where}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Package size={15} className="text-muted" aria-hidden="true" />
              {itemsQty}
            </span>
          </p>
        </div>
        {canAct && (
          <div className="shrink-0">
            {!cancelAsk ? (
              <Button variant="secondary" className="min-h-10 px-4 text-[14px]" onClick={() => setCancelAsk(true)}>
                <X size={16} aria-hidden="true" /> Cancel request
              </Button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 text-[14px] text-navy">
                Cancel this request? Suppliers will stop quoting.
                <Button
                  variant="danger"
                  className="min-h-9 px-3 text-[14px]"
                  onClick={async () => {
                    try {
                      await cancelRequest(request.id)
                      await done("Request cancelled")
                    } catch (err) {
                      setError(errorText(err))
                    }
                    setCancelAsk(false)
                  }}
                >
                  Yes, cancel
                </Button>
                <button type="button" className="px-2 font-semibold text-muted hover:text-navy" onClick={() => setCancelAsk(false)}>
                  Keep it
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {detail.order && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-navy px-5 py-4 text-white shadow-[0_6px_18px_rgba(21,35,61,0.25)]">
          <p className="flex items-center gap-3 text-[15px]">
            <span className="btn-gradient flex h-10 w-10 items-center justify-center rounded-lg text-navy" aria-hidden="true">
              <CheckCircle2 size={20} />
            </span>
            <span>
              <strong>Order {detail.order.po_number} placed</strong>
              <span className="block text-white/75">
                {rupees(detail.order.total_amount)} · approved {day(detail.order.approved_at, true)}
              </span>
            </span>
          </p>
          <Link to={`/startup/orders?o=${detail.order.id}`} className="btn-gradient inline-flex min-h-10 items-center rounded-md px-4 text-[14px] font-bold text-navy">
            Go to orders
          </Link>
        </div>
      )}

      <SummaryCards
        selected={tab === "quotes" ? "quotes" : tab === "suppliers" ? "suppliers" : "budget"}
        onPick={(id) => setTab(id === "budget" ? "request" : id === "suppliers" ? "suppliers" : "quotes")}
        items={[
          {
            id: "quotes",
            label: "Quotes in",
            value: views.length,
            hint: detail.matches.length ? `from ${detail.matches.length} approved supplier${detail.matches.length === 1 ? "" : "s"}` : "waiting for MPI",
            icon: FileText,
            dot: views.length > 0 && canAct,
          },
          { id: "lowest", label: "Lowest full cost", value: Number.isFinite(lowest) ? rupees(lowest) : "–", hint: "incl. GST and MPI fee", icon: Wallet },
          {
            id: "suppliers",
            label: "Best score",
            value: best?.score ? `${best.score.score}/100` : "–",
            hint: best ? best.quote.supplierName.replace("MPI Verified ", "") : "price, quality, delivery",
            icon: Award,
          },
          { id: "budget", label: "Your budget", value: request.budget_max ? rupees(request.budget_max) : "–", hint: "private to you and MPI", icon: Lock },
        ]}
      />

      <TabBar<Tab>
        label="Request sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "quotes", label: "Compare quotes", count: views.length },
          { id: "suppliers", label: "Suppliers", count: detail.matches.length },
          { id: "request", label: "Your request" },
        ]}
      />

      <div className="mt-5">
        {tab === "quotes" &&
          (views.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={request.status === "cancelled" ? "This request was cancelled" : "No quotes yet"}
              body={
                detail.invitations.length
                  ? `${detail.invitations.length} supplier${detail.invitations.length === 1 ? " is" : "s are"} preparing a quote. You'll get a message when one arrives.`
                  : "MPI is choosing the right suppliers for this request. They'll be invited to quote once approved."
              }
            />
          ) : (
            <>
              {budget && canAct && (
                <p className="mb-4 flex items-center gap-2 text-[13.5px] text-muted">
                  <Lock size={14} aria-hidden="true" /> Your budget ({budget}) is never shown to suppliers.
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {views.map((v) => {
                  const badges: string[] = []
                  if (best && best.quote.id === v.quote.id && views.length > 1) badges.push("Best score")
                  if (views.length > 1 && (v.breakdown?.buyer?.total_cost ?? v.quote.total) === lowest) badges.push("Lowest total")
                  return (
                    <QuoteCard
                      key={v.quote.id}
                      view={v}
                      badges={badges}
                      selected={panel?.quoteId === v.quote.id}
                      ordered={ordered}
                      onNegotiate={() => setPanel({ kind: "negotiate", quoteId: v.quote.id })}
                      onApprove={() => setPanel({ kind: "approve", quoteId: v.quote.id })}
                    />
                  )
                })}
              </div>
              {selected && canAct && panel?.kind === "negotiate" && (
                <NegotiatePanel view={selected} now={now} onClose={() => setPanel(null)} onDone={done} />
              )}
              {selected && canAct && panel?.kind === "approve" && (
                <ApprovePanel
                  view={selected}
                  onCancel={() => setPanel(null)}
                  onDone={async () => {
                    setPanel(null)
                    await done("Order placed")
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                />
              )}
            </>
          ))}
        {tab === "suppliers" && <SuppliersTab detail={detail} quotes={data.quotes} />}
        {tab === "request" && <RequestTab detail={detail} category={category} />}
      </div>
      {toastNode}
    </div>
  )
}
