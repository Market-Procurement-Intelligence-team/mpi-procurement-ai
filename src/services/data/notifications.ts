/** The signed-in person's in-app notifications. */

import { db } from "../../lib/db"
import type { Tables } from "../../lib/database.types"
import { check, unwrap } from "./errors"

export type Notification = Tables<"notifications">

export async function listNotifications(limit = 30): Promise<Notification[]> {
  return unwrap(await db.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit))
}

export async function countUnread(): Promise<number> {
  const { count, error } = await db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)
  check({ error })
  return count ?? 0
}

export async function markRead(notificationId: string): Promise<void> {
  check(await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId))
}

export async function markAllRead(): Promise<void> {
  check(await db.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null))
}
