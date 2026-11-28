/**
 * The service brief being written, kept in one place so going Back never
 * loses anything, and in the browser tab (sessionStorage) so a refresh
 * doesn't wipe it. A brief is saved as a request of kind "service".
 */

import type { Json } from "../../../lib/database.types"
import type { BriefDraft } from "../../../services/data/ai"
import {
  deliverableLines,
  deliverablesOf,
  type ProviderPreference,
  type Request,
  type RequestInput,
} from "../../../services/data/requests"
import { newKey, todayIso, toNumber, type Errors } from "../new-request/draft"

export interface DraftDeliverable {
  key: string
  title: string
  doneWhen: string
}

export interface ServiceDraft {
  /** What the startup typed or said. */
  text: string
  aiReadText: string | null
  aiReading: BriefDraft | null
  language: string | null
  categoryId: string | null
  title: string
  goal: string
  deliverables: DraftDeliverable[]
  skillIds: string[]
  neededBy: string
  revisionRounds: number
  remote: boolean
  deliveryCity: string
  deliveryState: string
  links: string[]
  budgetMin: string
  budgetMax: string
  providerPreference: ProviderPreference
  proposalsWanted: number
  schemeIds: string[]
  missing: string[]
  /** Shortlisted freelancers to send with the brief (up to 3). */
  picks: string[]
}

export const BRIEF_STEPS = [
  { id: "need", label: "What you need" },
  { id: "deliverables", label: "Deliverables & timing" },
  { id: "budget", label: "Budget & providers" },
  { id: "review", label: "Review & send" },
] as const

export type BriefStep = 0 | 1 | 2 | 3

export function emptyDeliverable(): DraftDeliverable {
  return { key: newKey(), title: "", doneWhen: "" }
}

export function emptyServiceDraft(): ServiceDraft {
  return {
    text: "",
    aiReadText: null,
    aiReading: null,
    language: null,
    categoryId: null,
    title: "",
    goal: "",
    deliverables: [],
    skillIds: [],
    neededBy: "",
    revisionRounds: 2,
    remote: true,
    deliveryCity: "",
    deliveryState: "",
    links: [],
    budgetMin: "",
    budgetMax: "",
    providerPreference: "any",
    proposalsWanted: 3,
    schemeIds: [],
    missing: [],
    picks: [],
  }
}

/** Fills the brief from the AI's reading, keeping what the startup already wrote where the AI found nothing. */
export function applyBriefReading(d: ServiceDraft, r: BriefDraft): ServiceDraft {
  return {
    ...d,
    aiReadText: d.text,
    aiReading: r,
    language: r.language,
    categoryId: r.categoryId ?? d.categoryId,
    title: r.title || d.title,
    goal: r.goal ?? d.goal,
    deliverables: r.deliverables.length
      ? r.deliverables.map((x) => ({ key: newKey(), title: x.title, doneWhen: x.doneWhen ?? "" }))
      : d.deliverables,
    skillIds: r.skillIds.length ? r.skillIds : d.skillIds,
    neededBy: r.neededBy ?? d.neededBy,
    revisionRounds: r.revisionRounds ?? d.revisionRounds,
    remote: r.remote,
    deliveryCity: r.deliveryCity ?? d.deliveryCity,
    deliveryState: r.deliveryState ?? d.deliveryState,
    budgetMin: r.budgetMin != null ? String(r.budgetMin) : d.budgetMin,
    budgetMax: r.budgetMax != null ? String(r.budgetMax) : d.budgetMax,
    missing: r.missing,
  }
}

/** A saved draft brief, back into the steps. */
export function fromServiceRequest(request: Request): ServiceDraft {
  const reading = (request.ai_extracted as unknown as BriefDraft | null) ?? null
  const text = request.requirement_text ?? ""
  return {
    ...emptyServiceDraft(),
    text,
    aiReadText: reading ? text : null,
    aiReading: reading,
    language: request.input_language,
    categoryId: request.category_id,
    title: request.title === "Untitled brief" ? "" : request.title,
    goal: request.description ?? "",
    deliverables: deliverablesOf(request).map((x) => ({ key: newKey(), title: x.title, doneWhen: x.done_when ?? "" })),
    skillIds: request.skill_ids ?? [],
    neededBy: request.needed_by ?? "",
    revisionRounds: request.revision_rounds ?? 2,
    remote: !request.delivery_city,
    deliveryCity: request.delivery_city ?? "",
    deliveryState: request.delivery_state ?? "",
    links: request.reference_links ?? [],
    budgetMin: request.budget_min != null ? String(request.budget_min) : "",
    budgetMax: request.budget_max != null ? String(request.budget_max) : "",
    providerPreference: (request.provider_preference as ProviderPreference) ?? "any",
    proposalsWanted: request.proposals_wanted ?? 3,
    schemeIds: request.scheme_ids ?? [],
    missing: reading?.missing ?? [],
  }
}

