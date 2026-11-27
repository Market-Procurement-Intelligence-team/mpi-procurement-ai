/**
 * Supplier Dashboard (/supplier): the first page after logging in.
 *
 * - AI summary line (from the facts below; plain line if the AI is off).
 * - KPI cards: new requests, offers to answer, active orders, earned, each
 *   with a "this week" trend or a shortcut.
 * - Left column: Sales & earnings (monthly sales, by category), then Orders to
 *   deliver. Right column: Needs your attention, then Recent activity (buyer
 *   price offers, requests to quote, orders to move forward; urgent first).
 *   On a phone, Needs your attention is first.
 *
 * Buyers appear as "MPI Verified Buyer" and the budget is never shown.
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { Link, useNavigate } from "react-router"
import { BellRing, Factory, Handshake, Inbox, ListChecks, Package, PenLine, Truck, UserRound, Wallet } from "lucide-react"
import { useMe } from "../../app/session"
import { listCategories, type Category } from "../../services/data/catalogue"
import { getOrderMoney, getVolumeStatus, type OrderMoney, type VolumeStatus } from "../../services/data/money"
import { listMyOffers, timeLeftToReply, type Offer } from "../../services/data/negotiation"
import { listMyOrders, ORDER_STEPS, type OrderSummary } from "../../services/data/orders"
import { listMyInvitations, type InvitationWithRequest } from "../../services/data/quotes"
import { Alert } from "../../ui/form"
import { isDone, STEP_LABEL } from "../orders/OrdersPage"
import { day, daysLeft, daysUntil, errorText, rupees, SummaryCards, timeLeftText } from "../supplier/parts"
import { requestState } from "../supplier/requestState"
import { AiSummary, Greeting, Panel, RecentsButton, TodoList, type TodoItem } from "./parts"
import SalesPanel, { type SaleEntry } from "./SalesPanel"

interface Data {
  invitations: InvitationWithRequest[]
  offers: Offer[]
  orders: OrderSummary[]
  money: Map<string, OrderMoney>
  categories: Category[]
  volume: VolumeStatus[]
}

const WEEK = 7 * 24 * 60 * 60 * 1000
const thisWeek = (iso: string | null | undefined) => !!iso && Date.now() - new Date(iso).getTime() < WEEK
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export default function SupplierOverview() {
  const me = useMe()
  const navigate = useNavigate()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Dashboard · MPI"
    let alive = true
    ;(async () => {
      try {
        const org = me.profile.org_id
        const [invitations, offers, orders, categories, volume] = await Promise.all([
          listMyInvitations(org),
          listMyOffers(org).catch(() => []),
          listMyOrders(),
          listCategories().catch(() => []),
          getVolumeStatus(org).catch(() => []),
        ])
        const sums = await Promise.all(orders.map((o) => getOrderMoney(o.id).catch(() => null)))
        if (!alive) return
        setData({
          invitations,
          offers,
          orders,
          categories,
          volume,
          money: new Map(orders.flatMap((o, i) => (sums[i] ? [[o.id, sums[i]!] as const] : []))),
        })
      } catch (err) {
        if (alive) setError(errorText(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [me.profile.org_id])

  const view = useMemo(() => {
    if (!data) return null
    const { invitations, offers, orders, money, categories, volume } = data
    const rows = invitations.map((item) => ({ item, state: requestState(item, offers) }))
    const fresh = rows.filter((r) => r.state.kind === "new" && !r.state.closed)
    const unseen = fresh.filter((r) => r.item.invitation.status === "invited")
    const toAnswer = rows.filter((r) => r.state.kind === "offer" && r.state.openOffer)
    const waiting = rows.filter((r) => r.state.kind === "sent" && r.state.quote?.status === "submitted")
    const won = rows.filter((r) => r.state.quote?.status === "accepted").length
    const lost = rows.filter((r) => r.state.quote?.status === "rejected").length
    const newThisWeek = fresh.filter((r) => thisWeek(r.item.invitation.invited_at)).length

    const liveOrders = orders.filter((o) => !isDone(o))
    const toMove = liveOrders.filter((o) => o.status !== "delivered")
    const placed = orders.filter((o) => o.status !== "cancelled")
    const newOrders = placed.filter((o) => thisWeek(o.approved_at || o.created_at)).length
    const owed = orders.reduce((n, o) => n + (money.get(o.id)?.balances.mpi_owes_you ?? 0), 0)
    const late = (o: OrderSummary) => o.status !== "delivered" && (daysUntil(o.expected_delivery) ?? 1) < 0
    const soonest = toAnswer
      .map((r) => timeLeftToReply(r.state.openOffer!))
      .sort((a, b) => a - b)[0]

    const todo: TodoItem[] = []
    for (const { item, state } of toAnswer) {
      const o = state.openOffer!
      todo.push({
        id: `offer-${o.id}`,
        icon: Handshake,
        title: `A buyer asked for ${rupees(o.proposed_total)} on ${item.request.title}`,
        detail: `Reply within ${timeLeftText(timeLeftToReply(o))}`,
        cta: "Answer",
        to: `/supplier/requests/${item.invitation.id}`,
        urgent: true,
      })
    }
    for (const o of toMove) {
      const next = ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1]
      if (!next || next === "completed") continue
      const d = daysUntil(o.expected_delivery)
      todo.push({
        id: `move-${o.id}`,
        icon: Factory,
        title: `Mark ${o.requestTitle} as ${STEP_LABEL[next].toLowerCase()}`,
        detail: `${o.po_number} · ${o.expected_delivery ? `delivery ${day(o.expected_delivery)} (${daysLeft(o.expected_delivery)})` : "set a delivery date"}`,
        cta: "Update",
        to: `/supplier/orders?o=${o.id}`,
        urgent: late(o) || (d !== null && d <= 3),
      })
    }
    for (const { item, state } of fresh) {
      const d = daysUntil(item.request.needed_by)
      const draft = state.quote?.status === "draft"
      todo.push({
        id: `quote-${item.invitation.id}`,
        icon: draft ? PenLine : Inbox,
        title: draft ? `Finish your quote for ${item.request.title}` : `Send a quote for ${item.request.title}`,
        detail: item.request.needed_by ? `Needed by ${day(item.request.needed_by)} (${daysLeft(item.request.needed_by)})` : "No needed-by date",
        cta: draft ? "Continue" : "Quote",
        to: `/supplier/requests/${item.invitation.id}`,
        urgent: d !== null && d <= 3,
      })
    }
    todo.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))

    // Nothing to do yet (a new account): useful first steps instead of an empty box.
    const gettingStarted: TodoItem[] = [
      { id: "gs-profile", icon: UserRound, title: "Complete your supplier profile", detail: "A full profile helps MPI match you to more buyers", cta: "Open profile", to: "/supplier/profile" },
      { id: "gs-requests", icon: Inbox, title: "See requests matched to you", detail: "MPI sends you buyer requests that fit your business", cta: "View", to: "/supplier/requests" },
      { id: "gs-alerts", icon: BellRing, title: "Check your notifications", detail: "New requests and price offers show up here first", cta: "Open", to: "/supplier/notifications" },
    ]

    // Sales & earnings: every order that wasn't cancelled.
    const catName = new Map(categories.map((c) => [c.id, c.name]))
    const sales: SaleEntry[] = placed.map((o) => {
      const s = money.get(o.id)?.amounts.supplier
      const req = invitations.find((i) => i.request.id === o.request_id)?.request
      return {
        at: o.approved_at || o.created_at,
        category: (req?.category_id && catName.get(req.category_id)) || "Other",
        invoiced: s?.invoice_total ?? o.total_amount,
        payout: s?.payout ?? o.total_amount,
      }
    })
    const earned = sales.reduce((n, e) => n + e.payout, 0)

    const facts = [
      `${plural(fresh.length, "new request")} to quote${unseen.length ? `, ${unseen.length} not opened yet` : ""}`,
      ...toAnswer.map((r) => `A buyer asked for ${rupees(r.state.openOffer!.proposed_total)} on "${r.item.request.title}", reply within ${timeLeftText(timeLeftToReply(r.state.openOffer!))}`),
      waiting.length ? `${plural(waiting.length, "quote")} sent and waiting for the buyer` : "",
      `${plural(liveOrders.length, "order")} in progress, ${toMove.length} to move forward`,
      ...liveOrders.filter(late).map((o) => `Order "${o.requestTitle}" is past its delivery date (${day(o.expected_delivery)})`),
      ...toMove
        .filter((o) => o.expected_delivery && !late(o))
        .slice(0, 3)
        .map((o) => `Order "${o.requestTitle}" is ${STEP_LABEL[o.status].toLowerCase()}, delivery ${day(o.expected_delivery)} (${daysLeft(o.expected_delivery)})`),
      earned > 0 ? `Earned ${rupees(earned)} through MPI after commission` : "No sales through MPI yet",
      owed > 0 ? `MPI still owes you ${rupees(owed)} from buyer payments` : "",
      ...volume.slice(0, 2).map(
        (v) =>
          `${v.category_name}: ${v.clients_this_month} MPI client${v.clients_this_month === 1 ? "" : "s"} this month, ${v.current_pct}% volume discount${v.next_tier_clients ? `, next tier at ${v.next_tier_clients} clients` : ""}`,
      ),
    ]
      .filter(Boolean)
      .slice(0, 12)

    const fallback = todo.length
      ? `${plural(todo.length, "thing")} need${todo.length === 1 ? "s" : ""} you today, starting with: ${todo[0].title.charAt(0).toLowerCase()}${todo[0].title.slice(1)}.`
      : `Nothing needs you right now. ${waiting.length ? `${plural(waiting.length, "quote")} waiting for the buyer.` : "New requests from MPI show up here."}`

    return { gettingStarted, fresh, unseen, toAnswer, waiting, won, decided: won + lost, newThisWeek, liveOrders, toMove, newOrders, owed, earned, soonest, todo, facts, fallback, sales }
  }, [data])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Greeting name={me.profile.full_name || ""} line="Here's how your business is doing this month." />
        <div className="flex flex-wrap items-center gap-2.5">
          <RecentsButton role="vendor" />
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
          <Link to="/supplier/requests" className="btn-gradient inline-flex min-h-11 items-center gap-2 rounded-md px-5 font-bold text-navy shadow-[0_4px_14px_rgba(236,141,73,0.3)]">
            <Inbox size={18} aria-hidden="true" /> Requests for you
          </Link>
        </motion.div>
        </div>
      </div>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <AiSummary facts={view?.facts ?? null} fallback={view?.fallback ?? "Loading your day…"} />

      {!view ? (
        <div className="space-y-4" aria-label="Loading">
          <div className="h-24 animate-pulse rounded-xl bg-page" />
          <div className="h-72 animate-pulse rounded-xl bg-page" />
        </div>
      ) : (
        <>
          <SummaryCards
            selected={null}
            onPick={(id) =>
              navigate(id === "new" ? "/supplier/requests?tab=new" : id === "offers" ? "/supplier/requests?tab=offer" : "/supplier/orders")
            }
            items={[
              {
                id: "new",
                label: "New requests",
                value: view.fresh.length,
                trend: view.newThisWeek ? `+${view.newThisWeek} this week` : undefined,
                hint: view.unseen.length ? `${view.unseen.length} not opened yet` : view.fresh.length ? "ready to quote" : "none right now",
                icon: Inbox,
                dot: view.unseen.length > 0,
                cta: view.fresh.length ? "Send quotes" : undefined,
              },
              {
                id: "offers",
                label: "Offers to answer",
                value: view.toAnswer.length,
                hint: view.soonest !== undefined ? `first one within ${timeLeftText(view.soonest)}` : view.waiting.length ? `${plural(view.waiting.length, "quote")} with buyers` : "none right now",
                icon: Handshake,
                dot: view.toAnswer.length > 0,
                cta: view.toAnswer.length ? "Answer offers" : undefined,
              },
              {
                id: "orders",
                label: "Active orders",
                value: view.liveOrders.length,
                trend: view.newOrders ? `+${view.newOrders} this week` : undefined,
                hint: view.toMove.length ? `${view.toMove.length} to move forward` : view.liveOrders.length ? "waiting for buyers" : "none right now",
                icon: Package,
                dot: view.toMove.length > 0,
                cta: view.liveOrders.length ? "Update orders" : undefined,
              },
              {
                id: "earned",
                label: "Earned",
                value: rupees(view.earned),
                tone: "good",
                hint: view.owed > 0 ? `${rupees(view.owed)} still to come from MPI` : view.earned ? "after MPI commission" : "shows after your first order",
                icon: Wallet,
              },
            ]}
          />

          <div className="space-y-5">
              <SalesPanel entries={view.sales} won={view.won} decided={view.decided} />
            {/* Orders and Needs your attention side by side; on a phone Needs comes first. */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
              <Panel
                title="Orders to deliver"
                icon={Truck}
                action={
                  <Link to="/supplier/orders" className="text-[13.5px] font-semibold text-navy hover:underline">
                    All orders
                  </Link>
                }
              >
                {view.liveOrders.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[14px] text-muted">No orders in progress. When a buyer approves your quote, it shows up here.</p>
                ) : (
                  <ul>
                    {view.liveOrders.slice(0, 4).map((o) => {
                      const step = ORDER_STEPS.indexOf(o.status)
                      const next = ORDER_STEPS[step + 1]
                      const pct = Math.round(((step + 1) / ORDER_STEPS.length) * 100)
                      const late = o.status !== "delivered" && (daysUntil(o.expected_delivery) ?? 1) < 0
                      return (
                        <li key={o.id} className="border-b border-line/70 last:border-b-0">
                          <Link to={`/supplier/orders?o=${o.id}`} className="block px-4 py-3.5 hover:bg-navy-tint/40 sm:px-5">
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className="font-semibold text-navy">{o.requestTitle}</span>
                              <span className={`text-[13px] font-semibold ${late ? "text-red-text" : "text-muted"}`}>
                                {o.status === "delivered" ? "Delivered" : o.expected_delivery ? `Delivery ${day(o.expected_delivery)} · ${daysLeft(o.expected_delivery)}` : "Set a delivery date"}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[12.5px] text-muted">
                              {o.po_number} · {STEP_LABEL[o.status]} (step {step + 1} of {ORDER_STEPS.length})
                              {o.status === "delivered" ? " · waiting for the buyer to confirm" : next && next !== "completed" ? ` · next: ${STEP_LABEL[next].toLowerCase()}` : ""}
                            </span>
                            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-page" aria-hidden="true">
                              <span className="block h-full rounded-full btn-gradient" style={{ width: `${pct}%` }} />
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>
              <Panel
                title={view.todo.length ? "Needs your attention" : "Getting started"}
                icon={ListChecks}
                className="flex flex-col max-lg:order-first"
                action={view.todo.length ? <span className="rounded-full bg-orange px-2 py-px text-[12px] font-bold text-navy">{view.todo.length}</span> : undefined}
              >
                <TodoList
                  items={view.todo.length ? view.todo : view.gettingStarted}
                  empty="No requests to quote, price offers to answer or orders to update right now."
                  emptyActions={
                    <>
                      <Link to="/supplier/notifications" className="btn-gradient inline-flex min-h-10 items-center rounded-md px-4 text-[13.5px] font-bold text-navy shadow-sm hover:brightness-95">
                        View activity
                      </Link>
                      <Link to="/supplier/requests" className="btn-gradient inline-flex min-h-10 items-center gap-1.5 rounded-md px-4 text-[13.5px] font-bold text-navy shadow-sm hover:brightness-95">
                        <Inbox size={15} aria-hidden="true" /> Requests for you
                      </Link>
                    </>
                  }
                />
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
