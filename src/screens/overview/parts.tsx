/**
 * Pieces shared by the three Overview dashboards (startup, supplier, admin):
 * the AI summary line, panels, "Needs you" rows and recent activity.
 */

import { useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router"
import { ArrowRight, CheckCircle2, Sparkles, type LucideIcon } from "lucide-react"
import { motion, useReducedMotion, type Variants } from "motion/react"
import type { Role } from "../../app/session"
import { getDashboardSummary } from "../../services/data/ai"
import { listNotifications, markRead, type Notification } from "../../services/data/notifications"
import { iconFor, notificationsPath, notifyChanged, resolveLink } from "../notifications/notify"
import { ago, GRADIENT_PANEL } from "../supplier/parts"

/** Lists on the dashboards slide in one row after another. */
export const listStagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }
export const rowIn: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
}

export function greeting(name: string): string {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()))
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
  const first = name.trim().split(/\s+/)[0]?.replace(/[()]/g, "")
  return first ? `${part}, ${first}` : part
}

/**
 * The big greeting on a dashboard. The words rise in one by one; then every
 * few seconds a wave of MPI colour (orange to red) runs through the navy
 * letters, lifting each one a little as it passes. No movement for people
 * who ask for less motion.
 */
const NAVY = "#15233d"
const SWEEP = 1.8 // seconds the colour wave takes to cross the greeting
const CYCLE = 8.6 // seconds between the start of one sweep and the next
const letterIndex = (words: string[], word: number, letter: number) => words.slice(0, word).join("").length + letter

export function Greeting({ name, line }: { name: string; line: string }) {
  const reduce = useReducedMotion()
  const words = greeting(name).split(" ")
  const total = words.join("").length || 1
  return (
    <div>
      <h1 className="font-display text-[36px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[52px]" aria-label={greeting(name)}>
        <span className="inline-block pb-1" aria-hidden="true">
          {words.map((w, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.08 * i, type: "spring", stiffness: 260, damping: 22 }}
            >
              {[...w].map((ch, j) => {
                const k = letterIndex(words, i, j)
                return (
                  <motion.span
                    key={j}
                    className="inline-block origin-bottom"
                    style={{ color: NAVY }}
                    // A wave of MPI colour runs through the letters, lifting each one a little as it passes.
                    animate={reduce ? undefined : { y: [0, -16, -8, 0], scale: [1, 1.14, 1.06, 1], color: [NAVY, "#f09a47", "#db4230", NAVY] }}
                    transition={{ duration: 1, times: [0, 0.35, 0.65, 1], ease: "easeInOut", delay: 0.6 + (k / total) * SWEEP, repeat: Infinity, repeatDelay: CYCLE - 1 }}
                  >
                    {ch}
                  </motion.span>
                )
              })}
              {i < words.length - 1 ? "\u00a0" : ""}
            </motion.span>
          ))}
        </span>
      </h1>
      <motion.p
        className="mt-1 text-[15.5px] text-muted sm:text-[17px]"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 * words.length + 0.1, duration: 0.4 }}
      >
        {line}
      </motion.p>
    </div>
  )
}

/**
 * The summary line on top. The AI writes it from `facts`; while it loads, or
 * if the AI isn't available, the plain `fallback` line is shown instead, and
 * then it is NOT labelled as AI.
 */
