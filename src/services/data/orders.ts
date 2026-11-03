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
export type OrderEvent = Tables<"order_events">

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

/**
 * The steps an order has been through, oldest first, each with its date and
 * time, for the order timeline. Orders placed before 28 Oct 2026 only have
 * the day they were placed and the step they had reached by then.
 */
export async function listOrderHistory(orderId: string): Promise<OrderEvent[]> {
  return unwrap(await db.from("order_events").select("*").eq("po_id", orderId).order("created_at"))
}

/** Supplier: move the order to a later step, optionally setting the expected delivery date (YYYY-MM-DD). */
export async function updateOrderStatus(orderId: string, status: OrderStatus, expectedDelivery?: string): Promise<void> {
  check(await db.rpc("update_order_status", { p_po_id: orderId, p_status: status, p_expected_delivery: expectedDelivery }))
}

/** Startup: confirm a delivered order is complete. */
export async function markOrderCompleted(orderId: string): Promise<void> {
  await updateOrderStatus(orderId, "completed")
}

// ---------------------------------------------------------------- messages

export type OrderMessage = Tables<"order_messages">
export type MessageTopic = "for_other_side" | "delivery" | "quality" | "payment" | "other"

/**
 * Your side's conversation with MPI about an order, oldest first. The other
 * side never sees it; MPI passes on anything meant for them.
 */
export async function listOrderMessages(orderId: string): Promise<OrderMessage[]> {
  return unwrap(await db.from("order_messages").select("*").eq("po_id", orderId).order("created_at"))
}

/** Buyer or supplier: send a message to MPI about an order. */
export async function sendOrderMessage(orderId: string, topic: MessageTopic, body: string): Promise<void> {
  check(await db.rpc("send_order_message", { p_po_id: orderId, p_topic: topic, p_body: body }))
}

/** MPI admin: reply in one side's conversation on an order. */
export async function replyOrderMessage(orderId: string, orgId: string, body: string): Promise<void> {
  check(await db.rpc("reply_order_message", { p_po_id: orderId, p_org_id: orgId, p_body: body }))
}
