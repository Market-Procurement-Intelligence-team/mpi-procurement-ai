/**
 * Freelancer: Briefs. Service briefs MPI approved this freelancer for.
 *
 * Navy summary cards on top work as the tabs: New, Proposal sent, Won,
 * Closed. Each brief is one card: what the startup wants, by when, the skills
 * asked (the freelancer's own are ticked), and what needs doing next
 * (reply by, a change asked, a price offer to answer). The startup appears
 * as "MPI Verified Buyer" and the budget is never shown.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ArrowRight, CalendarClock, CheckCircle2, CircleCheck, Clock, Handshake, Inbox, ListChecks, MessageSquareText, Repeat, Send, Trophy, XCircle } from "lucide-react"
import { useMe } from "../../../app/session"
import { listCategories, type Category } from "../../../services/data/catalogue"
import { listMyOffers, timeLeftToReply, type Offer } from "../../../services/data/negotiation"
import { listMyBriefs, type Brief, type BriefTab } from "../../../services/data/proposals"
import { getMyProviderProfile, listSkills, type Skill } from "../../../services/data/providers"
import { deliverablesOf } from "../../../services/data/requests"
import EmptyState from "../../../ui/EmptyState"
import { Alert } from "../../../ui/form"
import PageHeader from "../../../ui/PageHeader"
import { Chip, day, daysLeft, errorText, GRADIENT_PANEL, rupees, SummaryCards, timeLeftText, useNow } from "../../supplier/parts"

const EMPTY: Record<BriefTab, { title: string; body: string }> = {
  new: { title: "No new briefs", body: "When MPI matches a startup's brief to your profile, it shows up here." },
  sent: { title: "No proposals sent yet", body: "Proposals you send are kept here until the startup decides." },
  won: { title: "Nothing won yet", body: "When a startup hires you, the brief moves here." },
  closed: { title: "Nothing closed", body: "Briefs you declined or that went to someone else are kept here." },
}

interface Loaded {
  briefs: Brief[]
  offers: Offer[]
  categories: Category[]
  mySkillIds: Set<string>
  skills: Skill[]
}

/** What the freelancer should do next on a brief, as a small line. */
function nextStep(b: Brief, offer: Offer | undefined, now: Date) {
  const openChange = b.changes.find((c) => c.status === "open")
  if (offer) {
    return { icon: Handshake, text: `Price offer to answer · ${timeLeftText(timeLeftToReply(offer, now))} left`, urgent: true }
  }
  if (openChange) return { icon: MessageSquareText, text: "The startup asked for a change", urgent: true }
  if (b.tab === "new") {
    const draft = b.myQuotes.some((q) => q.status === "draft")
    const ms = b.replyBy.getTime() - now.getTime()
    return {
      icon: Clock,
      text: `${draft ? "Draft saved · " : ""}${ms > 0 ? `Reply within ${timeLeftText(ms)}` : "Reply soon"}`,
      urgent: ms > 0 && ms < 86_400_000,
    }
  }
  if (b.tab === "sent") {
    const q = b.myQuotes.find((x) => x.status === "submitted")
    return { icon: Send, text: `Version ${q?.version ?? 1} sent${q?.total != null ? ` · ${rupees(q.total)}` : ""} · waiting for the startup`, urgent: false }
  }
  if (b.tab === "won") return { icon: Trophy, text: "You were hired. The order is in My orders.", urgent: false }
  if (b.invitation.status === "declined") return { icon: XCircle, text: "You declined this brief", urgent: false }
  return { icon: XCircle, text: "The startup chose another provider", urgent: false }
}

