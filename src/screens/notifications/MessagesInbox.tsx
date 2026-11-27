/**
 * Messages with MPI, as an inbox: conversations on the left, the chat on
 * the right.
 *
 * - Startup / supplier: one conversation with MPI per order. The other side
 *   never sees it; MPI passes on anything meant for them.
 * - Admin: one conversation per order and side (buyer or supplier), with a
 *   reply box, "Pass on" on messages meant for the other side, and a tick to
 *   send the same reply to both sides.
 *
 * URL: ?tab=messages&o=<order id>[&side=buyer|supplier][&topic=...]
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ArrowLeft, Forward, MessageSquare, Package, Search, Send, ShieldCheck } from "lucide-react"
import type { Role } from "../../app/session"
import { listAllOrders, type AdminOrder } from "../../services/data/admin"
import { listNotifications, markRead, type Notification } from "../../services/data/notifications"
import {
  listMyOrders,
  listVisibleOrderMessages,
  replyOrderMessage,
  sendOrderMessage,
  type MessageTopic,
  type OrderMessage,
  type OrderSummary,
} from "../../services/data/orders"
import Button from "../../ui/Button"
import EmptyState from "../../ui/EmptyState"
import { Alert, BOX, boxBorder } from "../../ui/form"
import VoiceTextArea from "../../ui/VoiceTextArea"
import { STEP_LABEL } from "../orders/OrdersPage"
import { ago, day, errorText } from "../supplier/parts"
import { notifyChanged } from "./notify"

type Side = "buyer" | "supplier"

interface Convo {
  key: string
  order: OrderSummary | AdminOrder
  /** Admin only: which side this conversation is with. */
  side?: Side
  orgId: string
  messages: OrderMessage[]
  /** Admin: the side is waiting for MPI. Others: MPI replied and it's unread. */
  needsYou: boolean
}

const TOPIC_KEYS: MessageTopic[] = ["for_other_side", "delivery", "quality", "payment", "other"]

function topicLabel(t: string, role: Role): string {
  if (t === "for_other_side") return role === "startup" ? "For the supplier" : role === "vendor" ? "For the buyer" : "For the other side"
  return { delivery: "Delivery", quality: "Quality", payment: "Payment" }[t] ?? "Something else"
}

const time = (iso: string) => `${day(iso)} ${new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`

const isAdminOrder = (o: OrderSummary | AdminOrder): o is AdminOrder => "buyerRealName" in o

/** Which conversation a notification's link points at. */
function linkedOrder(n: Notification): string | null {
  return n.link?.match(/[?&]o=([0-9a-f-]{36})/)?.[1] ?? null
}

// ---------------------------------------------------------------- thread

