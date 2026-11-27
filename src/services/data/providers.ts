/**
 * Freelancers (one-person service providers) and their profiles.
 *
 * A freelancer is a supplier organisation of one person. They build their own
 * profile: headline, bio, skills, projects, work experience, certificates,
 * courses, education and fixed-price service packages. MPI reviews it before
 * startups can see it.
 *
 * Privacy: startups read freelancers only through the freelancer_* views,
 * which never include the person's name, PAN, bank details, client or company
 * names, or links. The freelancer and MPI read the full tables.
 *
 * Freelancer sign-up and browsing work only while MPI has switched
 * freelancers on (see freelancersOpen / setFreelancersEnabled).
 */

import { db } from "../../lib/db"
import type { Json, Tables, TablesInsert, TablesUpdate, Views } from "../../lib/database.types"
import { check, unwrap } from "./errors"

export type ProviderProfile = Tables<"provider_profiles">
export type Skill = Tables<"skills">
export type ProviderSkill = Tables<"provider_skills">
export type ProviderProject = Tables<"provider_projects">
export type ProviderExperience = Tables<"provider_experience">
export type ProviderCredential = Tables<"provider_credentials">
export type ProviderPackage = Tables<"provider_packages">
export type ProviderVerification = Tables<"provider_verifications">

export type ProviderStatus = "draft" | "pending_review" | "active" | "paused" | "suspended"
export type PayoutStatus = "not_started" | "pending" | "verified" | "rejected"
export type WorkMode = "remote" | "on_site" | "both"
export type Availability = "available" | "limited" | "busy"
export type SkillLevel = "beginner" | "intermediate" | "expert"
export type LanguageLevel = "basic" | "conversational" | "fluent" | "native"
export type CredentialKind = "certification" | "course" | "education"
export type VerificationKind = "identity_pan" | "gst" | "udyam" | "bank" | "credential"
export type ReviewDecision = "approve" | "changes" | "suspend"

export interface Language {
  name: string
  level: LanguageLevel
}

/** Plain-language labels for screens. */
export const PROVIDER_STATUS_LABEL: Record<ProviderStatus, string> = {
  draft: "Draft",
  pending_review: "Waiting for MPI review",
  active: "Live",
  paused: "Paused",
  suspended: "Suspended",
}

export const VERIFICATION_LABEL: Record<VerificationKind, string> = {
  identity_pan: "Identity (PAN)",
  gst: "GST",
  udyam: "Udyam",
  bank: "Bank details",
  credential: "Certificate",
}

// ---------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------

/** Is freelancer sign-up open? Works before signing in too. */
export async function freelancersOpen(): Promise<boolean> {
  return unwrap(await db.rpc("freelancers_open")) === true
}

/** Admin: open or close freelancer sign-up and browsing. */
export async function setFreelancersEnabled(on: boolean): Promise<void> {
  check(await db.rpc("set_freelancers_enabled", { p_on: on }))
}

// ---------------------------------------------------------------------------
// Skills list
// ---------------------------------------------------------------------------

/** The skills freelancers pick from, optionally for one category. */
export async function listSkills(categoryId?: string): Promise<Skill[]> {
  let query = db.from("skills").select("*").order("sort_order").order("name")
  if (categoryId) query = query.eq("category_id", categoryId)
  return unwrap(await query)
}

// ---------------------------------------------------------------------------
// The freelancer's own profile
// ---------------------------------------------------------------------------

export interface MyProviderProfile {
  profile: ProviderProfile
  categoryIds: string[]
  skills: (ProviderSkill & { skill: Pick<Skill, "id" | "name" | "category_id"> | null })[]
  projects: ProviderProject[]
  experience: ProviderExperience[]
  credentials: ProviderCredential[]
  packages: ProviderPackage[]
  verifications: ProviderVerification[]
}

