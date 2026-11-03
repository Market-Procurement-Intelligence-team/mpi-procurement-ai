/**
 * My requests: every request the startup has made.
 *
 * Navy summary cards, then tabs (All / Active / Offers in / Ordered / Drafts),
 * a search box and a sort control. Each row is clickable as a whole and
 * shows the title, category and quantity pills, the needed-by date (orange
 * within 7 days, red within 3 or overdue), the status in its own column and
 * one clear action: Continue draft, View offers, View request or Track order.
 */

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { ArrowRight, CalendarClock, FileText, Handshake, Package, PenLine, Plus, Search, Send } from "lucide-react"
import { useMe } from "../../app/session"
import { listCategories, type Category } from "../../services/data/catalogue"
import { listMyRequestCards, type RequestCard } from "../../services/data/requests"
import EmptyState from "../../ui/EmptyState"
import { Alert, BOX, boxBorder } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { Chip, day, daysLeft, daysUntil, errorText, qty, SummaryCards, TabBar } from "../supplier/parts"

type Tab = "all" | "active" | "offers" | "ordered" | "drafts"
type Sort = "newest" | "needed"

const NEW = "/startup/requests/new"

const STATUS: Record<RequestCard["request"]["status"], { label: string; tone: "navy" | "orange" | "red" | "line" }> = {
  draft: { label: "Draft", tone: "line" },
  open: { label: "Finding suppliers", tone: "orange" },
  comparing: { label: "Offers in", tone: "orange" },
  ordered: { label: "Ordered", tone: "navy" },
  cancelled: { label: "Cancelled", tone: "red" },
}

function inTab(c: RequestCard, tab: Tab): boolean {
  const s = c.request.status
  if (tab === "all") return true
  if (tab === "drafts") return s === "draft"
  if (tab === "ordered") return s === "ordered"
  if (tab === "offers") return s === "comparing" || (s === "open" && c.quoteCount > 0)
  return s === "open" || s === "comparing"
}

function action(c: RequestCard): { to: string; label: string; primary: boolean; icon: typeof ArrowRight } {
  const { request: r } = c
  if (r.status === "draft") return { to: `${NEW}?draft=${r.id}`, label: "Continue draft", primary: false, icon: PenLine }
  if (r.status === "ordered")
    return { to: c.orderId ? `/startup/orders?o=${c.orderId}` : `/startup/requests/${r.id}`, label: "Track order", primary: false, icon: Package }
  if (c.quoteCount > 0 && r.status !== "cancelled")
    return { to: `/startup/requests/${r.id}`, label: `View ${c.quoteCount} offer${c.quoteCount === 1 ? "" : "s"}`, primary: true, icon: Handshake }
  return { to: `/startup/requests/${r.id}`, label: "View request", primary: false, icon: ArrowRight }
}

function NewButton() {
  return (
    <Link to={NEW} className="btn-gradient inline-flex min-h-11 items-center gap-2 rounded-md px-5 text-[15px] font-bold text-navy shadow-sm hover:brightness-95">
      <Plus size={18} aria-hidden="true" />
      New request
    </Link>
  )
}

function NeededBy({ date, live }: { date: string | null; live: boolean }) {
  if (!date) return <span className="text-muted">No date</span>
  const d = daysUntil(date) ?? 99
  const tone = !live ? "text-muted" : d <= 3 ? "font-semibold text-red-text" : d <= 7 ? "font-semibold text-[#b8611f]" : "text-navy"
  return (
    <span className={`inline-flex items-center gap-1.5 ${tone}`}>
      <CalendarClock size={14} aria-hidden="true" />
      Needed by {day(date)}
      {live && <span className="font-normal">({daysLeft(date)})</span>}
    </span>
  )
}

