/**
 * Money: what an offer costs, what an order costs, invoices, payments,
 * payouts and returns. Follows the client's "Products & Services Master MVP
 * Specification v2" (31 Oct 2026), with its sample rates for the MVP.
 *
 * All amounts are worked out in the database by one calculation, so every
 * screen shows the same numbers. Each side only gets its own part:
 *   - the startup sees what it pays (supplier invoice, MPI fee, savings)
 *   - the supplier sees its invoice, MPI's commission and its payout
 *   - the admin sees everything
 *
 * Payments are SIMULATED in the MVP: no real money moves. Screens must say
 * so wherever a payment or payout is shown ("Simulated payment").
 *
 * Typical use:
 *   Startup comparing offers:  compareOffers(requestId), priceBreakdown(quoteId)
 *   Startup approving:         approveQuoteAtPrice(quoteId, breakdown.buyer.checkout_total)
 *   Startup paying:            payOrder(orderId)   (advance + MPI fee now, balance on delivery)
 *   Order page (any side):     getOrderMoney(orderId)
 *   Supplier dashboard:        getVolumeStatus()
 *   Admin:                     payOutSupplier, payRefund, setFeeRule, saveRateCard
 */

import { db } from "../../lib/db"
import type { Json, Tables } from "../../lib/database.types"
import { unwrap } from "./errors"

export type FeeRule = Tables<"fee_rules">
export type RateCard = Tables<"supplier_rate_cards">

/** One payment step, e.g. "Advance (30%) before work starts". */
export interface ScheduleStep {
  seq: number
  pct: number
  amount: number
}

export interface BuyerScheduleStep extends ScheduleStep {
  /** Part of this step that goes to the supplier's invoice. */
  supplier_part: number
  /** MPI's fee, paid in full with the first step. */
  mpi_fee_part: number
}

/** What the startup pays. All amounts in rupees. */
export interface BuyerAmounts {
  supplier_invoice: number
  /** The supplier's MPI volume discount, before GST. */
  volume_benefit: number
  /** Further discount agreed in negotiation, before GST. */
  negotiated_discount: number
  mpi_fee: number
  mpi_fee_gst: number
  mpi_fee_invoice: number
  /** Supplier invoice + MPI fee invoice. */
  checkout_total: number
  /** Costs paid directly (ad budget, government fees). Not discounted, no fee. */
  pass_through: number
  /** Reverse-charge GST the startup pays to the government itself (some legal work). */
  rcm_tax: number
  /** checkout_total + pass_through. */
  cash_paid: number
  /** cash_paid + rcm_tax: the full cost, used to compare offers. */
  total_cost: number
  schedule: BuyerScheduleStep[]
}

/** What the supplier invoices and receives. */
export interface SupplierAmounts {
  eligible_reference: number
  extras: number
  reference_value: number
  volume_pct: number
  volume_discount: number
  negotiated_pct: number
  negotiated_discount: number
  taxable: number
  tax_mode: "forward" | "reverse"
  gst: number
  invoice_total: number
  commission: number
  commission_gst: number
  commission_invoice: number
  /** invoice_total minus MPI's commission invoice. */
  payout: number
  schedule: ScheduleStep[]
}

export interface MpiAmounts {
  fee_base: number
  buyer_fee: number
  supplier_commission: number
  /** Fees before GST. GST is never MPI's revenue. */
  revenue: number
  gst_on_invoices: number
  invoices_total: number
}

export interface Savings {
  /** Like-for-like cost without MPI, before GST. */
  baseline: number
  /** Cost with MPI (MPI fee included), before GST. */
  with_mpi: number
  net: number
  pct: number
}

export type MoneySide = "buyer" | "supplier" | "admin"

export interface PriceBreakdown {
  formula_version: string
  side: MoneySide
  quote_id: string
  payment_terms: string | null
  payment_route: "mpi_collects" | "direct"
  /** Only for the startup and admin. */
  buyer?: BuyerAmounts
  savings?: Savings
  /** Only for the supplier and admin. */
  supplier?: SupplierAmounts
  /** Only for admin. */
  mpi?: MpiAmounts
  volume: { pct: number; clients_last_month: number | null; locked: boolean }
  fee_rule: { version: number; needs_review: boolean; professional_gate: boolean; note: string | null }
}

export interface Installment {
  id: string
  seq: number
  label: string
  amount: number
  due: "on_order" | "on_delivery" | "on_settlement"
  status: "due" | "paid" | "waived"
  paid_at: string | null
}

