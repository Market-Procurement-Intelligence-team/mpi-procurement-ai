/**
 * Orders, for the startup (/startup/orders) and the supplier (/supplier/orders).
 *
 * Navy summary cards on top. Left: the list of orders (Active / Done).
 * Right: one order, with tabs:
 * - Progress: the 6 steps with their dates. The supplier moves the order
 *   forward (with an expected delivery date); the startup confirms it once
 *   delivered.
 * - Payments: each side's invoices with their parts (before work starts, on
 *   delivery). The startup pays what is due now; the supplier sees MPI's
 *   commission and its payout. Payments are SIMULATED and say so.
 * - Items: the lines of the approved quote.
 * Contact supplier/buyer and Need help open this order's conversation with
 * MPI on the Notifications screen (Messages tab).
 * Header actions also download the PO and invoices (print or save as PDF).
 *
 * Each side sees the other only as "MPI Verified Buyer/Supplier #…".
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  Factory,
  FileText,
  Inbox,
  Info,
  LifeBuoy,
  MessageSquare,
  Package,
  PackageCheck,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react"
import { getOrderMoney, INVOICE_LABELS, payOrder, SIMULATED_NOTE, type InvoiceSummary, type OrderMoney } from "../../services/data/money"
import {
  listMyOrders,
  listOrderHistory,
  ORDER_STEPS,
  updateOrderStatus,
  type OrderEvent,
  type OrderStatus,
  type OrderSummary,
} from "../../services/data/orders"
import { listQuoteLines, type QuoteLine } from "../../services/data/quotes"
import Button from "../../ui/Button"
import EmptyState from "../../ui/EmptyState"
import { Alert, BOX, boxBorder } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { Chip, day, daysLeft, daysUntil, errorText, GRADIENT_PANEL, rupees, SummaryCards, useToast } from "../supplier/parts"
import { notificationsPath } from "../notifications/notify"
import { printInvoice, printPurchaseOrder } from "./printDoc"

type Side = "startup" | "vendor"
type ListTab = "active" | "done"
type DetailTab = "progress" | "payments" | "items"

export const STEP_LABEL: Record<OrderStatus, string> = {
  issued: "Order placed",
  in_production: "In production",
  qc_passed: "Quality checked",
  dispatched: "Dispatched",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
}

const STEP_ICON: Record<OrderStatus, typeof Package> = {
  issued: FileText,
  in_production: Factory,
  qc_passed: ClipboardCheck,
  dispatched: Truck,
  delivered: PackageCheck,
  completed: BadgeCheck,
  cancelled: FileText,
}

export const STATUS_TONE: Record<OrderStatus, "navy" | "orange" | "red" | "line"> = {
  issued: "orange",
  in_production: "orange",
  qc_passed: "orange",
  dispatched: "orange",
  delivered: "orange",
  completed: "navy",
  cancelled: "red",
}

export const isDone = (o: OrderSummary) => o.status === "completed" || o.status === "cancelled"

const isoIn = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Installments the startup can pay right now (what the database's pay_order will take). */
export function dueNow(money: OrderMoney | undefined, status: OrderStatus): number {
  if (!money) return 0
  const delivered = status === "delivered" || status === "completed"
  return money.invoices
    .filter((i) => i.kind !== "mpi_commission_to_supplier" && i.status !== "cancelled")
    .flatMap((i) => i.installments ?? [])
    .filter((x) => x.status === "due" && x.amount > 0 && (x.due === "on_order" || (x.due === "on_delivery" && delivered)))
    .reduce((n, x) => n + x.amount, 0)
}

/** Everything the startup still has to pay on an order, now or later. */
export function stillToPay(money: OrderMoney | undefined): number {
  if (!money) return 0
  return money.invoices
    .filter((i) => i.kind !== "mpi_commission_to_supplier" && i.status !== "cancelled")
    .flatMap((i) => i.installments ?? [])
    .filter((x) => x.status === "due")
    .reduce((n, x) => n + x.amount, 0)
}

