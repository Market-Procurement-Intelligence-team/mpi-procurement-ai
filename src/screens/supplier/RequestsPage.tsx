/**
 * Supplier: Requests for you.
 *
 * Every request MPI matched to this supplier (after the admin approved the
 * match), as one card each, under tabs: New, Offers to answer, Quote sent,
 * Not interested. Navy summary cards on top jump to a tab.
 *
 * Buyers appear as "MPI Verified Buyer" and the budget is never shown.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Handshake,
  Inbox,
  MapPin,
  Send,
  ShieldCheck,
  Wallet,
  X,
  XCircle,
} from "lucide-react"
import { useMe } from "../../app/session"
import { listCategories, type Category } from "../../services/data/catalogue"
import { listMyOffers, timeLeftToReply, type Offer } from "../../services/data/negotiation"
import { declineInvitation, listMyInvitations, type InvitationWithRequest } from "../../services/data/quotes"
import Button from "../../ui/Button"
import EmptyState from "../../ui/EmptyState"
import { Alert } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import {
  ago,
  Chip,
  day,
  daysLeft,
  daysUntil,
  errorText,
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
} from "./parts"
import { requestState, type RequestKind, type RequestState } from "./requestState"

type Row = { item: InvitationWithRequest; state: RequestState }

const TABS: { id: RequestKind; label: string }[] = [
  { id: "new", label: "New" },
  { id: "offer", label: "Offers to answer" },
  { id: "sent", label: "Quote sent" },
  { id: "declined", label: "Not interested" },
]

const EMPTY: Record<RequestKind, { title: string; body: string }> = {
  new: { title: "No new requests", body: "When MPI matches a buyer's request to your factory, it shows up here." },
  offer: { title: "No offers to answer", body: "If a buyer asks for a lower price on one of your quotes, you'll answer it here." },
  sent: { title: "No quotes sent yet", body: "Quotes you send to buyers are listed here with their status." },
  declined: { title: "Nothing here", body: "Requests you mark as not interested are kept here." },
}

/** Button look for links. */
function LinkButton({ to, primary = false, children }: { to: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-bold transition-colors ${
        primary ? "btn-gradient text-navy shadow-sm hover:brightness-95" : "border-[1.5px] border-navy bg-white text-navy hover:bg-navy-tint"
      }`}
    >
      {children}
    </Link>
  )
}

function StatusChip({ row }: { row: Row }) {
  const { state, item } = row
  if (state.kind === "declined") return <Chip>Not interested</Chip>
  if (state.kind === "offer") return <Chip tone="red">Offer to answer</Chip>
  if (state.kind === "sent") {
    if (state.quote?.status === "accepted") return <Chip tone="navy"><BadgeCheck size={13} aria-hidden="true" />Won</Chip>
    if (state.quote?.status === "rejected") return <Chip>Not chosen</Chip>
    return <Chip tone="navy"><Send size={12} aria-hidden="true" />Quote sent</Chip>
  }
  if (state.closed) return <Chip>Closed</Chip>
  if (state.quote?.status === "draft") return <Chip tone="orange">Draft saved</Chip>
  if (item.invitation.status === "invited") return <Chip tone="orange"><span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden="true" />New</Chip>
  return <Chip>Seen</Chip>
}

const EDGE: Record<RequestKind, string> = {
  new: "border-l-orange",
  offer: "border-l-red",
  sent: "border-l-navy",
  declined: "border-l-input",
}

function Fact({ icon: Icon, label, children, warn = false }: { icon: typeof MapPin; label: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-lg bg-page px-3 py-2.5">
      <Icon size={17} className="mt-0.5 shrink-0 text-navy" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">{label}</p>
        <p className={`text-[14.5px] font-semibold ${warn ? "text-red-text" : "text-navy"}`}>{children}</p>
      </div>
    </div>
  )
}

function RequestCard({
  row,
  category,
  now,
  onDecline,
}: {
  row: Row
  category: Category | undefined
  now: Date
  onDecline: (row: Row) => Promise<void>
}) {
  const { item, state } = row
  const { request, lines } = item
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const to = `/supplier/requests/${item.invitation.id}`
  const d = daysUntil(request.needed_by)
  const where = place(request.delivery_city, request.delivery_state)
  const quoteTotal = state.quote?.total ?? null

  return (
    <article
      className={`overflow-hidden rounded-xl border-[1.5px] border-l-[5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)] transition-shadow hover:shadow-[0_6px_18px_rgba(21,35,61,0.1)] ${EDGE[state.kind]}`}
    >
      <div className="p-4 sm:p-5">
        {/* who and status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-orange" aria-hidden="true">
              <Building2 size={19} />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[14.5px] font-bold text-navy">
                {item.buyerName}
                <ShieldCheck size={15} className="shrink-0 text-orange" aria-label="Verified by MPI" />
              </p>
              <p className="truncate text-[13px] text-muted">
                {[category?.name, where].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <StatusChip row={row} />
        </div>

        <h2 className="mt-3 font-display text-[18px] font-bold leading-snug text-navy">{request.title}</h2>

        {/* items */}
        {lines.length > 0 && (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-navy-tint/40">
            {lines.map((l) => {
              const specs = specsText(l.specs)
              return (
                <li key={l.id} className="flex items-start justify-between gap-4 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-navy">{l.description}</p>
                    {specs && <p className="mt-0.5 text-[13px] text-muted">{specs}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Quantity</p>
                    <p className="font-display text-[17px] font-bold text-navy">{qty(l.quantity, l.unit)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* facts */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Fact icon={CalendarClock} label="Needed by" warn={d !== null && d <= 7}>
            {day(request.needed_by, true) ?? "Flexible"}
            {d !== null && <span className="ml-1.5 text-[12.5px] font-medium">({daysLeft(request.needed_by)})</span>}
          </Fact>
          <Fact icon={MapPin} label="Deliver to">{where ?? "To be confirmed"}</Fact>
          <Fact icon={Wallet} label="Payment, set by MPI">{termsText(category?.payment_terms)}</Fact>
        </div>

        {request.required_certifications.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
            Needs:
            {request.required_certifications.map((c) => (
              <span key={c} className="rounded-full bg-navy-tint px-2 py-0.5 text-[12.5px] font-semibold text-navy">
                {c}
              </span>
            ))}
          </p>
        )}

        {/* buyer's offer */}
        {state.openOffer && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border-[1.5px] border-orange bg-orange-tint px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Handshake size={19} className="mt-0.5 shrink-0 text-navy" aria-hidden="true" />
              <p className="text-[14.5px] text-navy">
                The buyer offered <strong className="font-display text-[16px]">{rupees(state.openOffer.proposed_total)}</strong>
                {quoteTotal !== null && <> for your quote of {rupees(quoteTotal)}</>}.
                <span className="ml-1 font-semibold text-red-text">Reply within {timeLeftText(timeLeftToReply(state.openOffer, now))}.</span>
              </p>
            </div>
          </div>
        )}

        {/* your quote */}
        {state.kind === "sent" && state.quote && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy px-4 py-3 text-white">
            <p className="text-[14.5px]">
              Your quote: <strong className="font-display text-[16px] text-orange">{rupees(quoteTotal ?? 0)}</strong>
              <span className="text-white/70"> incl. GST</span>
            </p>
            <p className="text-[13px] text-white/75">
              {state.quote.status === "accepted"
                ? "You won this order"
                : state.quote.status === "rejected"
                  ? "The buyer chose another offer"
                  : `Sent ${ago(state.quote.submitted_at) ?? ""} · buyer is comparing`}
            </p>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-page/60 px-4 py-3 sm:px-5">
        {state.kind === "offer" && (
          <LinkButton to={`${to}#offer`} primary>
            Reply to offer <ArrowRight size={17} aria-hidden="true" />
          </LinkButton>
        )}
        {state.kind === "sent" && (
          <LinkButton to={to}>
            <FileText size={17} aria-hidden="true" /> View quote
          </LinkButton>
        )}
        {state.kind === "new" && !state.closed && (
          <>
            <LinkButton to={to} primary>
              {state.quote?.status === "draft" ? "Continue quote" : "Send quote"} <ArrowRight size={17} aria-hidden="true" />
            </LinkButton>
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[14.5px] font-semibold text-muted hover:bg-navy-tint hover:text-navy"
              >
                <X size={16} aria-hidden="true" /> Not interested
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 text-[14px] text-navy">
                Not quoting for this one?
                <Button
                  variant="secondary"
                  className="min-h-9 px-3 text-[14px]"
                  busy={busy}
                  onClick={async () => {
                    setBusy(true)
                    await onDecline(row)
                    setBusy(false)
                    setConfirming(false)
                  }}
                >
                  Yes, skip it
                </Button>
                <button type="button" className="px-2 font-semibold text-muted hover:text-navy" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </span>
            )}
          </>
        )}
        {state.kind === "new" && state.closed && <p className="text-[14px] text-muted">This request is closed. No quote needed.</p>}
        {state.kind === "declined" && (
          <Link to={to} className="text-[14px] font-semibold text-navy underline-offset-2 hover:underline">
            Changed your mind? Send a quote
          </Link>
        )}
      </div>
    </article>
  )
}