export type InvoiceKind = "supplier_to_buyer" | "mpi_fee_to_buyer" | "mpi_commission_to_supplier"

export interface InvoiceSummary {
  id: string
  number: string
  kind: InvoiceKind
  taxable: number
  gst: number
  rcm_gst: number
  total: number
  status: "issued" | "part_paid" | "paid" | "cancelled"
  paid: number
  credited: number
  issued_at: string
  lines: Json
  installments: Installment[] | null
}

export interface OrderMoney {
  po_id: string
  po_number: string
  side: MoneySide
  simulated_payments: true
  payment_route: "mpi_collects" | "direct"
  priced_with: {
    fee_rule_version: number | null
    formula_version: string
    volume_pct: number
    volume_clients: number | null
    priced_at: string
  }
  amounts: { buyer?: BuyerAmounts; savings?: Savings; supplier?: SupplierAmounts; mpi?: MpiAmounts; cash_reconciles?: boolean }
  invoices: InvoiceSummary[]
  payments: { id: string; amount: number; payee: "mpi" | "supplier"; simulated: boolean; paid_at: string }[]
  /** Supplier and admin only. */
  payouts: { gross: number; commission_deducted: number; net: number; kind: string; simulated: boolean; paid_at: string }[] | null
  credit_notes: { number: string; kind: string; total: number; units: number | null; reason: string | null; created_at: string }[]
  /** Startup and admin only. */
  refunds: { amount: number; simulated: boolean; paid_at: string }[] | null
  /**
   * Startup: { still_to_pay, refund_due }. Supplier: { mpi_owes_you, you_owe_mpi }.
   * Admin: MPI's ledger balances per account.
   */
  balances: Record<string, number>
}

export interface OfferScore {
  quote_id: string
  supplier_alias: string
  /** Full cost to the startup: supplier invoice, MPI fee, direct costs, reverse-charge GST. */
  total_cost: number
  checkout_total: number
  volume_benefit: number
  lead_time_days: number | null
  /** Out of 35 / 35 / 20 / 10 by default (admin can change the weights). */
  price_points: number
  quality_points: number
  delivery_points: number
  location_points: number
  /** Out of 100. */
  score: number
  rank: number
  reasons: string[]
}

export interface VolumeStatus {
  category_id: string
  category_name: string
  rate_card_id: string
  clients_last_month: number
  /** The discount MPI clients get from this supplier this month, %. */
  current_pct: number
  next_tier_clients: number | null
  next_tier_pct: number | null
  clients_this_month: number
  tiers: { min: number; pct: number }[]
}

/** Plain words for invoice kinds, for screens. */
export const INVOICE_LABELS: Record<InvoiceKind, string> = {
  supplier_to_buyer: "Supplier's invoice",
  mpi_fee_to_buyer: "MPI fee",
  mpi_commission_to_supplier: "MPI commission",
}

export const SIMULATED_NOTE = "Simulated payment: no real money moved."

/** A new key for one click of a pay button, so a double click is recorded once. */
export function newPaymentKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

// ---------------------------------------------------------------- reading

/** Price breakdown of a quote as of now, from the signed-in person's side. */
export async function getPriceBreakdown(quoteId: string): Promise<PriceBreakdown> {
  return unwrap(await db.rpc("price_breakdown", { p_quote_id: quoteId })) as unknown as PriceBreakdown
}

/** Offers on a request, scored out of 100, best first. Startup and admin only. */
export async function compareOffers(requestId: string): Promise<OfferScore[]> {
  return unwrap(await db.rpc("compare_offers", { p_request_id: requestId })) as OfferScore[]
}

/** Everything about an order's money, from the signed-in person's side. */
export async function getOrderMoney(orderId: string): Promise<OrderMoney> {
  return unwrap(await db.rpc("order_money", { p_po_id: orderId })) as unknown as OrderMoney
}

/** The supplier's MPI volume per category (admin may pass a supplier). */
export async function getVolumeStatus(vendorOrgId?: string): Promise<VolumeStatus[]> {
  const rows = unwrap(await db.rpc("volume_status", vendorOrgId ? { p_vendor_org_id: vendorOrgId } : {}))
  return rows.map((r) => ({ ...r, tiers: r.tiers as unknown as VolumeStatus["tiers"] }))
}

