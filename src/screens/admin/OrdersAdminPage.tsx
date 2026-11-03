/**
 * Admin: Orders and messages (/admin/orders).
 *
 * Every order on MPI. Summary cards on top. Left: the order list (Needs reply /
 * Active / Done). Right: one order, with tabs:
 * - Messages: the buyer's and the supplier's conversations with MPI, side by
 *   side, each with a reply box. A message meant for the other side can be
 *   passed on in one click. Names stay private between the two sides.
 * - Progress: the 6 steps. The admin can step in and set the status.
 * - Money: what the buyer paid, what MPI owes the supplier (with a simulated
 *   payout), MPI's revenue, and all 3 invoices.
 *
 * The admin sees real company names next to the MPI aliases.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import {
  ArrowLeft,
  Banknote,
  Building2,
  CircleDollarSign,
  Forward,
  Inbox,
  Info,
  MessageSquare,
  Package,
  Search,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react"
import { listAllOrderMessages, listAllOrders, type AdminOrder } from "../../services/data/admin"
import { getOrderMoney, payOutSupplier, SIMULATED_NOTE, type OrderMoney } from "../../services/data/money"
import {
  listOrderHistory,
  ORDER_STEPS,
  replyOrderMessage,
  updateOrderStatus,
  type OrderEvent,
  type OrderMessage,
  type OrderStatus,
} from "../../services/data/orders"
import Button from "../../ui/Button"
import EmptyState from "../../ui/EmptyState"
import { Alert, BOX, boxBorder } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { InvoiceCard, isDone, STATUS_TONE, STEP_LABEL, Stepper } from "../orders/OrdersPage"
import { Chip, day, daysLeft, errorText, GRADIENT_PANEL, rupees, SummaryCards, useToast } from "../supplier/parts"

type ListTab = "reply" | "active" | "done"
type DetailTab = "messages" | "progress" | "money"

const TOPIC: Record<string, string> = {
  for_other_side: "For the other side",
  delivery: "Delivery",
  quality: "Quality",
  payment: "Payment",
  other: "Something else",
}

const time = (iso: string) =>
  `${day(iso)} ${new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`

/** Conversations (one per order and side) whose last message is still waiting for MPI. */
function waiting(messages: OrderMessage[]): Set<string> {
  const last = new Map<string, OrderMessage>()
  for (const m of messages) last.set(`${m.po_id}:${m.org_id}`, m)
  return new Set([...last.entries()].filter(([, m]) => !m.from_mpi).map(([k]) => k))
}

const owesSupplier = (m: OrderMoney | undefined) => Math.max(-(m?.balances.supplier_payable ?? 0), 0)

// ---------------------------------------------------------------- list