/** Everything on the signed-in freelancer's profile, or null for other accounts. */
export async function getMyProviderProfile(orgId: string): Promise<MyProviderProfile | null> {
  const profile = unwrap(await db.from("provider_profiles").select("*").eq("org_id", orgId).maybeSingle())
  if (!profile) return null
  const [cats, skills, projects, experience, credentials, packages, verifications] = await Promise.all([
    db.from("vendor_categories").select("category_id").eq("vendor_org_id", orgId),
    db.from("provider_skills").select("*, skill:skills(id, name, category_id)").eq("org_id", orgId),
    db.from("provider_projects").select("*").eq("org_id", orgId).order("sort_order").order("year", { ascending: false }),
    db.from("provider_experience").select("*").eq("org_id", orgId).order("started_on", { ascending: false }),
    db.from("provider_credentials").select("*").eq("org_id", orgId).order("year", { ascending: false }),
    db.from("provider_packages").select("*").eq("org_id", orgId).order("sort_order").order("price"),
    db.from("provider_verifications").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
  ])
  return {
    profile,
    categoryIds: unwrap(cats).map((c) => c.category_id),
    skills: unwrap(skills) as unknown as MyProviderProfile["skills"],
    projects: unwrap(projects),
    experience: unwrap(experience),
    credentials: unwrap(credentials),
    packages: unwrap(packages),
    verifications: unwrap(verifications),
  }
}

/** The parts of the profile a freelancer may edit (not the status fields). */
export type ProviderProfileEdit = Partial<
  Pick<
    TablesUpdate<"provider_profiles">,
    | "headline"
    | "bio"
    | "years_experience"
    | "tools"
    | "work_mode"
    | "service_area"
    | "availability"
    | "max_parallel_projects"
    | "usual_delivery_days"
    | "legal_name"
    | "payout_reference"
  >
> & { languages?: Language[] }

export async function updateMyProviderProfile(orgId: string, edit: ProviderProfileEdit): Promise<void> {
  const { languages, ...rest } = edit
  const patch: TablesUpdate<"provider_profiles"> = { ...rest }
  if (languages) patch.languages = languages as unknown as Json
  check(await db.from("provider_profiles").update(patch).eq("org_id", orgId))
}

/** Replace the freelancer's categories (only categories open to freelancers are accepted). */
export async function setMyCategories(orgId: string, categoryIds: string[]): Promise<void> {
  const current = unwrap(await db.from("vendor_categories").select("category_id").eq("vendor_org_id", orgId))
  const have = new Set(current.map((c) => c.category_id))
  const want = new Set(categoryIds)
  const remove = [...have].filter((id) => !want.has(id))
  const add = [...want].filter((id) => !have.has(id))
  if (remove.length) check(await db.from("vendor_categories").delete().eq("vendor_org_id", orgId).in("category_id", remove))
  if (add.length) check(await db.from("vendor_categories").insert(add.map((category_id) => ({ vendor_org_id: orgId, category_id }))))
}

/** Add or change one skill. */
export async function saveMySkill(orgId: string, skillId: string, level: SkillLevel, years?: number | null): Promise<void> {
  check(await db.from("provider_skills").upsert({ org_id: orgId, skill_id: skillId, level, years: years ?? null }))
}

export async function removeMySkill(orgId: string, skillId: string): Promise<void> {
  check(await db.from("provider_skills").delete().eq("org_id", orgId).eq("skill_id", skillId))
}

// Projects, experience, credentials and packages share the same add / edit / remove shape.
type OwnTable = "provider_projects" | "provider_experience" | "provider_credentials" | "provider_packages"

async function addRow<T extends OwnTable>(table: T, row: TablesInsert<T>): Promise<Tables<T>> {
  // One concrete table type keeps the query builder simple; the row type is checked by the callers.
  return unwrap(await db.from(table as "provider_projects").insert(row as never).select("*").single()) as unknown as Tables<T>
}

async function updateRow<T extends OwnTable>(table: T, id: string, patch: TablesUpdate<T>): Promise<void> {
  check(await db.from(table as "provider_projects").update(patch as never).eq("id", id))
}

async function removeRow(table: OwnTable, id: string): Promise<void> {
  check(await db.from(table as "provider_projects").delete().eq("id", id))
}

