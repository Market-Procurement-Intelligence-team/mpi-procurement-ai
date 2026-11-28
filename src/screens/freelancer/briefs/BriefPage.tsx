/**
 * Freelancer: one brief and the proposal for it, side by side.
 *
 * Left: the brief (deliverables with "done when", goal, skills, links, the
 * facts). Right: the proposal.
 * - Writing: start from a package, a price for each deliverable (its share
 *   of the total is the milestone split), days, rounds of changes, a cover
 *   note, and "You receive" worked out by MPI's fee rule as you type.
 *   Send proposal, Save draft, or Decline (with a reason only MPI sees).
 * - Sent: the proposal as the startup sees it, its versions, and a price
 *   offer to answer if the startup made one. A change the startup asked for
 *   opens the form again for version 2.
 *
 * The startup is "MPI Verified Buyer"; the budget is never shown.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router"
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Clock,
  ExternalLink,
  FileText,
  Info,
  ListChecks,
  MessageSquareText,
  PackageCheck,
  Pencil,
  Save,
  Send,
  Trophy,
  Wallet,
  X,
  XCircle,
} from "lucide-react"
import { useMe } from "../../../app/session"
import { listCategories, type Category } from "../../../services/data/catalogue"
import { getPriceBreakdown, type PriceBreakdown } from "../../../services/data/money"
import { listMyOffers, timeLeftToReply, type Offer } from "../../../services/data/negotiation"
import {
  declineBrief,
  listMyBriefs,
  MAX_CHANGES,
  previewProposal,
  saveProposal,
  splitPct,
  type Brief,
  type ProposalPreview,
} from "../../../services/data/proposals"
import { getMyProviderProfile, listSkills, type ProviderPackage, type Skill } from "../../../services/data/providers"
import { markInvitationViewed, listQuoteLines, type Quote, type QuoteLine } from "../../../services/data/quotes"
import { deliverablesOf } from "../../../services/data/requests"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import { Chip, day, daysLeft, errorText, place, rupees, timeLeftText, useNow, useToast } from "../../supplier/parts"
import { OfferReply } from "../../supplier/QuotePage"
import { SectionPanel, Stepper, Tile } from "../ui"

const num = (s: string) => {
  const n = Number(s.replace(/[,₹\s]/g, ""))
  return Number.isFinite(n) ? n : NaN
}

const addDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)

interface Loaded {
  brief: Brief
  packages: ProviderPackage[]
  category: Category | undefined
  skills: Skill[]
  mySkillIds: Set<string>
  offers: Offer[]
  /** Lines of every version, by quote id. */
  lines: Map<string, QuoteLine[]>
  breakdown: PriceBreakdown | null
}

interface Form {
  prices: string[]
  days: string
  revisions: number
  packageId: string | null
  note: string
}

// ---------------------------------------------------------------- the brief