function BriefCard({ b, offer, data, now }: { b: Brief; offer: Offer | undefined; data: Loaded; now: Date }) {
  const deliverables = deliverablesOf(b.request)
  const cat = data.categories.find((c) => c.id === b.request.category_id)
  const skills = (b.request.skill_ids ?? []).map((id) => data.skills.find((s) => s.id === id)).filter(Boolean) as Skill[]
  const step = nextStep(b, offer, now)
  const Icon = step.icon
  const cta = b.tab === "new" ? (b.myQuotes.some((q) => q.status === "draft") ? "Finish proposal" : "Write proposal") : step.urgent ? "Answer" : "Open"

  return (
    <article className="flex flex-col overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={GRADIENT_PANEL}>
      <div className="flex-1 px-5 pt-4 pb-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {cat && <span className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[12.5px] font-semibold text-navy">{cat.name}</span>}
          {b.invitation.status === "invited" && <Chip tone="orange">New</Chip>}
          {b.changes.length > 0 && b.tab === "sent" && <Chip tone="line">{b.changes.length} change{b.changes.length === 1 ? "" : "s"} asked</Chip>}
        </div>
        <h2 className="text-[17px] font-bold leading-snug text-navy">{b.request.title}</h2>
        <p className="mt-0.5 text-[13.5px] text-muted">From {b.buyerName}</p>
        <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-navy">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={14} className="text-muted" aria-hidden="true" />
            {b.request.needed_by ? `By ${day(b.request.needed_by)} (${daysLeft(b.request.needed_by)})` : "Flexible date"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={14} className="text-muted" aria-hidden="true" />
            {deliverables.length} deliverable{deliverables.length === 1 ? "" : "s"}
          </span>
          {b.request.revision_rounds != null && (
            <span className="inline-flex items-center gap-1.5">
              <Repeat size={14} className="text-muted" aria-hidden="true" />
              {b.request.revision_rounds} round{b.request.revision_rounds === 1 ? "" : "s"} of changes
            </span>
          )}
        </p>
        {skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills asked">
            {skills.slice(0, 5).map((s) => {
              const mine = data.mySkillIds.has(s.id)
              return (
                <span
                  key={s.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${mine ? "bg-navy text-white" : "border border-line bg-white text-muted"}`}
                >
                  {mine && <CircleCheck size={12} className="text-orange" aria-hidden="true" />}
                  {s.name}
                </span>
              )
            })}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 bg-white/70 px-5 py-3">
        <span className={`inline-flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold ${step.urgent ? "text-red-text" : "text-navy"}`}>
          <Icon size={15} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0">{step.text}</span>
        </span>
        <Link
          to={`/supplier/requests/${b.invitation.id}`}
          className={`inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-md px-4 text-[14px] font-bold ${
            b.tab === "new" || step.urgent ? "btn-gradient text-navy shadow-sm hover:brightness-95" : "border-[1.5px] border-navy bg-white text-navy hover:bg-navy-tint"
          }`}
        >
          {cta} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

export default function BriefsPage() {
  const me = useMe()
  const orgId = me.organisation.id
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const now = useNow()

  const load = useCallback(async () => {
    try {
      const [briefs, offers, categories, mine, skills] = await Promise.all([
        listMyBriefs(orgId),
        listMyOffers(orgId),
        listCategories(),
        getMyProviderProfile(orgId),
        listSkills(),
      ])
      setData({ briefs, offers, categories, skills, mySkillIds: new Set((mine?.skills ?? []).map((s) => s.skill_id)) })
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [orgId])

  useEffect(() => {
    document.title = "Briefs · MPI"
    void load()
  }, [load])

  const openOffer = useMemo(() => {
    const m = new Map<string, Offer>()
    for (const o of data?.offers ?? []) if (o.status === "open" && timeLeftToReply(o, now) > 0) m.set(o.request_id, o)
    return m
  }, [data, now])

  const counts = useMemo(() => {
    const c: Record<BriefTab, number> = { new: 0, sent: 0, won: 0, closed: 0 }
    for (const b of data?.briefs ?? []) c[b.tab] += 1
    return c
  }, [data])

  const asked = (params.get("tab") as BriefTab | null) ?? null
  const tab: BriefTab = asked ?? (counts.new || !counts.sent ? "new" : "sent")
  const list = (data?.briefs ?? []).filter((b) => b.tab === tab)
  const toAnswer = (data?.briefs ?? []).filter((b) => b.tab === "sent" && (openOffer.has(b.request.id) || b.changes.some((c) => c.status === "open"))).length

  return (
    <div>
      <PageHeader title="Briefs" description="Service briefs MPI matched to you. Startups see your anonymous name, never your contact details." />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <SummaryCards
        selected={tab}
        onPick={(id) => setParams({ tab: id }, { replace: true })}
        items={[
          { id: "new", label: "New", value: counts.new, hint: "waiting for your proposal", icon: Inbox, dot: counts.new > 0 },
          { id: "sent", label: "Proposal sent", value: counts.sent, hint: toAnswer ? `${toAnswer} to answer` : "waiting for the startup", icon: Send, dot: toAnswer > 0 },
          { id: "won", label: "Won", value: counts.won, hint: "you were hired", icon: Trophy },
          { id: "closed", label: "Closed", value: counts.closed, hint: "declined or not chosen", icon: CheckCircle2 },
        ]}
      />
      {!data ? (
        <div className="grid gap-4 md:grid-cols-2" aria-label="Loading">
          <div className="h-56 animate-pulse rounded-xl bg-page" />
          <div className="h-56 animate-pulse rounded-xl bg-page" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={tab === "won" ? Trophy : Inbox} title={EMPTY[tab].title} body={EMPTY[tab].body} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((b) => (
            <BriefCard key={b.invitation.id} b={b} offer={openOffer.get(b.request.id)} data={data} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}
