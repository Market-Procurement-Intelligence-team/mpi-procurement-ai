/**
 * A freelancer's ANONYMOUS profile, as startups see it: the anonymous code,
 * never a name, past client or company name, link, or contact detail.
 * Used by the freelancer's "Preview as a startup" now, and by the startup's
 * Find a provider screen later (fed from the freelancer_* views).
 */

import { useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { BadgeCheck, BriefcaseBusiness, CircleCheck, CircleX, Clock, FolderKanban, GraduationCap, Lock, MapPin, RefreshCw, Sparkles, Star } from "lucide-react"
import type { MyProviderProfile } from "../../services/data/providers"
import { rupees, SOFT_BG } from "../supplier/parts"
import { AVAILABILITY, label, monthYear, SKILL_LEVELS, WORK_MODES } from "./useBuilder"

export interface PublicFreelancer {
  code: string
  city: string | null
  state: string | null
  headline: string | null
  bio: string | null
  years: number | null
  workMode: string
  serviceArea: string | null
  availability: string
  maxParallel: number
  deliveryDays: number | null
  since: string | null
  checks: string[]
  languages: { name: string; level: string }[]
  tools: string[]
  skills: { name: string; level: string; years: number | null }[]
  projects: { id: string; title: string; category: string | null; clientKind: string | null; year: number | null; work: string | null; result: string | null; tools: string[] }[]
  experience: { id: string; role: string; companyKind: string | null; from: string; to: string | null; description: string | null }[]
  credentials: { id: string; kind: string; title: string; issuer: string | null; year: number | null }[]
  packages: { id: string; title: string; category: string | null; price: number; days: number; revisions: number; included: string[]; excluded: string[] }[]
  /** Reviews from completed service orders (never who wrote them). */
  rating?: { rating: number; reviews: number } | null
  reviews?: { id: string; rating: number; tags: string[]; note: string | null; created_at: string }[]
}

const TAG_LABEL: Record<string, string> = { on_time: "On time", good_quality: "Good quality", easy_to_work_with: "Easy to work with" }

/** The public view of the signed-in freelancer's own profile (private fields left out). */
export function fromOwnProfile(d: MyProviderProfile, code: string, city: string | null, state: string | null, categoryName: (id: string | null) => string | null): PublicFreelancer {
  const p = d.profile
  const verified = d.verifications.filter((v) => v.status === "verified" && (!v.expires_at || v.expires_at >= new Date().toISOString().slice(0, 10)))
  return {
    code,
    city,
    state,
    headline: p.headline,
    bio: p.bio,
    years: p.years_experience,
    workMode: p.work_mode,
    serviceArea: p.service_area,
    availability: p.availability,
    maxParallel: p.max_parallel_projects,
    deliveryDays: p.usual_delivery_days,
    since: p.reviewed_at,
    checks: [...new Set(verified.map((v) => v.kind))],
    languages: Array.isArray(p.languages) ? (p.languages as { name: string; level: string }[]) : [],
    tools: p.tools,
    skills: d.skills.map((s) => ({ name: s.skill?.name ?? "Skill", level: s.level, years: s.years })),
    projects: d.projects.map((x) => ({ id: x.id, title: x.title, category: categoryName(x.category_id), clientKind: x.client_kind, year: x.year, work: x.role_and_work, result: x.result, tools: x.tools })),
    experience: d.experience.map((x) => ({ id: x.id, role: x.role_title, companyKind: x.company_kind, from: x.started_on, to: x.ended_on, description: x.description })),
    credentials: d.credentials.map((x) => ({ id: x.id, kind: x.kind, title: x.title, issuer: x.issuer, year: x.year })),
    packages: d.packages
      .filter((k) => k.is_active)
      .map((k) => ({ id: k.id, title: k.title, category: categoryName(k.category_id), price: Number(k.price), days: k.turnaround_days, revisions: k.revision_rounds, included: k.deliverables, excluded: k.exclusions })),
  }
}

const CHECK_LABEL: Record<string, string> = {
  identity_pan: "Identity (PAN) checked",
  bank: "Bank checked",
  gst: "GST checked",
  udyam: "Udyam checked",
  credential: "Certificate checked",
}

const LEVEL_WIDTH: Record<string, number> = { beginner: 34, intermediate: 67, expert: 100 }

/** An abstract avatar: never a photo or initials, so nobody can be recognised. */
export function AnonAvatar({ code, size = 64 }: { code: string; size?: number }) {
  const n = [...code].reduce((a, c) => a + c.charCodeAt(0), 0)
  const turn = (n * 37) % 360
  return (
    <span className="relative shrink-0 overflow-hidden rounded-2xl shadow-lg" style={{ width: size, height: size, background: "#233653" }} aria-hidden="true">
      <span className="absolute rounded-full" style={{ width: size * 0.9, height: size * 0.9, left: -size * 0.2, top: -size * 0.25, background: "linear-gradient(135deg,#f09a47,#db4230)", transform: `rotate(${turn}deg)` }} />
      <span className="absolute rounded-lg" style={{ width: size * 0.42, height: size * 0.42, right: size * 0.12, bottom: size * 0.12, background: "#15233d", border: "2px solid rgba(255,255,255,0.18)" }} />
      <span className="absolute rounded-full" style={{ width: size * 0.16, height: size * 0.16, right: size * 0.25, top: size * 0.2, background: "#fdebd9" }} />
    </span>
  )
}

function Side({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line/70 bg-white p-4">
      <h3 className="text-[15px] font-bold text-navy">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function PackageCard({ k, action }: { k: PublicFreelancer["packages"][number]; action?: ReactNode }) {
  return (
    <article className="rounded-xl border-[1.5px] border-line/70 bg-white p-4">
      {k.category && <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">{k.category}</p>}
      <h4 className="mt-0.5 font-display text-[16px] font-bold leading-snug text-navy">{k.title}</h4>
      <p className="mt-2 font-display text-[24px] font-bold leading-none text-navy">{rupees(k.price)}</p>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock size={13} aria-hidden="true" /> {k.days} day{k.days === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1">
          <RefreshCw size={13} aria-hidden="true" /> {k.revisions} revision{k.revisions === 1 ? "" : "s"}
        </span>
      </p>
      {k.included.length > 0 && (
        <ul className="mt-3 space-y-1">
          {k.included.map((v) => (
            <li key={v} className="flex gap-2 text-[13.5px] text-navy">
              <CircleCheck size={15} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" /> {v}
            </li>
          ))}
        </ul>
      )}
      {k.excluded.length > 0 && (
        <ul className="mt-2 space-y-1">
          {k.excluded.map((v) => (
            <li key={v} className="flex gap-2 text-[13.5px] text-muted">
              <CircleX size={15} className="mt-0.5 shrink-0 text-red-text" aria-hidden="true" /> {v}
            </li>
          ))}
        </ul>
      )}
      {action && <div className="mt-3">{action}</div>}
    </article>
  )
}

type WorkTab = "projects" | "experience" | "credentials" | "reviews"

export default function PublicProfile({ f, actions, banner }: { f: PublicFreelancer; actions?: ReactNode; banner?: ReactNode }) {
  const [tab, setTab] = useState<WorkTab>("projects")
  const tabs: { id: WorkTab; label: string; icon: typeof Star; count?: number }[] = [
    { id: "projects", label: "Projects", icon: FolderKanban, count: f.projects.length },
    { id: "experience", label: "Experience", icon: BriefcaseBusiness, count: f.experience.length },
    { id: "credentials", label: "Certificates & education", icon: GraduationCap, count: f.credentials.length },
    { id: "reviews", label: "Reviews", icon: Star, count: f.rating?.reviews || undefined },
  ]
  const where = [f.city, f.state].filter(Boolean).join(", ")
  return (
    <div className="space-y-5">
      {banner}
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-ink text-white shadow-[0_8px_30px_rgba(15,23,40,0.18)]">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-orange/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 size-72 rounded-full bg-[#2b4a7e]/40 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <AnonAvatar code={f.code} />
            <div className="min-w-0">
              <h2 className="text-[24px] font-bold leading-tight sm:text-[28px]">{f.code}</h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange px-2.5 py-1 text-xs font-bold text-navy">
                  <BadgeCheck size={14} aria-hidden="true" /> Verified freelancer
                </span>
                {f.checks.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold">
                    <CircleCheck size={13} className="text-orange" aria-hidden="true" /> {CHECK_LABEL[c] ?? c}
                  </span>
                ))}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-white/75">
                {where && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} aria-hidden="true" /> {where} · {label(WORK_MODES, f.workMode)}
                    {f.serviceArea ? ` · ${f.serviceArea}` : ""}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${f.availability === "busy" ? "bg-red" : f.availability === "limited" ? "bg-orange" : "bg-[#34d399]"}`} aria-hidden="true" />
                  {label(AVAILABILITY, f.availability)} · up to {f.maxParallel} project{f.maxParallel === 1 ? "" : "s"} at a time
                </span>
                {f.since && <span>On MPI since {monthYear(f.since)}</span>}
                {f.rating && f.rating.reviews > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                    <Star size={15} className="fill-orange text-orange" aria-hidden="true" /> {f.rating.rating.toFixed(1)} ({f.rating.reviews} review{f.rating.reviews === 1 ? "" : "s"})
                  </span>
                )}
              </p>
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        <p className="relative flex items-start gap-2 border-t border-white/10 px-5 py-2.5 text-[13px] text-white/70 sm:px-7">
          <Lock size={14} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
          Name, contact details and past client names stay hidden. MPI shares what's needed once you place an order.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {/* About */}
          <section className="rounded-xl border border-line/70 p-5" style={{ background: SOFT_BG }}>
            <h3 className="font-display text-[20px] font-bold leading-snug text-navy">{f.headline || "No headline yet"}</h3>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink">{f.bio || "No bio yet."}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact label="Experience" value={f.years !== null ? `${f.years} year${f.years === 1 ? "" : "s"}` : "—"} />
              <Fact label="Usual delivery" value={f.deliveryDays ? `${f.deliveryDays} days` : "—"} />
              <Fact label="Packages from" value={f.packages.length ? rupees(Math.min(...f.packages.map((k) => k.price))) : "—"} />
            </div>
          </section>

          {/* Work, in tabs so the page stays short */}
          <section className="overflow-hidden rounded-xl border border-line/70 bg-white">
            <div role="tablist" aria-label="Work" className="flex gap-1 overflow-x-auto border-b border-line px-2">
              {tabs.map((t) => {
                const on = tab === t.id
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)} className={`relative flex min-h-12 shrink-0 items-center gap-2 px-3 text-[14.5px] font-semibold ${on ? "text-navy" : "text-muted hover:text-navy"}`}>
                    <t.icon size={16} className={on ? "text-orange-2" : ""} aria-hidden="true" />
                    {t.label}
                    {t.count !== undefined && <span className={`rounded-full px-1.5 text-[12px] font-bold ${on ? "bg-orange text-navy" : "bg-navy-tint text-navy"}`}>{t.count}</span>}
                    {on && <motion.span layoutId="pub-tab" className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-orange" />}
                  </button>
                )
              })}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="p-4 sm:p-5">
                {tab === "projects" &&
                  (f.projects.length ? (
                    <ul className="space-y-3">
                      {f.projects.map((x) => (
                        <li key={x.id} className="rounded-xl border border-line/70 p-4" style={{ background: SOFT_BG }}>
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-[16px] font-bold text-navy">{x.title}</span>
                            {x.category && <span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-navy">{x.category}</span>}
                          </p>
                          <p className="mt-0.5 text-[13px] text-muted">
                            {[x.clientKind ? `For a ${x.clientKind.replace(/^an? /i, "")}` : null, x.year].filter(Boolean).join(" · ")}
                          </p>
                          {x.work && <p className="mt-2 text-[14.5px] text-ink">{x.work}</p>}
                          {x.result && (
                            <p className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-[13.5px] font-semibold text-navy">
                              <Sparkles size={14} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" /> {x.result}
                            </p>
                          )}
                          {x.tools.length > 0 && (
                            <p className="mt-2 flex flex-wrap gap-1.5">
                              {x.tools.map((t) => (
                                <span key={t} className="rounded-md border border-line bg-white px-2 py-0.5 text-[12px] text-muted">
                                  {t}
                                </span>
                              ))}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>No projects yet.</Empty>
                  ))}
                {tab === "experience" &&
                  (f.experience.length ? (
                    <ol className="relative ml-2 space-y-4 border-l-2 border-line pl-5">
                      {f.experience.map((x) => (
                        <li key={x.id} className="relative">
                          <span className={`absolute top-1 size-3 rounded-full ring-4 ring-white ${x.to ? "bg-input" : "bg-orange"}`} style={{ left: -27 }} aria-hidden="true" />
                          <p className="text-[12.5px] font-semibold text-muted">
                            {monthYear(x.from)} – {x.to ? monthYear(x.to) : "Now"}
                          </p>
                          <p className="font-bold text-navy">{x.role}</p>
                          {x.companyKind && <p className="text-[13.5px] text-muted">{x.companyKind}</p>}
                          {x.description && <p className="mt-1 text-[14px] text-ink">{x.description}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty>No work history yet.</Empty>
                  ))}
                {tab === "credentials" &&
                  (f.credentials.length ? (
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {f.credentials.map((x) => (
                        <li key={x.id} className="rounded-xl border border-line/70 p-3.5" style={{ background: SOFT_BG }}>
                          <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">{x.kind === "education" ? "Education" : x.kind === "course" ? "Course" : "Certification"}</p>
                          <p className="font-bold text-navy">{x.title}</p>
                          <p className="text-[13px] text-muted">{[x.issuer, x.year].filter(Boolean).join(" · ")}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>No certificates or education added.</Empty>
                  ))}
                {tab === "reviews" &&
                  (f.reviews && f.reviews.length ? (
                    <ul className="space-y-3">
                      {f.reviews.map((r) => (
                        <li key={r.id} className="rounded-lg border border-line/70 p-3.5">
                          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                            <span className="inline-flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star key={n} size={15} className={n <= r.rating ? "fill-orange text-orange" : "text-line"} aria-hidden="true" />
                              ))}
                            </span>
                            A startup on MPI · {monthYear(r.created_at)}
                          </p>
                          {r.tags.length > 0 && (
                            <p className="mt-1.5 flex flex-wrap gap-1.5">
                              {r.tags.map((t) => (
                                <span key={t} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[12.5px] font-semibold text-navy">
                                  {TAG_LABEL[t] ?? t}
                                </span>
                              ))}
                            </p>
                          )}
                          {r.note && <p className="mt-1.5 text-[14.5px] text-ink">"{r.note}"</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>New on MPI. Reviews appear here after finished orders.</Empty>
                  ))}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>

        {/* Right column */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section>
            <h3 className="mb-2 text-[15px] font-bold text-navy">Packages</h3>
            <div className="space-y-3">
              {f.packages.length ? (
                f.packages.map((k) => (
                  <PackageCard key={k.id} k={k} />
                ))
              ) : (
                <Empty>No packages yet.</Empty>
              )}
            </div>
          </section>
          <Side title="Skills">
            {f.skills.length ? (
              <ul className="space-y-2.5">
                {f.skills.map((s) => (
                  <li key={s.name}>
                    <p className="flex justify-between text-[13.5px]">
                      <span className="font-semibold text-navy">{s.name}</span>
                      <span className="text-muted">
                        {label(SKILL_LEVELS, s.level)}
                        {s.years ? ` · ${s.years} yr${s.years === 1 ? "" : "s"}` : ""}
                      </span>
                    </p>
                    <span className="mt-1 block h-1.5 rounded-full bg-navy-tint">
                      <span className="block h-full rounded-full btn-gradient" style={{ width: `${LEVEL_WIDTH[s.level] ?? 50}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted">No skills yet.</p>
            )}
          </Side>
          {(f.languages.length > 0 || f.tools.length > 0) && (
            <Side title="Languages and tools">
              <ul className="space-y-1 text-[13.5px]">
                {f.languages.map((l) => (
                  <li key={l.name} className="flex justify-between">
                    <span className="font-semibold text-navy">{l.name}</span>
                    <span className="capitalize text-muted">{l.level}</span>
                  </li>
                ))}
              </ul>
              {f.tools.length > 0 && (
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {f.tools.map((t) => (
                    <span key={t} className="rounded-md bg-navy-tint px-2 py-0.5 text-[12.5px] font-semibold text-navy">
                      {t}
                    </span>
                  ))}
                </p>
              )}
            </Side>
          )}
        </aside>
      </div>
    </div>
  )
}

function Fact({ label: l, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2.5">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">{l}</p>
      <p className="mt-0.5 font-display text-[17px] font-bold text-navy">{value}</p>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-[14px] text-muted">{children}</p>
}
