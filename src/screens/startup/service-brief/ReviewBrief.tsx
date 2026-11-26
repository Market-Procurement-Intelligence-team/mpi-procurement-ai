/**
 * Brief step 4, "Review & send": the brief in readable sections with Edit
 * links, Add a scheme, and what happens after sending.
 */

import type { ReactNode } from "react"
import { BadgeCheck, CalendarDays, CircleCheck, ExternalLink, Handshake, Lock, MapPin, Pencil, RefreshCw, Rocket, Sparkles, Users, Wallet } from "lucide-react"
import type { Category } from "../../../services/data/catalogue"
import type { Skill } from "../../../services/data/providers"
import { SOFT_BG } from "../../supplier/parts"
import { emptyDraft, formatDate, formatRupees, toNumber, type WizardDraft } from "../new-request/draft"
import SchemePicker from "../new-request/SchemePicker"
import { PROVIDER_LABEL, type BriefStep, type ServiceDraft } from "./brief"

const NEXT = [
  { icon: BadgeCheck, title: "MPI checks the matches", body: "MPI's AI suggests providers who fit, and the MPI team approves each one." },
  { icon: Users, title: "Providers send proposals", body: "Their price, timeline and how they'll do the work. They never see your budget." },
  { icon: Handshake, title: "You compare and choose one", body: "Pick the proposal that suits you best." },
  { icon: Wallet, title: "You pay the first part to MPI", body: "MPI holds it and pays the provider when you accept the work." },
  { icon: Rocket, title: "Work starts", body: "You follow progress and accept each deliverable." },
]

