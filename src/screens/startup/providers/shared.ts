/**
 * Shared pieces for the startup's Find a provider screen: turning the
 * anonymous freelancer views into what the screens show, and the filters.
 */

import type { FreelancerCard, FreelancerDetail, FreelancerSkill } from "../../../services/data/providers"
import type { PublicFreelancer } from "../../freelancer/PublicProfile"

export const skillsOf = (c: FreelancerCard): FreelancerSkill[] => (Array.isArray(c.skills) ? (c.skills as unknown as FreelancerSkill[]) : [])

const LEVEL_RANK: Record<string, number> = { expert: 0, intermediate: 1, beginner: 2 }

/** Strongest skills first. */
export const topSkills = (c: FreelancerCard, n = 4): FreelancerSkill[] =>
  [...skillsOf(c)].sort((a, b) => (LEVEL_RANK[a.level] ?? 3) - (LEVEL_RANK[b.level] ?? 3)).slice(0, n)

/** The anonymous profile, in the shape the shared profile layout uses. */
export function toPublic(d: FreelancerDetail, categoryName: (id: string | null) => string | null): PublicFreelancer {
  const c = d.card
  return {
    code: c.display_name ?? "MPI Verified Supplier",
    city: c.city,
    state: c.state,
    headline: c.headline,
    bio: c.bio,
    years: c.years_experience,
    workMode: c.work_mode ?? "remote",
    serviceArea: c.service_area,
    availability: c.availability ?? "available",
    maxParallel: c.max_parallel_projects ?? 1,
    deliveryDays: c.usual_delivery_days,
    since: c.approved_at,
    checks: c.verified_checks ?? [],
    languages: Array.isArray(c.languages) ? (c.languages as unknown as { name: string; level: string }[]) : [],
    tools: c.tools ?? [],
    skills: d.skills.map((s) => ({ name: s.name, level: s.level, years: s.years })),
    projects: d.projects.map((x) => ({
      id: x.id ?? "",
      title: x.title ?? "",
      category: categoryName(x.category_id),
      clientKind: x.client_kind,
      year: x.year,
      work: x.role_and_work,
      result: x.result,
      tools: x.tools ?? [],
    })),
    experience: d.experience.map((x) => ({
      id: x.id ?? "",
      role: x.role_title ?? "",
      companyKind: x.company_kind,
      from: x.started_on ?? "",
      to: x.ended_on,
      description: x.description,
    })),
    credentials: d.credentials.map((x) => ({ id: x.id ?? "", kind: x.kind ?? "course", title: x.title ?? "", issuer: x.issuer, year: x.year })),
    packages: d.packages.map((k) => ({
      id: k.id ?? "",
      title: k.title ?? "",
      category: categoryName(k.category_id),
      price: Number(k.price ?? 0),
      days: k.turnaround_days ?? 0,
      revisions: k.revision_rounds ?? 0,
      included: k.deliverables ?? [],
      excluded: k.exclusions ?? [],
    })),
    rating: d.rating,
    reviews: d.reviews,
  }
}

// ---------------------------------------------------------------- filters

export interface Filters {
  q: string
  category: string
  skill: string
  within: number | null
  availableNow: boolean
  priceUpTo: number | null
}

export const NO_FILTERS: Filters = { q: "", category: "", skill: "", within: null, availableNow: false, priceUpTo: null }

export const WITHIN_OPTIONS = [7, 14, 30] as const
export const PRICE_OPTIONS = [10000, 25000, 50000, 100000] as const

export const activeFilterCount = (f: Filters) =>
  [f.category, f.skill, f.within, f.availableNow || null, f.priceUpTo].filter(Boolean).length

export function matches(c: FreelancerCard, f: Filters): boolean {
  if (f.category && !(c.category_ids ?? []).includes(f.category)) return false
  if (f.skill && !skillsOf(c).some((s) => s.skill_id === f.skill)) return false
  if (f.within && (c.usual_delivery_days === null || c.usual_delivery_days > f.within)) return false
  if (f.availableNow && c.availability !== "available") return false
  if (f.priceUpTo && (c.starting_price === null || Number(c.starting_price) > f.priceUpTo)) return false
  const q = f.q.trim().toLowerCase()
  if (q) {
    const text = [c.headline, c.bio, c.display_name, ...(c.tools ?? []), ...skillsOf(c).map((s) => s.name)].join(" ").toLowerCase()
    if (!q.split(/\s+/).every((word) => text.includes(word))) return false
  }
  return true
}
