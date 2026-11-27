/**
 * The freelancer's own Profile page: the profile builder.
 *
 * Top: a dark header with the person, their anonymous name, how ready the
 * profile is, and the main action (Send for review, Pause, Resume).
 * Tabs: Profile builder, Preview as a startup, Settings.
 * The builder shows ONE section at a time, picked from a menu on the left
 * (a row of pills on phones), so the page never turns into a long scroll.
 * The open section and tab are kept in the address (?s=…&tab=…).
 */

import { useState, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import {
  BadgeCheck,
  BriefcaseBusiness,
  Circle,
  CircleAlert,
  CircleCheck,
  Eye,
  FolderKanban,
  GraduationCap,
  Hourglass,
  Lock,
  PackageCheck,
  Pause,
  Play,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useMe } from "../../app/session"
import { PROVIDER_STATUS_LABEL, setMyProfilePaused, submitMyProfile, type ProviderStatus } from "../../services/data/providers"
import Button from "../../ui/Button"
import { Alert } from "../../ui/form"
import FullPageMessage from "../../ui/FullPageMessage"
import SettingsSection from "../profile/SettingsSection"
import { errorText, useToast } from "../supplier/parts"
import PublicProfile, { fromOwnProfile } from "./PublicProfile"
import About from "./sections/About"
import Checks from "./sections/Checks"
import Credentials from "./sections/Credentials"
import Experience from "./sections/Experience"
import Packages from "./sections/Packages"
import Projects from "./sections/Projects"
import Skills from "./sections/Skills"
import type { SectionProps } from "./sections/types"
import { readiness, sectionDone, useBuilder, type SectionId } from "./useBuilder"

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; component: (p: SectionProps) => ReactNode; count?: (p: SectionProps["b"]) => number }[] = [
  { id: "about", label: "About", icon: UserRound, component: About },
  { id: "skills", label: "Skills", icon: Sparkles, component: Skills, count: (b) => b.data.skills.length },
  { id: "projects", label: "Projects", icon: FolderKanban, component: Projects, count: (b) => b.data.projects.length },
  { id: "experience", label: "Experience", icon: BriefcaseBusiness, component: Experience, count: (b) => b.data.experience.length },
  { id: "credentials", label: "Certificates", icon: GraduationCap, component: Credentials, count: (b) => b.data.credentials.length },
  { id: "packages", label: "Packages", icon: PackageCheck, component: Packages, count: (b) => b.data.packages.filter((k) => k.is_active).length },
  { id: "checks", label: "Checks", icon: ShieldCheck, component: Checks },
]

type Tab = "builder" | "preview" | "settings"

function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

function Ring({ percent }: { percent: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: 72, height: 72 }} role="img" aria-label={`Profile ${percent}% ready`}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <defs>
          <linearGradient id="fl-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f09a47" />
            <stop offset="100%" stopColor="#db4230" />
          </linearGradient>
        </defs>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="url(#fl-ring)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} style={{ transition: "stroke-dashoffset 600ms" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-white">{percent}%</span>
    </div>
  )
}