function Row({ c, category }: { c: RequestCard; category: Category | undefined }) {
  const navigate = useNavigate()
  const { request: r, lines } = c
  const st = STATUS[r.status]
  const a = action(c)
  const live = r.status === "open" || r.status === "comparing" || r.status === "draft"
  const quantity = lines.length === 1 ? qty(lines[0].quantity, lines[0].unit) : lines.length ? `${lines.length} items` : null
  const urgent = live && r.status !== "draft" && (daysUntil(r.needed_by) ?? 99) <= 3

  return (
    <li
      onClick={() => navigate(a.to)}
      className={`group grid cursor-pointer gap-3 border-b border-l-4 border-b-line px-5 py-4 transition-colors last:border-b-0 hover:bg-navy-tint/40 md:grid-cols-[minmax(0,1fr)_10rem_11rem] md:items-center ${
        urgent ? "border-l-red" : a.primary ? "border-l-orange" : "border-l-transparent"
      }`}
    >
      <div className="min-w-0">
        <Link to={a.to} onClick={(e) => e.stopPropagation()} className="block truncate text-[16px] font-semibold text-navy group-hover:underline">
          {r.title}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
          {category && <span className="rounded-full bg-navy-tint px-2.5 py-0.5 font-semibold text-navy">{category.name}</span>}
          {quantity && <span className="rounded-full border border-line bg-white px-2.5 py-0.5 font-semibold text-navy">{quantity}</span>}
          <NeededBy date={r.needed_by} live={live} />
          <span className="text-muted">
            {r.status === "draft" ? "Saved" : "Sent"} {day(r.updated_at)}
          </span>
        </div>
      </div>
      <div className="md:text-right">
        <Chip tone={st.tone}>{st.label}</Chip>
      </div>
      <div className="md:text-right">
        <Link
          to={a.to}
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-[14px] font-bold transition-colors md:w-auto ${
            a.primary ? "btn-gradient text-navy shadow-sm hover:brightness-95" : "border-[1.5px] border-navy bg-white text-navy hover:bg-navy-tint"
          }`}
        >
          <a.icon size={16} aria-hidden="true" />
          {a.label}
        </Link>
      </div>
    </li>
  )
}

export default function MyRequestsPage() {
  const me = useMe()
  const [cards, setCards] = useState<RequestCard[] | null>(null)
  const [categories, setCategories] = useState<Map<string, Category>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState("")

  const tab = (params.get("tab") as Tab | null) ?? "all"
  const sort = (params.get("sort") as Sort | null) ?? "newest"
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    p.set(k, v)
    setParams(p, { replace: true })
  }

  useEffect(() => {
    document.title = "My requests · MPI"
    Promise.all([listMyRequestCards(me.organisation.id), listCategories()])
      .then(([c, cats]) => {
        setCards(c)
        setCategories(new Map(cats.map((x) => [x.id, x])))
      })
      .catch((err) => {
        setCards([])
        setError(errorText(err))
      })
  }, [me.organisation.id])

  const counts = useMemo(() => {
    const all = cards ?? []
    return Object.fromEntries((["all", "active", "offers", "ordered", "drafts"] as Tab[]).map((t) => [t, all.filter((c) => inTab(c, t)).length])) as Record<Tab, number>
  }, [cards])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (cards ?? []).filter(
      (c) =>
        inTab(c, tab) &&
        (!q ||
          c.request.title.toLowerCase().includes(q) ||
          c.lines.some((l) => l.description.toLowerCase().includes(q)) ||
          (categories.get(c.request.category_id ?? "")?.name.toLowerCase().includes(q) ?? false)),
    )
    if (sort === "needed") {
      return [...list].sort((a, b) => (daysUntil(a.request.needed_by) ?? 9999) - (daysUntil(b.request.needed_by) ?? 9999))
    }
    return list
  }, [cards, tab, sort, query, categories])

  const offersWaiting = (cards ?? []).filter((c) => inTab(c, "offers")).reduce((n, c) => n + c.quoteCount, 0)
  const dueSoon = (cards ?? []).filter((c) => inTab(c, "active") && (daysUntil(c.request.needed_by) ?? 99) <= 7).length

  return (
    <>
      <PageHeader title="My requests" description="Everything you've asked MPI to source." actions={<NewButton />} />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {cards === null ? (
        <div className="space-y-3" aria-label="Loading requests">
          <div className="h-24 animate-pulse rounded-xl bg-page" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-page" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        !error && (
          <EmptyState
            icon={FileText}
            title="No requests yet"
            body="Describe what you need in your own words, or pick from the catalogue. MPI finds verified suppliers for you."
            action={<NewButton />}
          />
        )
      ) : (
        <>
          <SummaryCards
            selected={tab}
            onPick={(id) => set("tab", id)}
            items={[
              { id: "active", label: "Active requests", value: counts.active, hint: dueSoon ? `${dueSoon} needed within 7 days` : "being sourced", icon: Send, dot: dueSoon > 0 },
              { id: "offers", label: "Offers to review", value: offersWaiting, hint: counts.offers ? `on ${counts.offers} request${counts.offers === 1 ? "" : "s"}` : "none yet", icon: Handshake, dot: offersWaiting > 0 },
              { id: "ordered", label: "Ordered", value: counts.ordered, hint: "track in Orders", icon: Package },
              { id: "drafts", label: "Drafts", value: counts.drafts, hint: counts.drafts ? "not sent yet" : "nothing saved", icon: PenLine },
            ]}
          />

          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <TabBar<Tab>
              label="Request status"
              value={tab}
              onChange={(t) => set("tab", t)}
              tabs={[
                { id: "all", label: "All", count: counts.all },
                { id: "active", label: "Active", count: counts.active },
                { id: "offers", label: "Offers in", count: counts.offers },
                { id: "ordered", label: "Ordered", count: counts.ordered },
                { id: "drafts", label: "Drafts", count: counts.drafts },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row md:pb-1.5">
              <div className="relative min-w-0 flex-1 sm:min-w-56 md:w-64 md:flex-none">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title or item"
                  aria-label="Search requests"
                  className={`${BOX} ${boxBorder()} min-h-10 pl-9 text-[14.5px]`}
                />
              </div>
              <select
                value={sort}
                onChange={(e) => set("sort", e.target.value)}
                aria-label="Sort requests"
                className={`block shrink-0 rounded-md border-[1.5px] ${boxBorder()} min-h-10 bg-white px-3 pr-8 text-[14.5px] text-navy focus:outline-none sm:w-auto`}
              >
                <option value="newest">Newest first</option>
                <option value="needed">Needed by, soonest</option>
              </select>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border-[1.5px] border-dashed border-line px-4 py-10 text-center text-muted">
              {query ? `No requests match "${query}".` : "Nothing in this tab yet."}
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
              <li className="hidden border-b border-line bg-navy px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-white md:grid md:grid-cols-[minmax(0,1fr)_10rem_11rem]">
                <span>Request</span>
                <span className="text-right">Status</span>
                <span className="text-right">Next step</span>
              </li>
              {shown.map((c) => (
                <Row key={c.request.id} c={c} category={categories.get(c.request.category_id ?? "")} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