const LINK_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i

/** What must be fixed before leaving a step. */
export function briefErrors(step: BriefStep, d: ServiceDraft): Errors {
  const e: Errors = {}
  if (step === 0) {
    if (!d.categoryId) e.categoryId = "Choose the kind of service."
    if (!d.title.trim()) e.title = "Give the brief a short title."
    else if (d.title.trim().length > 120) e.title = "Keep the title under 120 characters."
  }
  if (step === 1) {
    const filled = d.deliverables.filter((x) => x.title.trim())
    if (!filled.length) e.deliverables = "Add at least one deliverable."
    d.deliverables.forEach((x) => {
      if (!x.title.trim() && x.doneWhen.trim()) e[`${x.key}.title`] = "Say what this deliverable is."
      if (x.title.length > 200) e[`${x.key}.title`] = "Keep it under 200 characters."
    })
    if (!d.neededBy) e.neededBy = "Choose the deadline."
    else if (d.neededBy < todayIso()) e.neededBy = "This date has passed. Choose a later one."
    if (!d.remote) {
      if (!d.deliveryCity.trim()) e.deliveryCity = "Enter the city."
      if (!d.deliveryState) e.deliveryState = "Choose the state."
    }
    d.links.forEach((l, i) => {
      if (l.trim() && !LINK_RE.test(l.trim())) e[`link.${i}`] = "Start the link with https://"
    })
  }
  if (step === 2) {
    const min = toNumber(d.budgetMin)
    const max = toNumber(d.budgetMax)
    if (d.budgetMin.trim() && (min == null || min < 0)) e.budgetMin = "Enter an amount in rupees."
    if (d.budgetMax.trim() && (max == null || max < 0)) e.budgetMax = "Enter an amount in rupees."
    if (min != null && max != null && max < min) e.budgetMax = "The highest amount should be more than the lowest."
  }
  return e
}

/** Turns the brief into what the data layer saves. */
export function toBriefInput(d: ServiceDraft): RequestInput {
  const text = d.text.trim()
  const deliverables = d.deliverables
    .filter((x) => x.title.trim())
    .map((x) => ({ title: x.title.trim(), done_when: x.doneWhen.trim() || null }))
  const fallback = (d.title.trim() || deliverables[0]?.title || text.split(/\s+/).slice(0, 8).join(" ") || "Untitled brief").slice(0, 120)
  return {
    title: fallback.length >= 3 ? fallback : "Untitled brief",
    description: d.goal.trim() || null,
    requirementText: text || null,
    inputLanguage: d.language,
    aiExtracted: (d.aiReading as unknown as Json) ?? null,
    requiredCertifications: [],
    schemeIds: d.schemeIds,
    categoryId: d.categoryId,
    source: d.aiReading ? "ai_assisted" : "catalogue",
    neededBy: d.neededBy || null,
    deliveryCity: d.remote ? null : d.deliveryCity.trim() || null,
    deliveryState: d.remote ? null : d.deliveryState || null,
    budgetMin: toNumber(d.budgetMin),
    budgetMax: toNumber(d.budgetMax),
    lines: deliverableLines(deliverables),
    brief: {
      deliverables,
      skillIds: d.skillIds,
      revisionRounds: d.revisionRounds,
      providerPreference: d.providerPreference,
      proposalsWanted: d.proposalsWanted,
      referenceLinks: d.links.filter((l) => l.trim()),
    },
  }
}

const KEY = "mpi.newBrief"

export interface SavedBrief {
  draft: ServiceDraft
  step: BriefStep
  requestId: string | null
}

export function loadBrief(): SavedBrief | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedBrief
    return saved?.draft ? { ...saved, draft: { ...emptyServiceDraft(), ...saved.draft } } : null
  } catch {
    return null
  }
}

export function storeBrief(saved: SavedBrief): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Private windows can block storage; the steps still work.
  }
}

export function clearBrief(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/** Starts a brief from what the startup wrote on the goods page (they picked a service). */
export function handOffToBrief(text: string, categoryId: string | null): void {
  storeBrief({ draft: { ...emptyServiceDraft(), text, categoryId }, step: 0, requestId: null })
}

/** The picks that go with the brief: none when it asks for businesses only, or freelancers are off. */
export function effectivePicks(d: ServiceDraft, freelancersOn: boolean): string[] {
  return freelancersOn && d.providerPreference !== "business" ? [...new Set(d.picks)].slice(0, 3) : []
}

/** Adds picks (from the shortlist screen) without going over 3. */
export const mergePicks = (current: string[], extra: string[]): string[] => [...new Set([...current, ...extra])].slice(0, 3)

export const PROVIDER_LABEL: Record<ProviderPreference, string> = {
  any: "Any provider",
  business: "Businesses (MSMEs)",
  freelancer: "Freelancers",
}
