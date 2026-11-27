/**
 * Admin: Price offers and activity (/admin/activity).
 *
 * MPI watches negotiations and steps in only when needed (decided 27 Oct).
 * - Top: the average saving from negotiation, and one bar split into Live,
 *   Accepted and Expired or declined. Clicking a part of the bar filters the
 *   price offers.
 * - Price offers tab: one row per startup–supplier negotiation with the offer
 *   chain (who offered each price), status and the 24-hour countdown. A row
 *   opens to show each offer.
 * - Activity log tab: who did what and when, in plain words, by day, colour
 *   coded by kind. A row opens to show its details.
 * The page refreshes itself every minute.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Handshake,
  History,
  Search,
  Settings2,
  Timer,
  TrendingDown,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react"
import type { Tables } from "../../lib/database.types"
import { listActivity, listNegotiationThreads, PAYMENT_TERMS_LABELS, type ActivityEntry, type NegotiationThread, type PaymentTerms } from "../../services/data/admin"
import { MAX_OFFERS_PER_QUOTE, offerStatus, timeLeftToReply } from "../../services/data/negotiation"
import { Alert, BOX, boxBorder } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { Panel } from "../overview/parts"
import { errorText, rupees, SOFT_BG, TabBar, timeLeftText, useNow } from "../supplier/parts"

type Offer = Tables<"quote_negotiations">
type State = "live" | "accepted" | "closed"
type Filter = "all" | State
type Tab = "offers" | "activity"

const REFRESH_MS = 60_000

const STATES: { id: State; label: string; color: string; text: string }[] = [
  { id: "live", label: "Live", color: "linear-gradient(90deg, #f09a47, #ec8d49)", text: "waiting for a reply" },
  { id: "accepted", label: "Accepted", color: "#15967b", text: "price agreed" },
  { id: "closed", label: "Expired or declined", color: "#7d8799", text: "no deal on price" },
]

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
const fmtWhen = (iso: string) => `${new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${fmtTime(iso)}`

/** Where a negotiation stands now. A counter-offer waiting for a reply is live. */
function threadState(t: NegotiationThread, now: Date): State {
  const s = offerStatus(t.offers[t.offers.length - 1], now)
  return s === "open" ? "live" : s === "accepted" ? "accepted" : "closed"
}

/** The agreed price and the saving, for an accepted negotiation. */
function saving(t: NegotiationThread): { amount: number; pct: number; final: number } | null {
  const last = t.offers[t.offers.length - 1]
  if (last.status !== "accepted" || !t.startTotal) return null
  const amount = t.startTotal - last.proposed_total
  return { amount, pct: (amount / t.startTotal) * 100, final: last.proposed_total }
}

const sideName = (o: Offer) => (o.proposed_by === "buyer" ? "Startup" : "Supplier")