function HowItWorks() {
  const steps = [
    ["Check the request", "Items, quantities, date and place."],
    ["Send your best price", "Use the MPI price guide for each item."],
    ["Answer offers", "The buyer may ask for a lower price, up to 3 times."],
  ]
  return (
    <aside className="h-fit rounded-xl bg-navy p-5 text-white shadow-[0_3px_10px_rgba(21,35,61,0.2)] lg:sticky lg:top-24">
      <h2 className="font-display text-[16px] font-bold">How quoting works</h2>
      <ol className="mt-4 space-y-4">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="btn-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-navy">
              {i + 1}
            </span>
            <div>
              <p className="text-[14.5px] font-semibold">{title}</p>
              <p className="text-[13px] text-white/70">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 flex items-start gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-[13px] text-white/85">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
        Payment terms are set by MPI, the same for every supplier on a request.
      </p>
    </aside>
  )
}

export default function RequestsPage() {
  const me = useMe()
  const orgId = me.organisation.id
  const [items, setItems] = useState<InvitationWithRequest[] | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [categories, setCategories] = useState<Map<string, Category>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [toast, toastNode] = useToast()
  const now = useNow()

  const tab = (params.get("tab") as RequestKind | null) ?? "new"

  const reload = useCallback(async () => {
    try {
      const [inv, off, cats] = await Promise.all([listMyInvitations(orgId), listMyOffers(orgId), listCategories()])
      setItems(inv)
      setOffers(off)
      setCategories(new Map(cats.map((c) => [c.id, c])))
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [orgId])

  useEffect(() => {
    void reload()
  }, [reload])

  const rows = useMemo<Row[]>(() => {
    if (!items) return []
    return items
      .map((item) => ({ item, state: requestState(item, offers, now) }))
      .sort((a, b) => {
        const da = daysUntil(a.item.request.needed_by) ?? 9999
        const dbb = daysUntil(b.item.request.needed_by) ?? 9999
        return da - dbb
      })
  }, [items, offers, now])

  const byKind = (k: RequestKind) => rows.filter((r) => r.state.kind === k)
  const counts = Object.fromEntries(TABS.map((t) => [t.id, byKind(t.id).length])) as Record<RequestKind, number>
  const won = byKind("sent").filter((r) => r.state.quote?.status === "accepted").length
  const unseen = byKind("new").filter((r) => r.item.invitation.status === "invited").length

  const setTab = (t: string) => setParams({ tab: t }, { replace: true })

  async function decline(row: Row) {
    try {
      await declineInvitation(row.item.invitation.id)
      toast("Marked as not interested")
      await reload()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const verified = me.organisation.verification_status === "verified"
  const shown = byKind(tab)

  return (
    <div>
      <PageHeader
        title="Requests for you"
        description="Buyer requests MPI matched to your factory. Send your best price; the buyer's budget is never shared."
      />

      {!verified && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-[1.5px] border-orange bg-orange-tint px-4 py-3">
          <p className="flex items-start gap-2.5 text-[14.5px] text-navy">
            <ShieldCheck size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Your profile is not verified yet.</strong> Add your GSTIN and Udyam number so MPI can verify you and
              match you to more buyers.
            </span>
          </p>
          <LinkButton to="/supplier/profile">Complete profile</LinkButton>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {items === null && !error ? (
        <p className="py-16 text-center text-muted">Loading your requests…</p>
      ) : (
        <>
          <SummaryCards
            selected={tab}
            onPick={setTab}
            items={[
              { id: "new", label: "New requests", value: counts.new, hint: unseen ? `${unseen} not opened yet` : "all opened", icon: Inbox, dot: unseen > 0 },
              {
                id: "offer",
                label: "Offers to answer",
                value: counts.offer,
                hint: counts.offer ? "reply within 24 h" : "nothing waiting",
                icon: Handshake,
                dot: counts.offer > 0,
              },
              { id: "sent", label: "Quotes sent", value: counts.sent, hint: won ? `${won} won` : "waiting on buyers", icon: Send },
              { id: "declined", label: "Not interested", value: counts.declined, hint: "requests you skipped", icon: XCircle },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0">
              <TabBar<RequestKind>
                label="Requests"
                value={tab}
                onChange={setTab}
                tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))}
              />
              <div className="mt-4 space-y-4">
                {shown.length === 0 ? (
                  <EmptyState
                    icon={tab === "sent" ? CheckCircle2 : tab === "offer" ? Clock : Inbox}
                    title={EMPTY[tab].title}
                    body={EMPTY[tab].body}
                  />
                ) : (
                  shown.map((row) => (
                    <RequestCard
                      key={row.item.invitation.id}
                      row={row}
                      category={row.item.request.category_id ? categories.get(row.item.request.category_id) : undefined}
                      now={now}
                      onDecline={decline}
                    />
                  ))
                )}
              </div>
            </div>
            <HowItWorks />
          </div>
        </>
      )}
      {toastNode}
    </div>
  )
}