/** A past project. client_name and link are seen by MPI only, never by startups. */
export const addProject = (row: TablesInsert<"provider_projects">) => addRow("provider_projects", row)
export const updateProject = (id: string, patch: TablesUpdate<"provider_projects">) => updateRow("provider_projects", id, patch)
export const removeProject = (id: string) => removeRow("provider_projects", id)

/** A past job. company_name is seen by MPI only, never by startups. */
export const addExperience = (row: TablesInsert<"provider_experience">) => addRow("provider_experience", row)
export const updateExperience = (id: string, patch: TablesUpdate<"provider_experience">) =>
  updateRow("provider_experience", id, patch)
export const removeExperience = (id: string) => removeRow("provider_experience", id)

/** A certificate, course or education entry. link is seen by MPI only. */
export const addCredential = (row: TablesInsert<"provider_credentials">) => addRow("provider_credentials", row)
export const updateCredential = (id: string, patch: TablesUpdate<"provider_credentials">) =>
  updateRow("provider_credentials", id, patch)
export const removeCredential = (id: string) => removeRow("provider_credentials", id)

/** A fixed-price service package. Price is in rupees. */
export const addPackage = (row: TablesInsert<"provider_packages">) => addRow("provider_packages", row)
export const updatePackage = (id: string, patch: TablesUpdate<"provider_packages">) => updateRow("provider_packages", id, patch)
export const removePackage = (id: string) => removeRow("provider_packages", id)

/** Ask MPI to check something (identity, GST, Udyam, bank, a certificate). */
export async function requestVerification(orgId: string, kind: VerificationKind, evidenceRef?: string): Promise<void> {
  check(await db.from("provider_verifications").insert({ org_id: orgId, kind, evidence_ref: evidenceRef ?? null }))
}

/** Withdraw a check that MPI has not decided yet. */
export async function withdrawVerification(id: string): Promise<void> {
  check(await db.from("provider_verifications").delete().eq("id", id))
}

/**
 * Send the profile to MPI for review. Fails with a plain message listing
 * what is missing (headline, bio, a category, a skill, a project or job,
 * a package).
 */
export async function submitMyProfile(): Promise<void> {
  check(await db.rpc("submit_provider_profile"))
}

