/**
 * Supplier: one request. Send a quote, see it once sent, and answer the
 * buyer's price offers.
 *
 * - Not quoted yet (or a draft / withdrawn quote): the quote form. One block
 *   per item with the MPI price guide, other charges, delivery days, valid
 *   until and notes (with voice). A navy total box on the right.
 * - Quote sent: the quote, what the supplier receives after MPI's
 *   commission, and the price offers with Accept / Suggest another price /
 *   Decline and the full history.
 *
 * The buyer's budget is never shown. Payment terms are set by MPI.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useLocation, useParams } from "react-router"
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  Clock,
  Handshake,
  History,
  Info,
  MapPin,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react"
import { useMe } from "../../app/session"
import { listCategories, type Category } from "../../services/data/catalogue"
import { getPriceBreakdown, getVolumeStatus, type PriceBreakdown } from "../../services/data/money"
import {
  listOffersForRequest,
  MAX_OFFERS_PER_QUOTE,
  offerStatus,
  respondToPrice,
  timeLeftToReply,
  type Offer,
} from "../../services/data/negotiation"
import { CHANCE_LABELS, chanceFor, getPriceGuide, type Chance, type PriceGuide } from "../../services/data/pricing"
import {
  createQuote,
  listMyInvitations,
  listQuoteLines,
  markInvitationViewed,
  replaceQuoteLines,
  submitQuote,
  updateDraftQuote,
  withdrawQuote,
  type InvitationWithRequest,
  type QuoteLine,
  type QuoteLineInput,
} from "../../services/data/quotes"
import Button from "../../ui/Button"
import VoiceTextArea from "../../ui/VoiceTextArea"
import { Alert, BOX, boxBorder } from "../../ui/form"
import { RequestSchemeChips } from "../schemes/parts"
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
  termsText,
  timeLeftText,
  useNow,
  useToast,
} from "./parts"
import { requestState } from "./requestState"

// ---------------------------------------------------------------- types

type ExtraType = "setup" | "testing" | "logistics" | "other"

interface ExtraRow {
  key: string
  lineType: ExtraType
  label: string
  hint?: string
  on: boolean
  amount: string
  preset: boolean
}

const PRESETS: Omit<ExtraRow, "on" | "amount">[] = [
  { key: "setup", lineType: "setup", label: "Tooling and setup", hint: "One-time dies, plates, moulds", preset: true },
  { key: "testing", lineType: "testing", label: "Testing and certificates", hint: "Lab tests, test reports", preset: true },
  { key: "logistics", lineType: "logistics", label: "Freight and delivery", hint: "Leave off if included in your price", preset: true },
]

const GST_RATES = [5, 12, 18, 28]
const EXTRA_GST = 18

interface ItemPrice {
  price: string
  tax: number
}

const num = (s: string) => {
  const n = Number(s.replace(/,/g, ""))
  return Number.isFinite(n) ? n : NaN
}

const isoIn = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------- small parts

function Panel({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)] ${className}`} style={GRADIENT_PANEL}>
      {children}
    </section>
  )
}

function SectionTitle({ n, title, hint, aside }: { n?: number; title: string; hint?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {n !== undefined && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy font-display text-[15px] font-bold text-orange">
            {n}
          </span>
        )}
        <div>
          <h2 className="font-display text-[18px] font-bold text-navy">{title}</h2>
          {hint && <p className="text-[13.5px] text-muted">{hint}</p>}
        </div>
      </div>
      {aside}
    </div>
  )
}

const CHANCE_TONE: Record<Chance, string> = {
  high: "bg-navy text-white",
  medium: "bg-orange-tint text-navy",
  low: "bg-red-tint text-red-text",
}

/** Low / usual / high bar with the typed price marked, and 3 suggested prices. */
function PriceGuideBox({ guide, price, onPick }: { guide: PriceGuide; price: number; onPick: (p: number) => void }) {
  const { band } = guide
  const span = band.high - band.low || 1
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - band.low) / span) * 100))}%`
  const has = Number.isFinite(price) && price > 0
  const chance = has ? chanceFor(band, price) : null
  return (
    <div className="mt-3 rounded-lg border border-line bg-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-navy">
          <Sparkles size={14} className="text-orange" aria-hidden="true" />
          MPI price guide, per {guide.unit}
        </p>
        <span className="text-[12px] font-semibold text-muted">
          {band.source === "past_quotes" ? `Based on ${band.basedOn ?? 0} past MPI prices` : "AI estimate"}
        </span>
      </div>

      <div className="relative mt-4 mb-1 h-2 rounded-full" style={{ background: "linear-gradient(90deg, #15233d, #f09a47, #db4230)" }}>
        <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white" style={{ left: pos(band.typical) }} aria-hidden="true" />
        {has && (
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-navy shadow"
            style={{ left: pos(price) }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex justify-between text-[12px] text-muted">
        <span>Low {rupees(band.low, true)}</span>
        <span>Usual {rupees(band.typical, true)}</span>
        <span>High {rupees(band.high, true)}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {guide.suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s.unitPrice)}
            className={`rounded-lg border-[1.5px] px-2 py-2 text-left transition-colors hover:border-orange ${
              has && Math.abs(price - s.unitPrice) < 0.005 ? "border-orange bg-orange-tint" : "border-line bg-page/60"
            }`}
          >
            <span className="block text-[12px] font-semibold text-muted">{s.label}</span>
            <span className="block font-display text-[15.5px] font-bold text-navy">{rupees(s.unitPrice, true)}</span>
            <span className="block text-[11.5px] font-semibold text-navy/80">
              {s.chancePct !== null ? `${s.chancePct}% win rate` : CHANCE_LABELS[s.chance]}
            </span>
          </button>
        ))}
      </div>

      {chance && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-navy">
          Your price:
          <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${CHANCE_TONE[chance]}`}>{CHANCE_LABELS[chance]} of winning</span>
        </p>
      )}
      {band.note && <p className="mt-2 text-[12.5px] text-muted">{band.note}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- header

function RequestHeader({ item, category }: { item: InvitationWithRequest; category: Category | undefined }) {
  const { request } = item
  const d = daysUntil(request.needed_by)
  const where = place(request.delivery_city, request.delivery_state)
  return (
    <div className="mb-6">
      <Link to="/supplier/requests" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> Requests for you
      </Link>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold leading-tight text-navy sm:text-[30px]">{request.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-[13.5px]">
            {category && <span className="rounded-full bg-navy-tint px-3 py-1 font-semibold text-navy">{category.name}</span>}
            {request.required_certifications.map((c) => (
              <span key={c} className="rounded-full border border-line bg-white px-3 py-1 font-semibold text-navy">
                Needs {c}
              </span>
            ))}
          </div>
          {(request.scheme_ids ?? []).length > 0 && (
            <div className="mt-3 max-w-2xl rounded-lg border-[1.5px] border-orange/60 bg-orange-tint/40 px-3.5 py-2.5 text-[13.5px] text-navy">
              <p className="mb-1.5 font-semibold">The startup plans to use these government schemes:</p>
              <RequestSchemeChips ids={request.scheme_ids} linkBase="/supplier/schemes" />
              <p className="mt-1.5 text-[12.5px] text-muted">Keep a proper GST invoice and any certificates these schemes ask for, so the startup can claim them.</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-navy px-4 py-3 text-white shadow-[0_3px_10px_rgba(21,35,61,0.2)]">
          <span className="btn-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-navy" aria-hidden="true">
            <Building2 size={19} />
          </span>
          <div className="text-[13.5px]">
            <p className="flex items-center gap-1.5 font-bold">
              {item.buyerName} <ShieldCheck size={14} className="text-orange" aria-label="Verified by MPI" />
            </p>
            <p className="flex flex-wrap items-center gap-x-3 text-white/80">
              {where && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} aria-hidden="true" />
                  {where}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 ${d !== null && d <= 7 ? "font-semibold text-orange" : ""}`}>
                <CalendarClock size={13} aria-hidden="true" />
                {request.needed_by ? `Needed by ${day(request.needed_by)} (${daysLeft(request.needed_by)})` : "Flexible date"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- quote form

interface FormProps {
  item: InvitationWithRequest
  guides: Map<string, PriceGuide | null>
  draftLines: QuoteLine[]
  draftQuoteId: string | null
  draft: { lead: number | null; validUntil: string | null; notes: string | null } | null
  terms: string
  volumePct: number
  onDone: (message: string) => Promise<void>
}

function QuoteForm({ item, guides, draftLines, draftQuoteId, draft, terms, volumePct, onDone }: FormProps) {
  const { lines } = item
  const [prices, setPrices] = useState<Record<string, ItemPrice>>(() =>
    Object.fromEntries(
      lines.map((l) => {
        const saved = draftLines.find((d) => d.request_line_id === l.id)
        return [l.id, { price: saved ? String(saved.unit_price) : "", tax: saved ? Number(saved.tax_rate) : 18 }]
      }),
    ),
  )
  const [extras, setExtras] = useState<ExtraRow[]>(() => {
    const others = draftLines.filter((d) => !d.request_line_id)
    const rows: ExtraRow[] = PRESETS.map((p) => {
      const saved = others.find((o) => o.line_type === p.lineType)
      return { ...p, on: !!saved, amount: saved ? String(Number(saved.unit_price) * Number(saved.quantity)) : "" }
    })
    const used = new Set(PRESETS.map((p) => others.find((o) => o.line_type === p.lineType)?.id).filter(Boolean))
    others
      .filter((o) => !used.has(o.id))
      .forEach((o) =>
        rows.push({
          key: o.id,
          lineType: "other",
          label: o.description,
          on: true,
          amount: String(Number(o.unit_price) * Number(o.quantity)),
          preset: false,
        }),
      )
    return rows
  })
  const [lead, setLead] = useState(draft?.lead ? String(draft.lead) : "")
  const [validUntil, setValidUntil] = useState(draft?.validUntil ?? isoIn(7))
  const [notes, setNotes] = useState(draft?.notes ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"send" | "save" | null>(null)

  const totals = useMemo(() => {
    let items = 0
    let gst = 0
    for (const l of lines) {
      const p = num(prices[l.id]?.price ?? "")
      if (Number.isFinite(p) && p > 0) {
        const base = p * Number(l.quantity)
        items += base
        gst += (base * (prices[l.id]?.tax ?? 18)) / 100
      }
    }
    let other = 0
    for (const e of extras) {
      const a = num(e.amount)
      if (e.on && Number.isFinite(a) && a > 0) {
        other += a
        gst += (a * EXTRA_GST) / 100
      }
    }
    return { items, other, gst, total: items + other + gst }
  }, [lines, prices, extras])

  function setPrice(id: string, patch: Partial<ItemPrice>) {
    setPrices((p) => ({ ...p, [id]: { ...p[id], ...patch } }))
    setErrors((e) => ({ ...e, [id]: "" }))
  }

  function setExtra(key: string, patch: Partial<ExtraRow>) {
    setExtras((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    setErrors((e) => ({ ...e, [key]: "" }))
  }

  function build(strict: boolean): QuoteLineInput[] | null {
    const errs: Record<string, string> = {}
    const out: QuoteLineInput[] = []
    for (const l of lines) {
      const p = num(prices[l.id]?.price ?? "")
      if (!Number.isFinite(p) || p <= 0) {
        if (strict) errs[l.id] = "Enter your price per " + l.unit
        continue
      }
      out.push({ requestLineId: l.id, lineType: "item", description: l.description, quantity: Number(l.quantity), unitPrice: p, taxRate: prices[l.id].tax })
    }
    for (const e of extras) {
      if (!e.on) continue
      const a = num(e.amount)
      if (!e.label.trim()) {
        errs[e.key] = "Name this charge"
        continue
      }
      if (!Number.isFinite(a) || a <= 0) {
        if (strict) errs[e.key] = "Enter the amount, or untick it"
        continue
      }
      out.push({ lineType: e.lineType, description: e.label.trim(), quantity: 1, unitPrice: a, taxRate: EXTRA_GST })
    }
    const leadN = lead ? Number(lead) : null
    if (strict && (!leadN || leadN < 1)) errs.lead = "How many days to deliver?"
    if (lead && (!Number.isInteger(Number(lead)) || Number(lead) < 1)) errs.lead = "Enter whole days, 1 or more"
    if (strict && !validUntil) errs.validUntil = "Pick a date"
    if (validUntil && daysUntil(validUntil)! < 0) errs.validUntil = "Pick today or a later date"
    setErrors(errs)
    return Object.values(errs).some(Boolean) ? null : out
  }

  async function save(send: boolean) {
    setFormError(null)
    const built = build(send)
    if (!built) {
      setFormError(send ? "Please fill in the marked fields." : "Please fix the marked fields.")
      return
    }
    setBusy(send ? "send" : "save")
    const fields = { leadTimeDays: lead ? Number(lead) : null, validUntil: validUntil || null, notes: notes.trim() || null }
    try {
      if (draftQuoteId) {
        await replaceQuoteLines(draftQuoteId, built)
        await updateDraftQuote(draftQuoteId, fields)
        if (send) await submitQuote(draftQuoteId)
      } else {
        await createQuote(item.invitation, { ...fields, lines: built }, send)
      }
      await onDone(send ? "Quote sent to the buyer" : "Draft saved")
    } catch (err) {
      setFormError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        {/* items */}
        <Panel>
          <div className="bg-gradient-to-br from-navy-tint via-navy-tint/60 to-orange-tint/50 px-5 py-4">
            <SectionTitle
              n={1}
              title="Price each item"
              hint="Prices are per piece, before GST."
              aside={<Chip tone="navy">{lines.length} item{lines.length === 1 ? "" : "s"}</Chip>}
            />
          </div>
          <div className="space-y-4 bg-white p-4 sm:p-5">
            {lines.map((l) => {
              const ip = prices[l.id]
              const p = num(ip?.price ?? "")
              const guide = guides.get(l.id)
              const specs = specsText(l.specs)
              return (
                <div key={l.id} className="rounded-xl border-[1.5px] border-line bg-page/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[16px] font-bold text-navy">{l.description}</h3>
                      {specs && <p className="mt-0.5 text-[13px] text-muted">{specs}</p>}
                    </div>
                    <div className="rounded-lg bg-navy px-3 py-1.5 text-right text-white">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white/70">Quantity</p>
                      <p className="font-display text-[16px] font-bold text-orange">{qty(l.quantity, l.unit)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`p-${l.id}`} className="mb-1.5 block text-sm font-semibold text-navy">
                        Your price per {l.unit} <span className="text-red-text">*</span>
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted">₹</span>
                        <input
                          id={`p-${l.id}`}
                          inputMode="decimal"
                          value={ip?.price ?? ""}
                          onChange={(e) => setPrice(l.id, { price: e.target.value.replace(/[^\d.]/g, "") })}
                          placeholder="0.00"
                          aria-invalid={errors[l.id] ? true : undefined}
                          className={`${BOX} ${boxBorder(errors[l.id])} min-h-12 pl-7 font-display text-[18px] font-bold`}
                        />
                      </div>
                      {errors[l.id] ? (
                        <p className="mt-1 text-[13px] font-medium text-red-text">{errors[l.id]}</p>
                      ) : (
                        <p className="mt-1 text-[13px] text-muted">
                          Line total{" "}
                          <strong className="text-navy">{Number.isFinite(p) && p > 0 ? rupees(p * Number(l.quantity)) : "₹0"}</strong> before GST
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-sm font-semibold text-navy">GST rate</p>
                      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`GST rate for ${l.description}`}>
                        {GST_RATES.map((r) => (
                          <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={ip?.tax === r}
                            onClick={() => setPrice(l.id, { tax: r })}
                            className={`min-h-12 rounded-md border-[1.5px] text-[15px] font-bold transition-colors ${
                              ip?.tax === r ? "border-navy bg-navy text-white" : "border-input bg-white text-navy hover:border-orange"
                            }`}
                          >
                            {r}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {guide ? (
                    <PriceGuideBox guide={guide} price={p} onPick={(v) => setPrice(l.id, { price: String(v) })} />
                  ) : guide === null ? (
                    <p className="mt-3 text-[13px] text-muted">No price guide for this item yet. Use your usual rate.</p>
                  ) : (
                    <p className="mt-3 text-[13px] text-muted">Loading the price guide…</p>
                  )}
                </div>
              )
            })}
          </div>
        </Panel>

        {/* other charges */}
        <Panel>
          <div className="bg-white p-4 sm:p-5">
            <SectionTitle n={2} title="Other charges" hint="Optional. Shown to the buyer as separate lines, with 18% GST." />
            <div className="mt-4 space-y-2.5">
              {extras.map((e) => (
                <div key={e.key} className={`rounded-lg border-[1.5px] px-3.5 py-3 ${e.on ? "border-orange bg-orange-tint/40" : "border-line bg-page/50"}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={e.on}
                        onChange={(ev) => setExtra(e.key, { on: ev.target.checked })}
                        className="h-5 w-5 shrink-0 accent-[#15233d]"
                      />
                      {e.preset ? (
                        <span className="min-w-0">
                          <span className="block text-[15px] font-semibold text-navy">{e.label}</span>
                          {e.hint && <span className="block text-[12.5px] text-muted">{e.hint}</span>}
                        </span>
                      ) : (
                        <input
                          value={e.label}
                          onChange={(ev) => setExtra(e.key, { label: ev.target.value })}
                          placeholder="Name of the charge"
                          aria-label="Name of the charge"
                          className={`${BOX} ${boxBorder()} min-h-10 text-[15px]`}
                        />
                      )}
                    </label>
                    <div className="relative w-36">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted">₹</span>
                      <input
                        inputMode="decimal"
                        aria-label={`Amount for ${e.label || "this charge"}`}
                        value={e.amount}
                        disabled={!e.on}
                        onChange={(ev) => setExtra(e.key, { amount: ev.target.value.replace(/[^\d.]/g, "") })}
                        placeholder="0"
                        className={`${BOX} ${boxBorder(errors[e.key])} min-h-10 pl-7 text-[15px] font-semibold disabled:bg-page`}
                      />
                    </div>
                    {!e.preset && (
                      <button
                        type="button"
                        aria-label="Remove this charge"
                        onClick={() => setExtras((rows) => rows.filter((r) => r.key !== e.key))}
                        className="rounded-md p-2 text-muted hover:bg-red-tint hover:text-red-text"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {errors[e.key] && <p className="mt-1.5 text-[13px] font-medium text-red-text">{errors[e.key]}</p>}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setExtras((rows) => [
                  ...rows,
                  { key: `c-${Date.now()}`, lineType: "other", label: "", on: true, amount: "", preset: false },
                ])
              }
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-md bg-navy-tint px-3 text-[14px] font-semibold text-navy hover:bg-orange-tint"
            >
              <Plus size={16} aria-hidden="true" /> Add another charge
            </button>
          </div>
        </Panel>

        {/* delivery and validity */}
        <Panel>
          <div className="bg-white p-4 sm:p-5">
            <SectionTitle n={3} title="Delivery and validity" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lead" className="mb-1.5 block text-sm font-semibold text-navy">
                  Days to deliver after the order <span className="text-red-text">*</span>
                </label>
                <input
                  id="lead"
                  inputMode="numeric"
                  value={lead}
                  onChange={(e) => {
                    setLead(e.target.value.replace(/\D/g, ""))
                    setErrors((er) => ({ ...er, lead: "" }))
                  }}
                  placeholder="e.g. 10"
                  className={`${BOX} ${boxBorder(errors.lead)} min-h-12`}
                />
                {errors.lead ? (
                  <p className="mt-1 text-[13px] font-medium text-red-text">{errors.lead}</p>
                ) : (
                  item.request.needed_by &&
                  lead && (
                    <p className="mt-1 text-[13px] text-muted">
                      Ready by about {day(isoIn(Number(lead)))}; needed by {day(item.request.needed_by)}.
                    </p>
                  )
                )}
              </div>
              <div>
                <label htmlFor="valid" className="mb-1.5 block text-sm font-semibold text-navy">
                  Price valid until <span className="text-red-text">*</span>
                </label>
                <input
                  id="valid"
                  type="date"
                  value={validUntil}
                  min={isoIn(0)}
                  onChange={(e) => {
                    setValidUntil(e.target.value)
                    setErrors((er) => ({ ...er, validUntil: "" }))
                  }}
                  className={`${BOX} ${boxBorder(errors.validUntil)} min-h-12`}
                />
                {errors.validUntil && <p className="mt-1 text-[13px] font-medium text-red-text">{errors.validUntil}</p>}
              </div>
            </div>
          </div>
        </Panel>

        {/* notes */}
        <Panel>
          <div className="bg-white p-4 sm:p-5">
            <SectionTitle n={4} title="Notes for the buyer" hint="Optional. Materials, samples, what's included." />
            <div className="mt-4">
              <VoiceTextArea
                label="Notes"
                value={notes}
                onChange={setNotes}
                placeholder="e.g. Includes a sample batch for approval before the full run."
              />
              <p className="mt-1 text-right text-[12px] text-muted">{notes.length} / 1000</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* total */}
      <aside className="h-fit space-y-4 lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-xl bg-navy text-white shadow-[0_6px_18px_rgba(21,35,61,0.25)]">
          <div className="accent-line h-1" />
          <div className="p-5">
            <h2 className="font-display text-[16px] font-bold">Your quote total</h2>
            <dl className="mt-4 space-y-2 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-white/75">Items</dt>
                <dd className="font-semibold">{rupees(totals.items)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/75">Other charges</dt>
                <dd className="font-semibold">{rupees(totals.other)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/75">GST</dt>
                <dd className="font-semibold">{rupees(totals.gst)}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-lg bg-white/10 px-4 py-3">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">Total incl. GST</p>
              <p className="font-display text-[30px] font-bold leading-tight text-orange">{rupees(totals.total)}</p>
            </div>

            {volumePct > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-orange/40 bg-orange/15 px-3 py-2.5 text-[13px]">
                <BadgeCheck size={16} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
                <span>
                  <strong>MPI volume rate {volumePct}%</strong> comes off your item prices when you send. You'll see the final total
                  right after.
                </span>
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 text-[13px] text-white/85">
              <Wallet size={16} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
              <span>
                <strong className="text-white">Payment, set by MPI:</strong> {terms}
              </span>
            </div>
            <div className="mt-2 flex items-start gap-2 text-[13px] text-white/85">
              <Info size={16} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
              <span>MPI's commission comes out of your payout. It is not added to the buyer's price.</span>
            </div>

            {formError && (
              <p className="mt-4 rounded-md bg-red-tint px-3 py-2 text-[13.5px] font-medium text-red-text" role="alert">
                {formError}
              </p>
            )}

            <div className="mt-4 space-y-2">
              <Button className="w-full" busy={busy === "send"} disabled={busy !== null} onClick={() => save(true)}>
                <Send size={17} aria-hidden="true" /> Send quote
              </Button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => save(false)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border-[1.5px] border-white/40 text-[15px] font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-60"
              >
                <Save size={16} aria-hidden="true" /> {busy === "save" ? "Saving…" : "Save draft"}
              </button>
            </div>
            <p className="mt-3 text-center text-[12px] text-white/60">You can withdraw a sent quote until the buyer accepts it.</p>
          </div>
        </div>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------- sent quote

function SentQuote({
  quote,
  lines,
  breakdown,
  canWithdraw,
  onWithdraw,
}: {
  quote: NonNullable<ReturnType<typeof requestState>["quote"]>
  lines: QuoteLine[]
  breakdown: PriceBreakdown | null
  canWithdraw: boolean
  onWithdraw: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const s = breakdown?.supplier
  const status =
    quote.status === "accepted"
      ? { chip: <Chip tone="navy"><BadgeCheck size={13} aria-hidden="true" />Won</Chip>, text: "The buyer accepted this quote. The order is in My orders." }
      : quote.status === "rejected"
        ? { chip: <Chip>Not chosen</Chip>, text: "The buyer chose another offer this time." }
        : { chip: <Chip tone="navy"><Send size={12} aria-hidden="true" />Sent</Chip>, text: `Sent ${ago(quote.submitted_at) ?? ""}. The buyer is comparing quotes.` }

  return (
    <Panel>
      <div className="bg-gradient-to-br from-navy-tint via-navy-tint/60 to-orange-tint/50 px-5 py-4">
        <SectionTitle title={`Your quote${quote.version > 1 ? `, version ${quote.version}` : ""}`} hint={status.text} aside={status.chip} />
      </div>
      <div className="bg-white p-4 sm:p-5">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[34rem] text-[14px]">
            <thead className="bg-navy text-left text-[12px] uppercase tracking-[0.05em] text-white">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Item</th>
                <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
                <th className="px-3 py-2.5 text-right font-semibold">Price</th>
                <th className="px-3 py-2.5 text-right font-semibold">GST</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} className={i % 2 ? "bg-page/60" : "bg-white"}>
                  <td className="px-3 py-2.5 font-semibold text-navy">{l.description}</td>
                  <td className="px-3 py-2.5 text-right text-navy">{Number(l.quantity).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5 text-right text-navy">{rupees(Number(l.unit_price), true)}</td>
                  <td className="px-3 py-2.5 text-right text-muted">{Number(l.tax_rate)}%</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-navy">{rupees(Number(l.quantity) * Number(l.unit_price))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <dl className="space-y-1.5 rounded-lg bg-page/70 p-4 text-[14px]">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-semibold text-navy">{rupees(quote.subtotal)}</dd></div>
            {quote.volume_discount_amount > 0 && (
              <div className="flex justify-between"><dt className="text-muted">MPI volume rate {quote.volume_discount_pct}%</dt><dd className="font-semibold text-navy">−{rupees(quote.volume_discount_amount)}</dd></div>
            )}
            {quote.discount_amount > 0 && (
              <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="font-semibold text-navy">−{rupees(quote.discount_amount)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-muted">GST</dt><dd className="font-semibold text-navy">{rupees(quote.tax_amount)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-bold text-navy">Buyer pays you</dt><dd className="font-display text-[18px] font-bold text-navy">{rupees(quote.total ?? 0)}</dd></div>
          </dl>
          <div className="rounded-lg bg-navy p-4 text-[14px] text-white">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">What you receive</p>
            {s ? (
              <>
                <p className="mt-1 font-display text-[26px] font-bold text-orange">{rupees(s.payout)}</p>
                <p className="text-[13px] text-white/75">
                  {rupees(s.invoice_total)} invoice minus MPI commission {rupees(s.commission_invoice)} (incl. GST)
                </p>
              </>
            ) : (
              <p className="mt-1 text-white/80">Shown once the quote is sent.</p>
            )}
            <p className="mt-3 flex items-start gap-2 text-[13px] text-white/85">
              <Wallet size={15} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
              {termsText(quote.payment_terms ?? breakdown?.payment_terms)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-navy">
          {quote.lead_time_days && <span><Clock size={14} className="mr-1 inline text-muted" aria-hidden="true" />Delivery in {quote.lead_time_days} days</span>}
          {quote.valid_until && <span><CalendarClock size={14} className="mr-1 inline text-muted" aria-hidden="true" />Valid until {day(quote.valid_until, true)}</span>}
        </div>
        {quote.notes && <p className="mt-3 rounded-lg border-l-4 border-orange bg-orange-tint/50 px-3 py-2 text-[14px] text-navy">{quote.notes}</p>}

        {canWithdraw && (
          <div className="mt-4 border-t border-line pt-3 text-[14px]">
            {!confirm ? (
              <button type="button" onClick={() => setConfirm(true)} className="font-semibold text-red-text hover:underline">
                Withdraw this quote
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 text-navy">
                Withdraw it? You can send a new one after.
                <Button
                  variant="danger"
                  className="min-h-9 px-3 text-[14px]"
                  busy={busy}
                  onClick={async () => {
                    setBusy(true)
                    await onWithdraw()
                    setBusy(false)
                    setConfirm(false)
                  }}
                >
                  Yes, withdraw
                </Button>
                <button type="button" onClick={() => setConfirm(false)} className="px-2 font-semibold text-muted hover:text-navy">
                  Cancel
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------- offers

function OfferReply({
  offer,
  quoteTotal,
  used,
  now,
  onDone,
}: {
  offer: Offer
  quoteTotal: number
  used: number
  now: Date
  onDone: (message: string) => Promise<void>
}) {
  const [mode, setMode] = useState<"accept" | "counter" | "decline" | null>(null)
  const [counter, setCounter] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const diff = offer.proposed_total - quoteTotal
  const pct = quoteTotal ? (diff / quoteTotal) * 100 : 0
  const left = Math.max(0, MAX_OFFERS_PER_QUOTE - used)
  const middle = Math.round((offer.proposed_total + quoteTotal) / 2)

  async function act(response: "accept" | "decline" | "counter") {
    setError(null)
    let counterTotal: number | undefined
    if (response === "counter") {
      counterTotal = num(counter)
      if (!Number.isFinite(counterTotal) || counterTotal <= 0) return setError("Enter your price.")
      if (counterTotal <= offer.proposed_total) return setError("Your price should be above the buyer's offer. To agree, accept it.")
      if (counterTotal >= quoteTotal) return setError("Your price should be below your current quote.")
    }
    setBusy(true)
    try {
      await respondToPrice(offer.id, response, { counterTotal, message: message.trim() || undefined })
      await onDone(
        response === "accept" ? "Offer accepted. Your quote is updated to the new price." : response === "counter" ? "Your price was sent to the buyer" : "Offer declined. Your quote stays as it was.",
      )
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const tile = (active: boolean) =>
    `flex flex-col items-start rounded-xl border-[1.5px] p-4 text-left transition-all hover:-translate-y-0.5 ${active ? "border-orange shadow-[0_6px_16px_rgba(240,154,71,0.25)]" : "border-line"}`

  return (
    <Panel id="offer">
      <div className="bg-gradient-to-br from-orange-tint via-orange-tint/60 to-navy-tint/60 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">Your reply is needed</p>
            <h2 className="font-display text-[26px] font-bold leading-tight text-navy">The buyer offers {rupees(offer.proposed_total)}</h2>
            <p className="text-[14px] text-muted">Total incl. GST, for your quote of {rupees(quoteTotal)}.</p>
          </div>
          <div className="rounded-lg bg-navy px-4 py-2.5 text-white">
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">
              <Clock size={13} aria-hidden="true" /> Time left to reply
            </p>
            <p className="font-display text-[20px] font-bold text-orange">{timeLeftText(timeLeftToReply(offer, now))}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-white p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-page/70 p-3.5">
            <p className="text-[12px] font-semibold text-muted">Your quote</p>
            <p className="font-display text-[20px] font-bold text-navy">{rupees(quoteTotal)}</p>
          </div>
          <div className="rounded-lg bg-orange-tint p-3.5">
            <p className="text-[12px] font-semibold text-muted">Buyer's offer</p>
            <p className="font-display text-[20px] font-bold text-navy">{rupees(offer.proposed_total)}</p>
          </div>
          <div className="rounded-lg bg-red-tint p-3.5">
            <p className="text-[12px] font-semibold text-muted">Difference</p>
            <p className="font-display text-[20px] font-bold text-red-text">
              {diff < 0 ? "−" : "+"}
              {rupees(Math.abs(diff))} <span className="text-[13px]">({pct.toFixed(1)}%)</span>
            </p>
          </div>
        </div>

        {offer.message && (
          <blockquote className="rounded-lg border-l-4 border-navy bg-navy-tint/60 px-4 py-3 text-[14.5px] italic text-navy">
            “{offer.message}”
            <span className="mt-1 block text-[12.5px] not-italic text-muted">Buyer, {ago(offer.created_at)}</span>
          </blockquote>
        )}

        <p className="flex items-center gap-2 rounded-lg bg-navy-tint/60 px-3.5 py-2.5 text-[13.5px] text-navy">
          <Handshake size={16} aria-hidden="true" />
          <strong>Offers used: {used} of {MAX_OFFERS_PER_QUOTE}.</strong> Each side has 24 hours to reply.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => setMode("accept")} className={`${tile(mode === "accept")} btn-gradient border-transparent text-navy`}>
            <span className="flex w-full items-center justify-between font-display text-[17px] font-bold">
              Accept {rupees(offer.proposed_total)} <Check size={18} aria-hidden="true" />
            </span>
            <span className="mt-1 text-[12.5px]">Your quote is reissued at this price.</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("counter")}
            disabled={left === 0}
            className={`${tile(mode === "counter")} bg-white disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="font-display text-[17px] font-bold text-navy">Suggest another price</span>
            <span className="mt-1 text-[12.5px] text-muted">{left === 0 ? "No offers left on this quote." : "Meet the buyer partway."}</span>
          </button>
          <button type="button" onClick={() => setMode("decline")} className={`${tile(mode === "decline")} bg-white`}>
            <span className="flex w-full items-center justify-between font-display text-[17px] font-bold text-red-text">
              Decline <X size={18} aria-hidden="true" />
            </span>
            <span className="mt-1 text-[12.5px] text-muted">Your quote stays at {rupees(quoteTotal)}.</span>
          </button>
        </div>

        {mode && (
          <div className="rounded-xl border-[1.5px] border-line bg-page/50 p-4">
            {mode === "counter" && (
              <div className="mb-4">
                <label htmlFor="counter" className="mb-1.5 block text-sm font-semibold text-navy">
                  Your price, total incl. GST
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted">₹</span>
                    <input
                      id="counter"
                      inputMode="decimal"
                      value={counter}
                      onChange={(e) => setCounter(e.target.value.replace(/[^\d.]/g, ""))}
                      className={`${BOX} ${boxBorder()} min-h-12 pl-7 font-display text-[18px] font-bold`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCounter(String(middle))}
                    className="min-h-10 rounded-full bg-navy-tint px-3 text-[13px] font-semibold text-navy hover:bg-orange-tint"
                  >
                    Meet halfway: {rupees(middle)}
                  </button>
                </div>
              </div>
            )}
            <VoiceTextArea
              label={mode === "accept" ? "Message to the buyer (optional)" : mode === "counter" ? "Why this price? (optional)" : "Reason (optional)"}
              value={message}
              onChange={setMessage}
              rows={3}
              placeholder={mode === "counter" ? "e.g. This includes free plate setup for repeat orders." : "A short note for the buyer"}
            />
            {error && <p className="mt-2 text-[13.5px] font-medium text-red-text" role="alert">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant={mode === "decline" ? "danger" : "primary"}
                busy={busy}
                onClick={() => act(mode)}
              >
                {mode === "accept" ? `Confirm, accept ${rupees(offer.proposed_total)}` : mode === "counter" ? "Send my price" : "Confirm decline"}
              </Button>
              <Button variant="ghost" onClick={() => { setMode(null); setError(null) }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

const OFFER_STATUS: Record<Offer["status"], { label: string; tone: "navy" | "orange" | "red" | "line" }> = {
  open: { label: "Waiting for reply", tone: "orange" },
  accepted: { label: "Accepted", tone: "navy" },
  declined: { label: "Declined", tone: "red" },
  countered: { label: "Countered", tone: "line" },
  withdrawn: { label: "Withdrawn", tone: "line" },
  expired: { label: "Expired", tone: "line" },
}

function OfferHistory({ offers, firstQuote, now }: { offers: Offer[]; firstQuote: { total: number; at: string | null } | null; now: Date }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={GRADIENT_PANEL}>
      <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-navy">
        <History size={17} className="text-orange" aria-hidden="true" /> Offer history
      </h2>
      <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
        {firstQuote && (
          <li className="relative">
            <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-navy" aria-hidden="true" />
            <p className="text-[12.5px] font-semibold text-muted">Your first quote · {day(firstQuote.at)}</p>
            <p className="font-display text-[17px] font-bold text-navy">{rupees(firstQuote.total)}</p>
          </li>
        )}
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
                  {o.proposed_by === "buyer" ? "Buyer's offer" : "Your price"} · {day(o.created_at)}
                </p>
                <Chip tone={st.tone}>{st.label}</Chip>
              </div>
              <p className="font-display text-[17px] font-bold text-navy">{rupees(o.proposed_total)}</p>
              {o.message && <p className="text-[13px] italic text-muted">“{o.message}”</p>}
              {o.response_message && <p className="mt-1 text-[13px] text-navy">Reply: {o.response_message}</p>}
            </li>
          )
        })}
      </ol>
      {offers.length === 0 && <p className="mt-3 text-[13.5px] text-muted">No price offers yet. The buyer can ask for a lower price up to 3 times.</p>}
    </section>
  )
}

// ---------------------------------------------------------------- page

interface Loaded {
  item: InvitationWithRequest
  offers: Offer[]
  category: Category | undefined
  lines: QuoteLine[]
  breakdown: PriceBreakdown | null
  volumePct: number
  firstQuote: { total: number; at: string | null } | null
}

export default function QuotePage() {
  const { invitationId } = useParams()
  const me = useMe()
  const orgId = me.organisation.id
  const location = useLocation()
  const [data, setData] = useState<Loaded | null>(null)
  const [guides, setGuides] = useState<Map<string, PriceGuide | null>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [toast, toastNode] = useToast()
  const now = useNow()

  const load = useCallback(async () => {
    try {
      const all = await listMyInvitations(orgId)
      const item = all.find((i) => i.invitation.id === invitationId)
      if (!item) {
        setNotFound(true)
        return
      }
      const [offers, cats, volume] = await Promise.all([
        listOffersForRequest(item.request.id),
        listCategories(),
        getVolumeStatus().catch(() => []),
      ])
      const state = requestState(item, offers)
      const quote = state.quote
      const [lines, breakdown] = await Promise.all([
        quote ? listQuoteLines(quote.id) : Promise.resolve([]),
        quote && quote.status !== "draft" && quote.status !== "withdrawn" ? getPriceBreakdown(quote.id).catch(() => null) : Promise.resolve(null),
      ])
      const sentVersions = item.myQuotes.filter((q) => q.submitted_at).sort((a, b) => a.version - b.version)
      setData({
        item,
        offers,
        category: cats.find((c) => c.id === item.request.category_id),
        lines,
        breakdown,
        volumePct: volume.find((v) => v.category_id === item.request.category_id)?.current_pct ?? 0,
        firstQuote: sentVersions[0] ? { total: sentVersions[0].total ?? 0, at: sentVersions[0].submitted_at } : null,
      })
      setError(null)
      if (item.invitation.status === "invited") void markInvitationViewed(item.invitation.id).catch(() => undefined)
    } catch (err) {
      setError(errorText(err))
    }
  }, [orgId, invitationId])

  useEffect(() => {
    void load()
  }, [load])

  // Price guides load one by one in the background; a missing guide just hides.
  const lineIds = data?.item.lines.map((l) => l.id).join(",")
  useEffect(() => {
    if (!lineIds) return
    let alive = true
    lineIds.split(",").forEach((id) => {
      getPriceGuide(id)
        .then((g) => alive && setGuides((m) => new Map(m).set(id, g)))
        .catch(() => alive && setGuides((m) => new Map(m).set(id, null)))
    })
    return () => {
      alive = false
    }
  }, [lineIds])

  useEffect(() => {
    if (data && location.hash === "#offer") document.getElementById("offer")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [data, location.hash])

  async function done(message: string) {
    toast(message)
    await load()
    setFormKey((k) => k + 1)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (notFound) {
    return (
      <div className="py-16 text-center">
        <p className="text-[18px] font-semibold text-navy">This request isn't available to you.</p>
        <Link to="/supplier/requests" className="mt-3 inline-block font-semibold text-navy underline">
          Back to Requests for you
        </Link>
      </div>
    )
  }
  if (!data) {
    return error ? <Alert>{error}</Alert> : <p className="py-16 text-center text-muted">Loading the request…</p>
  }

  const { item, offers, category, lines, breakdown, volumePct, firstQuote } = data
  const state = requestState(item, offers, now)
  const quote = state.quote
  const terms = termsText(quote?.payment_terms ?? category?.payment_terms)
  const editing = !quote || quote.status === "draft" || quote.status === "withdrawn"
  const closed = ["ordered", "cancelled"].includes(item.request.status)
  const usedOnQuote = quote ? offers.filter((o) => o.quote_id === quote.id || o.revised_quote_id === quote.id).length : 0

  return (
    <div>
      <RequestHeader item={item} category={category} />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {editing ? (
        closed ? (
          <Alert tone="info">This request is closed, so no quote is needed.</Alert>
        ) : (
          <>
            {quote?.status === "withdrawn" && (
              <div className="mb-4">
                <Alert tone="info">You withdrew your last quote. Your prices are filled in below so you can send a new one.</Alert>
              </div>
            )}
            {quote?.status === "draft" && (
              <div className="mb-4">
                <Alert tone="info">Draft saved {ago(quote.updated_at)}. The buyer can't see it until you send it.</Alert>
              </div>
            )}
            <QuoteForm
              key={`${formKey}-${quote?.id ?? "new"}`}
              item={item}
              guides={guides}
              draftLines={lines}
              draftQuoteId={quote?.status === "draft" ? quote.id : null}
              draft={quote ? { lead: quote.lead_time_days, validUntil: quote.valid_until, notes: quote.notes } : null}
              terms={terms}
              volumePct={volumePct}
              onDone={done}
            />
          </>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            {state.openOffer && quote && (
              <OfferReply offer={state.openOffer} quoteTotal={quote.total ?? 0} used={Math.max(usedOnQuote, 1)} now={now} onDone={done} />
            )}
            {quote && (
              <SentQuote
                quote={quote}
                lines={lines}
                breakdown={breakdown}
                canWithdraw={quote.status === "submitted" && !state.openOffer}
                onWithdraw={async () => {
                  try {
                    await withdrawQuote(quote.id)
                    await done("Quote withdrawn")
                  } catch (err) {
                    setError(errorText(err))
                  }
                }}
              />
            )}
          </div>
          <aside className="h-fit space-y-4 lg:sticky lg:top-24">
            <OfferHistory offers={offers} firstQuote={firstQuote} now={now} />
          </aside>
        </div>
      )}
      {toastNode}
    </div>
  )
}