/** A row of pill buttons where the selected one has a sliding gradient behind it. */
function Pills<T extends string>({ id, items, value, onChange, round = false }: { id: string; items: { id: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; round?: boolean }) {
  return (
    <span className={`inline-flex flex-wrap gap-1 ${round ? "" : "rounded-lg bg-page p-0.5"}`} role="group" aria-label="Show">
      {items.map((it) => {
        const on = it.id === value
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.id)}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1 text-[13px] font-bold transition-colors ${round ? "rounded-full border" : "rounded-md"} ${
              on ? "border-transparent text-navy" : round ? "border-line bg-white text-navy hover:border-navy/40" : "text-muted hover:text-navy"
            }`}
          >
            {on && (
              <motion.span
                layoutId={`pill-${id}`}
                className={`btn-gradient absolute inset-0 shadow-sm ${round ? "rounded-full" : "rounded-md"}`}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                aria-hidden="true"
              />
            )}
            {it.icon && <it.icon size={14} className="relative" aria-hidden="true" />}
            <span className="relative">{it.label}</span>
          </button>
        )
      })}
    </span>
  )
}

// ---------------------------------------------------------------- top: saving + status bar

function Pulse({ threads, now, filter, onPick }: { threads: NegotiationThread[]; now: Date; filter: Filter; onPick: (f: Filter) => void }) {
  const counts = { live: 0, accepted: 0, closed: 0 }
  for (const t of threads) counts[threadState(t, now)]++
  const deals = threads.map(saving).filter((s): s is NonNullable<typeof s> => !!s)
  const avg = deals.length ? deals.reduce((a, d) => a + d.pct, 0) / deals.length : null
  const total = deals.reduce((a, d) => a + d.amount, 0)
  const all = threads.length

  return (
    <section className="rise-in mb-6 grid overflow-hidden rounded-xl border-[1.5px] border-line md:grid-cols-3" style={{ background: SOFT_BG }}>
      <div className="flex flex-col justify-center border-b border-line px-5 py-5 md:col-span-1 md:border-b-0 md:border-r">
        <span className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-muted">
          <TrendingDown size={15} aria-hidden="true" /> Average saving from negotiation
        </span>
        <span className="mt-1 font-display text-[44px] font-bold leading-none text-navy">{avg == null ? "–" : `${avg.toFixed(1)}%`}</span>
        <span className="mt-2 text-[14px] text-navy">
          {deals.length ? (
            <>
              <b>{rupees(total)}</b> saved on {deals.length} agreed price{deals.length === 1 ? "" : "s"}
            </>
          ) : (
            "No price agreed yet"
          )}
        </span>
      </div>

      <div className="px-5 py-5 md:col-span-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14.5px] font-bold text-navy">
            {all} negotiation{all === 1 ? "" : "s"}
          </span>
          {filter !== "all" && (
            <button type="button" onClick={() => onPick("all")} className="text-[13px] font-semibold text-navy underline">
              Show all
            </button>
          )}
        </div>
        <div className="mt-3 flex h-4 w-full gap-1 overflow-hidden rounded-full bg-white" role="group" aria-label="Filter by status">
          {all === 0 ? (
            <span className="h-full w-full rounded-full bg-page" />
          ) : (
            STATES.filter((s) => counts[s.id] > 0).map((s) => (
              <motion.button
                key={s.id}
                type="button"
                aria-label={`${s.label}: ${counts[s.id]}`}
                aria-pressed={filter === s.id}
                onClick={() => onPick(filter === s.id ? "all" : s.id)}
                initial={{ flexGrow: 0.001 }}
                animate={{ flexGrow: counts[s.id], opacity: filter === "all" || filter === s.id ? 1 : 0.35 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full basis-0 first:rounded-l-full last:rounded-r-full"
                style={{ background: s.color, minWidth: 10 }}
              />
            ))
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {STATES.map((s) => {
            const on = filter === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(on ? "all" : s.id)}
                aria-pressed={on}
                className={`self-start rounded-lg px-2.5 py-2 text-left transition-colors ${on ? "bg-white shadow-sm ring-[1.5px] ring-navy" : "hover:bg-white/70"}`}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-navy">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </span>
                <span className="mt-0.5 block font-display text-[22px] font-bold leading-tight text-navy">{counts[s.id]}</span>
                <span className="block text-[12px] text-muted">{s.text}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- price offers

function StatusTag({ state, children }: { state: State; children: ReactNode }) {
  const cls = state === "live" ? "bg-orange-tint text-navy" : state === "accepted" ? "bg-[#ecfdf5] text-[#047857]" : "bg-page text-muted"
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold ${cls}`}>{children}</span>
}

/** One price in the chain, with who offered it underneath. */
function PriceStep({ amount, who, tone, struck = false }: { amount: number; who: string; tone: "quote" | "buyer" | "vendor" | "accepted"; struck?: boolean }) {
  const style =
    tone === "accepted" ? { background: "#ecfdf5", color: "#047857" } : tone === "buyer" ? { background: "#e8ecf3", color: "#15233d" } : tone === "vendor" ? { background: "#fdebd9", color: "#15233d" } : { background: "#ffffff", color: "#4b5567" }
  return (
    <span className="inline-flex flex-col items-center">
      <span className={`rounded-md px-2 py-0.5 text-[13px] font-bold ${struck ? "line-through decoration-1" : ""}`} style={style}>
        {rupees(amount)}
      </span>
      <span className="mt-0.5 font-semibold uppercase tracking-wide text-muted" style={{ fontSize: 10.5 }}>
        {who}
      </span>
    </span>
  )
}

function OfferChain({ t }: { t: NegotiationThread }) {
  return (
    <span className="flex flex-wrap items-start gap-1.5">
      {t.startTotal != null && <PriceStep amount={t.startTotal} who="Quote" tone="quote" struck />}
      {t.offers.map((o, i) => (
        <span key={o.id} className="contents">
          {(i > 0 || t.startTotal != null) && <ArrowRight size={13} className="mt-1.5 text-muted" aria-hidden="true" />}
          <PriceStep
            amount={o.proposed_total}
            who={`${sideName(o)}${i > 0 ? " counter" : ""}`}
            tone={o.status === "accepted" ? "accepted" : o.proposed_by === "buyer" ? "buyer" : "vendor"}
          />
        </span>
      ))}
    </span>
  )
}

const offerOutcome: Record<Offer["status"], string> = {
  open: "Waiting for a reply",
  accepted: "Accepted",
  declined: "Declined",
  countered: "Countered",
  withdrawn: "Withdrawn",
  expired: "Expired with no reply",
}

function ThreadRow({ t, now, open, onToggle }: { t: NegotiationThread; now: Date; open: boolean; onToggle: () => void }) {
  const state = threadState(t, now)
  const last = t.offers[t.offers.length - 1]
  const s = saving(t)
  const left = timeLeftToReply(last, now)
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full gap-2 px-4 py-3 text-left hover:bg-page/40 md:grid-cols-12 md:items-center">
        <span className="min-w-0 md:col-span-4">
          <span className="block truncate text-[14.5px] font-bold text-navy">{t.requestTitle}</span>
          <span className="block truncate text-[12.5px] text-muted">
            {t.buyerName} <span aria-hidden="true">→</span> {t.supplierName}
          </span>
        </span>
        <span className="md:col-span-5">
          <OfferChain t={t} />
        </span>
        <span className="flex items-center justify-between gap-2 md:col-span-3 md:justify-end">
          <span className="md:text-right">
            {state === "live" && (
              <StatusTag state="live">
                <Timer size={12} aria-hidden="true" /> {last.proposed_by === "buyer" ? "Supplier" : "Startup"} to reply · {timeLeftText(left)}
              </StatusTag>
            )}
            {state === "accepted" && <StatusTag state="accepted">{s ? `Saved ${rupees(s.amount)} · ${s.pct.toFixed(1)}%` : "Accepted"}</StatusTag>}
            {state === "closed" && <StatusTag state="closed">{offerOutcome[offerStatus(last, now)]}</StatusTag>}
            <span className="mt-0.5 block text-[12px] text-muted">
              {t.offers.length} of {MAX_OFFERS_PER_QUOTE} offers
            </span>
          </span>
          <ChevronDown size={17} className={`shrink-0 text-navy transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="overflow-hidden"
        aria-hidden={!open}
      >
        <div className="border-t border-line px-4 py-3" style={{ background: "#f7f8fa" }}>
          <ol className="space-y-2">
            {t.offers.map((o, i) => (
              <li key={o.id} className="flex gap-3 text-[13.5px]">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-navy" style={{ background: o.proposed_by === "buyer" ? "#e8ecf3" : "#fdebd9" }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-navy">
                    <b>{o.proposed_by === "buyer" ? t.buyerName : t.supplierName}</b> ({sideName(o).toLowerCase()}) offered <b>{rupees(o.proposed_total)}</b>
                    <span className="text-muted"> · {fmtWhen(o.created_at)}</span>
                  </span>
                  {o.message && <span className="block text-muted">“{o.message}”</span>}
                  <span className="block text-[12.5px] font-semibold text-navy">
                    {offerOutcome[offerStatus(o, now)]}
                    {o.responded_at && o.status !== "open" ? ` · ${fmtWhen(o.responded_at)}` : ""}
                    {o.response_message ? <span className="font-normal text-muted"> · “{o.response_message}”</span> : null}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <Link to={`/admin/matches?r=${t.requestId}&list=all`} tabIndex={open ? 0 : -1} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-navy underline">
            Open the request <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </motion.div>
    </li>
  )
}

function OffersTab({ threads, now, filter, setFilter }: { threads: NegotiationThread[]; now: Date; filter: Filter; setFilter: (f: Filter) => void }) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return threads
      .filter((t) => filter === "all" || threadState(t, now) === filter)
      .filter((t) => !q || [t.requestTitle, t.buyerName, t.supplierName].some((x) => x.toLowerCase().includes(q)))
  }, [threads, filter, query, now])

  return (
    <>
      <div className="flex flex-col gap-3 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="relative w-full sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests or companies" aria-label="Search price offers" className={`${BOX} ${boxBorder()} min-h-9 pl-9 text-[14px]`} />
        </div>
        <Pills
          id="offers"
          value={filter}
          onChange={setFilter}
          items={[{ id: "all" as Filter, label: "All" }, ...STATES.map((s) => ({ id: s.id as Filter, label: s.label }))]}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={filter} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {shown.length === 0 ? (
            <p className="px-5 py-8 text-center text-[14px] text-muted">{threads.length ? "No price offers match." : "No price offers yet. They show here as soon as a startup asks for a lower price."}</p>
          ) : (
            <ul className="space-y-2 px-4 pb-4 pt-3 sm:px-5">
              {shown.map((t) => (
                <ThreadRow key={t.key} t={t} now={now} open={open === t.key} onToggle={() => setOpen(open === t.key ? null : t.key)} />
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

// ---------------------------------------------------------------- activity log

type Kind = "requests" | "offers" | "orders" | "admin"
const KINDS: { id: Kind; label: string; icon: LucideIcon }[] = [
  { id: "requests", label: "Requests and matches", icon: ClipboardList },
  { id: "offers", label: "Quotes and offers", icon: Handshake },
  { id: "orders", label: "Orders and payments", icon: Truck },
  { id: "admin", label: "Suppliers and settings", icon: Settings2 },
]

function kindOf(action: string): Kind {
  if (action.startsWith("rfq.") || action.startsWith("request.") || action.startsWith("match.")) return "requests"
  if (action === "quote.submitted" || action.startsWith("negotiation.")) return "offers"
  if (action === "quote.approved" || action.startsWith("order") || action.startsWith("payment") || action.startsWith("payout")) return "orders"
  return "admin"
}

/** Icon and colours for an entry, so AI steps, money, alerts and settings stand apart. */
function lookOf(action: string): { icon: LucideIcon; bg: string; fg: string; tag: string } {
  if (action === "request.matched") return { icon: Bot, bg: "#e3edf9", fg: "#1f5fa8", tag: "AI" }
  if (action.startsWith("payment") || action.startsWith("payout") || action === "quote.approved" || action === "negotiation.accept")
    return { icon: CreditCard, bg: "#ecfdf5", fg: "#047857", tag: "Money" }
  if (["negotiation.expired", "negotiation.decline", "negotiation.withdraw", "match.rejected", "order.return"].includes(action))
    return { icon: TriangleAlert, bg: "#fde8e4", fg: "#b8331f", tag: "Alert" }
  if (action.startsWith("settings.") || action === "demo.reset" || action === "vendor.verification") return { icon: Settings2, bg: "#eef1f5", fg: "#4b5567", tag: "Admin" }
  const k = KINDS.find((x) => x.id === kindOf(action)) ?? KINDS[3]
  return { icon: k.icon, bg: "#e8ecf3", fg: "#15233d", tag: "" }
}

const rec = (d: unknown): Record<string, unknown> => (d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {})
const num = (d: unknown, k: string): number | null => {
  const v = rec(d)[k]
  return typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null
}
const str = (d: unknown, k: string): string | null => {
  const v = rec(d)[k]
  return typeof v === "string" ? v : null
}
const words = (s: string) => s.replace(/[_.]/g, " ")

/** The entry in plain words. */
function sentence(a: ActivityEntry): ReactNode {
  const d = a.entry.details
  const who = <b>{a.orgName ?? "MPI"}</b>
  const subject = <b>{a.subjectName ?? "a supplier"}</b>
  const total = num(d, "total")
  const money = total != null ? <b>{rupees(total)}</b> : null
  switch (a.entry.action) {
    case "rfq.invited":
      return <>{subject} was invited to quote on a request</>
    case "request.matched":
      return <>AI suggested {num(d, "suggested") ?? "some"} suppliers for a new request</>
    case "match.approved":
      return <>{who} approved {subject} for a request</>
    case "match.rejected":
      return <>{who} turned down {subject} for a request</>
    case "quote.submitted":
      return <>{who} sent a quote{money && <> of {money}</>}</>
    case "negotiation.proposed":
      return <>{who} asked for a lower price{money && <> of {money}</>}</>
    case "negotiation.accept":
      return <>{who} accepted the price{money && <> of {money}</>}</>
    case "negotiation.counter":
      return <>{who} countered{money && <> with {money}</>}</>
    case "negotiation.decline":
      return <>{who} declined the price offer{money && <> of {money}</>}</>
    case "negotiation.withdraw":
      return <>{who} withdrew a price offer</>
    case "negotiation.expired":
      return <>A price offer{money && <> of {money}</>} expired with no reply</>
    case "quote.approved":
      return <>{who} approved a quote and placed an order{money && <> of {money}</>}</>
    case "order.status":
      return <>{who} moved an order to <b>{words(str(d, "to") ?? "a new step")}</b></>
    case "order.return":
      return <>{who} recorded a return of {num(d, "units") ?? "some"} units</>
    case "payment.simulated": {
      const paid = (num(d, "to_mpi") ?? 0) + (num(d, "to_supplier") ?? 0)
      return <>{who} paid {paid ? <b>{rupees(paid)}</b> : "for an order"} (sample payment)</>
    }
    case "payout.simulated":
      return <>MPI paid out {num(d, "net") != null ? <b>{rupees(num(d, "net") ?? 0)}</b> : "money"} to a supplier (sample payout)</>
    case "order_message_sent":
      return <>{who} sent a message about an order</>
    case "vendor.verification":
      return <>{who} marked {subject} as <b>{words(str(d, "status") ?? "reviewed")}</b></>
    case "settings.payment_terms":
      return <>{who} changed payment terms</>
    case "settings.fee_rule":
      return <>{who} changed a fee rule</>
    case "settings.rate_card":
      return <>{who} changed a supplier rate card</>
    case "demo.reset":
      return <>{who} reset the demo workspace</>
    default:
      return <>{who}: {words(a.entry.action)}</>
  }
}

const MONEY_KEYS: Record<string, string> = {
  total: "Amount",
  to_mpi: "Paid to MPI",
  to_supplier: "Paid to supplier",
  gross: "Before commission",
  commission: "MPI commission",
  net: "Paid out",
  supplier_credit: "Supplier credit",
  fee_reversal: "Fee returned",
  commission_reversal: "Commission returned",
}
const HIDDEN_KEYS = new Set(["key", "negotiation_id", "request_id", "quote_id", "category_id", "vendor_org_id", "orgs"])

/** The entry's saved details as label / value pairs. */
function detailRows(a: ActivityEntry): [string, string][] {
  const out: [string, string][] = []
  const d = rec(a.entry.details)
  if (a.subjectName) out.push(["Company", a.subjectName])
  for (const [k, v] of Object.entries(d)) {
    if (HIDDEN_KEYS.has(k) || v == null || v === "") continue
    if (k in MONEY_KEYS && num(d, k) != null) out.push([MONEY_KEYS[k], rupees(num(d, k) ?? 0)])
    else if (k === "payment_terms") out.push(["New terms", PAYMENT_TERMS_LABELS[v as PaymentTerms] ?? "Platform default"])
    else if (k === "score") out.push(["Match score", `${v} / 100`])
    else if (k === "from") out.push(["From", words(String(v))])
    else if (k === "to") out.push(["To", words(String(v))])
    else if (k === "suggested") out.push(["Suppliers suggested", String(v)])
    else if (typeof v === "string" || typeof v === "number") out.push([words(k).replace(/^./, (c) => c.toUpperCase()), words(String(v))])
  }
  if (a.entry.action === "settings.payment_terms" && !("payment_terms" in d && d.payment_terms)) out.push(["New terms", "Back to the platform default"])
  out.push(["By", a.actorName ? `${a.actorName}${a.orgName ? ` (${a.orgName})` : ""}` : "Automatic"])
  out.push(["When", new Date(a.entry.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })])
  return out
}

/** Where to look at what the entry is about. */
function detailLink(a: ActivityEntry): { to: string; label: string } | null {
  const e = a.entry
  const requestId = e.entity_type === "request" ? e.entity_id : str(e.details, "request_id")
  if (e.entity_type === "purchase_order") return { to: "/admin/orders", label: "Open orders" }
  if (requestId) return { to: `/admin/matches?r=${requestId}&list=all`, label: "Open the request" }
  if (e.entity_type === "organisation" && e.action === "vendor.verification") return { to: "/admin/verification", label: "Open supplier verification" }
  if (e.entity_type === "catalogue_category" || e.action === "settings.payment_terms") return { to: "/admin/payment-terms", label: "Open payment terms" }
  return null
}

function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(now) - start(d)) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })
}

function LogRow({ a, open, onToggle }: { a: ActivityEntry; open: boolean; onToggle: () => void }) {
  const look = lookOf(a.entry.action)
  const link = detailLink(a)
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="relative flex gap-3">
      <span className="relative z-10 mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white" style={{ background: look.bg, color: look.fg }} aria-hidden="true">
        <look.icon size={14} />
      </span>
      <div className="min-w-0 flex-1 overflow-hidden rounded-lg bg-white">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3.5 py-2.5 text-left hover:bg-page/40">
          <span className="min-w-0 text-[14px] text-navy">
            {look.tag && (
              <span className="mr-1.5 rounded px-1.5 py-px align-middle font-bold uppercase" style={{ background: look.bg, color: look.fg, fontSize: 10.5 }}>
                {look.tag}
              </span>
            )}
            {sentence(a)}
            {a.actorName && <span className="block text-[12.5px] text-muted">by {a.actorName}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-muted">
            {fmtTime(a.entry.created_at)}
            <ChevronDown size={14} className={`text-navy transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
        </button>
        <motion.div initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="overflow-hidden" aria-hidden={!open}>
          <div className="border-t border-line px-3.5 py-2.5" style={{ background: "#f7f8fa" }}>
            <dl className="grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
              {detailRows(a).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="shrink-0 text-muted">{k}</dt>
                  <dd className="min-w-0 font-semibold text-navy">{v}</dd>
                </div>
              ))}
            </dl>
            {link && (
              <Link to={link.to} tabIndex={open ? 0 : -1} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-navy underline">
                {link.label} <ArrowRight size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </motion.li>
  )
}

function ActivityTab({ entries, now }: { entries: ActivityEntry[]; now: Date }) {
  const [kind, setKind] = useState<Kind | "all">("all")
  const [open, setOpen] = useState<number | null>(null)
  const days = useMemo(() => {
    const out: { label: string; items: ActivityEntry[] }[] = []
    for (const e of entries.filter((x) => kind === "all" || kindOf(x.entry.action) === kind)) {
      const label = dayLabel(e.entry.created_at, now)
      const last = out[out.length - 1]
      if (last?.label === label) last.items.push(e)
      else out.push({ label, items: [e] })
    }
    return out
  }, [entries, kind, now])

  return (
    <>
      <div className="mx-4 mt-3 border-b border-line pb-3 sm:mx-5">
        <Pills id="activity" round value={kind} onChange={setKind} items={[{ id: "all" as const, label: "All", icon: History }, ...KINDS]} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={kind} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {days.length === 0 ? (
            <p className="px-5 py-8 text-center text-[14px] text-muted">Nothing here yet.</p>
          ) : (
            <div className="px-4 pb-5 pt-1 sm:px-5">
              {days.map((g) => (
                <section key={g.label} className="mt-3">
                  <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-muted">
                    <span>{g.label}</span>
                    <span className="rounded-full bg-white px-2 py-px normal-case tracking-normal text-navy">
                      {g.items.length} event{g.items.length === 1 ? "" : "s"}
                    </span>
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  </h3>
                  <ol className="relative space-y-1.5">
                    <span className="absolute" style={{ left: 13, top: 12, bottom: 12, width: 2, background: "#dfe4eb" }} aria-hidden="true" />
                    {g.items.map((a) => (
                      <LogRow key={a.entry.id} a={a} open={open === a.entry.id} onToggle={() => setOpen(open === a.entry.id ? null : a.entry.id)} />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

// ---------------------------------------------------------------- page

function LiveDot({ at }: { at: Date | null }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-navy" title="This page checks for new activity every minute">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "#15967b" }} />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "#15967b" }} />
      </span>
      <span>
        Live<span className="hidden font-normal text-muted sm:inline"> · updates every minute{at ? ` · last ${fmtTime(at.toISOString())}` : ""}</span>
      </span>
    </span>
  )
}

export default function ActivityPage() {
  const [threads, setThreads] = useState<NegotiationThread[] | null>(null)
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const now = useNow(30_000)
  const tab: Tab = params.get("tab") === "activity" ? "activity" : "offers"
  const filter = (["live", "accepted", "closed"].includes(params.get("show") ?? "") ? params.get("show") : "all") as Filter

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (v) n.set(k, v)
          else n.delete(k)
        }
        return n
      },
      { replace: true },
    )

  const reload = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([listNegotiationThreads(), listActivity()])
      setThreads(t)
      setEntries(a)
      setLoadedAt(new Date())
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [])

  useEffect(() => {
    document.title = "Price offers and activity · MPI admin"
    void reload()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload()
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  const pickFilter = (f: Filter) => set({ show: f === "all" ? null : f, tab: null })

  return (
    <div>
      <PageHeader title="Price offers and activity" description="Watch price negotiations between startups and suppliers, and everything that happens on MPI. Step in only when needed." />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {!threads || !entries ? (
        <div className="space-y-4" aria-label="Loading">
          <div className="h-40 animate-pulse rounded-xl bg-page" />
          <div className="h-96 animate-pulse rounded-xl bg-page" />
        </div>
      ) : (
        <>
          <Pulse threads={threads} now={now} filter={filter} onPick={pickFilter} />
          <Panel title={tab === "offers" ? "Price offers" : "Activity log"} icon={tab === "offers" ? BadgeCheck : FileText} action={<LiveDot at={loadedAt} />}>
            <div className="px-4 sm:px-5">
              <TabBar
                label="Price offers and activity"
                value={tab}
                onChange={(t) => set({ tab: t === "offers" ? null : t })}
                tabs={[
                  { id: "offers", label: "Price offers", count: threads.length },
                  { id: "activity", label: "Activity log", count: entries.length },
                ]}
              />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                {tab === "offers" ? <OffersTab threads={threads} now={now} filter={filter} setFilter={pickFilter} /> : <ActivityTab entries={entries} now={now} />}
              </motion.div>
            </AnimatePresence>
          </Panel>
        </>
      )}
    </div>
  )
}