function OrderList({
  orders,
  selectedId,
  unanswered,
  money,
  onSelect,
}: {
  orders: AdminOrder[]
  selectedId: string | null
  unanswered: Set<string>
  money: Map<string, OrderMoney>
  onSelect: (id: string) => void
}) {
  if (!orders.length) return <p className="px-5 py-10 text-center text-muted">Nothing here right now.</p>
  return (
    <ul className="space-y-2 p-3">
      {orders.map((o) => {
        const selected = o.id === selectedId
        const replies = [o.buyer_org_id, o.vendor_org_id].filter((org) => unanswered.has(`${o.id}:${org}`)).length
        const payout = owesSupplier(money.get(o.id))
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
                <span className="block text-[15px] font-semibold leading-snug text-navy">{o.requestTitle || o.po_number}</span>
                <span className="mt-1 block text-[12.5px] text-muted">{o.po_number}</span>
                <span className="block text-[12.5px] text-muted">
                  {o.buyerRealName} → {o.supplierRealName}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                <span className={`text-[12px] font-semibold ${selected ? "text-navy" : "text-muted"}`}>{STEP_LABEL[o.status]}</span>
                {replies > 0 && (
                  <span className="rounded-full bg-orange px-2 py-0.5 text-[11.5px] font-bold text-navy">
                    {replies === 2 ? "2 to reply" : "Reply"}
                  </span>
                )}
                {payout > 0 && <span className="rounded-full bg-navy-tint px-2 py-0.5 text-[11.5px] font-bold text-navy">Pay out</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- messages

function Conversation({
  order,
  side,
  messages,
  waitingReply,
  onReply,
  onPassOn,
}: {
  order: AdminOrder
  side: "buyer" | "supplier"
  messages: OrderMessage[]
  waitingReply: boolean
  onReply: (body: string) => Promise<void>
  onPassOn: (m: OrderMessage) => Promise<void>
}) {
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const real = side === "buyer" ? order.buyerRealName : order.supplierRealName
  const alias = side === "buyer" ? order.buyerName : order.supplierName
  const other = side === "buyer" ? "supplier" : "buyer"

  return (
    <section className="flex flex-col rounded-xl border-[1.5px] border-line bg-white" aria-label={`Conversation with the ${side}`}>
      <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">{side === "buyer" ? "Buyer" : "Supplier"}</p>
          <p className="truncate text-[15px] font-bold text-navy">{real}</p>
          <p className="text-[12.5px] text-muted">Sees itself as {alias}</p>
        </div>
        {waitingReply && <Chip tone="orange">Waiting for MPI</Chip>}
      </header>

      <div className="flex-1 space-y-3 px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted">No messages from the {side} yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.from_mpi ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-[14px] ${
                  m.from_mpi ? "bg-navy text-white" : "border-[1.5px] border-line bg-page/60 text-navy"
                }`}
              >
                <p className={`mb-1 text-[11.5px] font-semibold ${m.from_mpi ? "text-white/70" : "text-muted"}`}>
                  {m.from_mpi ? "MPI (you)" : side === "buyer" ? "Buyer" : "Supplier"}
                  {!m.from_mpi && ` · ${TOPIC[m.topic] ?? TOPIC.other}`} · {time(m.created_at)}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
                {!m.from_mpi && m.topic === "for_other_side" && (
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null)
                      try {
                        await onPassOn(m)
                      } catch (err) {
                        setError(errorText(err))
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange px-3 py-1 text-[12.5px] font-bold text-navy hover:bg-orange-2"
                  >
                    <Forward size={14} aria-hidden="true" /> Pass on to the {other}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!body.trim()) return setError("Please write a reply.")
          setBusy(true)
          setError(null)
          try {
            await onReply(body)
            setBody("")
          } catch (err) {
            setError(errorText(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <label htmlFor={`reply-${side}`} className="sr-only">
          Reply to the {side}
        </label>
        <textarea
          id={`reply-${side}`}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Reply to the ${side}. They see it as from MPI.`}
          className={`${BOX} ${boxBorder()} py-2 text-[14.5px]`}
        />
        {error && (
          <div className="mt-2">
            <Alert>{error}</Alert>
          </div>
        )}
        <Button type="submit" className="mt-2 w-full" busy={busy}>
          <Send size={16} aria-hidden="true" /> Send reply
        </Button>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------- progress (step in)

function StepIn({ order, onDone }: { order: AdminOrder; onDone: (msg: string) => Promise<void> }) {
  const options: OrderStatus[] = [...ORDER_STEPS, "cancelled"].filter((s) => s !== order.status) as OrderStatus[]
  const [status, setStatus] = useState<OrderStatus>(ORDER_STEPS[ORDER_STEPS.indexOf(order.status) + 1] ?? options[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (isDone(order)) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-navy-tint/60 px-4 py-3 text-[14px] text-navy">
        <Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> This order is closed.
      </p>
    )
  }
  return (
    <div className="rounded-xl border-[1.5px] border-line bg-white p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Step in (only if needed)</p>
      <p className="mt-1 text-[14px] text-navy">
        Normally the supplier moves the order forward and the buyer confirms it. Use this only to fix a stuck order.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-60">
          <label htmlFor="admin-status" className="mb-1.5 block text-sm font-semibold text-navy">
            Set status to
          </label>
          <select
            id="admin-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            className={`${BOX} ${boxBorder()} min-h-11 text-[15px]`}
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {STEP_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          busy={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await updateOrderStatus(order.id, status)
              await onDone(`Status set to ${STEP_LABEL[status].toLowerCase()}`)
            } catch (err) {
              setError(errorText(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          Update status
        </Button>
      </div>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- money

function Money({ order, money, onDone }: { order: AdminOrder; money: OrderMoney | null; onDone: (msg: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!money) return <p className="text-muted">Loading the money…</p>
  const paidIn = money.payments.filter((p) => p.payee === "mpi").reduce((n, p) => n + p.amount, 0)
  const owes = owesSupplier(money)
  const paidOut = (money.payouts ?? []).reduce((n, p) => n + p.net, 0)
  const revenue = money.amounts.mpi?.revenue ?? 0

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border-[1.5px] border-line bg-white p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Buyer paid MPI</p>
          <p className="font-display text-[22px] font-bold text-navy">{rupees(paidIn)}</p>
          <p className="text-[12.5px] text-muted">of {rupees(money.amounts.buyer?.checkout_total ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-navy p-4 text-white sm:col-span-1">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">MPI owes the supplier</p>
          <p className="font-display text-[24px] font-bold text-orange">{rupees(owes)}</p>
          {owes > 0 ? (
            <Button
              className="mt-2 w-full"
              busy={busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await payOutSupplier(order.id)
                  await onDone(`Paid out ${rupees(owes)} to the supplier (simulated)`)
                } catch (err) {
                  setError(errorText(err))
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Banknote size={16} aria-hidden="true" /> Pay out {rupees(owes)}
            </Button>
          ) : (
            <p className="text-[12.5px] text-white/70">Nothing to pay out right now</p>
          )}
        </div>
        <div className="rounded-xl border-[1.5px] border-line bg-white p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Paid out so far</p>
          <p className="font-display text-[22px] font-bold text-navy">{rupees(paidOut)}</p>
          <p className="text-[12.5px] text-muted">after commission</p>
        </div>
        <div className="rounded-xl border-[1.5px] border-line bg-white p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">MPI revenue</p>
          <p className="font-display text-[22px] font-bold text-navy">{rupees(revenue)}</p>
          <p className="text-[12.5px] text-muted">fee + commission, before GST</p>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <Info size={15} aria-hidden="true" /> {SIMULATED_NOTE}
      </p>
      <div className="grid gap-4 xl:grid-cols-3">
        {money.invoices.map((i) => (
          <InvoiceCard key={i.id} invoice={i} side="admin" order={order} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- detail

function OrderPanel({
  order,
  money,
  messages,
  unanswered,
  onBack,
  onDone,
}: {
  order: AdminOrder
  money: OrderMoney | null
  messages: OrderMessage[]
  unanswered: Set<string>
  onBack: () => void
  onDone: (msg: string) => Promise<void>
}) {
  const [params, setParams] = useSearchParams()
  const tab = (params.get("tab") as DetailTab | null) ?? "messages"
  const setTab = (t: DetailTab) => {
    const p = new URLSearchParams(params)
    p.set("tab", t)
    setParams(p, { replace: true })
  }
  const [events, setEvents] = useState<OrderEvent[]>([])
  useEffect(() => {
    let alive = true
    listOrderHistory(order.id).then((e) => alive && setEvents(e)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [order.id, order.status])

  const mine = messages.filter((m) => m.po_id === order.id)
  const buyerMsgs = mine.filter((m) => m.org_id === order.buyer_org_id)
  const supplierMsgs = mine.filter((m) => m.org_id === order.vendor_org_id)
  const toReply = [order.buyer_org_id, order.vendor_org_id].filter((o) => unanswered.has(`${order.id}:${o}`)).length
  const eta = order.expected_delivery

  const reply = (orgId: string, who: string) => async (body: string) => {
    await replyOrderMessage(order.id, orgId, body)
    await onDone(`Reply sent to the ${who}`)
  }
  const passOn = (toOrg: string, from: string, to: string) => async (m: OrderMessage) => {
    await replyOrderMessage(order.id, toOrg, `Message from the ${from}, passed on by MPI:\n${m.body}`)
    await onDone(`Passed on to the ${to}`)
  }

  return (
    <section className="overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={GRADIENT_PANEL} aria-label={order.po_number}>
      <div className="bg-gradient-to-br from-navy-tint via-navy-tint/60 to-orange-tint/50 px-5 pb-4 pt-4 sm:px-6">
        <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy lg:hidden">
          <ArrowLeft size={16} aria-hidden="true" /> All orders
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-muted">{order.po_number}</p>
            <h2 className="font-display text-[22px] font-bold leading-tight text-navy">{order.requestTitle}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[14px] text-navy">
              <Building2 size={15} className="text-muted" aria-hidden="true" />
              <strong>{order.buyerRealName}</strong> buys from <strong>{order.supplierRealName}</strong>
              <ShieldCheck size={15} className="text-orange" aria-label="Both verified by MPI" />
            </p>
          </div>
          <div className="sm:text-right">
            <Chip tone={STATUS_TONE[order.status]}>{STEP_LABEL[order.status]}</Chip>
            {money?.amounts.buyer && <p className="mt-1 font-display text-[22px] font-bold text-navy">{rupees(money.amounts.buyer.checkout_total)}</p>}
            <p className="text-[12px] text-muted">buyer pays, incl. GST and MPI fee</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-[13.5px]">
          <li className="rounded-full bg-white px-3 py-1 text-navy ring-1 ring-line">
            <span className="text-muted">Placed:</span> <strong>{day(order.approved_at, true)}</strong>
          </li>
          <li className="rounded-full bg-white px-3 py-1 text-navy ring-1 ring-line">
            <span className="text-muted">Expected delivery:</span>{" "}
            <strong>{eta ? `${day(eta, true)}${!isDone(order) ? ` (${daysLeft(eta)})` : ""}` : "Not set yet"}</strong>
          </li>
          {toReply > 0 && <li className="rounded-full bg-orange px-3 py-1 font-bold text-navy">{toReply === 2 ? "Both sides waiting" : "1 side waiting"} for a reply</li>}
        </ul>
      </div>

      <div className="border-y border-line bg-white px-5 py-3 sm:px-6">
        <div role="tablist" aria-label="Order sections" className="grid grid-cols-3 gap-1 rounded-2xl bg-page p-1 sm:inline-flex sm:rounded-full">
          {(
            [
              { id: "messages", label: "Messages", count: toReply || undefined },
              { id: "progress", label: "Progress" },
              { id: "money", label: "Money" },
            ] as { id: DetailTab; label: string; count?: number }[]
          ).map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                  active ? "bg-navy text-white shadow-sm" : "text-muted hover:text-navy"
                }`}
              >
                {t.label}
                {t.count !== undefined && <span className="rounded-full bg-orange px-1.5 text-[11.5px] font-bold text-navy">{t.count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white p-5 sm:p-6">
        {tab === "messages" && (
          <>
            <p className="mb-4 flex items-start gap-2 text-[13.5px] text-muted">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
              Each side only sees its own conversation with MPI. Use "Pass on" to forward a message meant for the other side; it arrives as from MPI.
            </p>
            <div className="grid gap-4 xl:grid-cols-2">
              <Conversation
                order={order}
                side="buyer"
                messages={buyerMsgs}
                waitingReply={unanswered.has(`${order.id}:${order.buyer_org_id}`)}
                onReply={reply(order.buyer_org_id, "buyer")}
                onPassOn={passOn(order.vendor_org_id, "buyer", "supplier")}
              />
              <Conversation
                order={order}
                side="supplier"
                messages={supplierMsgs}
                waitingReply={unanswered.has(`${order.id}:${order.vendor_org_id}`)}
                onReply={reply(order.vendor_org_id, "supplier")}
                onPassOn={passOn(order.buyer_org_id, "supplier", "buyer")}
              />
            </div>
          </>
        )}
        {tab === "progress" && (
          <div className="space-y-5">
            {order.status === "cancelled" ? <Chip tone="red">Cancelled</Chip> : <Stepper status={order.status} events={events} />}
            <StepIn key={order.status} order={order} onDone={onDone} />
          </div>
        )}
        {tab === "money" && <Money order={order} money={money} onDone={onDone} />}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- page

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [money, setMoney] = useState<Map<string, OrderMoney>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [toast, toastNode] = useToast()

  const selectedId = params.get("o")

  const reload = useCallback(async () => {
    try {
      const [fresh, msgs] = await Promise.all([listAllOrders(), listAllOrderMessages().catch(() => [])])
      setOrders(fresh)
      setMessages(msgs)
      const sums = await Promise.all(fresh.map((o) => getOrderMoney(o.id).catch(() => null)))
      setMoney(new Map(fresh.flatMap((o, i) => (sums[i] ? [[o.id, sums[i]!] as const] : []))))
      setError(null)
    } catch (err) {
      setError(errorText(err))
      setOrders((o) => o ?? [])
    }
  }, [])

  useEffect(() => {
    document.title = "Orders and messages · MPI admin"
    void reload()
  }, [reload])

  const unanswered = useMemo(() => waiting(messages), [messages])
  const all = useMemo(() => orders ?? [], [orders])
  const lists = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (o: AdminOrder) =>
      !q || [o.requestTitle, o.po_number, o.buyerRealName, o.supplierRealName].some((t) => t.toLowerCase().includes(q))
    const shown = all.filter(match)
    const needsReply = (o: AdminOrder) => unanswered.has(`${o.id}:${o.buyer_org_id}`) || unanswered.has(`${o.id}:${o.vendor_org_id}`)
    return {
      reply: shown.filter(needsReply),
      active: shown.filter((o) => !isDone(o)),
      done: shown.filter(isDone),
    }
  }, [all, query, unanswered])

  const listTab = (params.get("list") as ListTab | null) ?? (lists.reply.length ? "reply" : "active")
  const shown = lists[listTab]
  const selected = all.find((o) => o.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId && shown.length && window.matchMedia("(min-width: 1024px)").matches) {
      const p = new URLSearchParams(params)
      p.set("o", shown[0].id)
      setParams(p, { replace: true })
    }
  }, [selectedId, shown, params, setParams])

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) (v === null ? p.delete(k) : p.set(k, v))
    setParams(p, { replace: true })
  }

  async function done(message: string) {
    toast(message)
    await reload()
  }

  const waitingCount = unanswered.size
  const activeCount = all.filter((o) => !isDone(o)).length
  const toPayOut = all.reduce((n, o) => n + owesSupplier(money.get(o.id)), 0)
  const revenue = all.reduce((n, o) => n + (money.get(o.id)?.amounts.mpi?.revenue ?? 0), 0)

  const tabs: { id: ListTab; label: string }[] = [
    { id: "reply", label: "Needs reply" },
    { id: "active", label: "Active" },
    { id: "done", label: "Done" },
  ]

  return (
    <div>
      <PageHeader
        title="Orders and messages"
        description="Every order on MPI. Reply to buyers and suppliers, pay suppliers out, and step in only when needed."
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {orders === null ? (
        <div className="space-y-4" aria-label="Loading">
          <div className="h-24 animate-pulse rounded-xl bg-page" />
          <div className="h-80 animate-pulse rounded-xl bg-page" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={Inbox} title="No orders yet" body="When a startup approves a quote, the order shows up here." />
      ) : (
        <>
          <SummaryCards
            selected={listTab === "reply" ? "reply" : listTab === "done" ? null : "active"}
            onPick={(id) => update({ list: id === "reply" ? "reply" : "active", o: null, tab: id === "payout" || id === "revenue" ? "money" : null })}
            items={[
              { id: "reply", label: "Messages to answer", value: waitingCount, hint: waitingCount ? "buyers and suppliers waiting" : "all answered", icon: MessageSquare, dot: waitingCount > 0 },
              { id: "active", label: "Active orders", value: activeCount, hint: `${all.length} in total`, icon: Package },
              { id: "payout", label: "To pay out", value: rupees(toPayOut), hint: toPayOut ? "owed to suppliers now" : "nothing owed", icon: Wallet, dot: toPayOut > 0 },
              { id: "revenue", label: "MPI revenue", value: rupees(revenue), hint: "fees + commission, before GST", icon: CircleDollarSign },
            ]}
          />
          <div className="grid gap-5 lg:grid-cols-[23rem_minmax(0,1fr)]">
            <aside className={`h-fit overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)] lg:sticky lg:top-24 ${selected ? "hidden lg:block" : ""}`}>
              <div role="tablist" aria-label="Orders" className="flex gap-1 border-b border-line px-2">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={listTab === t.id}
                    onClick={() => update({ list: t.id, o: null, tab: null })}
                    className={`flex min-h-12 items-center gap-2 border-b-[3px] px-2.5 text-[14.5px] font-semibold ${
                      listTab === t.id ? "border-orange text-navy" : "border-transparent text-muted hover:text-navy"
                    }`}
                  >
                    {t.label}
                    <span className={`rounded-full px-2 py-px text-[12px] font-bold ${listTab === t.id ? "bg-orange text-navy" : "bg-navy-tint text-navy"}`}>
                      {lists[t.id].length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative px-3 pt-3">
                <Search size={16} className="pointer-events-none absolute left-6 top-1/2 mt-1.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search order, company or PO"
                  aria-label="Search orders"
                  className={`${BOX} ${boxBorder()} min-h-10 pl-9 text-[14.5px]`}
                />
              </div>
              <OrderList orders={shown} selectedId={selectedId} unanswered={unanswered} money={money} onSelect={(id) => update({ o: id, tab: null })} />
            </aside>
            <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
              {selected ? (
                <OrderPanel
                  key={selected.id}
                  order={selected}
                  money={money.get(selected.id) ?? null}
                  messages={messages}
                  unanswered={unanswered}
                  onBack={() => update({ o: null, tab: null })}
                  onDone={done}
                />
              ) : (
                <EmptyState icon={Package} title="Pick an order" body="Choose an order on the left to see its messages, progress and money." />
              )}
            </div>
          </div>
        </>
      )}
      {toastNode}
    </div>
  )
}