export function AiSummary({ facts, fallback }: { facts: string[] | null; fallback: string }) {
  const [text, setText] = useState<string | null>(null)
  const [state, setState] = useState<"loading" | "ai" | "plain">("loading")
  const key = facts?.join("|") ?? null

  useEffect(() => {
    if (!key || !facts) return
    let alive = true
    setState("loading")
    getDashboardSummary(facts)
      .then((t) => {
        if (!alive) return
        setText(t)
        setState("ai")
      })
      .catch(() => alive && setState("plain"))
    return () => {
      alive = false
    }
  }, [key])

  // Type the AI's text in, unless the person prefers less motion.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (state !== "ai" || !text) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length)
      return
    }
    setShown(0)
    const timer = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(timer)
          return n
        }
        return n + 2
      })
    }, 18)
    return () => window.clearInterval(timer)
  }, [state, text])

  return (
    <section
      aria-label={state === "ai" ? "AI summary" : "Today at a glance"}
      aria-busy={state === "loading"}
      className={`rise-in mb-6 flex items-start gap-3 rounded-xl border-[1.5px] bg-gradient-to-r ${state === "loading" ? "pulse-border border-orange/60" : "border-line"} from-navy-tint via-white to-orange-tint/60 px-4 py-3.5 sm:px-5`}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-orange">
        <Sparkles size={16} className={state === "loading" ? "animate-pulse" : ""} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.07em] text-muted">
          {state === "ai" ? "AI summary" : state === "loading" ? "AI summary · writing…" : "Today at a glance"}
        </p>
        {state === "loading" && !facts ? (
          <div className="mt-1.5 h-4 w-2/3 animate-pulse rounded bg-white/80" />
        ) : (
          <p className={`mt-0.5 text-[15.5px] leading-snug text-navy ${state === "loading" ? "opacity-70" : ""}`}>
            {state === "ai" && text ? (
              <>
                {text.slice(0, shown)}
                {shown < text.length && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-orange" aria-hidden="true" />}
              </>
            ) : (
              fallback
            )}
          </p>
        )}
      </div>
    </section>
  )
}

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title: string
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rise-in overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.06)] transition-shadow hover:shadow-[0_6px_18px_rgba(21,35,61,0.10)] ${className}`} style={GRADIENT_PANEL}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5" style={{ background: "#eef1f5", borderBottom: "1px solid #cbd2dc" }}>
        <h2 className="flex items-center gap-2 font-display text-[17px] font-bold" style={{ color: "#15233d" }}>
          {Icon && <Icon size={18} aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export interface TodoItem {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  cta: string
  to: string
  urgent?: boolean
}

/** The "Needs you" list: things to do now, most urgent first. */
export function TodoList({ items, empty, emptyActions }: { items: TodoItem[]; empty: string; emptyActions?: ReactNode }) {
  const navigate = useNavigate()
  if (!items.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <span className="relative flex h-14 w-14 items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-[#d1fae5] motion-safe:animate-ping [animation-duration:2.4s]" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#ecfdf5] text-[#047857] ring-1 ring-[#a7f3d0]">
            <CheckCircle2 size={28} />
          </span>
        </span>
        <p className="mt-4 font-display text-[17px] font-bold text-navy">All caught up</p>
        <p className="mt-1 max-w-[28ch] text-[14px] text-muted">{empty}</p>
        {emptyActions && <div className="mt-5 flex flex-wrap justify-center gap-2">{emptyActions}</div>}
      </div>
    )
  }
  return (
    <>
    <motion.ul variants={listStagger} initial="hidden" animate="show">
      {items.map((t) => (
        <motion.li key={t.id} variants={rowIn} className="border-b border-line/70 last:border-b-0">
          <motion.div
            whileTap={{ scale: 0.99 }}
            role="link"
            tabIndex={0}
            onClick={() => navigate(t.to)}
            onKeyDown={(e) => e.key === "Enter" && navigate(t.to)}
            className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-navy-tint/40 sm:px-5"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.urgent ? "btn-gradient text-navy" : "bg-navy-tint text-navy"}`}
              aria-hidden="true"
            >
              <t.icon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-snug text-navy">{t.title}</span>
              <span className={`block text-[13px] ${t.urgent ? "font-semibold text-red-text" : "text-muted"}`}>{t.detail}</span>
            </span>
            <Link
              to={t.to}
              onClick={(e) => e.stopPropagation()}
              className="btn-gradient hidden shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13.5px] font-bold text-navy shadow-sm hover:brightness-95 sm:inline-flex"
            >
              {t.cta} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </motion.div>
        </motion.li>
      ))}
    </motion.ul>
    {items.length < 3 && emptyActions && (
      <div className="flex flex-1 flex-col items-center justify-center border-t border-line/70 px-6 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf5] text-[#047857] ring-1 ring-[#a7f3d0]" aria-hidden="true">
          <CheckCircle2 size={20} />
        </span>
        <p className="mt-2.5 text-[14px] font-semibold text-navy">That's everything for now</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">{emptyActions}</div>
      </div>
    )}
    </>
  )
}

/** The latest notifications, with a link to see them all. */
export function RecentActivity({ role, limit = 6 }: { role: Role; limit?: number }) {
  const [items, setItems] = useState<Notification[] | null>(null)
  const navigate = useNavigate()
  useEffect(() => {
    listNotifications(limit)
      .then(setItems)
      .catch(() => setItems([]))
  }, [limit])
  return (
    <Panel
      title="Recent activity"
      action={
        <Link to={notificationsPath(role)} className="text-[13.5px] font-semibold text-navy hover:underline">
          See all
        </Link>
      }
    >
      {items === null ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-page" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-5 py-3.5 text-[13.5px] text-muted">Nothing yet. Updates on your work show up here.</p>
      ) : (
        <motion.ul variants={listStagger} initial="hidden" animate="show">
          {items.map((n) => {
            const Icon = iconFor(n.type)
            return (
              <motion.li key={n.id} variants={rowIn} className="border-b border-line/70 last:border-b-0">
                <motion.button
                  whileTap={{ scale: 0.99 }}
                  type="button"
                  onClick={async () => {
                    if (!n.read_at) await markRead(n.id).catch(() => undefined)
                    notifyChanged()
                    navigate(resolveLink(n.link, n.type, role))
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-navy-tint/40 sm:px-5"
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.read_at ? "bg-page text-muted" : "bg-navy text-orange"}`}>
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] leading-snug ${n.read_at ? "text-muted" : "font-bold text-navy"}`}>{n.title}</span>
                    <span className="block text-[12px] text-muted">{ago(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-orange" aria-label="Unread" />}
                </motion.button>
              </motion.li>
            )
          })}
        </motion.ul>
      )}
    </Panel>
  )
}