function Section({ title, step, onEdit, children }: { title: string; step: BriefStep; onEdit: (s: BriefStep) => void; children: ReactNode }) {
  return (
    <section className="px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold uppercase tracking-wide text-muted">{title}</h3>
        <button type="button" onClick={() => onEdit(step)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-navy hover:bg-navy-tint" aria-label={`Edit ${title.toLowerCase()}`}>
          <Pencil size={15} aria-hidden="true" /> Edit
        </button>
      </div>
      {children}
    </section>
  )
}

function Fact({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-[13.5px] font-semibold text-navy">
      <Icon size={14} className="text-orange-2" aria-hidden="true" />
      {children}
    </span>
  )
}

export default function ReviewBrief({
  draft,
  categories,
  skills,
  onEdit,
  update,
}: {
  draft: ServiceDraft
  categories: Category[] | null
  skills: Skill[]
  onEdit: (s: BriefStep) => void
  update: (patch: Partial<ServiceDraft>) => void
}) {
  const category = categories?.find((c) => c.id === draft.categoryId)
  const deliverables = draft.deliverables.filter((d) => d.title.trim())
  const skillNames = draft.skillIds.map((id) => skills.find((s) => s.id === id)?.name).filter(Boolean) as string[]
  const links = draft.links.filter((l) => l.trim())
  const min = toNumber(draft.budgetMin)
  const max = toNumber(draft.budgetMax)
  const budget =
    min != null && max != null ? `${formatRupees(draft.budgetMin)} to ${formatRupees(draft.budgetMax)}` : min != null ? `From ${formatRupees(draft.budgetMin)}` : max != null ? `Up to ${formatRupees(draft.budgetMax)}` : "Not given"

  // The scheme picker reads a goods draft; give it the brief in that shape.
  const asGoods: WizardDraft = {
    ...emptyDraft(),
    categoryId: draft.categoryId,
    title: draft.title,
    description: draft.goal,
    items: deliverables.map((d) => ({ key: d.key, itemId: null, itemName: null, description: d.title, quantity: "1", unit: "deliverable" })),
    schemeIds: draft.schemeIds,
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-start">
      <div className="min-w-0 overflow-hidden rounded-xl border-[1.5px] border-line shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={{ background: SOFT_BG }}>
        <div className="accent-line h-1" />
        <div className="px-5 pt-5 sm:px-6">
          <p className="text-sm font-semibold text-muted">{category?.name ?? "No kind of service chosen"} · Service brief</p>
          <h2 className="mt-1 text-2xl font-bold text-navy">{draft.title.trim() || "Untitled brief"}</h2>
          {draft.goal.trim() && <p className="mt-2 whitespace-pre-line text-[15px] text-muted">{draft.goal.trim()}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Fact icon={CalendarDays}>Done by {formatDate(draft.neededBy) || "no date"}</Fact>
            <Fact icon={RefreshCw}>
              {draft.revisionRounds} round{draft.revisionRounds === 1 ? "" : "s"} of changes
            </Fact>
            <Fact icon={MapPin}>{draft.remote ? "Online, anywhere in India" : [draft.deliveryCity.trim(), draft.deliveryState].filter(Boolean).join(", ")}</Fact>
          </div>
        </div>
        <div className="mt-2 divide-y divide-line">
          <Section title="Deliverables" step={1} onEdit={onEdit}>
            <ol className="space-y-2">
              {deliverables.map((d, i) => (
                <li key={d.key} className="flex items-start gap-3 rounded-lg border border-line/70 bg-white px-4 py-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[12px] font-bold text-white">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy">{d.title}</span>
                    {d.doneWhen.trim() && (
                      <span className="mt-0.5 flex items-start gap-1.5 text-[13.5px] text-muted">
                        <CircleCheck size={14} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" /> Done when: {d.doneWhen.trim()}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
          {(skillNames.length > 0 || links.length > 0) && (
            <Section title="Skills and references" step={1} onEdit={onEdit}>
              {skillNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {skillNames.map((n) => (
                    <span key={n} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-sm font-semibold text-navy">
                      {n}
                    </span>
                  ))}
                </div>
              )}
              {links.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {links.map((l) => (
                    <li key={l} className="flex items-center gap-1.5 text-[14px] text-navy">
                      <ExternalLink size={14} className="shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">{l}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          <Section title="Budget and providers" step={2} onEdit={onEdit}>
            <dl className="space-y-1.5 text-[15px]">
              <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-sm text-muted">Budget</dt>
                <dd className="inline-flex flex-wrap items-center gap-2 font-medium text-navy">
                  {budget}
                  {(min != null || max != null) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-tint px-2 py-0.5 text-xs font-semibold">
                      <Lock size={12} aria-hidden="true" /> Private
                    </span>
                  )}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-sm text-muted">Providers</dt>
                <dd className="font-medium text-navy">{PROVIDER_LABEL[draft.providerPreference]}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-sm text-muted">Proposals wanted</dt>
                <dd className="font-medium text-navy">{draft.proposalsWanted === 3 ? "Up to 3" : draft.proposalsWanted}</dd>
              </div>
            </dl>
          </Section>
          {draft.text.trim() && (
            <section className="px-5 py-5 sm:px-6">
              <h3 className="mb-2 text-[15px] font-bold uppercase tracking-wide text-muted">Your own words</h3>
              <p className="whitespace-pre-line rounded-lg bg-page p-3 text-[15px] text-navy">{draft.text.trim()}</p>
              <p className="mt-2 text-xs text-muted">Kept for the MPI team. Providers don't see this.</p>
            </section>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-6">
        <SchemePicker draft={asGoods} categories={categories} update={(p) => p.schemeIds && update({ schemeIds: p.schemeIds })} />
        <aside className="relative overflow-hidden rounded-xl bg-ink p-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-orange/20 blur-3xl" aria-hidden="true" />
          <h2 className="relative flex items-center gap-2 text-xl font-bold">
            <Sparkles size={18} className="text-orange" aria-hidden="true" /> What happens next
          </h2>
          <ol className="relative mt-5 space-y-4">
            {NEXT.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-orange">
                  <s.icon size={17} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">
                    {i + 1}. {s.title}
                  </span>
                  <span className="block text-sm leading-relaxed text-white/75">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}
