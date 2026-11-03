/**
 * Notifications and messages, for every role (<area>/notifications).
 * Opened from the bell's "Show all notifications" (or "Messages").
 *
 * - Notifications: everything MPI has told you, newest first, grouped by
 *   day, with All / Unread and "Mark all read". Clicking one opens it.
 * - Messages: your conversations with MPI about orders (see MessagesInbox).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Bell, CheckCheck } from "lucide-react"
import type { Role } from "../../app/session"
import { listNotifications, markAllRead, markRead, type Notification } from "../../services/data/notifications"
import EmptyState from "../../ui/EmptyState"
import { Alert } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { ago, errorText, TabBar } from "../supplier/parts"
import MessagesInbox from "./MessagesInbox"
import { iconFor, notifyChanged, resolveLink } from "./notify"

type Tab = "all" | "messages"
type Filter = "all" | "unread"

function group(iso: string): string {
  const d = new Date(iso)
  const today = new Date(new Date().toDateString())
  const days = Math.floor((today.getTime() - new Date(d.toDateString()).getTime()) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return "Earlier this week"
  return "Older"
}

function NotificationList({ role, onUnread }: { role: Role; onUnread: (n: number) => void }) {
  const [items, setItems] = useState<Notification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      setItems(await listNotifications(200))
      setError(null)
    } catch (err) {
      setError(errorText(err))
      setItems((i) => i ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const unread = (items ?? []).filter((n) => !n.read_at).length
  useEffect(() => onUnread(unread), [unread, onUnread])

  const groups = useMemo(() => {
    const shown = (items ?? []).filter((n) => filter === "all" || !n.read_at)
    const out: [string, Notification[]][] = []
    for (const n of shown) {
      const g = group(n.created_at)
      const last = out.at(-1)
      if (last && last[0] === g) last[1].push(n)
      else out.push([g, [n]])
    }
    return out
  }, [items, filter])

  async function open(n: Notification) {
    if (!n.read_at) await markRead(n.id).catch(() => undefined)
    notifyChanged()
    navigate(resolveLink(n.link, n.type, role))
  }

  if (items === null) return <div className="h-80 animate-pulse rounded-xl bg-page" aria-label="Loading" />

  return (
    <div className="max-w-3xl">
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="inline-flex rounded-lg bg-page p-1 ring-1 ring-inset ring-line">
          {(["all", "unread"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-9 rounded-md px-4 text-[14px] font-semibold ${
                filter === f ? "bg-white text-navy shadow-[0_1px_3px_rgba(21,35,61,0.18)] ring-1 ring-line" : "text-muted hover:text-navy"
              }`}
            >
              {f === "all" ? "All" : `Unread (${unread})`}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!unread}
          onClick={async () => {
            await markAllRead().catch(() => undefined)
            notifyChanged()
            await load()
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border-[1.5px] border-navy bg-white px-3 text-[13.5px] font-semibold text-navy hover:bg-navy-tint disabled:opacity-40"
        >
          <CheckCheck size={15} aria-hidden="true" /> Mark all read
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={Bell} title={filter === "unread" ? "No unread notifications" : "No notifications yet"} body="You're all caught up." />
      ) : (
        <div className="space-y-5">
          {groups.map(([label, list]) => (
            <section key={label}>
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{label}</h3>
              <ul className="overflow-hidden rounded-xl border-[1.5px] border-line bg-white">
                {list.map((n) => {
                  const Icon = iconFor(n.type)
                  return (
                    <li key={n.id} className="border-b border-line/70 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => void open(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-navy-tint/50 ${n.read_at ? "" : "bg-orange-tint/35"}`}
                      >
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.read_at ? "bg-page text-muted" : "bg-navy text-orange"}`}>
                          <Icon size={17} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] leading-snug text-navy ${n.read_at ? "font-medium" : "font-bold"}`}>{n.title}</span>
                          {n.body && <span className="mt-0.5 block text-[13.5px] text-muted">{n.body}</span>}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="text-[12px] text-muted">{ago(n.created_at)}</span>
                          {!n.read_at && <span className="h-2 w-2 rounded-full bg-red" aria-label="Unread" />}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NotificationsPage({ role }: { role: Role }) {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get("tab") === "messages" ? "messages" : "all"
  const [unread, setUnread] = useState<number | undefined>(undefined)
  const [waiting, setWaiting] = useState<number | undefined>(undefined)

  useEffect(() => {
    document.title = `${tab === "messages" ? "Messages" : "Notifications"} · MPI`
  }, [tab])

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={
          role === "admin"
            ? "Everything that needs MPI's attention, and your conversations with buyers and suppliers."
            : "Everything MPI has told you, and your messages with the MPI team about your orders."
        }
      />
      <div className="mb-5">
        <TabBar<Tab>
          label="Notifications sections"
          value={tab}
          onChange={(t) => setParams(t === "messages" ? { tab: "messages" } : {}, { replace: true })}
          tabs={[
            { id: "all", label: "Notifications", count: unread || undefined },
            { id: "messages", label: "Messages", count: waiting || undefined },
          ]}
        />
      </div>
      {tab === "all" ? <NotificationList role={role} onUnread={setUnread} /> : <MessagesInbox role={role} onCount={setWaiting} />}
    </div>
  )
}