function BriefColumn({ data }: { data: Loaded }) {
  const { request, lines } = data.brief
  const deliverables = deliverablesOf(request)
  const skills = (request.skill_ids ?? []).map((id) => data.skills.find((s) => s.id === id)).filter(Boolean) as Skill[]
  const facts: [string, string][] = [
    ["Deadline", request.needed_by ? `${day(request.needed_by, true)} (${daysLeft(request.needed_by)})` : "Flexible"],
    ["Where", place(request.delivery_city, request.delivery_state) ?? "Online, anywhere in India"],
    ["Changes", request.revision_rounds != null ? `${request.revision_rounds} round${request.revision_rounds === 1 ? "" : "s"}` : "Not set"],
  ]
  return (
    <SectionPanel icon={FileText} title="The brief" subtitle={`From ${data.brief.buyerName}`}>
      <div className="space-y-4">
        {request.description && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Goal</p>
            <p className="mt-1 whitespace-pre-line text-[14.5px] text-navy">{request.description}</p>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-line/70 bg-white">
          <p className="border-b border-line/70 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">
            Deliverables ({deliverables.length || lines.length})
          </p>
          <ol className="divide-y divide-line/70">
            {(deliverables.length ? deliverables : lines.map((l) => ({ title: l.description, done_when: null }))).map((d, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[12px] font-bold text-navy">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold text-navy">{d.title}</span>
                  {d.done_when && (
                    <span className="mt-0.5 flex items-start gap-1.5 text-[13px] text-muted">
                      <CircleCheck size={13} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" /> Done when: {d.done_when}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {skills.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Skills asked</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {skills.map((s) => {
                const mine = data.mySkillIds.has(s.id)
                return (
                  <span key={s.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${mine ? "bg-navy text-white" : "border border-line bg-white text-muted"}`}>
                    {mine && <CircleCheck size={12} className="text-orange" aria-hidden="true" />}
                    {s.name}
                  </span>
                )
              })}
            </div>
          </div>
        )}
        {(request.reference_links ?? []).length > 0 && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Reference links</p>
            <ul className="mt-1.5 space-y-1">
              {request.reference_links.map((l) => (
                <li key={l}>
                  <a href={l} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-[14px] font-semibold text-navy underline underline-offset-2 hover:text-orange-2">
                    <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{l}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="overflow-hidden rounded-xl border border-line/70 bg-white text-[14px]">
          {facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[6.5rem_1fr] border-b border-line/70 last:border-b-0">
              <dt className="bg-navy-tint/60 px-3 py-2 font-semibold text-navy">{k}</dt>
              <dd className="px-3 py-2 text-navy">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SectionPanel>
  )
}

// ---------------------------------------------------------------- money box

/**
 * What the freelancer receives, worked out by MPI's fee rule, with the Send
 * and Save buttons. It stays at the bottom of the screen while they type.
 */
function ReceiveBar({ preview, total, taxRate, loading, children }: { preview: ProposalPreview | null; total: number; taxRate: number; loading: boolean; children: ReactNode }) {
  const s = preview?.supplier
  const detail =
    total <= 0
      ? "Put a price on each deliverable to see what you receive."
      : !s
        ? loading
          ? "Working it out…"
          : "Could not work this out right now."
        : [
            `Your price ${rupees(total)}`,
            taxRate > 0 ? `+ GST ${rupees(s.gst)}` : "no GST",
            s.commission_invoice > 0 ? `− MPI commission ${rupees(s.commission_invoice)}` : "no MPI commission",
          ].join(" · ")
  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-navy px-4 py-3 text-white shadow-[0_10px_28px_rgba(21,35,61,0.35)]" aria-live="polite">
      <div className={`min-w-0 flex-1 transition-opacity ${loading ? "opacity-70" : ""}`} style={{ minWidth: 220 }}>
        <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">
          <Wallet size={14} className="text-orange" aria-hidden="true" /> You receive
        </p>
        <p className="font-display text-[26px] font-bold leading-tight text-orange">{s && total > 0 ? rupees(s.payout) : "–"}</p>
        <p className="text-[12.5px] text-white/75">{detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------- proposal form

function ProposalForm({
  data,
  start,
  taxRate,
  onDone,
  onCancel,
}: {
  data: Loaded
  start: Form
  taxRate: number
  onDone: (message: string) => Promise<void>
  onCancel?: () => void
}) {
  const { brief, packages } = data
  const rows = brief.lines
  const [form, setForm] = useState<Form>(start)
  const [busy, setBusy] = useState<"send" | "save" | "decline" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")
  const [preview, setPreview] = useState<ProposalPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const prices = form.prices.map((p) => num(p))
  const total = prices.reduce((a, p) => a + (Number.isFinite(p) && p > 0 ? p : 0), 0)
  const pct = splitPct(prices.map((p) => (Number.isFinite(p) && p > 0 ? p : 0)))
  const days = num(form.days)
  const needed = brief.request.needed_by
  const late = needed && Number.isFinite(days) && days > 0 && addDays(days) > needed
  const myPackages = packages.filter((p) => p.is_active && p.category_id === brief.request.category_id)
  const isNewVersion = brief.myQuotes.some((q) => q.status !== "draft")

  useEffect(() => {
    if (total <= 0) {
      setPreview(null)
      return
    }
    setPreviewing(true)
    const t = window.setTimeout(() => {
      previewProposal(brief.invitation.id, total, taxRate)
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setPreviewing(false))
    }, 350)
    return () => window.clearTimeout(t)
  }, [total, taxRate, brief.invitation.id])

  function applyPackage(p: ProviderPackage) {
    const n = Math.max(rows.length, 1)
    const each = Math.floor(p.price / n)
    setForm((f) => ({
      ...f,
      packageId: p.id,
      prices: rows.map((_, i) => String(i === n - 1 ? p.price - each * (n - 1) : each)),
      days: String(p.turnaround_days),
      revisions: p.revision_rounds,
    }))
  }

  async function save(send: boolean) {
    setError(null)
    if (send) {
      if (prices.some((p) => !Number.isFinite(p) || p <= 0)) return setError("Put a price on every deliverable.")
      if (!Number.isFinite(days) || days < 1) return setError("Add how many days the work takes.")
    }
    setBusy(send ? "send" : "save")
    try {
      await saveProposal(
        brief,
        {
          lines: rows.map((l, i) => ({ requestLineId: l.id, description: l.description, price: Number.isFinite(prices[i]) ? prices[i] : 0 })),
          days: Number.isFinite(days) && days > 0 ? Math.round(days) : null,
          revisions: form.revisions,
          packageId: form.packageId,
          note: form.note,
          taxRate,
        },
        send,
      )
      await onDone(send ? (isNewVersion ? "New version sent to the startup" : "Proposal sent to the startup") : "Draft saved")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  async function decline() {
    setBusy("decline")
    setError(null)
    try {
      await declineBrief(brief.invitation.id, reason.trim() || undefined)
      await onDone("Brief declined. MPI has been told.")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      {myPackages.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-semibold text-navy">Start from one of your packages</p>
          <div className="flex flex-wrap gap-2">
            {myPackages.map((p) => {
              const on = form.packageId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPackage(p)}
                  aria-pressed={on}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-left text-[13.5px] text-navy transition-shadow hover:shadow-md"
                  style={{ border: on ? "1.5px solid #ec8d49" : "1.5px solid #cbd2dc" }}
                >
                  <PackageCheck size={16} className={on ? "text-orange-2" : "text-muted"} aria-hidden="true" />
                  <span>
                    <span className="block font-semibold">{p.title}</span>
                    <span className="block text-[12.5px] text-muted">
                      {rupees(p.price)} · {p.turnaround_days} days · {p.revision_rounds} rounds
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-semibold text-navy">Price for each deliverable</p>
        <div className="overflow-hidden rounded-xl border border-line/70 bg-white">
          {rows.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3 border-b border-line/70 px-3 py-2.5 last:border-b-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[12px] font-bold text-navy">{i + 1}</span>
              <label htmlFor={`price-${l.id}`} className="min-w-0 flex-1 text-[14px] font-semibold text-navy">
                {l.description}
              </label>
              <span className="hidden w-11 shrink-0 text-right text-[12.5px] font-semibold text-muted sm:inline">{total > 0 ? `${pct[i]}%` : ""}</span>
              <div className="relative w-28 shrink-0 sm:w-36">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">₹</span>
                <input
                  id={`price-${l.id}`}
                  inputMode="numeric"
                  value={form.prices[i] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, packageId: f.packageId, prices: f.prices.map((p, j) => (j === i ? e.target.value : p)) }))}
                  placeholder="0"
                  className={`${BOX} ${boxBorder()} h-11 pl-7 text-right`}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between bg-navy-tint/60 px-4 py-2.5 text-[14px]">
            <span className="font-semibold text-navy">Total</span>
            <span className="font-display text-[18px] font-bold text-navy">{rupees(total)}</span>
          </div>
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">The split is your milestone plan: the startup sees each deliverable's share.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="days" className="mb-1.5 block text-sm font-semibold text-navy">
            Days to finish
          </label>
          <input id="days" inputMode="numeric" value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} placeholder="e.g. 12" className={`${BOX} ${boxBorder()} h-12`} />
          {late ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-semibold text-red-text">
              <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Ends after the startup's date ({day(needed)})
            </p>
          ) : Number.isFinite(days) && days > 0 ? (
            <p className="mt-1.5 text-[12.5px] text-muted">Done by about {day(addDays(days))}</p>
          ) : null}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-navy">Rounds of changes included</p>
          <Stepper label="rounds of changes" value={form.revisions} min={0} max={10} onChange={(n) => setForm((f) => ({ ...f, revisions: n }))} />
          {brief.request.revision_rounds != null && (
            <p className={`mt-1.5 text-[12.5px] ${form.revisions < brief.request.revision_rounds ? "font-semibold text-red-text" : "text-muted"}`}>
              The startup asked for {brief.request.revision_rounds}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="note" className="mb-1.5 flex items-baseline justify-between text-sm font-semibold text-navy">
          Cover note <span className="text-[12px] font-normal text-muted">{form.note.length}/1000</span>
        </label>
        <textarea
          id="note"
          rows={3}
          maxLength={1000}
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="How you'll do it, and similar work you've done. Don't add phone numbers, emails or links: MPI keeps you both anonymous."
          className={`${BOX} ${boxBorder()} py-2.5 text-[15px]`}
        />
      </div>

      {preview && (
        <p className="-mt-2 flex items-start gap-1.5 text-[12.5px] text-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Payment, set by MPI: {preview.payment_terms}. MPI's commission is {preview.fee_rule.commission_pct}% + GST (fee rule v
            {preview.fee_rule.version}
            {preview.fee_rule.needs_review ? ", sample" : ""}), taken from your payout, not added to the startup's price.
            {taxRate === 0 ? " No GST is added because your profile has no GSTIN." : ""}
          </span>
        </p>
      )}

      {error && <Alert>{error}</Alert>}

      {declining ? (
        <div className="rounded-xl border-[1.5px] border-dashed border-input bg-white p-4">
          <label htmlFor="reason" className="block text-sm font-semibold text-navy">
            Why not? <span className="font-normal text-muted">(optional, only MPI sees it)</span>
          </label>
          <input id="reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fully booked this month" className={`${BOX} ${boxBorder()} mt-1.5 h-11`} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" busy={busy === "decline"} onClick={decline}>
              <XCircle size={17} aria-hidden="true" /> Decline brief
            </Button>
            <Button variant="ghost" onClick={() => setDeclining(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <ReceiveBar preview={preview} total={total} taxRate={taxRate} loading={previewing}>
          <button
            type="button"
            disabled={busy !== null}
            aria-busy={busy === "save" || undefined}
            onClick={() => save(false)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border-[1.5px] border-white/40 bg-white/10 px-4 text-[15px] font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={17} aria-hidden="true" /> {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <Button busy={busy === "send"} disabled={busy !== null} onClick={() => save(true)}>
            <Send size={17} aria-hidden="true" /> {isNewVersion ? "Send new version" : "Send proposal"}
          </Button>
        </ReceiveBar>
      )}
      {!declining && (
        <div className="-mt-2 flex justify-end">
          {onCancel ? (
            <button type="button" onClick={onCancel} className="px-2 py-2 text-[14px] font-semibold text-navy hover:underline">
              Cancel, keep version {Math.max(...brief.myQuotes.map((q) => q.version))}
            </button>
          ) : (
            !isNewVersion && (
              <button type="button" onClick={() => setDeclining(true)} className="px-2 py-2 text-[14px] font-semibold text-red-text hover:underline">
                Not for me
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- sent proposal

function SentProposal({ quote, lines, breakdown }: { quote: Quote; lines: QuoteLine[]; breakdown: PriceBreakdown | null }) {
  const pct = splitPct(lines.map((l) => Number(l.line_amount ?? 0)))
  const s = breakdown?.supplier
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-line/70 bg-white">
        {lines.map((l, i) => (
          <div key={l.id} className="flex items-center gap-3 border-b border-line/70 px-3 py-2.5 text-[14px] last:border-b-0">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[12px] font-bold text-navy">{i + 1}</span>
            <span className="min-w-0 flex-1 font-semibold text-navy">{l.description}</span>
            <span className="text-[12.5px] font-semibold text-muted">{pct[i]}%</span>
            <span className="w-24 text-right font-semibold text-navy">{rupees(Number(l.line_amount ?? 0))}</span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-navy-tint/60 px-4 py-2.5 text-[14px]">
          <span className="font-semibold text-navy">Total the startup sees{quote.discount_pct > 0 ? " (after the agreed price)" : ""}</span>
          <span className="font-display text-[18px] font-bold text-navy">{rupees(quote.total ?? 0)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[14px]">
        <Tile className="p-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Days</p>
          <p className="font-bold text-navy">{quote.lead_time_days ?? "–"}</p>
        </Tile>
        <Tile className="p-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Rounds of changes</p>
          <p className="font-bold text-navy">{quote.revision_rounds ?? "–"}</p>
        </Tile>
      </div>
      {quote.notes && (
        <Tile className="p-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Cover note</p>
          <p className="mt-0.5 whitespace-pre-line text-[14px] text-navy">{quote.notes}</p>
        </Tile>
      )}
      {s && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-navy px-4 py-3 text-white">
          <span className="text-[13.5px] text-white/80">
            You receive (after MPI commission {rupees(s.commission_invoice)})
          </span>
          <span className="font-display text-[22px] font-bold text-orange">{rupees(s.payout)}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- page

export default function BriefPage() {
  const { invitationId } = useParams()
  const me = useMe()
  const orgId = me.organisation.id
  const taxRate = me.organisation.gstin ? 18 : 0
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [toast, toastNode] = useToast()
  const now = useNow()

  const load = useCallback(async () => {
    try {
      const [briefs, mine, categories, skills, offers] = await Promise.all([
        listMyBriefs(orgId),
        getMyProviderProfile(orgId),
        listCategories(),
        listSkills(),
        listMyOffers(orgId),
      ])
      const brief = briefs.find((b) => b.invitation.id === invitationId)
      if (!brief) {
        setError("This brief was not found. It may have been closed.")
        return
      }
      const sent = brief.myQuotes.filter((q) => q.status !== "draft")
      const current = brief.myQuotes.find((q) => q.status === "submitted" || q.status === "accepted")
      const [lineList, breakdown] = await Promise.all([
        Promise.all(brief.myQuotes.map((q) => listQuoteLines(q.id))),
        current ? getPriceBreakdown(current.id).catch(() => null) : Promise.resolve(null),
      ])
      setData({
        brief,
        packages: mine?.packages ?? [],
        category: categories.find((c) => c.id === brief.request.category_id),
        skills,
        mySkillIds: new Set((mine?.skills ?? []).map((s) => s.skill_id)),
        offers: offers.filter((o) => o.request_id === brief.request.id),
        lines: new Map(brief.myQuotes.map((q, i) => [q.id, lineList[i]])),
        breakdown,
      })
      setVersion((v) => v ?? sent[0]?.id ?? null)
      document.title = `${brief.request.title} · MPI`
      setError(null)
      if (brief.invitation.status === "invited") void markInvitationViewed(brief.invitation.id).catch(() => undefined)
    } catch (err) {
      setError(errorText(err))
    }
  }, [orgId, invitationId])

  useEffect(() => {
    void load()
  }, [load])

  const start = useMemo<Form | null>(() => {
    if (!data) return null
    const { brief } = data
    const base = brief.myQuotes.find((q) => q.status === "draft") ?? brief.myQuotes.find((q) => q.status === "submitted") ?? null
    const baseLines = base ? (data.lines.get(base.id) ?? []) : []
    return {
      prices: brief.lines.map((l) => {
        const hit = baseLines.find((x) => x.request_line_id === l.id)
        return hit ? String(Number(hit.unit_price)) : ""
      }),
      days: base?.lead_time_days ? String(base.lead_time_days) : "",
      revisions: base?.revision_rounds ?? brief.request.revision_rounds ?? 2,
      packageId: base?.package_id ?? null,
      note: base?.notes && base.notes !== "Revised price agreed in negotiation" ? base.notes : "",
    }
  }, [data])

  if (!data || !start) {
    return error ? (
      <div>
        <BackLink />
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      </div>
    ) : (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-label="Loading">
        <div className="h-96 animate-pulse rounded-xl bg-page" />
        <div className="h-96 animate-pulse rounded-xl bg-page" />
      </div>
    )
  }

  const { brief } = data
  const { request } = brief
  const sent = brief.myQuotes.filter((q) => q.status !== "draft" && q.status !== "withdrawn")
  const current = brief.myQuotes.find((q) => q.status === "submitted" || q.status === "accepted") ?? null
  const openChange = brief.changes.find((c) => c.status === "open") ?? null
  const offer = data.offers.find((o) => o.status === "open" && timeLeftToReply(o, now) > 0 && o.quote_id === current?.id)
  const closed = brief.tab === "closed" || brief.tab === "won"
  const writing = !closed && (!current || editing || !!openChange)
  const shown = sent.find((q) => q.id === version) ?? current ?? sent[0] ?? null

  async function done(message: string) {
    toast(message)
    setEditing(false)
    setVersion(null)
    await load()
  }

  const status =
    brief.tab === "won" ? (
      <Chip tone="navy">
        <Trophy size={13} aria-hidden="true" /> Hired
      </Chip>
    ) : brief.invitation.status === "declined" ? (
      <Chip tone="red">Declined</Chip>
    ) : brief.tab === "closed" ? (
      <Chip tone="line">Closed</Chip>
    ) : current ? (
      <Chip tone="orange">Version {current.version} sent</Chip>
    ) : (
      <Chip tone="orange">Waiting for your proposal</Chip>
    )

  const replyMs = brief.replyBy.getTime() - now.getTime()

  return (
    <div>
      <BackLink />
      <div className="mt-3 mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {status}
            {data.category && <span className="rounded-full bg-navy-tint px-3 py-0.5 text-[12.5px] font-semibold text-navy">{data.category.name}</span>}
          </div>
          <h1 className="font-display text-[26px] font-bold leading-tight text-navy sm:text-[30px]">{request.title}</h1>
          <p className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-navy">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={15} className="text-muted" aria-hidden="true" />
              {request.needed_by ? `Needed by ${day(request.needed_by)} (${daysLeft(request.needed_by)})` : "Flexible date"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks size={15} className="text-muted" aria-hidden="true" />
              {brief.lines.length} deliverable{brief.lines.length === 1 ? "" : "s"}
            </span>
            {!current && !closed && (
              <span className={`inline-flex items-center gap-1.5 ${replyMs > 0 && replyMs < 86_400_000 ? "font-semibold text-red-text" : ""}`}>
                <Clock size={15} className="text-muted" aria-hidden="true" />
                {replyMs > 0 ? `Reply within ${timeLeftText(replyMs)}` : "Reply soon"}
              </span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-24">
          <BriefColumn data={data} />
        </div>

        <div className="min-w-0 space-y-5">
          {openChange && !closed && (
            <div className="flex items-start gap-3 rounded-xl border-[1.5px] border-orange bg-orange-tint px-4 py-3 text-[14px] text-navy">
              <MessageSquareText size={18} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" />
              <span>
                <strong>The startup asked for a change</strong> ({day(openChange.created_at)}):
                <span className="mt-0.5 block whitespace-pre-line">"{openChange.message}"</span>
                <span className="mt-1 block text-[13px] text-muted">Send a new version below. Your current version stays with the startup until then.</span>
              </span>
            </div>
          )}

          {offer && current && (
            <OfferReply offer={offer} quoteTotal={current.total ?? 0} used={data.offers.length} now={now} onDone={done} />
          )}

          <SectionPanel
            icon={writing ? Pencil : Send}
            title={writing ? (current ? `Version ${Math.max(...sent.map((q) => q.version), 0) + 1}` : "Your proposal") : "Your proposal"}
            subtitle={
              writing
                ? "The startup sees your anonymous name, the prices, days, rounds and note. Never your contact details."
                : brief.tab === "won"
                  ? "The startup hired you for this version."
                  : `Sent ${day(shown?.submitted_at ?? null) ?? ""}. Changes asked: ${brief.changes.length} of ${MAX_CHANGES}.`
            }
            aside={
              !writing && sent.length > 1 ? (
                <div role="tablist" aria-label="Versions" className="flex gap-1 rounded-lg bg-white p-1">
                  {[...sent].reverse().map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      role="tab"
                      aria-selected={shown?.id === q.id}
                      onClick={() => setVersion(q.id)}
                      className={`rounded-md px-3 py-1.5 text-[13px] font-bold ${shown?.id === q.id ? "bg-navy text-white" : "text-navy hover:bg-navy-tint"}`}
                    >
                      v{q.version}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
          >
            {writing ? (
              <ProposalForm key={openChange?.id ?? "form"} data={data} start={start} taxRate={taxRate} onDone={done} onCancel={current && !openChange ? () => setEditing(false) : undefined} />
            ) : shown ? (
              <>
                {shown.status === "superseded" && (
                  <p className="mb-3 flex items-center gap-2 text-[13.5px] text-muted">
                    <Info size={15} aria-hidden="true" /> An older version. The startup sees your latest one.
                  </p>
                )}
                <SentProposal quote={shown} lines={data.lines.get(shown.id) ?? []} breakdown={shown.id === current?.id ? data.breakdown : null} />
                {brief.changes.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Changes the startup asked for</p>
                    <ol className="space-y-2">
                      {brief.changes.map((c) => (
                        <li key={c.id} className="rounded-lg border border-line/70 bg-white px-3 py-2 text-[13.5px] text-navy">
                          <span className="text-muted">{day(c.created_at)} · </span>
                          {c.message}
                          {c.status === "answered" && <span className="ml-1 font-semibold text-[#047857]">Answered</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {!closed && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line/70 pt-4">
                    <Button variant="secondary" onClick={() => setEditing(true)}>
                      <Pencil size={16} aria-hidden="true" /> Send a new version
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="flex items-center gap-2 text-[14px] text-muted">
                <X size={16} aria-hidden="true" />
                {brief.decline ? `You declined this brief${brief.decline.reason ? `: "${brief.decline.reason}"` : "."}` : "No proposal was sent."}
              </p>
            )}
          </SectionPanel>
        </div>
      </div>
      {toastNode}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/supplier/requests" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy hover:underline">
      <ArrowLeft size={16} aria-hidden="true" /> Briefs
    </Link>
  )
}