/** Fee rules in force: the latest version per category, platform default first. */
export async function listFeeRules(): Promise<FeeRule[]> {
  const rows = unwrap(await db.from("fee_rules").select("*").order("version", { ascending: false }))
  const latest = new Map<string, FeeRule>()
  for (const r of rows) {
    const key = r.category_id ?? "platform"
    if (!latest.has(key)) latest.set(key, r)
  }
  return [...latest.values()].sort((a, b) => (a.category_id === null ? -1 : b.category_id === null ? 1 : 0))
}

/** Active rate cards: the supplier's own, or all for admin. */
export async function listRateCards(vendorOrgId?: string): Promise<RateCard[]> {
  let query = db.from("supplier_rate_cards").select("*").eq("is_active", true)
  if (vendorOrgId) query = query.eq("vendor_org_id", vendorOrgId)
  return unwrap(await query)
}

// ---------------------------------------------------------------- actions

/**
 * Approves a quote only at the price the startup was shown. If the price
 * changed in between (for example a new fee rule), the database refuses and
 * the screen should reload the breakdown. Returns the order id.
 */
export async function approveQuoteAtPrice(quoteId: string, shownCheckoutTotal: number): Promise<string> {
  return unwrap(await db.rpc("approve_quote", { p_quote_id: quoteId, p_expected_checkout: shownCheckoutTotal }))
}

/** Startup pays what is due now (simulated). Pass the same key if the click is retried. */
export async function payOrder(orderId: string, key = newPaymentKey("pay")): Promise<Json> {
  return unwrap(await db.rpc("pay_order", { p_po_id: orderId, p_idempotency_key: key }))
}

/** Admin pays the supplier what MPI collected, minus commission (simulated). */
export async function payOutSupplier(orderId: string, key = newPaymentKey("payout")): Promise<Json> {
  return unwrap(await db.rpc("settle_supplier", { p_po_id: orderId, p_idempotency_key: key }))
}

/** Supplier (or admin) records units that came back on one item line. */
export async function recordReturn(
  orderId: string,
  quoteLineId: string,
  units: number,
  reason: string,
  key = newPaymentKey("return"),
): Promise<Json> {
  return unwrap(
    await db.rpc("record_return", {
      p_po_id: orderId,
      p_quote_line_id: quoteLineId,
      p_units: units,
      p_reason: reason,
      p_idempotency_key: key,
    }),
  )
}

/** Admin pays a refund the startup is owed (simulated). */
export async function payRefund(orderId: string, key = newPaymentKey("refund")): Promise<Json> {
  return unwrap(await db.rpc("pay_refund", { p_po_id: orderId, p_idempotency_key: key }))
}

export interface FeeRuleInput {
  categoryId: string | null
  buyerFeeType: "percent" | "fixed" | "none"
  buyerFeeValue: number
  commissionEnabled: boolean
  commissionPct: number
  supplierTaxMode?: "forward" | "reverse"
  paymentRoute?: "mpi_collects" | "direct"
  mpiTaxPct?: number
  buyerFeeMin?: number | null
  buyerFeeMax?: number | null
  /** Legal / CA protection. Turning it off needs a note saying who approved it. */
  professionalGate?: boolean
  note?: string
}

/** Admin: a new version of a fee rule. Orders already placed keep their version. */
export async function setFeeRule(input: FeeRuleInput): Promise<string> {
  return unwrap(
    await db.rpc("set_fee_rule", {
      p_category_id: input.categoryId,
      p_buyer_fee_type: input.buyerFeeType,
      p_buyer_fee_value: input.buyerFeeValue,
      p_commission_enabled: input.commissionEnabled,
      p_commission_pct: input.commissionPct,
      p_supplier_tax_mode: input.supplierTaxMode,
      p_payment_route: input.paymentRoute,
      p_mpi_tax_pct: input.mpiTaxPct,
      p_buyer_fee_min: input.buyerFeeMin ?? undefined,
      p_buyer_fee_max: input.buyerFeeMax ?? undefined,
      p_professional_gate: input.professionalGate,
      p_note: input.note,
    }),
  )
}

/** Admin: a supplier's MPI rate card for one category (replaces the active one). */
export async function saveRateCard(
  vendorOrgId: string,
  categoryId: string,
  tiers: { min: number; pct: number }[],
  note?: string,
): Promise<string> {
  return unwrap(
    await db.rpc("save_rate_card", {
      p_vendor_org_id: vendorOrgId,
      p_category_id: categoryId,
      p_tiers: tiers as unknown as Json,
      p_note: note,
    }),
  )
}
