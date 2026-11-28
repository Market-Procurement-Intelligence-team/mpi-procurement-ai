/**
 * Startup: proposals on a service brief, side by side (up to 3 columns).
 *
 * Each column: the provider's anonymous name (freelancer or business), the
 * score out of 100 with "MPI pick" on the best, what the startup pays and how
 * it sits against their private budget, days, rounds of changes, the
 * milestone split (each deliverable's share of the price), the cover note
 * and MPI's reasons. Actions: View profile (freelancers), Ask for a change,
 * Price offer, Hire. Panels for those open under the columns.
 */

import { useState } from "react"
import { CalendarClock, CircleAlert, Hand, Handshake, MessageSquareText, Repeat, Send, Sparkles, UserRound } from "lucide-react"
import type { PriceBreakdown } from "../../../services/data/money"
import { offerStatus, type Offer } from "../../../services/data/negotiation"
import { askForChange, MAX_CHANGES, splitPct, type ProposalChange, type ProposalScore } from "../../../services/data/proposals"
import type { QuoteWithLines } from "../../../services/data/quotes"
import type { Request } from "../../../services/data/requests"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import { AnonAvatar } from "../../freelancer/PublicProfile"
import { Chip, day, errorText, GRADIENT_PANEL, rupees } from "../../supplier/parts"

export interface ProposalView {
  quote: QuoteWithLines
  breakdown: PriceBreakdown | null
  offers: Offer[]
}

const FIT: Record<NonNullable<ProposalScore["budget_fit"]>, { label: string; tone: "navy" | "orange" | "red" }> = {
  within: { label: "Within your budget", tone: "navy" },
  a_little_above: { label: "A little above budget", tone: "orange" },
  above: { label: "Above your budget", tone: "red" },
}

const SEGMENT = ["#15233d", "#f09a47", "#4b5567", "#ec8d49", "#233653", "#a3adba"]