export default function FreelancerProfilePage() {
  const me = useMe()
  const orgId = me.organisation.id
  const { builder: b, error, loading, reload } = useBuilder(orgId)
  const [params, setParams] = useSearchParams()
  const [toast, toastNode] = useToast()
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const tab: Tab = params.get("tab") === "preview" ? "preview" : params.get("tab") === "settings" ? "settings" : "builder"
  const sectionParam = params.get("s") as SectionId | null
  const section: SectionId = SECTIONS.some((s) => s.id === sectionParam) ? (sectionParam as SectionId) : "about"
  const go = (next: { tab?: Tab; s?: SectionId }) => {
    const p = new URLSearchParams(params)
    if (next.tab === "builder") p.delete("tab")
    else if (next.tab) p.set("tab", next.tab)
    if (next.s) p.set("s", next.s)
    setParams(p, { replace: true })
  }

  if (loading) return <FullPageMessage loading title="Loading your profile" />
  if (!b) return <Alert>{error ?? "Couldn't load your profile."}</Alert>

  const p = b.data.profile
  const status = p.status as ProviderStatus
  const changesAsked = status === "draft" && !!p.status_note && !!p.reviewed_at
  const ready = readiness(b.data)
  const name = me.profile.full_name || p.legal_name || me.email
  const props: SectionProps = { b, orgId, reload, toast }
  const Current = SECTIONS.find((s) => s.id === section)!.component

  const act = async (fn: () => Promise<void>, done: string) => {
    setActing(true)
    setActionError(null)
    try {
      await fn()
      await reload()
      toast(done)
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      setActing(false)
    }
  }

  const chip = changesAsked ? { text: "Changes asked", cls: "bg-red/90 text-white" } : status === "active" ? { text: "Live", cls: "bg-orange text-navy" } : { text: PROVIDER_STATUS_LABEL[status], cls: "border border-white/15 bg-white/10 text-white" }

  const mainAction =
    status === "active" ? (
      <Button variant="secondary" busy={acting} onClick={() => void act(() => setMyProfilePaused(true), "Paused: you won't get new work")} className="border-white/40 bg-white/10 text-white hover:bg-white/20">
        <Pause size={16} aria-hidden="true" /> Pause new work
      </Button>
    ) : status === "paused" ? (
      <Button busy={acting} onClick={() => void act(() => setMyProfilePaused(false), "You're live again")}>
        <Play size={16} aria-hidden="true" /> Resume
      </Button>
    ) : status === "pending_review" ? (
      <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 bg-white/5 px-4 text-[14.5px] font-semibold text-white/85">
        <Hourglass size={16} className="text-orange" aria-hidden="true" /> Waiting for MPI review
      </span>
    ) : status === "suspended" ? null : (
      <Button busy={acting} disabled={!ready.ready} onClick={() => void act(submitMyProfile, "Sent to MPI for review")} title={ready.ready ? undefined : "Finish the list first"}>
        <Send size={16} aria-hidden="true" /> {changesAsked ? "Send again for review" : "Send for review"}
      </Button>
    )

  const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "builder", label: "Profile builder", icon: Wrench },
    { id: "preview", label: "Preview as a startup", icon: Eye },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-ink text-white shadow-[0_8px_30px_rgba(15,23,40,0.18)]">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-orange/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 size-72 rounded-full bg-[#2b4a7e]/40 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-7 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <span className="btn-gradient flex size-14 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-bold text-navy shadow-lg sm:size-16 sm:text-2xl">{initialsOf(name)}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="break-words text-[24px] font-bold leading-tight sm:text-[28px]">{name}</h1>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${chip.cls}`}>{chip.text}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold">Freelancer</span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[14.5px] text-white/70">
                <Lock size={14} className="shrink-0 text-orange" aria-hidden="true" /> <span>Startups see you as</span> <b className="text-white">{me.organisation.display_name}</b>
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:shrink-0">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Ring percent={ready.percent} />
              <p className="max-w-48 text-sm leading-snug text-white/75">
                {ready.ready ? "Everything MPI needs is there." : `${ready.done} of ${ready.items.length} things MPI needs are done.`}
              </p>
            </div>
            {mainAction}
          </div>
        </div>
        <div role="tablist" aria-label="Profile pages" className="relative flex gap-1 overflow-x-auto border-t border-white/10 px-3 sm:px-5">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button key={t.id} role="tab" type="button" aria-selected={on} onClick={() => go({ tab: t.id })} className={`relative flex min-h-12 shrink-0 items-center gap-2 px-4 text-[15px] font-semibold transition-colors ${on ? "text-white" : "text-white/60 hover:text-white"}`}>
                <t.icon size={17} className={on ? "text-orange" : ""} aria-hidden="true" />
                {t.label}
                {on && <motion.span layoutId="fl-tab" className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-orange" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>

      {actionError && (
        <div className="mt-4">
          <Alert>{actionError}</Alert>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-5">
          {tab === "builder" && (
            <>
              <StatusStrip status={status} changesAsked={changesAsked} note={p.status_note} />
              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                {/* Section menu */}
                <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                  <nav aria-label="Profile sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-xl lg:border lg:border-line/70 lg:bg-white lg:p-2">
                    {SECTIONS.map((s) => {
                      const on = s.id === section
                      const done = sectionDone(b.data, s.id)
                      const n = s.count?.(b)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => go({ s: s.id })}
                          aria-current={on ? "true" : undefined}
                          className={`relative flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-[14.5px] font-semibold transition-colors ${on ? "text-navy" : "text-navy/80 hover:bg-navy-tint"} border border-line/70 bg-white lg:border-0 lg:bg-transparent`}
                        >
                          {on && <motion.span layoutId="fl-nav" className="absolute inset-0 rounded-lg bg-orange-tint" style={{ boxShadow: "inset 3px 0 0 #ec8d49" }} transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                          <s.icon size={17} className={`relative shrink-0 ${on ? "text-orange-2" : "text-muted"}`} aria-hidden="true" />
                          <span className="relative flex-1 whitespace-nowrap">{s.label}</span>
                          {n !== undefined && n > 0 && <span className="relative rounded-full bg-navy-tint px-1.5 text-[12px] font-bold text-navy">{n}</span>}
                          <span className="relative">{done ? <CircleCheck size={16} className="text-[#047857]" aria-label="Done" /> : <Circle size={16} className="text-line" aria-hidden="true" />}</span>
                        </button>
                      )
                    })}
                  </nav>
                  {!ready.ready && status !== "suspended" && (
                    <div className="mt-4 hidden rounded-xl p-4 text-white lg:block" style={{ background: "linear-gradient(135deg, #15233d 0%, #1b2c4a 60%, #233653 100%)" }}>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70">Still to do</p>
                      <ul className="mt-2 space-y-1.5">
                        {ready.items
                          .filter((i) => !i.done)
                          .map((i) => (
                            <li key={i.id}>
                              <button type="button" onClick={() => go({ s: i.section })} className="flex w-full items-start gap-2 text-left text-[13.5px] hover:text-orange">
                                <CircleAlert size={15} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" /> {i.label}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </aside>

                {/* One section at a time */}
                <AnimatePresence mode="wait">
                  <motion.div key={section} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="min-w-0">
                    <Current {...props} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}

          {tab === "preview" && (
            <PublicProfile
              f={fromOwnProfile(b.data, me.organisation.display_name, me.organisation.city, me.organisation.state, b.categoryName)}
              banner={
                <p className="flex items-start gap-2 rounded-xl border-[1.5px] border-orange/60 bg-orange-tint/50 px-4 py-3 text-[14px] text-navy">
                  <Eye size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    This is how startups see your profile{status === "active" ? "" : " once MPI approves it"}. Your name, client and company names, links, PAN and bank details are never shown.
                  </span>
                </p>
              }
              actions={
                <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-[13.5px] font-semibold text-white/80">
                  <BadgeCheck size={16} className="text-orange" aria-hidden="true" /> Startups can shortlist you here
                </span>
              }
            />
          )}

          {tab === "settings" && <SettingsSection email={me.email} />}
        </motion.div>
      </AnimatePresence>
      {toastNode}
    </div>
  )
}

function StatusStrip({ status, changesAsked, note }: { status: ProviderStatus; changesAsked: boolean; note: string | null }) {
  const look = changesAsked
    ? { cls: "border-red/40 bg-red-tint text-red-text", icon: CircleAlert, title: "MPI asked for changes", body: note ? `"${note}" Make the changes, then send it again.` : "Make the changes, then send it again." }
    : status === "pending_review"
      ? { cls: "border-line bg-navy-tint text-navy", icon: Hourglass, title: "Waiting for MPI review", body: "MPI usually reviews within 1–2 working days. You can keep editing meanwhile." }
      : status === "active"
        ? { cls: "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]", icon: CircleCheck, title: "Your profile is live", body: "Startups can find you. Changes show straight away." }
        : status === "paused"
          ? { cls: "border-line bg-orange-tint/60 text-navy", icon: Pause, title: "Paused", body: "Startups can't find you and you won't get new briefs. Resume any time." }
          : status === "suspended"
            ? { cls: "border-red/40 bg-red-tint text-red-text", icon: CircleAlert, title: "Your profile is suspended", body: note ? `MPI: "${note}" Please contact the MPI team.` : "Please contact the MPI team." }
            : { cls: "border-line bg-white text-navy", icon: Circle, title: "Draft: startups can't see you yet", body: "Finish the list, check it under Preview as a startup, then send it to MPI." }
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-2.5 rounded-xl border-[1.5px] px-4 py-3 text-[14.5px] ${look.cls}`} role="status">
      <look.icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <b>{look.title}.</b> {look.body}
      </span>
    </motion.p>
  )
}