// ---------------------------------------------------------------- list

function OrderList({
  orders,
  side,
  selectedId,
  money,
  onSelect,
}: {
  orders: OrderSummary[]
  side: Side
  selectedId: string | null
  money: Map<string, OrderMoney>
  onSelect: (id: string) => void
}) {
  if (!orders.length) return <p className="px-5 py-10 text-center text-muted">Nothing here right now.</p>
  return (
    <ul className="space-y-2 p-3">
      {orders.map((o) => {
        const selected = o.id === selectedId
        const due = side === "startup" ? dueNow(money.get(o.id), o.status) : 0
        const needsYou =
          side === "startup" ? due > 0 || o.status === "delivered" : !isDone(o) && o.status !== "delivered"
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onSelect(o.id)}
              aria-current={selected || undefined}
              className={`flex w-full items-start gap-3 rounded-lg border-[1.5px] py-3 pr-3.5 text-left transition-colors ${
                selected
                  ? "border-l-[5px] border-orange pl-3 bg-orange-tint/45 shadow-[0_2px_8px_rgba(240,154,71,0.25)]"
                  : "border-line bg-white pl-[calc(0.75rem+3.5px)] hover:border-orange/60"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-navy" title={o.requestTitle}>
                  {o.requestTitle || o.po_number}
                </span>
                <span className="mt-1 block text-[12.5px] text-muted">{o.po_number}</span>
                <span className="block text-[12.5px] text-muted">
                  {(side === "startup" ? o.supplierName : o.buyerName).replace("MPI Verified ", "")}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                <span className={`text-[12px] font-semibold ${selected ? "text-navy" : "text-muted"}`}>{STEP_LABEL[o.status]}</span>
                {needsYou && !isDone(o) && (
                  <span className="rounded-full bg-orange px-2 py-0.5 text-[11.5px] font-bold text-navy">
                    {side === "startup" ? (due > 0 ? "Pay now" : "Confirm") : "Update"}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- progress

export function Stepper({ status, events }: { status: OrderStatus; events: OrderEvent[] }) {
  const reached = ORDER_STEPS.indexOf(status)
  return (
    <ol className="grid gap-2 sm:grid-cols-6">
      {ORDER_STEPS.map((s, i) => {
        const done = i <= reached
        const current = i === reached
        const when = events.filter((e) => e.status === s).at(-1)?.created_at ?? null
        const Icon = STEP_ICON[s]
        return (
          <li key={s} className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:text-center">
            {i > 0 && (
              <span
                className={`absolute hidden h-[3px] sm:block ${i <= reached ? "bg-orange" : "bg-line"}`}
                style={{ left: "-50%", right: "50%", top: 20 }}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                current ? "btn-gradient text-navy shadow-[0_0_0_4px_rgba(240,154,71,0.25)]" : done ? "bg-navy text-orange" : "border-[1.5px] border-line bg-white text-muted"
              }`}
              aria-hidden="true"
            >
              {done && !current ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
            </span>
            <span>
              <span className={`block text-[13.5px] font-semibold ${done ? "text-navy" : "text-muted"}`}>{STEP_LABEL[s]}</span>
              <span className="block text-[12px] text-muted">{when ? day(when) : done ? "" : "Not yet"}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function SupplierUpdate({ order, onDone }: { order: OrderSummary; onDone: (msg: string) => Promise<void> }) {
  const at = ORDER_STEPS.indexOf(order.status)
  const next = ORDER_STEPS[at + 1]
  const [date, setDate] = useState(order.expected_delivery ?? isoIn(7))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!next || next === "completed") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-navy-tint/60 px-4 py-3 text-[14px] text-navy">
        <Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        {order.status === "delivered"
          ? "Delivered. The buyer now confirms the order is complete."
          : "This order is closed."}
      </p>
    )
  }
  return (
    <div className="rounded-xl border-[1.5px] border-orange bg-orange-tint/40 p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">Your next step</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label htmlFor="eta" className="mb-1.5 block text-sm font-semibold text-navy">
            Expected delivery
          </label>
          <input id="eta" type="date" value={date} min={isoIn(0)} onChange={(e) => setDate(e.target.value)} className={`${BOX} ${boxBorder()} min-h-11`} />
        </div>
        <Button
          busy={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await updateOrderStatus(order.id, next, date || undefined)
              await onDone(`Marked as ${STEP_LABEL[next].toLowerCase()}`)
            } catch (err) {
              setError(errorText(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          Mark as {STEP_LABEL[next].toLowerCase()}
        </Button>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">The buyer is told each time you move the order forward.</p>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

function StartupConfirm({ order, onDone }: { order: OrderSummary; onDone: (msg: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (order.status !== "delivered") {
    const d = order.expected_delivery
    return (
      <p className="flex items-start gap-2 rounded-lg bg-navy-tint/60 px-4 py-3 text-[14px] text-navy">
        <Truck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        {order.status === "completed"
          ? "You confirmed this order is complete. Thank you."
          : d
            ? `The supplier expects to deliver by ${day(d, true)} (${daysLeft(d)}). You'll get a message at each step.`
            : "The supplier will share a delivery date soon. You'll get a message at each step."}
      </p>
    )
  }
  return (
    <div className="rounded-xl border-[1.5px] border-orange bg-orange-tint/40 p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">Your next step</p>
      <p className="mt-1 text-[15px] text-navy">The supplier marked this order as delivered. Got everything in good shape?</p>
      <Button
        className="mt-3"
        busy={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await updateOrderStatus(order.id, "completed")
            await onDone("Order marked complete")
          } catch (err) {
            setError(errorText(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <CheckCircle2 size={17} aria-hidden="true" /> Yes, mark as complete
      </Button>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- payments

const INVOICE_TONE: Record<InvoiceSummary["status"], { label: string; tone: "navy" | "orange" | "red" | "line" }> = {
  issued: { label: "Not paid", tone: "orange" },
  part_paid: { label: "Part paid", tone: "orange" },
  paid: { label: "Paid", tone: "navy" },
  cancelled: { label: "Cancelled", tone: "line" },
}

const DUE_TEXT = { on_order: "Before work starts", on_delivery: "On delivery", on_settlement: "When MPI settles" } as const

export function InvoiceCard({ invoice, side, order }: { invoice: InvoiceSummary; side: Side | "admin"; order: OrderSummary }) {
  const st = INVOICE_TONE[invoice.status]
  const label =
    side === "vendor" && invoice.kind === "supplier_to_buyer"
      ? "Your invoice to the buyer"
      : side === "vendor" && invoice.kind === "mpi_commission_to_supplier"
        ? "MPI commission (taken from your payout)"
        : side === "startup" && invoice.kind === "supplier_to_buyer"
          ? "Supplier's invoice"
          : INVOICE_LABELS[invoice.kind]
  return (
    <article className="rounded-xl border-[1.5px] border-line bg-white soft-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-bold text-navy">{label}</p>
          <p className="text-[12.5px] text-muted">
            {invoice.number} · issued {day(invoice.issued_at)}
          </p>
        </div>
        <Chip tone={st.tone}>{st.label}</Chip>
      </div>
      <button
        type="button"
        onClick={() => printInvoice(order, invoice, label)}
        className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy underline-offset-2 hover:underline"
      >
        <Download size={14} aria-hidden="true" /> Download invoice
      </button>
      <dl className="mt-3 space-y-1 text-[14px]">
        <div className="flex justify-between"><dt className="text-muted">Amount before GST</dt><dd className="font-semibold text-navy">{rupees(invoice.taxable)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">GST</dt><dd className="font-semibold text-navy">{rupees(invoice.gst)}</dd></div>
        <div className="flex justify-between border-t border-line pt-1.5"><dt className="font-bold text-navy">Total</dt><dd className="font-display text-[17px] font-bold text-navy">{rupees(invoice.total)}</dd></div>
      </dl>
      {invoice.installments && invoice.installments.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {invoice.installments.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 rounded-lg bg-page/70 px-3 py-2 text-[13.5px]">
              <span className="text-navy">
                <strong>{x.label || DUE_TEXT[x.due]}</strong>
                {x.paid_at && <span className="text-muted"> · paid {day(x.paid_at)}</span>}
              </span>
              <span className="flex items-center gap-2">
                <strong className="text-navy">{rupees(x.amount)}</strong>
                {x.status === "paid" ? (
                  <Check size={15} className="text-navy" aria-label="Paid" />
                ) : (
                  <span className="text-[12px] font-semibold text-muted">{x.status === "waived" ? "Waived" : "Due"}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function Payments({ order, money, side, onDone }: { order: OrderSummary; money: OrderMoney | null; side: Side; onDone: (msg: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!money) return <p className="text-muted">Loading the payments…</p>
  const invoices = money.invoices.filter((i) =>
    side === "startup" ? i.kind !== "mpi_commission_to_supplier" : i.kind !== "mpi_fee_to_buyer",
  )
  const now = dueNow(money, order.status)
  const later = stillToPay(money) - now
  const s = money.amounts.supplier

  return (
    <div className="space-y-4">
      {side === "startup" ? (
        <div className="flex flex-col gap-3 rounded-xl bg-navy p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">{now > 0 ? "Due now" : "Nothing due now"}</p>
            <p className="font-display text-[30px] font-bold leading-tight text-orange">{rupees(now)}</p>
            <p className="text-[13px] text-white/75">
              {later > 0 ? `${rupees(later)} more on delivery.` : now > 0 ? "That's everything for this order." : "All paid for this order."}
            </p>
          </div>
          {now > 0 && (
            <div>
              <Button
                busy={busy}
                onClick={async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await payOrder(order.id)
                    await onDone(`Paid ${rupees(now)} (simulated)`)
                  } catch (err) {
                    setError(errorText(err))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Wallet size={17} aria-hidden="true" /> Pay {rupees(now)}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-navy p-4 text-white">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">Your payout</p>
            <p className="font-display text-[26px] font-bold text-orange">{rupees(s?.payout ?? 0)}</p>
            <p className="text-[12.5px] text-white/70">Invoice minus MPI commission</p>
          </div>
          <div className="rounded-xl border-[1.5px] border-line bg-white soft-panel p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">MPI owes you now</p>
            <p className="font-display text-[22px] font-bold text-navy">{rupees(money.balances.mpi_owes_you ?? 0)}</p>
            <p className="text-[12.5px] text-muted">From what the buyer has paid</p>
          </div>
          <div className="rounded-xl border-[1.5px] border-line bg-white soft-panel p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Paid out so far</p>
            <p className="font-display text-[22px] font-bold text-navy">
              {rupees((money.payouts ?? []).reduce((n, p) => n + p.net, 0))}
            </p>
            <p className="text-[12.5px] text-muted">MPI commission {rupees(s?.commission_invoice ?? 0)} incl. GST</p>
          </div>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <Info size={15} aria-hidden="true" /> {SIMULATED_NOTE}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {invoices.map((i) => (
          <InvoiceCard key={i.id} invoice={i} side={side} order={order} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- detail

function OrderPanel({
  order,
  side,
  money,
  onBack,
  onDone,
}: {
  order: OrderSummary
  side: Side
  money: OrderMoney | null
  onBack: () => void
  onDone: (msg: string) => Promise<void>
}) {
  const [params, setParams] = useSearchParams()
  const tab = (params.get("tab") as DetailTab | null) ?? "progress"
  const setTab = (t: DetailTab) => {
    const p = new URLSearchParams(params)
    p.set("tab", t)
    setParams(p, { replace: true })
  }
  const [events, setEvents] = useState<OrderEvent[]>([])
  const [lines, setLines] = useState<QuoteLine[] | null>(null)
  const navigate = useNavigate()
  const openMessages = (topic: string) =>
    navigate(notificationsPath(side === "startup" ? "startup" : "vendor", { order: order.id, topic }))

  useEffect(() => {
    let alive = true
    listOrderHistory(order.id).then((e) => alive && setEvents(e)).catch(() => undefined)
    listQuoteLines(order.quote_id).then((l) => alive && setLines(l)).catch(() => alive && setLines([]))
    return () => {
      alive = false
    }
  }, [order.id, order.quote_id, order.status])

  const other = side === "startup" ? order.supplierName : order.buyerName
  const total = side === "startup" ? money?.amounts.buyer?.checkout_total : money?.amounts.supplier?.invoice_total
  const eta = order.expected_delivery

  const facts: [ReactNode, ReactNode][] = [
    ["Placed", day(order.approved_at, true)],
    ["Expected delivery", eta ? `${day(eta, true)}${!isDone(order) ? ` (${daysLeft(eta)})` : ""}` : "Not set yet"],
  ]

  return (
    <section className="overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={GRADIENT_PANEL} aria-label={order.po_number}>
      <div className="bg-gradient-to-br from-navy-tint via-navy-tint/60 to-orange-tint/50 px-5 pt-4 sm:px-6">
        <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy lg:hidden">
          <ArrowLeft size={16} aria-hidden="true" /> All orders
        </button>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-muted">{order.po_number}</p>
          <div className="flex flex-wrap gap-2" aria-label="Order actions">
            <button
              type="button"
              onClick={() => openMessages("for_other_side")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-navy px-3 text-[13.5px] font-semibold text-white hover:bg-navy-2"
            >
              <MessageSquare size={15} aria-hidden="true" /> Contact {side === "startup" ? "supplier" : "buyer"}
            </button>
            <button
              type="button"
              onClick={() => openMessages("other")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border-[1.5px] border-navy bg-white px-3 text-[13.5px] font-semibold text-navy hover:bg-navy-tint"
            >
              <LifeBuoy size={15} aria-hidden="true" /> Need help
            </button>
            <button
              type="button"
              disabled={!lines}
              onClick={() => lines && printPurchaseOrder(order, lines, total)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border-[1.5px] border-navy bg-white px-3 text-[13.5px] font-semibold text-navy hover:bg-navy-tint disabled:opacity-50"
            >
              <Download size={15} aria-hidden="true" /> Download PO
            </button>
            <button
              type="button"
              onClick={() => setTab("payments")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border-[1.5px] border-navy bg-white px-3 text-[13.5px] font-semibold text-navy hover:bg-navy-tint"
            >
              <FileText size={15} aria-hidden="true" /> Invoices
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-bold leading-tight text-navy">{order.requestTitle}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-[14px] text-navy">
              {other} <ShieldCheck size={15} className="text-orange" aria-label="Verified by MPI" />
            </p>
          </div>
          <div className="sm:text-right">
            <Chip tone={STATUS_TONE[order.status]}>{STEP_LABEL[order.status]}</Chip>
            {total !== undefined && (
              <p className="mt-1 font-display text-[22px] font-bold text-navy">{rupees(total)}</p>
            )}
            <p className="text-[12px] text-muted">{side === "startup" ? "incl. GST and MPI fee" : "your invoice incl. GST"}</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-[13.5px]">
          {facts.map(([k, v]) => (
            <li key={String(k)} className="rounded-full bg-white px-3 py-1 text-navy ring-1 ring-line">
              <span className="text-muted">{k}:</span> <strong>{v}</strong>
            </li>
          ))}
          {side === "startup" && money && dueNow(money, order.status) > 0 && (
            <li className="rounded-full bg-orange px-3 py-1 font-bold text-navy">Due now {rupees(dueNow(money, order.status))}</li>
          )}
        </ul>
        <div className="h-4" />
      </div>

      <div className="border-y border-line bg-white px-5 py-3 sm:px-6">
        <div role="tablist" aria-label="Order sections" className="grid grid-cols-2 gap-1 rounded-2xl bg-page p-1 sm:inline-flex sm:rounded-full">
          {(
            [
              { id: "progress", label: "Progress" },
              { id: "payments", label: "Payments" },
              { id: "items", label: "Items", count: lines?.length },
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
                {t.count !== undefined && (
                  <span className={`rounded-full px-1.5 text-[11.5px] font-bold ${active ? "bg-orange text-navy" : "bg-white text-navy"}`}>{t.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white p-5 sm:p-6">
        {tab === "progress" && (
          <div className="space-y-5">
            <Stepper status={order.status} events={events} />
            {side === "vendor" ? <SupplierUpdate order={order} onDone={onDone} /> : <StartupConfirm order={order} onDone={onDone} />}
          </div>
        )}
        {tab === "payments" && <Payments order={order} money={money} side={side} onDone={onDone} />}
        {tab === "items" && (
          <div className="overflow-x-auto rounded-xl border-[1.5px] border-line">
            <table className="w-full min-w-[32rem] text-[14px]">
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
                {(lines ?? []).map((l, i) => (
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
            {lines && lines.length === 0 && <p className="px-4 py-6 text-center text-muted">No items to show.</p>}
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- page

export default function OrdersPage({ side }: { side: Side }) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [money, setMoney] = useState<Map<string, OrderMoney>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [toast, toastNode] = useToast()

  const listTab = (params.get("list") as ListTab | null) ?? "active"
  const selectedId = params.get("o")

  const reload = useCallback(async () => {
    try {
      const fresh = await listMyOrders()
      setOrders(fresh)
      const sums = await Promise.all(fresh.map((o) => getOrderMoney(o.id).catch(() => null)))
      setMoney(new Map(fresh.flatMap((o, i) => (sums[i] ? [[o.id, sums[i]!] as const] : []))))
      setError(null)
    } catch (err) {
      setError(errorText(err))
      setOrders((o) => o ?? [])
    }
  }, [])

  useEffect(() => {
    document.title = `${side === "startup" ? "Orders" : "My orders"} · MPI`
    void reload()
  }, [reload, side])

  const sorted = useMemo(() => {
    const all = orders ?? []
    const eta = (o: OrderSummary) => daysUntil(o.expected_delivery) ?? 999
    return {
      active: all.filter((o) => !isDone(o)).sort((a, b) => eta(a) - eta(b)),
      done: all.filter(isDone),
    }
  }, [orders])

  const shown = sorted[listTab]
  const selected = (orders ?? []).find((o) => o.id === selectedId) ?? null

  // Pick the first order on wide screens so the panel isn't empty.
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

  const all = orders ?? []
  const active = sorted.active
  const startupCards = () => {
    const payNow = active.reduce((n, o) => n + dueNow(money.get(o.id), o.status), 0)
    const toConfirm = active.filter((o) => o.status === "delivered").length
    const owed = all.reduce((n, o) => n + stillToPay(money.get(o.id)), 0)
    return [
      { id: "active", label: "Active orders", value: active.length, hint: active.length ? "in progress" : "none right now", icon: Package },
      { id: "pay", label: "Due now", value: rupees(payNow), hint: payNow ? "ready to pay" : "nothing to pay", icon: Wallet, dot: payNow > 0 },
      { id: "confirm", label: "To confirm", value: toConfirm, hint: toConfirm ? "delivered, check and confirm" : "nothing waiting", icon: PackageCheck, dot: toConfirm > 0 },
      { id: "owed", label: "Still to pay", value: rupees(owed), hint: "across all orders", icon: CircleDollarSign },
    ]
  }
  const vendorCards = () => {
    const toUpdate = active.filter((o) => o.status !== "delivered").length
    const soon = active.filter((o) => (daysUntil(o.expected_delivery) ?? 99) <= 7 && o.status !== "delivered").length
    const owed = all.reduce((n, o) => n + (money.get(o.id)?.balances.mpi_owes_you ?? 0), 0)
    const payout = all.reduce((n, o) => n + (money.get(o.id)?.amounts.supplier?.payout ?? 0), 0)
    return [
      { id: "active", label: "Active orders", value: active.length, hint: `${toUpdate} to move forward`, icon: Factory, dot: toUpdate > 0 },
      { id: "soon", label: "Due within 7 days", value: soon, hint: soon ? "deliver first" : "nothing urgent", icon: CalendarClock, dot: soon > 0 },
      { id: "owed", label: "MPI owes you", value: rupees(owed), hint: "from buyer payments", icon: Wallet },
      { id: "payouts", label: "Total payouts", value: rupees(payout), hint: "after MPI commission", icon: CircleDollarSign },
    ]
  }

  return (
    <div>
      <PageHeader
        title={side === "startup" ? "Orders" : "My orders"}
        description={
          side === "startup"
            ? "Track each order, pay what's due and confirm delivery. Payments are simulated for now."
            : "Move each order forward as you make and deliver it, and see what MPI pays you."
        }
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
        <EmptyState
          icon={Inbox}
          title="No orders yet"
          body={
            side === "startup"
              ? "When you approve a quote on one of your requests, the order shows up here."
              : "When a buyer approves your quote, the order shows up here."
          }
          action={
            side === "startup" ? (
              <Link to="/startup/requests" className="btn-gradient inline-flex min-h-11 items-center rounded-md px-5 font-bold text-navy">
                See my requests
              </Link>
            ) : (
              <Link to="/supplier/requests" className="btn-gradient inline-flex min-h-11 items-center rounded-md px-5 font-bold text-navy">
                See requests for you
              </Link>
            )
          }
        />
      ) : (
        <>
          <SummaryCards
            selected={listTab === "done" ? "done" : "active"}
            onPick={(id) => update({ list: id === "done" ? "done" : "active", o: null, tab: null })}
            items={side === "startup" ? startupCards() : vendorCards()}
          />
          <div className="grid gap-5 lg:grid-cols-[23rem_minmax(0,1fr)]">
            <aside className={`h-fit overflow-hidden rounded-xl border-[1.5px] border-line bg-white soft-panel shadow-[0_1px_3px_rgba(21,35,61,0.08)] lg:sticky lg:top-24 ${selected ? "hidden lg:block" : ""}`}>
              <div role="tablist" aria-label="Orders" className="flex gap-1 border-b border-line px-2">
                {(["active", "done"] as ListTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={listTab === t}
                    onClick={() => update({ list: t, o: null, tab: null })}
                    className={`flex min-h-12 items-center gap-2 border-b-[3px] px-3 text-[15px] font-semibold ${
                      listTab === t ? "border-orange text-navy" : "border-transparent text-muted hover:text-navy"
                    }`}
                  >
                    {t === "active" ? "Active" : "Done"}
                    <span className={`rounded-full px-2 py-px text-[12px] font-bold ${listTab === t ? "bg-orange text-navy" : "bg-navy-tint text-navy"}`}>
                      {sorted[t].length}
                    </span>
                  </button>
                ))}
              </div>
              <OrderList orders={shown} side={side} selectedId={selectedId} money={money} onSelect={(id) => update({ o: id, tab: null })} />
            </aside>
            <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
              {selected ? (
                <OrderPanel
                  key={selected.id}
                  order={selected}
                  side={side}
                  money={money.get(selected.id) ?? null}
                  onBack={() => update({ o: null, tab: null })}
                  onDone={done}
                />
              ) : (
                <EmptyState icon={Package} title="Pick an order" body="Choose an order on the left to see its progress and payments." />
              )}
            </div>
          </div>
        </>
      )}
      {toastNode}
    </div>
  )
}
