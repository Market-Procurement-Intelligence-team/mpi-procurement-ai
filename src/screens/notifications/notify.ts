/**
 * Helpers shared by the bell glance and the Notifications screen: where a
 * notification should open, which icon it gets, and a signal that tells the
 * top bar to refresh its unread count.
 */

import {
  BadgeCheck,
  Bell,
  CircleDollarSign,
  FileText,
  Handshake,
  Inbox,
  MessageSquare,
  Package,
  RotateCcw,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type { Role } from "../../app/session"

const AREA: Record<Role, string> = { startup: "/startup", vendor: "/supplier", admin: "/admin" }

/** Notifications screen path for a role, optionally on the Messages tab. */
export function notificationsPath(role: Role, messages?: { order?: string; side?: "buyer" | "supplier"; topic?: string }): string {
  if (!messages) return `${AREA[role]}/notifications`
  const p = new URLSearchParams({ tab: "messages" })
  if (messages.order) p.set("o", messages.order)
  if (messages.side) p.set("side", messages.side)
  if (messages.topic) p.set("topic", messages.topic)
  return `${AREA[role]}/notifications?${p}`
}

/**
 * Where a notification opens. Older notifications carry paths from the old
 * app (/app/..., /vendor/...); they are mapped to today's screens.
 */
export function resolveLink(link: string | null, type: string, role: Role): string {
  const area = AREA[role]
  if (link && (link.startsWith("/startup") || link.startsWith("/supplier") || link.startsWith("/admin/"))) return link
  if (link) {
    const req = link.match(/^\/app\/requests\/([0-9a-f-]{36})/)
    if (req) return `/startup/requests/${req[1]}`
    if (link.startsWith("/app/orders")) return "/startup/orders"
    if (link.startsWith("/app/requests")) return "/startup/requests"
    if (link.startsWith("/vendor/orders")) return "/supplier/orders"
    if (link.startsWith("/vendor/profile")) return "/supplier/profile"
    if (link.startsWith("/vendor/")) return "/supplier/requests"
    if (link.startsWith("/admin/matches")) return "/admin/matches"
  }
  if (type === "order_message") return notificationsPath(role, {})
  if (role === "admin") return type.includes("match") ? "/admin/matches" : "/admin/orders"
  if (/order|payment|payout|refund|return|quote_accepted/.test(type)) return `${area}/orders`
  return `${area}/requests`
}

export function iconFor(type: string): LucideIcon {
  if (type === "order_message") return MessageSquare
  if (type.startsWith("price_")) return Handshake
  if (type === "quote_received") return FileText
  if (type === "quote_accepted") return BadgeCheck
  if (type === "rfq_invited") return Inbox
  if (type.includes("match")) return Sparkles
  if (type === "payment_received") return CircleDollarSign
  if (type === "payout_sent") return Wallet
  if (type === "refund_paid" || type === "return_recorded") return RotateCcw
  if (type.includes("order")) return Package
  return Bell
}

/** Tell the top bar to re-count unread notifications. */
export function notifyChanged(): void {
  window.dispatchEvent(new Event("mpi:notifications"))
}