function Ring({ score }: { score: number }) {
  const v = Math.max(0, Math.min(100, Math.round(score)))
  const size = 52
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-label={`Score ${v} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8ecf3" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f09a47" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[15px] font-bold text-navy">{v}</span>
    </span>
  )
}

function Fact({ icon: Icon, label, value, warn }: { icon: typeof Repeat; label: string; value: string; warn?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-[14px]">
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Icon size={14} aria-hidden="true" /> {label}
      </span>
      <span className="text-right">
        <span className="font-semibold text-navy">{value}</span>
        {warn && (
          <span className="mt-0.5 flex items-center justify-end gap-1 text-[12.5px] font-semibold text-red-text">
            <CircleAlert size={12} aria-hidden="true" /> {warn}
          </span>
        )}
      </span>
    </div>
  )
}

function ProposalColumn({
  view,
  score,
  pick,
  request,
  changes,
  selected,
  canAct,
  onProfile,
  onAction,
}: {
  view: ProposalView
  score: ProposalScore | undefined
  pick: boolean
  request: Request
  changes: ProposalChange[]
  selected: string | null
  canAct: boolean
  onProfile: (orgId: string) => void
  onAction: (kind: "change" | "negotiate" | "approve") => void
}) {
  const { quote, breakdown } = view
  const b = breakdown?.buyer
  const freelancer = score?.is_freelancer ?? false
  const amounts = quote.lines.map((l) => Number(l.line_amount ?? 0))
  const pct = splitPct(amounts)
  const days = quote.lead_time_days
  const finish = days != null ? new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10) : null
  const late = request.needed_by && finish && finish > request.needed_by ? "Ends after your date" : null
  const asked = request.revision_rounds
  const openChange = changes.find((c) => c.status === "open")
  const openOffer = view.offers.find((o) => offerStatus(o) === "open")
  const accepted = quote.status === "accepted"
  const fit = score?.budget_fit ? FIT[score.budget_fit] : null
  const border = selected || pick ? undefined : { border: "1.5px solid #cbd2dc", background: "linear-gradient(to bottom right, #e8ecf3, rgba(232,236,243,0.6), rgba(253,235,217,0.5)), #fff" }

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={border ?? GRADIENT_PANEL}>
      <header className="flex items-start gap-3 px-4 pt-4">
        <AnonAvatar code={quote.supplierName} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-bold text-navy">{quote.supplierName}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip tone="line">{freelancer ? "Freelancer" : "Business"}</Chip>
            {pick && (
              <Chip tone="navy">
                <Sparkles size={12} className="text-orange" aria-hidden="true" /> MPI pick
              </Chip>
            )}
            {quote.version > 1 && <Chip tone="line">Version {quote.version}</Chip>}
          </div>
        </div>
        {score && <Ring score={score.score} />}
      </header>

      <div className="mx-4 mt-3 rounded-lg bg-navy px-4 py-3 text-white">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">You pay</p>
        <p className="font-display text-[26px] font-bold leading-tight text-orange">{rupees(b?.checkout_total ?? quote.total ?? 0)}</p>
        <p className="text-[12.5px] text-white/75">
          Provider {rupees(b?.supplier_invoice ?? quote.total ?? 0)}
          {b && b.mpi_fee_invoice > 0 ? ` + MPI fee ${rupees(b.mpi_fee_invoice)}` : ""}
        </p>
      </div>
      {fit && (
        <p className="mx-4 mt-2">
          <Chip tone={fit.tone}>{fit.label}</Chip>
        </p>
      )}

      <div className="mx-4 mt-2 divide-y divide-line/70">
        <Fact icon={CalendarClock} label="Finishes in" value={days != null ? `${days} days (${day(finish)})` : "Not given"} warn={late} />
        <Fact
          icon={Repeat}
          label="Rounds of changes"
          value={quote.revision_rounds != null ? String(quote.revision_rounds) : "Not given"}
          warn={asked != null && quote.revision_rounds != null && quote.revision_rounds < asked ? `You asked for ${asked}` : null}
        />
      </div>

      <div className="mx-4 mt-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Milestones</p>
        <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-navy-tint" aria-hidden="true">
          {pct.map((p, i) => (
            <span key={i} style={{ width: `${p}%`, background: SEGMENT[i % SEGMENT.length], marginRight: i < pct.length - 1 ? 2 : 0 }} />
          ))}
        </div>
        <ol className="mt-2 space-y-1 text-[13.5px]">
          {quote.lines.map((l, i) => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEGMENT[i % SEGMENT.length] }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-navy">{l.description}</span>
              <span className="text-muted">{pct[i]}%</span>
              <span className="w-20 text-right font-semibold text-navy">{rupees(amounts[i])}</span>
            </li>
          ))}
        </ol>
      </div>

      {quote.notes && (
        <p className="mx-4 mt-3 rounded-lg border border-line/70 bg-white px-3 py-2 text-[13.5px] text-navy" title={quote.notes}>
          <span className="line-clamp-3">{quote.notes}</span>
        </p>
      )}

      {score && score.reasons.length > 0 && (
        <div className="mx-4 mt-3 flex flex-wrap gap-1.5">
          {score.reasons.map((r) => (
            <span key={r} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[12px] font-semibold text-navy">
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto px-4 pt-3 pb-4">
        {(openChange || openOffer) && (
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-navy">
            {openChange ? <MessageSquareText size={14} aria-hidden="true" /> : <Handshake size={14} aria-hidden="true" />}
            {openChange ? "Change asked. Waiting for a new version." : `Price offer of ${rupees(openOffer!.proposed_total)} waiting for a reply.`}
          </p>
        )}
        {accepted ? (
          <Chip tone="navy">Hired</Chip>
        ) : canAct ? (
          <div className="grid grid-cols-2 gap-2">
            {freelancer && (
              <Button variant="ghost" className="col-span-2 min-h-10 justify-start px-2 text-[14px]" onClick={() => onProfile(quote.vendor_org_id)}>
                <UserRound size={16} aria-hidden="true" /> View profile
              </Button>
            )}
            <Button
              variant="secondary"
              className="min-h-10 px-3 text-[14px]"
              disabled={!!openChange || !!openOffer || changes.length >= MAX_CHANGES}
              onClick={() => onAction("change")}
              title={changes.length >= MAX_CHANGES ? `You asked for ${MAX_CHANGES} changes already` : undefined}
            >
              <MessageSquareText size={16} aria-hidden="true" /> Ask for a change
            </Button>
            <Button variant="secondary" className="min-h-10 px-3 text-[14px]" disabled={!!openChange} onClick={() => onAction("negotiate")}>
              <Handshake size={16} aria-hidden="true" /> Price offer
            </Button>
            <Button className="col-span-2 min-h-11" onClick={() => onAction("approve")}>
              <Hand size={17} aria-hidden="true" /> Hire
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function AskChangePanel({ view, used, onClose, onDone }: { view: ProposalView; used: number; onClose: () => void; onDone: (message: string) => Promise<void> }) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (text.trim().length < 3) return setError("Say what you would like changed.")
    setBusy(true)
    setError(null)
    try {
      await askForChange(view.quote.id, text.trim())
      await onDone("Change asked. You'll get a message when the new version arrives.")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="change" className="mt-5 scroll-mt-24 overflow-hidden rounded-xl shadow-[0_6px_18px_rgba(21,35,61,0.12)]" style={GRADIENT_PANEL}>
      <div className="px-5 py-4">
        <h2 className="font-display text-[20px] font-bold text-navy">Ask {view.quote.supplierName} for a change</h2>
        <p className="text-[14px] text-muted">
          About what's included, the days or the rounds of changes. For the price, use a price offer. {MAX_CHANGES - used} of {MAX_CHANGES} left.
        </p>
      </div>
      <div className="bg-white px-5 py-4">
        <label htmlFor="change-text" className="sr-only">
          What should change
        </label>
        <textarea
          id="change-text"
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Please add 2 more screens for the checkout, and finish 3 days sooner."
          className={`${BOX} ${boxBorder()} py-2.5 text-[15px]`}
        />
        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button busy={busy} onClick={send}>
            <Send size={16} aria-hidden="true" /> Send to the provider
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </section>
  )
}

export default function ProposalsCompare({
  views,
  scores,
  changes,
  request,
  selected,
  canAct,
  onProfile,
  onAction,
}: {
  views: ProposalView[]
  scores: ProposalScore[]
  changes: ProposalChange[]
  request: Request
  selected: string | null
  canAct: boolean
  onProfile: (orgId: string) => void
  onAction: (kind: "change" | "negotiate" | "approve", quoteId: string) => void
}) {
  const rank = new Map(scores.map((s) => [s.quote_id, s.rank]))
  const sorted = [...views].sort((a, b) => (rank.get(a.quote.id) ?? 99) - (rank.get(b.quote.id) ?? 99))
  const best = scores.find((s) => s.rank === 1)
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((v) => (
        <ProposalColumn
          key={v.quote.id}
          view={v}
          score={scores.find((s) => s.quote_id === v.quote.id)}
          pick={views.length > 1 && best?.quote_id === v.quote.id}
          request={request}
          changes={changes.filter((c) => c.vendor_org_id === v.quote.vendor_org_id)}
          selected={selected === v.quote.id ? v.quote.id : null}
          canAct={canAct}
          onProfile={onProfile}
          onAction={(kind) => onAction(kind, v.quote.id)}
        />
      ))}
    </div>
  )
}