/** Pause (no new work) or resume an approved profile. */
export async function setMyProfilePaused(paused: boolean): Promise<void> {
  check(await db.rpc("set_provider_paused", { p_paused: paused }))
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface ProviderForReview {
  profile: ProviderProfile
  org: Pick<Tables<"organisations">, "id" | "name" | "display_name" | "city" | "state" | "is_demo" | "created_at">
}

/** Admin: freelancer profiles, optionally one status, newest first. */
export async function listProvidersForReview(status?: ProviderStatus): Promise<ProviderForReview[]> {
  let query = db
    .from("provider_profiles")
    .select("*, org:organisations!inner(id, name, display_name, city, state, is_demo, created_at)")
    .order("submitted_at", { ascending: false, nullsFirst: false })
  if (status) query = query.eq("status", status)
  const rows = unwrap(await query) as unknown as (ProviderProfile & { org: ProviderForReview["org"] })[]
  return rows.map(({ org, ...profile }) => ({ profile: profile as ProviderProfile, org }))
}

/** Admin: approve, ask for changes (note required), or suspend. */
export async function reviewProvider(orgId: string, decision: ReviewDecision, note?: string): Promise<void> {
  check(await db.rpc("review_provider_profile", { p_org_id: orgId, p_decision: decision, p_note: note }))
}

/** Admin: decide on one check. A bank check also sets the payout status. */
export async function reviewVerification(
  id: string,
  status: "verified" | "rejected" | "expired",
  note?: string,
  expiresAt?: string,
): Promise<void> {
  check(await db.rpc("review_provider_verification", { p_id: id, p_status: status, p_note: note, p_expires_at: expiresAt }))
}

/** Admin: the small facts the review queue shows on each row. */
export interface ProviderQueueFacts {
  categoryIds: string[]
  checks: Pick<ProviderVerification, "kind" | "status">[]
  skills: number
  work: number
  activePackages: number
}

export async function listProviderQueueFacts(orgIds: string[]): Promise<Map<string, ProviderQueueFacts>> {
  const facts = new Map<string, ProviderQueueFacts>(
    orgIds.map((id) => [id, { categoryIds: [], checks: [], skills: 0, work: 0, activePackages: 0 }]),
  )
  if (!orgIds.length) return facts
  const [cats, checks, skills, projects, jobs, packages] = await Promise.all([
    db.from("vendor_categories").select("vendor_org_id, category_id").in("vendor_org_id", orgIds),
    db.from("provider_verifications").select("org_id, kind, status").in("org_id", orgIds).order("created_at", { ascending: false }),
    db.from("provider_skills").select("org_id").in("org_id", orgIds),
    db.from("provider_projects").select("org_id").in("org_id", orgIds),
    db.from("provider_experience").select("org_id").in("org_id", orgIds),
    db.from("provider_packages").select("org_id").in("org_id", orgIds).eq("is_active", true),
  ])
  for (const c of unwrap(cats)) facts.get(c.vendor_org_id)?.categoryIds.push(c.category_id)
  for (const v of unwrap(checks)) facts.get(v.org_id)?.checks.push({ kind: v.kind, status: v.status })
  const bump = (rows: { org_id: string }[], key: "skills" | "work" | "activePackages") => {
    for (const r of rows) {
      const f = facts.get(r.org_id)
      if (f) f[key]++
    }
  }
  bump(unwrap(skills), "skills")
  bump([...unwrap(projects), ...unwrap(jobs)], "work")
  bump(unwrap(packages), "activePackages")
  return facts
}

/** Admin: the freelancer's PAN (from supplier details) and login email. */
export async function getProviderPrivate(orgId: string): Promise<{ pan: string | null; email: string | null }> {
  const [details, people] = await Promise.all([
    db.from("vendor_details").select("pan_number").eq("org_id", orgId).maybeSingle(),
    db.from("profiles").select("email").eq("org_id", orgId).limit(1),
  ])
  return { pan: unwrap(details)?.pan_number ?? null, email: unwrap(people)[0]?.email ?? null }
}

// ---------------------------------------------------------------------------
// What startups see (anonymous)
// ---------------------------------------------------------------------------

export type FreelancerCard = Views<"freelancer_directory">

export interface FreelancerSkill {
  skill_id: string
  name: string
  category_id: string
  level: SkillLevel
  years: number | null
}

/** Approved freelancers, optionally in one category. */
export async function listFreelancers(categoryId?: string): Promise<FreelancerCard[]> {
  let query = db.from("freelancer_directory").select("*").order("approved_at", { ascending: false })
  if (categoryId) query = query.contains("category_ids", [categoryId])
  return unwrap(await query)
}

export interface FreelancerDetail {
  card: FreelancerCard
  skills: FreelancerSkill[]
  projects: Views<"freelancer_projects">[]
  experience: Views<"freelancer_experience">[]
  credentials: Views<"freelancer_credentials">[]
  packages: Views<"freelancer_packages">[]
}

/** One approved freelancer's anonymous profile, or null if not visible. */
export async function getFreelancer(orgId: string): Promise<FreelancerDetail | null> {
  const card = unwrap(await db.from("freelancer_directory").select("*").eq("id", orgId).maybeSingle())
  if (!card) return null
  const [projects, experience, credentials, packages] = await Promise.all([
    db.from("freelancer_projects").select("*").eq("org_id", orgId).order("sort_order").order("year", { ascending: false }),
    db.from("freelancer_experience").select("*").eq("org_id", orgId).order("started_on", { ascending: false }),
    db.from("freelancer_credentials").select("*").eq("org_id", orgId).order("year", { ascending: false }),
    db.from("freelancer_packages").select("*").eq("org_id", orgId).order("sort_order").order("price"),
  ])
  return {
    card,
    skills: (card.skills ?? []) as unknown as FreelancerSkill[],
    projects: unwrap(projects),
    experience: unwrap(experience),
    credentials: unwrap(credentials),
    packages: unwrap(packages),
  }
}
