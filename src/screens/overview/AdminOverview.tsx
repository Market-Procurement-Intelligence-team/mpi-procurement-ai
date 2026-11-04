/**
 * Admin Dashboard (/admin): the first page after logging in.
 *
 * - AI summary line (from the facts below; plain line if the AI is off).
 * - KPI cards: AI matches to review, active orders, to pay out, MPI revenue.
 * - Left column: Business through MPI (monthly order value, by category), then
 *   Orders in progress. Right column: Needs your attention (messages to
 *   answer, payouts, matches to review, late orders, suppliers to verify;
 *   urgent first), then Recent activity. On a phone, Needs your attention is
 *   first.
 *
 * The admin sees real company names; buyers and suppliers only see aliases.
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { Link, useNavigate } from "react-router"
import { AlarmClock, CircleDollarSign, ListChecks, MessageSquare, Package, RefreshCcw, ShieldCheck, Sparkles, Truck, Wallet } from "lucide-react"
import { useMe } from "../../app/session"
import { listAllOrderMessages, listAllOrders, listMatchQueue, listRequestCategories, listSuppliers, MAX_APPROVED, type AdminOrder, type QueueRequest, type SupplierForReview } from "../../services/data/admin"
import { listCategories, type Category } from "../../services/data/catalogue"
import { getOrderMoney, type OrderMoney } from "../../services/data/money"
import { ORDER_STEPS, type OrderMessage } from "../../services/data/orders"
import { Alert } from "../../ui/form"
import { notificationsPath } from "../notifications/notify"
import { isDone, STEP_LABEL } from "../orders/OrdersPage"
import { day, daysLeft, daysUntil, errorText, rupees, SummaryCards } from "../supplier/parts"
import BusinessPanel, { type BusinessEntry } from "./BusinessPanel"
import { AiSummary, Greeting, Panel, RecentActivity, TodoList, type TodoItem } from "./parts"

interface Data {
  queue: QueueRequest[]
  orders: AdminOrder[]
  messages: OrderMessage[]
  money: Map<string, OrderMoney>
  requestCategory: Map<string, string | null>
  suppliers: SupplierForReview[]
  categories: Category[]
}

const WEEK = 7 * 24 * 60 * 60 * 1000
const thisWeek = (iso: string | null | undefined) => !!iso && Date.now() - new Date(iso).getTime() < WEEK
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const owesSupplier = (m: OrderMoney | undefined) => Math.max(-(m?.balances.supplier_payable ?? 0), 0)
const clip = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

export default function AdminOverview() {
  const me = useMe()
  const navigate = useNavigate()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Dashboard · MPI admin"
    let alive = true
    ;(async () => {
      try {
        const [queue, orders, messages, suppliers, categories] = await Promise.all([
          listMatchQueue().catch(() => []),
          listAllOrders(),
          listAllOrderMessages().catch(() => []),
          listSuppliers().catch(() => []),
          listCategories().catch(() => []),
        ])
        const [sums, requestCategory] = await Promise.all([
          Promise.all(orders.map((o) => getOrderMoney(o.id).catch(() => null))),
          listRequestCategories([...new Set(orders.map((o) => o.request_id))]).catch(() => new Map<string, string | null>()),
        ])
        if (!alive) return
        setData({
          queue,
          orders,
          messages,
          suppliers,
          categories,
          requestCategory,
          money: new Map(orders.flatMap((o, i) => (sums[i] ? [[o.id, sums[i]!] as const] : []))),
        })
      } catch (err) {
        if (alive) setError(errorText(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const view = useMemo(() => {
    if (!data) return null
    const { queue, orders, messages, money, suppliers, categories, requestCategory } = data

    // AI matches still waiting on requests that can take more suppliers.
    const toReview = queue.filter((q) => q.waitingCount > 0 && q.approvedCount < MAX_APPROVED)
    const matchesWaiting = toReview.reduce((n, q) => n + q.waitingCount, 0)

    // Conversations (one per order and side) whose last message is waiting for MPI.
    const last = new Map<string, OrderMessage>()
    for (const m of messages) last.set(`${m.po_id}:${m.org_id}`, m)
    const unanswered = [...last.values()].filter((m) => !m.from_mpi)

    const liveOrders = orders.filter((o) => !isDone(o))
    const late = liveOrders.filter((o) => o.status !== "delivered" && (daysUntil(o.expected_delivery) ?? 1) < 0)
    const payouts = orders.filter((o) => owesSupplier(money.get(o.id)) > 0)
    const toPayOut = payouts.reduce((n, o) => n + owesSupplier(money.get(o.id)), 0)
    const placed = orders.filter((o) => o.status !== "cancelled")
    const revenue = placed.reduce((n, o) => n + (money.get(o.id)?.amounts.mpi?.revenue ?? 0), 0)
    const newOrders = placed.filter((o) => thisWeek(o.approved_at || o.created_at)).length
    const toVerify = suppliers.filter((s) => ["pending", "under_review"].includes(s.organisation.verification_status))
    const orderById = new Map(orders.map((o) => [o.id, o]))

    const todo: TodoItem[] = []
    for (const m of unanswered) {
      const o = orderById.get(m.po_id)
      const side = o && m.org_id === o.vendor_org_id ? "supplier" : "buyer"
      todo.push({
        id: `msg-${m.po_id}-${m.org_id}`,
        icon: MessageSquare,
        title: `Reply to the ${side} on ${o ? `${o.po_number} (${o.requestTitle})` : "an order"}`,
        detail: `"${clip(m.body)}"`,
        cta: "Reply",
        to: notificationsPath("admin", { order: m.po_id, side }),
        urgent: true,
      })
    }
    for (const o of payouts) {
      todo.push({
        id: `pay-${o.id}`,
        icon: Wallet,
        title: `Pay out ${rupees(owesSupplier(money.get(o.id)))} to ${o.supplierRealName}`,
        detail: `${o.po_number} · the buyer has paid · simulated payout`,
        cta: "Pay out",
        to: `/admin/orders?o=${o.id}&tab=money`,
        urgent: true,
      })
    }
    for (const q of toReview) {
      const d = daysUntil(q.request.needed_by)
      todo.push({
        id: `match-${q.request.id}`,
        icon: Sparkles,
        title: `Review ${plural(q.waitingCount, "AI match", "AI matches")} for ${q.request.title}`,
        detail: `${q.buyerName || "Startup"} · ${q.approvedCount} of ${MAX_APPROVED} approved${q.request.needed_by ? ` · needed by ${day(q.request.needed_by)} (${daysLeft(q.request.needed_by)})` : ""}`,
        cta: "Review",
        to: `/admin/matches?r=${q.request.id}`,
        urgent: d !== null && d <= 7,
      })
    }
    for (const o of late) {
      todo.push({
        id: `late-${o.id}`,
        icon: AlarmClock,
        title: `Check on late order: ${o.requestTitle}`,
        detail: `${o.po_number} · ${o.supplierRealName} · was due ${day(o.expected_delivery)}`,
        cta: "Open",
        to: `/admin/orders?o=${o.id}`,
        urgent: true,
      })
    }
    for (const s of toVerify.slice(0, 3)) {
      todo.push({
        id: `verify-${s.organisation.id}`,
        icon: ShieldCheck,
        title: `Verify supplier ${s.organisation.name}`,
        detail: [s.organisation.city, s.organisation.state].filter(Boolean).join(", ") || "New supplier sign-up",
        cta: "Verify",
        to: "/admin/verification",
      })
    }
    todo.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))

    const gettingStarted: TodoItem[] = [
      { id: "gs-matches", icon: Sparkles, title: "Look at the AI matches queue", detail: "New startup requests show up here for approval", cta: "Open", to: "/admin/matches" },
      { id: "gs-terms", icon: CircleDollarSign, title: "Check the payment terms", detail: "Full advance or 30/70, per category", cta: "Open", to: "/admin/payment-terms" },
      { id: "gs-demo", icon: RefreshCcw, title: "Reset the demo workspace", detail: "Fresh demo requests, offers and orders", cta: "Open", to: "/admin/demo" },
    ]

    // Business through MPI: every order that wasn't cancelled.
    const catName = new Map(categories.map((c) => [c.id, c.name]))
    const business: BusinessEntry[] = placed.map((o) => {
      const m = money.get(o.id)
      const cat = requestCategory.get(o.request_id)
      return {
        at: o.approved_at || o.created_at,
        category: (cat && catName.get(cat)) || "Other",
        value: m?.amounts.buyer?.checkout_total ?? o.total_amount,
        toSupplier: m?.amounts.supplier?.payout ?? o.total_amount,
        revenue: m?.amounts.mpi?.revenue ?? 0,
        saved: Math.max(0, m?.amounts.savings?.net ?? 0),
      }
    })
    const value = business.reduce((n, e) => n + e.value, 0)

    const facts = [
      matchesWaiting ? `${plural(matchesWaiting, "AI-suggested supplier")} waiting for approval on ${plural(toReview.length, "request")}` : "No AI matches waiting for approval",
      unanswered.length ? `${plural(unanswered.length, "message")} from buyers or suppliers waiting for MPI's reply` : "All order messages answered",
      payouts.length ? `${rupees(toPayOut)} to pay out to suppliers on ${plural(payouts.length, "order")}` : "No supplier payouts due",
      `${plural(liveOrders.length, "order")} in progress${late.length ? `, ${late.length} past the delivery date` : ""}`,
      ...late.slice(0, 2).map((o) => `Order "${o.requestTitle}" from ${o.supplierRealName} was due ${day(o.expected_delivery)}`),
      toVerify.length ? `${plural(toVerify.length, "supplier")} waiting for verification` : "",
      value > 0 ? `${rupees(value)} of orders through MPI so far, earning MPI ${rupees(revenue)} before GST` : "",
    ]
      .filter(Boolean)
      .slice(0, 12)

    const fallback = todo.length
      ? `${plural(todo.length, "thing")} need${todo.length === 1 ? "s" : ""} you today, starting with: ${todo[0].title.charAt(0).toLowerCase()}${todo[0].title.slice(1)}.`
      : `Nothing needs you right now. ${liveOrders.length ? `${plural(liveOrders.length, "order")} in progress.` : "New requests show up in AI matches."}`

    return { toReview, matchesWaiting, unanswered, liveOrders, late, payouts, toPayOut, revenue, newOrders, todo, gettingStarted, facts, fallback, business }
  }, [data])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Greeting name={me.profile.full_name || ""} line="Here's what's happening on MPI today." />
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
          <Link to="/admin/matches" className="btn-gradient inline-flex min-h-11 items-center gap-2 rounded-md px-5 font-bold text-navy shadow-[0_4px_14px_rgba(236,141,73,0.3)]">
            <Sparkles size={18} aria-hidden="true" /> Review AI matches
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
            onPick={(id) => navigate(id === "matches" ? "/admin/matches" : id === "messages" ? notificationsPath("admin", {}) : "/admin/orders")}
            items={[
              {
                id: "matches",
                label: "AI matches to review",
                value: view.matchesWaiting,
                hint: view.toReview.length ? `on ${plural(view.toReview.length, "request")}` : "queue is clear",
                icon: Sparkles,
                dot: view.matchesWaiting > 0,
                cta: view.matchesWaiting ? "Review matches" : undefined,
              },
              {
                id: "orders",
                label: "Active orders",
                value: view.liveOrders.length,
                trend: view.newOrders ? `+${view.newOrders} this week` : undefined,
                hint: view.late.length ? `${view.late.length} late` : view.liveOrders.length ? "all on track" : "none right now",
                icon: Package,
                dot: view.late.length > 0,
                cta: view.liveOrders.length ? "Track orders" : undefined,
              },
              {
                id: "payouts",
                label: "To pay out",
                value: rupees(view.toPayOut),
                hint: view.payouts.length ? `to suppliers on ${plural(view.payouts.length, "order")}` : "nothing owed",
                icon: Wallet,
                dot: view.toPayOut > 0,
                cta: view.toPayOut > 0 ? "Pay suppliers" : undefined,
              },
              {
                id: "revenue",
                label: "MPI revenue",
                value: rupees(view.revenue),
                tone: "good",
                hint: "fees + commission, before GST",
                icon: CircleDollarSign,
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)] lg:items-start">
            {/* On a phone the two columns melt into one list, with Needs your attention first. */}
            <div className="min-w-0 space-y-5 max-lg:contents">
              <BusinessPanel entries={view.business} />
              <Panel
                title="Orders in progress"
                icon={Truck}
                action={
                  <Link to="/admin/orders" className="text-[13.5px] font-semibold text-navy hover:underline">
                    All orders
                  </Link>
                }
              >
                {view.liveOrders.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[14px] text-muted">No orders in progress. When a startup approves a quote, it shows up here.</p>
                ) : (
                  <ul>
                    {view.liveOrders.slice(0, 5).map((o) => {
                      const step = ORDER_STEPS.indexOf(o.status)
                      const pct = Math.round(((step + 1) / ORDER_STEPS.length) * 100)
                      const isLate = view.late.includes(o)
                      return (
                        <li key={o.id} className="border-b border-line/70 last:border-b-0">
                          <Link to={`/admin/orders?o=${o.id}`} className="block px-4 py-3.5 hover:bg-navy-tint/40 sm:px-5">
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className="font-semibold text-navy">{o.requestTitle}</span>
                              <span className={`text-[13px] font-semibold ${isLate ? "text-red-text" : "text-muted"}`}>
                                {o.status === "delivered" ? "Delivered" : o.expected_delivery ? `Delivery ${day(o.expected_delivery)} · ${daysLeft(o.expected_delivery)}` : "No delivery date yet"}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[12.5px] text-muted">
                              {o.po_number} · {o.buyerRealName} → {o.supplierRealName} · {STEP_LABEL[o.status]} (step {step + 1} of {ORDER_STEPS.length})
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
              <Panel
                title={view.todo.length ? "Needs your attention" : "Getting started"}
                icon={ListChecks}
                className="flex flex-col max-lg:order-first"
                action={view.todo.length ? <span className="rounded-full bg-orange px-2 py-px text-[12px] font-bold text-navy">{view.todo.length}</span> : undefined}
              >
                <TodoList
                  items={view.todo.length ? view.todo : view.gettingStarted}
                  empty="No matches to review, messages to answer or payouts due right now."
                  emptyActions={
                    <>
                      <Link to="/admin/notifications" className="btn-gradient inline-flex min-h-10 items-center rounded-md px-4 text-[13.5px] font-bold text-navy shadow-sm hover:brightness-95">
                        View activity
                      </Link>
                      <Link to="/admin/matches" className="btn-gradient inline-flex min-h-10 items-center gap-1.5 rounded-md px-4 text-[13.5px] font-bold text-navy shadow-sm hover:brightness-95">
                        <Sparkles size={15} aria-hidden="true" /> AI matches
                      </Link>
                    </>
                  }
                />
              </Panel>
              <RecentActivity role="admin" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
