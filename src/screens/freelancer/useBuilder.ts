/**
 * Loads everything the freelancer profile builder needs: the freelancer's own
 * profile (with skills, projects, jobs, certificates, packages and checks),
 * the skills list and the categories open to freelancers. Also works out how
 * ready the profile is to send to MPI, using the same rules as the database.
 */

import { useCallback, useEffect, useState } from "react"
import { listCategories, type Category } from "../../services/data/catalogue"
import { getMyProviderProfile, listSkills, type MyProviderProfile, type Skill } from "../../services/data/providers"
import { errorText } from "../supplier/parts"

export type SectionId = "about" | "skills" | "projects" | "experience" | "credentials" | "packages" | "checks"

export interface Builder {
  data: MyProviderProfile
  skills: Skill[]
  /** Categories open to freelancers, in catalogue order. */
  categories: Category[]
  categoryName: (id: string | null) => string | null
}

export function useBuilder(orgId: string) {
  const [state, setState] = useState<{ builder: Builder | null; error: string | null; loading: boolean }>({ builder: null, error: null, loading: true })

  const load = useCallback(async () => {
    try {
      const [data, skills, cats] = await Promise.all([getMyProviderProfile(orgId), listSkills(), listCategories()])
      if (!data) {
        setState({ builder: null, error: "This account has no freelancer profile.", loading: false })
        return
      }
      const categories = cats.filter((c) => c.freelancers_allowed && c.is_active)
      const names = new Map(cats.map((c) => [c.id, c.name]))
      setState({
        builder: { data, skills, categories, categoryName: (id) => (id ? (names.get(id) ?? null) : null) },
        error: null,
        loading: false,
      })
    } catch (err) {
      setState((s) => ({ ...s, error: errorText(err), loading: false }))
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, reload: load }
}

export interface ReadyItem {
  id: string
  label: string
  done: boolean
  section: SectionId
}

/** What MPI needs before the profile can be sent for review. */
export function readiness(d: MyProviderProfile): { items: ReadyItem[]; done: number; percent: number; ready: boolean } {
  const p = d.profile
  const items: ReadyItem[] = [
    { id: "headline", label: "A headline", done: !!p.headline?.trim(), section: "about" },
    { id: "bio", label: "A short bio (50+ characters)", done: (p.bio?.trim().length ?? 0) >= 50, section: "about" },
    { id: "category", label: "At least one category", done: d.categoryIds.length > 0, section: "about" },
    { id: "skill", label: "At least one skill", done: d.skills.length > 0, section: "skills" },
    { id: "work", label: "A project or past job", done: d.projects.length > 0 || d.experience.length > 0, section: "projects" },
    { id: "package", label: "A service package", done: d.packages.some((k) => k.is_active), section: "packages" },
  ]
  const done = items.filter((i) => i.done).length
  return { items, done, percent: Math.round((done / items.length) * 100), ready: done === items.length }
}

/** Has this section got what it needs (for the ticks in the menu)? */
export function sectionDone(d: MyProviderProfile, id: SectionId): boolean {
  const p = d.profile
  switch (id) {
    case "about":
      return !!p.headline?.trim() && (p.bio?.trim().length ?? 0) >= 50 && d.categoryIds.length > 0
    case "skills":
      return d.skills.length > 0
    case "projects":
      return d.projects.length > 0
    case "experience":
      return d.experience.length > 0
    case "credentials":
      return d.credentials.length > 0
    case "packages":
      return d.packages.some((k) => k.is_active)
    case "checks":
      return d.verifications.some((v) => v.kind === "identity_pan" && v.status === "verified") && d.verifications.some((v) => v.kind === "bank" && v.status === "verified")
  }
}

export const LANGUAGE_LEVELS = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
] as const

export const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
] as const

export const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "on_site", label: "On-site" },
  { value: "both", label: "Both" },
] as const

export const AVAILABILITY = [
  { value: "available", label: "Available" },
  { value: "limited", label: "Limited" },
  { value: "busy", label: "Busy" },
] as const

export const label = <T extends string>(list: readonly { value: T; label: string }[], v: string | null | undefined) =>
  list.find((o) => o.value === v)?.label ?? v ?? ""

/** "Jun 2021" from a date. */
export const monthYear = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : null
