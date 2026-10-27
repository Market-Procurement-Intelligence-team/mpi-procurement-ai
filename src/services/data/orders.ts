/**
 * Purchase orders. Created when a startup approves a quote. The supplier
 * moves an order forward through production and delivery; the startup marks
 * it completed once delivered.
 */

import { db } from "../../lib/db"
import type { Enums, Tables } from "../../lib/database.types"
import { check, unwrap } from "./errors"
import { getDisplayNames } from "./names"

export type Order = Tables<"purchase_orders">
export type OrderStatus = Enums<"po_status">

/** The order a supplier moves through, in sequence. */
export const ORDER_STEPS: OrderStatus[] = ["issued", "in_production", "qc_passed", "dispatched", "delivered", "completed"]

export interface OrderSummary extends Order {
  requestTitle: string
  buyerName: string
  supplierName: string
}

/** Orders where the signed-in organisation is the buyer or the supplier, newest first. */
export async function listMyOrders(): Promise<OrderSummary[]> {
  const orders = unwrap(await db.from("purchase_orders").select("*").order("created_at", { ascending: false }))
  if (!orders.length) return []

  const [requests, names] = await Promise.all([
    db.from("requests").select("id, title").in("id", orders.map((o) => o.request_id)).then(unwrap),
    getDisplayNames(orders.flatMap((o) => [o.buyer_org_id, o.vendor_org_id])),
  ])
  const titles = new Map(requests.map((r) => [r.id, r.title]))

  return orders.map((o) => ({
    ...o,
    requestTitle: titles.get(o.request_id) ?? "",
    buyerName: names.get(o.buyer_org_id) ?? "MPI Verified Buyer",
    supplierName: names.get(o.vendor_org_id) ?? "MPI Verified Supplier",
  }))
}

/** Supplier: move the order to a later step, optionally setting the expected delivery date (YYYY-MM-DD). */
export async function updateOrderStatus(orderId: string, status: OrderStatus, expectedDelivery?: string): Promise<void> {
  check(await db.rpc("update_order_status", { p_po_id: orderId, p_status: status, p_expected_delivery: expectedDelivery }))
}

/** Startup: confirm a delivered order is complete. */
export async function markOrderCompleted(orderId: string): Promise<void> {
  await updateOrderStatus(orderId, "completed")
}