function Thread({ convo, role, onBack, onChanged }: { convo: Convo; role: Role; onBack: () => void; onChanged: () => Promise<void> }) {
  const [params] = useSearchParams()
  const [topic, setTopic] = useState<MessageTopic>((params.get("topic") as MessageTopic) || "other")
  const [body, setBody] = useState("")
  const [alsoOther, setAlsoOther] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const o = convo.order
  const admin = role === "admin"
  const otherOrg = convo.orgId === o.buyer_org_id ? o.vendor_org_id : o.buyer_org_id
  const otherSide: Side = convo.side === "buyer" ? "supplier" : "buyer"
  const counterpart = role === "startup" ? "supplier" : "buyer"
  const ordersLink = role === "admin" ? `/admin/orders?o=${o.id}` : `${role === "startup" ? "/startup" : "/supplier"}/orders?o=${o.id}`

  async function send() {
    if (!body.trim()) return setError("Please write a message.")
    setBusy(true)
    setError(null)
    try {
      if (admin) {
        await replyOrderMessage(o.id, convo.orgId, body)
        if (alsoOther) await replyOrderMessage(o.id, otherOrg, body)
      } else {
        await sendOrderMessage(o.id, topic, body)
      }
      setBody("")
      setAlsoOther(false)
      await onChanged()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function passOn(m: OrderMessage) {
    setError(null)
    try {
      await replyOrderMessage(o.id, otherOrg, `Message from the ${convo.side}, passed on by MPI:\n${m.body}`)
      await onChanged()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const who = admin && isAdminOrder(o) ? (convo.side === "buyer" ? o.buyerRealName : o.supplierRealName) : "MPI team"

  return (
    <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl border-[1.5px] border-line bg-white soft-panel" aria-label={`Conversation about ${o.po_number}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-gradient-to-br from-navy-tint via-navy-tint/50 to-orange-tint/40 px-5 py-3.5">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy lg:hidden">
            <ArrowLeft size={16} aria-hidden="true" /> All conversations
          </button>
          <p className="text-[12.5px] font-semibold text-muted">
            {o.po_number} · {STEP_LABEL[o.status]}
          </p>
          <h2 className="font-display text-[18px] font-bold leading-tight text-navy">{o.requestTitle}</h2>
          <p className="mt-0.5 text-[13.5px] text-navy">
            {admin ? (
              <>
                With the {convo.side}: <strong>{who}</strong>
              </>
            ) : (
              <>
                With the <strong>MPI team</strong>
              </>
            )}
          </p>
        </div>
        <Link to={ordersLink} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border-[1.5px] border-navy bg-white px-3 text-[13.5px] font-semibold text-navy hover:bg-navy-tint">
          <Package size={15} aria-hidden="true" /> Open order
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-page/40 px-5 py-4 lg:max-h-[28rem]">
        {convo.messages.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted">
            {admin ? `No messages with the ${convo.side} yet.` : "No messages yet. Ask MPI anything about this order."}
          </p>
        ) : (
          convo.messages.map((m) => {
            const mine = admin ? m.from_mpi : !m.from_mpi
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-[14.5px] ${
                    m.from_mpi ? "bg-navy text-white" : "border-[1.5px] border-orange/45 bg-orange-tint/60 text-navy"
                  }`}
                >
                  <p className={`mb-1 text-[11.5px] font-semibold ${m.from_mpi ? "text-white/70" : "text-muted"}`}>
                    {m.from_mpi ? (admin ? "MPI (you)" : "MPI team") : admin ? (convo.side === "buyer" ? "Buyer" : "Supplier") : "You"}
                    {!m.from_mpi && ` · ${topicLabel(m.topic, role)}`} · {time(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {admin && !m.from_mpi && m.topic === "for_other_side" && (
                    <button
                      type="button"
                      onClick={() => void passOn(m)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange px-3 py-1 text-[12.5px] font-bold text-navy hover:bg-orange-2"
                    >
                      <Forward size={14} aria-hidden="true" /> Pass on to the {otherSide}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <form
        className="border-t border-line p-4"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        {admin ? (
          <>
            <label htmlFor="reply" className="sr-only">
              Reply to the {convo.side}
            </label>
            <textarea
              id="reply"
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Reply to the ${convo.side}. They see it as from MPI.`}
              className={`${BOX} ${boxBorder()} py-2 text-[14.5px]`}
            />
          </>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="What is it about?">
              {TOPIC_KEYS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={topic === t}
                  onClick={() => setTopic(t)}
                  className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
                    topic === t ? "bg-navy text-white" : "bg-page text-navy hover:bg-orange-tint"
                  }`}
                >
                  {topicLabel(t, role)}
                </button>
              ))}
            </div>
            <VoiceTextArea
              label="Message"
              value={body}
              onChange={setBody}
              rows={2}
              placeholder={topic === "for_other_side" ? `What should MPI tell the ${counterpart}?` : "How can MPI help?"}
            />
          </>
        )}
        {error && (
          <div className="mt-2">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {admin ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-navy">
              <input type="checkbox" checked={alsoOther} onChange={(e) => setAlsoOther(e.target.checked)} className="h-4 w-4 accent-[#F09A47]" />
              <Forward size={14} aria-hidden="true" /> Also pass on to the {otherSide}
            </label>
          ) : (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <ShieldCheck size={14} className="text-orange" aria-hidden="true" /> Names stay private. MPI passes on anything meant for the {counterpart}.
            </p>
          )}
          <Button type="submit" className="min-h-10 px-4" busy={busy}>
            <Send size={16} aria-hidden="true" /> {admin ? (alsoOther ? "Send to both" : "Send reply") : "Send to MPI"}
          </Button>
        </div>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------- inbox

export default function MessagesInbox({ role, onCount }: { role: Role; onCount: (n: number) => void }) {
  const [orders, setOrders] = useState<(OrderSummary | AdminOrder)[] | null>(null)
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [unreadNotes, setUnreadNotes] = useState<Notification[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [params, setParams] = useSearchParams()
  const admin = role === "admin"

  const load = useCallback(async () => {
    try {
      const [o, m, n] = await Promise.all([
        admin ? listAllOrders() : listMyOrders(),
        listVisibleOrderMessages(),
        listNotifications(200).catch(() => []),
      ])
      setOrders(o)
      setMessages(m)
      setUnreadNotes(n.filter((x) => x.type === "order_message" && !x.read_at))
      setError(null)
    } catch (err) {
      setError(errorText(err))
      setOrders((o) => o ?? [])
    }
  }, [admin])

  useEffect(() => {
    void load()
  }, [load])

  const convos = useMemo<Convo[]>(() => {
    const list: Convo[] = []
    const lastAt = (c: Convo) => c.messages.at(-1)?.created_at ?? ""
    for (const o of orders ?? []) {
      if (admin) {
        for (const side of ["buyer", "supplier"] as Side[]) {
          const orgId = side === "buyer" ? o.buyer_org_id : o.vendor_org_id
          const msgs = messages.filter((m) => m.po_id === o.id && m.org_id === orgId)
          const picked = params.get("o") === o.id && (params.get("side") ?? "buyer") === side
          if (!msgs.length && !picked) continue
          list.push({ key: `${o.id}:${side}`, order: o, side, orgId, messages: msgs, needsYou: !!msgs.length && !msgs.at(-1)!.from_mpi })
        }
      } else {
        const msgs = messages.filter((m) => m.po_id === o.id)
        const orgId = role === "startup" ? o.buyer_org_id : o.vendor_org_id
        const needsYou = unreadNotes.some((n) => linkedOrder(n) === o.id)
        list.push({ key: o.id, order: o, orgId, messages: msgs, needsYou })
      }
    }
    return list.sort((a, b) => Number(b.needsYou) - Number(a.needsYou) || lastAt(b).localeCompare(lastAt(a)))
  }, [orders, messages, unreadNotes, admin, role, params])

  useEffect(() => onCount(convos.filter((c) => c.needsYou).length), [convos, onCount])

  const shown = convos.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const o = c.order
    const names = isAdminOrder(o) ? [o.buyerRealName, o.supplierRealName] : []
    return [o.requestTitle, o.po_number, ...names].some((t) => t.toLowerCase().includes(q))
  })

  const selKey = params.get("o") ? (admin ? `${params.get("o")}:${params.get("side") ?? "buyer"}` : params.get("o")!) : null
  const selected = convos.find((c) => c.key === selKey) ?? null

  // Pick the first conversation on wide screens.
  useEffect(() => {
    if (!selKey && shown.length && window.matchMedia("(min-width: 1024px)").matches) pick(shown[0])
  }, [selKey, shown.length])

  // Opening a conversation marks its message notifications read.
  useEffect(() => {
    if (!selected) return
    const notes = unreadNotes.filter((n) => linkedOrder(n) === selected.order.id)
    if (!notes.length) return
    void Promise.all(notes.map((n) => markRead(n.id).catch(() => undefined))).then(() => {
      setUnreadNotes((list) => list.filter((n) => !notes.includes(n)))
      notifyChanged()
    })
  }, [selected, unreadNotes])

  function pick(c: Convo | null) {
    const p = new URLSearchParams(params)
    p.set("tab", "messages")
    p.delete("topic")
    if (c) {
      p.set("o", c.order.id)
      if (c.side) p.set("side", c.side)
      else p.delete("side")
    } else {
      p.delete("o")
      p.delete("side")
    }
    setParams(p, { replace: true })
  }

  if (orders === null) return <div className="h-96 animate-pulse rounded-xl bg-page" aria-label="Loading" />
  if (error) return <Alert>{error}</Alert>
  if (!convos.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={admin ? "No messages yet" : "No orders yet"}
        body={
          admin
            ? "When a buyer or supplier writes to MPI about an order, it shows up here."
            : "Once you have an order, you can message MPI about it here."
        }
      />
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[23rem_minmax(0,1fr)]">
      <aside className={`h-fit overflow-hidden rounded-xl border-[1.5px] border-line bg-white soft-panel lg:sticky lg:top-24 ${selected ? "hidden lg:block" : ""}`}>
        <div className="relative border-b border-line p-3">
          <Search size={16} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={admin ? "Search order, company or PO" : "Search order or PO"}
            aria-label="Search conversations"
            className={`${BOX} ${boxBorder()} min-h-10 pl-9 text-[14.5px]`}
          />
        </div>
        <ul className="max-h-[36rem] space-y-2 overflow-y-auto p-3">
          {shown.map((c) => {
            const last = c.messages.at(-1)
            const active = c.key === selected?.key
            const o = c.order
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  aria-current={active || undefined}
                  className={`w-full rounded-lg border-[1.5px] py-2.5 pr-3 text-left transition-colors ${
                    active ? "border-l-[5px] border-orange bg-orange-tint/45 pl-2.5" : "border-line bg-white pl-[calc(0.625rem+3.5px)] hover:border-orange/60"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-[14.5px] font-semibold leading-snug text-navy">{o.requestTitle || o.po_number}</span>
                    {last && <span className="shrink-0 text-[11.5px] text-muted">{ago(last.created_at)}</span>}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">
                    {o.po_number}
                    {admin && isAdminOrder(o) && ` · ${c.side === "buyer" ? "Buyer" : "Supplier"}: ${c.side === "buyer" ? o.buyerRealName : o.supplierRealName}`}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    {c.needsYou && <span className="h-2 w-2 shrink-0 rounded-full bg-red" aria-label={admin ? "Waiting for MPI" : "New reply"} />}
                    <span className={`line-clamp-1 text-[13px] ${c.needsYou ? "font-semibold text-navy" : "text-muted"}`}>
                      {last ? `${last.from_mpi ? (admin ? "You: " : "MPI: ") : admin ? "" : "You: "}${last.body}` : "No messages yet"}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
          {!shown.length && <li className="px-2 py-6 text-center text-[14px] text-muted">Nothing matches your search.</li>}
        </ul>
      </aside>
      <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
        {selected ? (
          <Thread key={selected.key} convo={selected} role={role} onBack={() => pick(null)} onChanged={load} />
        ) : (
          <EmptyState icon={MessageSquare} title="Pick a conversation" body="Choose a conversation on the left." />
        )}
      </div>
    </div>
  )
}
