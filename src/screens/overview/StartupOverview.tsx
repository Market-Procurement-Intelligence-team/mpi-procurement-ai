/**
 * Startup Dashboard (/startup): the first page after logging in.
 *
 * - AI summary line (from the facts below; plain line if the AI is off).
 * - KPI cards: active requests, quotes ready, orders, total saved, each with
 *   a "this week" trend or a shortcut.
 * - Left column: Spend & savings (monthly spend, by category), then Orders on
 *   the way. Right column: Recent activity, then Needs your attention
 *   (supplier price replies, payments due, deliveries to confirm, quotes to
 *   compare, drafts; urgent first). On a phone, Needs your attention is first.
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { Link, useNavigate } from "react-router"
import {
  FileText,
  Handshake,
  ListChecks,
  Package,
  PackageCheck,
  PenLine,
  PiggyBank,
  Plus,
  Scale,
  Send,
  Truck,
  Wallet,
} from "lucide-react"
import { useMe } from "../../app/session"
import { listCategories, type Category } from "../../services/data/catalogue"
import { getOrderMoney, type OrderMoney } from "../../services/data/money"
import { listMyBuyerOffers, offerStatus, timeLeftToReply, type Offer } from "../../services/data/negotiation"
import { listMyOrders, ORDER_STEPS, type OrderSummary } from "../../services/data/orders"
import { listMyRequestCards, type RequestCard } from "../../services/data/requests"
import { Alert } from "../../ui/form"
import { dueNow, isDone, STEP_LABEL, stillToPay } from "../orders/OrdersPage"
import { day, daysLeft, daysUntil, errorText, rupees, SummaryCards, timeLeftText } from "../supplier/parts"
import { AiSummary, Greeting, Panel, RecentActivity, TodoList, type TodoItem } from "./parts"
import SpendPanel, { type SpendEntry } from "./SpendPanel"

interface Data {
  cards: RequestCard[]
  orders: OrderSummary[]
  money: Map<string, OrderMoney>
  offers: Offer[]
  categories: Category[]
}

const WEEK = 7 * 24 * 60 * 60 * 1000
const thisWeek = (iso: string | null | undefined) => !!iso && Date.now() - new Date(iso).getTime() < WEEK

export default function StartupOverview() {
  const me = useMe()
  const navigate = useNavigate()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Dashboard · MPI"
    let alive = true
    ;(async () => {
      try {
        const [cards, orders, offers, categories] = await Promise.all([
          listMyRequestCards(me.profile.org_id),
          listMyOrders(),
          listMyBuyerOffers(me.profile.org_id).catch(() => []),
          listCategories().catch(() => []),
        ])
        const sums = await Promise.all(orders.map((o) => getOrderMoney(o.id).catch(() => null)))
        if (!alive) return
        setData({ cards, orders, offers, categories, money: new Map(orders.flatMap((o, i) => (sums[i] ? [[o.id, sums[i]!] as const] : []))) })
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
    const { cards, orders, money, offers, categories } = data
    const active = cards.filter((c) => ["open", "comparing"].includes(c.request.status) && !c.orderId)
    const drafts = cards.filter((c) => c.request.status === "draft")
    const toCompare = active.filter((c) => c.quoteCount > 0)
    const quotes = toCompare.reduce((n, c) => n + c.quoteCount, 0)
    const liveOrders = orders.filter((o) => !isDone(o))
    const payNow = liveOrders.reduce((n, o) => n + dueNow(money.get(o.id), o.status), 0)
    const owed = orders.reduce((n, o) => n + stillToPay(money.get(o.id)), 0)
    const toConfirm = liveOrders.filter((o) => o.status === "delivered")
    const counters = offers.filter((o) => o.proposed_by === "vendor" && offerStatus(o) === "open")
    const title = (requestId: string) => cards.find((c) => c.request.id === requestId)?.request.title ?? "your request"

    const todo: TodoItem[] = []
    for (const o of counters) {
      todo.push({
        id: `offer-${o.id}`,
        icon: Handshake,
        title: `The supplier suggested ${rupees(o.proposed_total)} on ${title(o.request_id)}`,
        detail: `Reply within ${timeLeftText(timeLeftToReply(o))}`,
        cta: "Reply",
        to: `/startup/requests/${o.request_id}`,
        urgent: true,
      })
    }
    for (const o of liveOrders) {
      const due = dueNow(money.get(o.id), o.status)
      if (due > 0)
        todo.push({ id: `pay-${o.id}`, icon: Wallet, title: `Pay ${rupees(due)} for ${o.requestTitle}`, detail: `${o.po_number} · simulated payment`, cta: "Pay", to: `/startup/orders?o=${o.id}&tab=payments`, urgent: true })
    }
    for (const o of toConfirm) {
      todo.push({ id: `confirm-${o.id}`, icon: PackageCheck, title: `Confirm delivery of ${o.requestTitle}`, detail: `${o.po_number} · the supplier marked it delivered`, cta: "Confirm", to: `/startup/orders?o=${o.id}`, urgent: true })
    }
    for (const c of toCompare) {
      const d = daysUntil(c.request.needed_by)
      todo.push({
        id: `cmp-${c.request.id}`,
        icon: Scale,
        title: `Compare ${c.quoteCount} quote${c.quoteCount === 1 ? "" : "s"} for ${c.request.title}`,
        detail: c.request.needed_by ? `Needed by ${day(c.request.needed_by)} (${daysLeft(c.request.needed_by)})` : "No needed-by date",
        cta: `View ${c.quoteCount} quote${c.quoteCount === 1 ? "" : "s"}`,
        to: `/startup/requests/${c.request.id}`,
        urgent: d !== null && d <= 3,
      })
    }
    for (const c of drafts.slice(0, 2)) {
      todo.push({ id: `draft-${c.request.id}`, icon: PenLine, title: `Finish your draft: ${c.request.title || "untitled request"}`, detail: "Not sent to MPI yet", cta: "Continue", to: `/startup/requests/new?draft=${c.request.id}` })
    }
    todo.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))

    const facts = [
      `${active.length} active request${active.length === 1 ? "" : "s"}, ${drafts.length} draft${drafts.length === 1 ? "" : "s"}`,
      `${quotes} quote${quotes === 1 ? "" : "s"} waiting to be compared on ${toCompare.length} request${toCompare.length === 1 ? "" : "s"}`,
      ...counters.map((o) => `Supplier counter-offer of ${rupees(o.proposed_total)} on "${title(o.request_id)}", reply within ${timeLeftText(timeLeftToReply(o))}`),
      `${liveOrders.length} order${liveOrders.length === 1 ? "" : "s"} in progress`,
      payNow > 0 ? `${rupees(payNow)} is due to pay now` : "Nothing to pay right now",
      ...toConfirm.map((o) => `Order ${o.po_number} (${o.requestTitle}) was delivered and needs confirming`),
      ...liveOrders
        .filter((o) => o.expected_delivery && o.status !== "delivered")
        .slice(0, 3)
        .map((o) => `Order "${o.requestTitle}" is ${STEP_LABEL[o.status].toLowerCase()}, delivery expected ${day(o.expected_delivery)} (${daysLeft(o.expected_delivery)})`),
    ].slice(0, 12)

    const fallback = todo.length
      ? `${todo.length} thing${todo.length === 1 ? "" : "s"} need${todo.length === 1 ? "s" : ""} you today${todo[0] ? `, starting with: ${todo[0].title.charAt(0).toLowerCase()}${todo[0].title.slice(1)}` : ""}.`
      : `Nothing needs you right now. ${liveOrders.length ? `${liveOrders.length} order${liveOrders.length === 1 ? " is" : "s are"} on the way.` : "Start a new request whenever you're ready."}`

    // Spend & savings: every order that wasn't cancelled.
    const catName = new Map(categories.map((c) => [c.id, c.name]))
    const placed = orders.filter((o) => o.status !== "cancelled")
    const spend: SpendEntry[] = placed.map((o) => {
      const m = money.get(o.id)
      const req = cards.find((c) => c.request.id === o.request_id)?.request
      return {
        at: o.approved_at || o.created_at,
        category: (req?.category_id && catName.get(req.category_id)) || "Other",
        amount: m?.amounts.buyer?.checkout_total ?? o.total_amount,
        saved: Math.max(0, m?.amounts.savings?.net ?? 0),
      }
    })
    const saved = spend.reduce((n, e) => n + e.saved, 0)
    const savedOn = spend.filter((e) => e.saved > 0).length
    const newRequests = active.filter((c) => thisWeek(c.request.created_at)).length
    const newOrders = placed.filter((o) => thisWeek(o.approved_at || o.created_at)).length
    if (saved > 0) facts.push(`Saved ${rupees(saved)} so far across ${savedOn} order${savedOn === 1 ? "" : "s"} compared with the usual price`)

    return { active, drafts, quotes, toCompare, liveOrders, payNow, owed, todo, facts: facts.slice(0, 12), fallback, spend, saved, savedOn, newRequests, newOrders, placed }
  }, [data])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Greeting name={me.profile.full_name || ""} line="Here's your procurement overview for this month." />
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
          <Link to="/startup/requests/new" className="btn-gradient inline-flex min-h-11 items-center gap-2 rounded-md px-5 font-bold text-navy shadow-[0_4px_14px_rgba(236,141,73,0.3)]">
            <Plus size={18} aria-hidden="true" /> New request
          </Link>
        </motion.div>
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
              navigate(
                id === "requests" ? "/startup/requests?tab=active" : id === "quotes" ? "/startup/requests?tab=offers" : "/startup/orders",
              )
            }
            items={[
              {
                id: "requests",
                label: "Active requests",
                value: view.active.length,
                trend: view.newRequests ? `+${view.newRequests} this week` : undefined,
                hint: view.drafts.length ? `${view.drafts.length} draft${view.drafts.length === 1 ? "" : "s"} too` : "being sourced",
                icon: Send,
                cta: "View requests",
              },
              {
                id: "quotes",
                label: "Quotes ready",
                value: view.quotes,
                hint: view.toCompare.length ? `on ${view.toCompare.length} request${view.toCompare.length === 1 ? "" : "s"}` : "none yet",
                icon: FileText,
                dot: view.quotes > 0,
                cta: view.quotes > 0 ? "Review quotes" : undefined,
              },
              {
                id: "orders",
                label: "Orders",
                value: view.liveOrders.length,
                trend: view.newOrders ? `+${view.newOrders} this week` : undefined,
                hint: view.payNow > 0 ? `${rupees(view.payNow)} due now` : view.liveOrders.length ? "in progress" : "none right now",
                icon: Package,
                dot: view.payNow > 0,
                cta: view.liveOrders.length ? "Track orders" : undefined,
              },
              {
                id: "saved",
                label: "Total saved",
                value: rupees(view.saved),
                tone: "good",
                hint: view.savedOn ? `across ${view.savedOn} order${view.savedOn === 1 ? "" : "s"} vs. usual price` : "shows after your first order",
                icon: PiggyBank,
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)] lg:items-start">
            {/* On a phone the two columns melt into one list, with Needs your attention first. */}
            <div className="min-w-0 space-y-5 max-lg:contents">
              <SpendPanel entries={view.spend} orderCount={view.placed.length} />
              <Panel
                title="Orders on the way"
                icon={Truck}
                action={
                  <Link to="/startup/orders" className="text-[13.5px] font-semibold text-navy hover:underline">
                    All orders
                  </Link>
                }
              >
                {view.liveOrders.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[14px] text-muted">No orders in progress. Approve a quote to place one.</p>
                ) : (
                  <ul>
                    {view.liveOrders.slice(0, 4).map((o) => {
                      const step = ORDER_STEPS.indexOf(o.status)
                      const pct = Math.round(((step + 1) / ORDER_STEPS.length) * 100)
                      const late = o.status !== "delivered" && (daysUntil(o.expected_delivery) ?? 1) < 0
                      return (
                        <li key={o.id} className="border-b border-line/70 last:border-b-0">
                          <Link to={`/startup/orders?o=${o.id}`} className="block px-4 py-3.5 hover:bg-navy-tint/40 sm:px-5">
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className="font-semibold text-navy">{o.requestTitle}</span>
                              <span className={`text-[13px] font-semibold ${late ? "text-red-text" : "text-muted"}`}>
                                {o.status === "delivered" ? "Delivered" : o.expected_delivery ? `Delivery ${day(o.expected_delivery)} · ${daysLeft(o.expected_delivery)}` : "Delivery date coming"}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[12.5px] text-muted">
                              {o.po_number} · {STEP_LABEL[o.status]} (step {step + 1} of {ORDER_STEPS.length})
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
            </div>
            <div className="min-w-0 space-y-5 max-lg:contents">
              <RecentActivity role="startup" />
              <Panel title="Needs your attention" icon={ListChecks} className="flex flex-col max-lg:order-first" action={view.todo.length ? <span className="rounded-full bg-orange px-2 py-px text-[12px] font-bold text-navy">{view.todo.length}</span> : undefined}>
                <TodoList
                  items={view.todo}
                  empty="No quotes to review, payments due or deliveries to confirm right now."
                  emptyActions={
                    <>
                      <Link to="/startup/notifications" className="btn-gradient inline-flex min-h-10 items-center rounded-md px-4 text-[13.5px] font-bold text-navy shadow-sm hover:brightness-95">
                        View activity
                      </Link>
                      <Link to="/startup/requests/new" className="btn-gradient inline-flex min-h-10 items-center gap-1.5 rounded-md px-4 text-[13.5px] font-bold text-navy shadow-sm hover:brightness-95">
                        <Plus size={15} aria-hidden="true" /> New request
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
