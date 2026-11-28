/**
 * Find a provider: the startup browses ANONYMOUS freelancer profiles that
 * MPI has approved, and shortlists the ones they like. Shortlisted
 * freelancers can be sent with a service brief (up to 3); MPI still approves
 * every invite. Businesses are not listed here yet: MPI matches them from
 * the brief, as before.
 *
 * One search box and one row of filters, then a list of rich rows. A
 * profile and the shortlist open in panels from the right, so the list
 * stays in place.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { AnimatePresence } from "motion/react"
import { BadgeCheck, Bookmark, CircleCheck, Clock, Info, MapPin, Search, SlidersHorizontal, Star, Users, X } from "lucide-react"
import { useMe } from "../../../app/session"
import { listCategories, type Category } from "../../../services/data/catalogue"
import {
  addToShortlist,
  freelancersOpen,
  listFreelancers,
  listMyShortlist,
  listSkills,
  removeFromShortlist,
  type FreelancerCard,
  type Skill,
} from "../../../services/data/providers"
import { listRatings, type Rating } from "../../../services/data/milestones"
import { isServiceBrief, listMyRequestCards } from "../../../services/data/requests"
import EmptyState from "../../../ui/EmptyState"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import PageHeader from "../../../ui/PageHeader"
import { AnonAvatar } from "../../freelancer/PublicProfile"
import { label, SKILL_LEVELS, WORK_MODES } from "../../freelancer/useBuilder"
import { errorText, rupees, SOFT_BG } from "../../supplier/parts"
import ProfilePanel from "./ProfilePanel"
import { ShortlistButton } from "./ShortlistButton"
import ShortlistPanel, { type DraftBrief } from "./ShortlistPanel"
import { activeFilterCount, matches, NO_FILTERS, PRICE_OPTIONS, topSkills, WITHIN_OPTIONS, type Filters } from "./shared"

const CHECK_SHORT: Record<string, string> = {
  identity_pan: "PAN checked",
  bank: "Bank checked",
  gst: "GST checked",
  udyam: "Udyam checked",
  credential: "Certificate checked",
}

const SELECT = "min-h-10 rounded-md border-[1.5px] bg-white px-3 pr-8 text-[14px] text-navy focus:border-orange focus:outline-none"

export default function ProvidersPage() {
  const me = useMe()
  const orgId = me.organisation.id
  const [params, setParams] = useSearchParams()
  const openId = params.get("p")
  const shortlistOpen = params.get("shortlist") === "1"

  const [open, setOpen] = useState<boolean | null>(null)
  const [cards, setCards] = useState<FreelancerCard[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [drafts, setDrafts] = useState<DraftBrief[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [ratings, setRatings] = useState<Map<string, Rating>>(new Map())

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const on = await freelancersOpen()
        if (!live) return
        setOpen(on)
        if (!on) return
        const [list, cats, sk, mine, reqs, stars] = await Promise.all([
          listFreelancers(),
          listCategories(),
          listSkills(),
          listMyShortlist(),
          listMyRequestCards(orgId).catch(() => []),
          listRatings().catch(() => new Map<string, Rating>()),
        ])
        if (!live) return
        setCards(list)
        setRatings(stars)
        setCategories(cats.filter((c) => c.freelancers_allowed))
        setSkills(sk)
        setSaved(mine)
        setDrafts(reqs.filter((c) => c.request.status === "draft" && isServiceBrief(c.request)).map((c) => ({ id: c.request.id, title: c.request.title })))
      } catch (e) {
        if (live) setError(errorText(e))
      }
    })()
    return () => {
      live = false
    }
  }, [orgId])

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const categoryName = useCallback((id: string | null) => (id ? catName.get(id) ?? null : null), [catName])
  const shown = useMemo(() => (cards ?? []).filter((c) => matches(c, f)), [cards, f])
  const skillChoices = useMemo(() => (f.category ? skills.filter((s) => s.category_id === f.category) : skills), [skills, f.category])
  const savedCards = useMemo(
    () => saved.map((id) => (cards ?? []).find((c) => c.id === id)).filter((c): c is FreelancerCard => Boolean(c)),
    [saved, cards],
  )
  const filtersOn = activeFilterCount(f)

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: false },
    )

  const toggle = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      if (saved.includes(id)) {
        await removeFromShortlist(orgId, id)
        setSaved((s) => s.filter((x) => x !== id))
      } else {
        await addToShortlist(orgId, id)
        setSaved((s) => [id, ...s])
      }
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusyId(null)
    }
  }

  const shortlistButton = (
    <button
      type="button"
      onClick={() => setParam("shortlist", "1")}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border-[1.5px] border-navy bg-white px-4 text-[15px] font-bold text-navy hover:bg-navy-tint"
    >
      <Bookmark size={17} aria-hidden="true" />
      Shortlist
      <span className="rounded-full bg-navy px-2 py-px text-[12.5px] text-white">{saved.length}</span>
    </button>
  )

  return (
    <>
      <PageHeader
        title="Find a provider"
        description="Every provider is checked by MPI. Names stay private until you work together."
        actions={open ? shortlistButton : undefined}
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {open === false ? (
        <EmptyState
          icon={Users}
          title="Freelancers aren't open yet"
          body="MPI hasn't opened freelancer profiles yet. You can still send a service brief from New request, and MPI finds providers for you."
        />
      ) : open === null || cards === null ? (
        !error && (
          <div className="space-y-3" aria-label="Loading providers">
            <div className="h-28 animate-pulse rounded-xl bg-page" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-page" />
            ))}
          </div>
        )
      ) : (
        <>
          {/* Search and filters */}
          <section className="mb-4 rounded-xl border-[1.5px] border-line p-4" style={{ background: SOFT_BG }} aria-label="Search and filters">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={f.q}
                  onChange={(e) => setF({ ...f, q: e.target.value })}
                  placeholder="Search skills, e.g. Shopify, packaging design"
                  aria-label="Search providers"
                  className={`${BOX} ${boxBorder()} min-h-11 pl-10 text-[15px]`}
                />
              </div>
              <p className="flex items-center gap-1.5 text-[13px] text-muted lg:max-w-[18rem]">
                <Info size={14} className="shrink-0" aria-hidden="true" />
                Showing freelancers. MPI matches businesses from your brief.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SlidersHorizontal size={16} className="text-muted" aria-hidden="true" />
              <select
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value, skill: "" })}
                aria-label="Kind of service"
                className={`${SELECT} ${f.category ? "border-navy" : "border-input"}`}
              >
                <option value="">Any kind of service</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={f.skill}
                onChange={(e) => setF({ ...f, skill: e.target.value })}
                aria-label="Skill"
                className={`${SELECT} ${f.skill ? "border-navy" : "border-input"}`}
              >
                <option value="">Any skill</option>
                {skillChoices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={f.within ?? ""}
                onChange={(e) => setF({ ...f, within: e.target.value ? Number(e.target.value) : null })}
                aria-label="Delivers within"
                className={`${SELECT} ${f.within ? "border-navy" : "border-input"}`}
              >
                <option value="">Any delivery time</option>
                {WITHIN_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    Delivers within {d} days
                  </option>
                ))}
              </select>
              <select
                value={f.priceUpTo ?? ""}
                onChange={(e) => setF({ ...f, priceUpTo: e.target.value ? Number(e.target.value) : null })}
                aria-label="Packages from"
                className={`${SELECT} ${f.priceUpTo ? "border-navy" : "border-input"}`}
              >
                <option value="">Any package price</option>
                {PRICE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    Packages from {rupees(p)} or less
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-pressed={f.availableNow}
                onClick={() => setF({ ...f, availableNow: !f.availableNow })}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold ${
                  f.availableNow ? "border-navy bg-navy text-white" : "border-input bg-white text-navy hover:bg-navy-tint"
                }`}
              >
                <span className={`size-2 rounded-full ${f.availableNow ? "bg-[#34d399]" : "bg-[#047857]"}`} aria-hidden="true" />
                Available now
              </button>
              {filtersOn > 0 && (
                <button type="button" onClick={() => setF({ ...NO_FILTERS, q: f.q })} className="inline-flex min-h-10 items-center gap-1 px-2 text-[14px] font-semibold text-navy underline-offset-2 hover:underline">
                  <X size={15} aria-hidden="true" />
                  Clear filters
                </button>
              )}
            </div>
          </section>

          <p className="mb-2 text-[14px] text-muted" aria-live="polite">
            {shown.length} freelancer{shown.length === 1 ? "" : "s"}
            {shown.length !== cards.length ? ` of ${cards.length}` : ""}
          </p>

          {shown.length === 0 ? (
            <div className="rounded-xl border-[1.5px] border-dashed border-line px-4 py-12 text-center">
              <p className="font-semibold text-navy">{cards.length === 0 ? "No freelancers are live yet" : "No freelancers match these filters"}</p>
              {cards.length > 0 && (
                <button type="button" onClick={() => setF(NO_FILTERS)} className="mt-2 text-[14.5px] font-semibold text-navy underline underline-offset-2">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {shown.map((c) => (
                <ProviderRow
                  key={c.id}
                  c={c}
                  rating={ratings.get(c.id ?? "") ?? null}
                  categoryName={categoryName}
                  saved={saved.includes(c.id ?? "")}
                  busy={busyId === c.id}
                  onToggle={() => toggle(c.id ?? "")}
                  onOpen={() => setParam("p", c.id)}
                />
              ))}
            </ul>
          )}

          <p className="mt-4 flex items-center gap-2 rounded-lg bg-navy-tint px-4 py-2.5 text-[13.5px] text-navy">
            <CircleCheck size={16} className="shrink-0" aria-hidden="true" />
            Shortlisted providers are sent to MPI with your brief. MPI approves every invite.
          </p>
        </>
      )}

      <AnimatePresence>
        {openId && (
          <ProfilePanel
            key={openId}
            orgId={openId}
            categoryName={categoryName}
            saved={saved.includes(openId)}
            busy={busyId === openId}
            onToggle={() => toggle(openId)}
            onClose={() => setParam("p", null)}
          />
        )}
        {shortlistOpen && !openId && cards !== null && (
          <ShortlistPanel
            key="shortlist"
            cards={savedCards}
            drafts={drafts}
            busyId={busyId}
            onRemove={toggle}
            onOpen={(id) => setParam("p", id)}
            onClose={() => setParam("shortlist", null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function ProviderRow({
  c,
  rating,
  categoryName,
  saved,
  busy,
  onToggle,
  onOpen,
}: {
  c: FreelancerCard
  rating: Rating | null
  categoryName: (id: string | null) => string | null
  saved: boolean
  busy: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const where = [c.city, c.state].filter(Boolean).join(", ")
  const cats = (c.category_ids ?? []).map((id) => categoryName(id)).filter(Boolean)
  const available = c.availability ?? "available"
  return (
    <li
      className="rounded-xl bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)]"
      style={
        saved
          ? {
              border: "2px solid transparent",
              background: "linear-gradient(#fff, #fff) padding-box, linear-gradient(120deg, #f09a47, #db4230) border-box",
            }
          : { border: "1.5px solid #e2e6ee" }
      }
    >
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_auto] md:items-center">
        {/* who */}
        <div className="flex min-w-0 items-center gap-3">
          <AnonAvatar code={c.display_name ?? ""} size={52} />
          <div className="min-w-0">
            <p className="font-display text-[15.5px] font-bold leading-snug text-navy">{c.display_name}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-orange-tint px-2 py-px text-[12px] font-bold text-navy">
              <BadgeCheck size={13} aria-hidden="true" /> Verified freelancer
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
              {where && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} aria-hidden="true" /> {c.city ?? where}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <span className={`size-2 rounded-full ${available === "busy" ? "bg-red" : available === "limited" ? "bg-orange" : "bg-[#047857]"}`} aria-hidden="true" />
                {available === "busy" ? "Busy" : available === "limited" ? "Limited time" : "Available"}
              </span>
            </p>
          </div>
        </div>

        {/* what */}
        <div className="min-w-0">
          <p className="line-clamp-2 text-[15.5px] font-semibold leading-snug text-navy">{c.headline || "No headline yet"}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Top skills">
            {topSkills(c, 3).map((s) => (
              <li key={s.skill_id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-page px-2.5 py-0.5 text-[12.5px] font-semibold text-navy">
                {s.name}
                <span className="text-[11.5px] font-medium text-muted">{label(SKILL_LEVELS, s.level)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            {(c.verified_checks ?? []).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <CircleCheck size={13} className="text-[#047857]" aria-hidden="true" /> {CHECK_SHORT[k] ?? k}
              </span>
            ))}
            {c.years_experience !== null && <span>{c.years_experience} yrs experience</span>}
            {c.usual_delivery_days !== null && (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} aria-hidden="true" /> Delivers in ~{c.usual_delivery_days} days
              </span>
            )}
            <span>{label(WORK_MODES, c.work_mode)}</span>
            {cats.length > 0 && <span>{cats.join(" · ")}</span>}
          </p>
        </div>

        {/* price and actions */}
        <div className="flex flex-col gap-2.5 md:items-end md:text-right">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Packages from</p>
            <p className="font-display text-[22px] font-bold leading-tight text-navy">
              {c.starting_price !== null ? rupees(Number(c.starting_price)) : "—"}
            </p>
            {rating && rating.reviews > 0 ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-navy">
                <Star size={13} className="fill-orange text-orange" aria-hidden="true" /> {rating.rating.toFixed(1)}
                <span className="font-normal text-muted">
                  ({rating.reviews} review{rating.reviews === 1 ? "" : "s"})
                </span>
              </p>
            ) : (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-muted">
                <Star size={13} aria-hidden="true" /> New on MPI
              </p>
            )}
          </div>
          <div className="flex gap-2 md:justify-end">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md border-[1.5px] border-navy bg-white px-3.5 text-[14px] font-bold text-navy hover:bg-navy-tint"
            >
              View profile
            </button>
            <ShortlistButton saved={saved} busy={busy} onToggle={onToggle} compact />
          </div>
        </div>
      </div>
    </li>
  )
}
