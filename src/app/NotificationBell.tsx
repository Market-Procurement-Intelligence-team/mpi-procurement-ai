/**
 * The bell in the top bar. Clicking it opens a small glance with the latest
 * notifications; "Show all notifications" opens the Notifications screen.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { Bell, CheckCheck, MessageSquare } from "lucide-react"
import { countUnread, listNotifications, markAllRead, markRead, type Notification } from "../services/data/notifications"
import { ago } from "../screens/supplier/parts"
import { iconFor, notificationsPath, notifyChanged, resolveLink } from "../screens/notifications/notify"
import type { Role } from "./session"

export default function NotificationBell({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[] | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const recount = useCallback(() => {
    countUnread()
      .then(setUnread)
      .catch(() => setUnread(0))
  }, [])

  useEffect(() => {
    recount()
    setOpen(false)
  }, [location.pathname, location.search, recount])

  useEffect(() => {
    window.addEventListener("mpi:notifications", recount)
    const timer = window.setInterval(recount, 60_000)
    return () => {
      window.removeEventListener("mpi:notifications", recount)
      window.clearInterval(timer)
    }
  }, [recount])

  useEffect(() => {
    if (!open) return
    listNotifications(8)
      .then(setItems)
      .catch(() => setItems([]))
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // The glance's own list is the freshest source once it has loaded.
  const fresh = items ? Math.max(items.filter((n) => !n.read_at).length, unread) : unread

  async function openItem(n: Notification) {
    if (!n.read_at) await markRead(n.id).catch(() => undefined)
    notifyChanged()
    setOpen(false)
    navigate(resolveLink(n.link, n.type, role))
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-md p-2 text-white/85 hover:bg-white/10 hover:text-white"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell size={22} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-red px-1 text-center text-xs font-bold leading-5 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Latest notifications"
          className="fixed inset-x-3 top-[4.25rem] z-40 overflow-hidden rounded-xl border-[1.5px] border-line bg-white text-navy shadow-[0_12px_32px_rgba(15,23,40,0.28)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="font-display text-[16px] font-bold">
              Notifications{fresh > 0 && <span className="ml-2 rounded-full bg-orange px-2 py-px text-[12px] font-bold text-navy">{fresh} new</span>}
            </p>
            <button
              type="button"
              disabled={!fresh}
              onClick={async () => {
                await markAllRead().catch(() => undefined)
                setUnread(0)
                setItems((list) => list?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null)
                notifyChanged()
              }}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              <CheckCheck size={15} aria-hidden="true" /> Mark all read
            </button>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto sm:max-h-[26rem]">
            {items === null ? (
              <li className="px-4 py-6 text-center text-[14px] text-muted">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-8 text-center text-[14px] text-muted">You're all caught up.</li>
            ) : (
              items.map((n) => {
                const Icon = iconFor(n.type)
                return (
                  <li key={n.id} className="border-b border-line/70 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => void openItem(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-navy-tint/50 ${n.read_at ? "" : "bg-orange-tint/35"}`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.read_at ? "bg-page text-muted" : "bg-navy text-orange"}`}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[14px] leading-snug ${n.read_at ? "font-medium" : "font-bold"}`}>{n.title}</span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{n.body}</span>}
                        <span className="mt-0.5 block text-[12px] text-muted">{ago(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red" aria-label="Unread" />}
                    </button>
                  </li>
                )
              })
            )}
          </ul>

          <div className="grid grid-cols-2 border-t border-line text-[14px] font-semibold">
            <Link to={notificationsPath(role, {})} className="flex min-h-11 items-center justify-center gap-1.5 border-r border-line hover:bg-navy-tint">
              <MessageSquare size={15} aria-hidden="true" /> Messages
            </Link>
            <Link to={notificationsPath(role)} className="flex min-h-11 items-center justify-center bg-navy text-white hover:bg-navy-2">
              Show all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
