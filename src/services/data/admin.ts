/**
 * MPI admin. Only works for an admin account: the database refuses these
 * calls (or returns nothing) for anyone else. The admin sees real company
 * names; startups and suppliers never do.
 */

import { db } from "../../lib/db"
import type { Enums, Tables } from "../../lib/database.types"
import { check, unwrap } from "./errors"
import { REQUEST_FIELDS, withPrivateDetails } from "./requests"

export type VerificationStatus = Enums<"verification_status">
export type PaymentTerms = "full_advance" | "30_70"

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  full_advance: "100% advance before work starts",
  "30_70": "30% before work starts, 70% on delivery",
}

export interface SupplierForReview {
  organisation: Tables<"organisations">
  details: Tables<"vendor_details"> | null
  categoryIds: string[]
}

export interface MatchForReview {
  match: Tables<"request_matches">
  supplierName: string
  supplierCode: string
}

export interface RequestForReview {
  request: Tables<"requests">
  buyerName: string
  categoryName: string | null
  matches: MatchForReview[]
}

// ---------------------------------------------------------------- suppliers

/** Suppliers, optionally only those with one verification status, newest first. */
export async function listSuppliers(status?: VerificationStatus): Promise<SupplierForReview[]> {
  let query = db.from("organisations").select("*").eq("type", "vendor").order("created_at", { ascending: false })
  if (status) query = query.eq("verification_status", status)
  const orgs = unwrap(await query)
  if (!orgs.length) return []

  const ids = orgs.map((o) => o.id)
  const [details, categories] = await Promise.all([
    db.from("vendor_details").select("*").in("org_id", ids).then(unwrap),
    db.from("vendor_categories").select("*").in("vendor_org_id", ids).then(unwrap),
  ])
  const detailsById = new Map(details.map((d) => [d.org_id, d]))

  return orgs.map((organisation) => ({
    organisation,
    details: detailsById.get(organisation.id) ?? null,
    categoryIds: categories.filter((c) => c.vendor_org_id === organisation.id).map((c) => c.category_id),
  }))
}

/**
 * Sets a supplier's verification status, with an optional note (for example
 * which document is missing). Verifying needs a GSTIN and Udyam number.
 */
export async function setVerification(orgId: string, status: VerificationStatus, note?: string): Promise<void> {
  check(await db.rpc("set_vendor_verification", { p_org_id: orgId, p_status: status, p_note: note }))
}

// ---------------------------------------------------------------- matches

/** Open requests that have AI-suggested suppliers waiting for review, oldest first. */
export async function listMatchesToReview(): Promise<RequestForReview[]> {
  const matches = unwrap(
    await db.from("request_matches").select("*").eq("status", "suggested").order("score", { ascending: false }),
  )
  if (!matches.length) return []

  const requestIds = [...new Set(matches.map((m) => m.request_id))]
  const requests = await withPrivateDetails(
    unwrap(
      await db.from("requests").select(REQUEST_FIELDS).in("id", requestIds).in("status", ["open", "comparing"])
        .order("created_at"),
    ),
  )
  const orgIds = [...new Set([...requests.map((r) => r.org_id), ...matches.map((m) => m.vendor_org_id)])]
  const categoryIds = [...new Set(requests.flatMap((r) => (r.category_id ? [r.category_id] : [])))]

  const [orgs, categories] = await Promise.all([
    db.from("organisations").select("id, name, display_name").in("id", orgIds).then(unwrap),
    categoryIds.length
      ? db.from("catalogue_categories").select("id, name").in("id", categoryIds).then(unwrap)
      : Promise.resolve([]),
  ])
  const orgById = new Map(orgs.map((o) => [o.id, o]))
  const categoryById = new Map(categories.map((c) => [c.id, c.name]))

  return requests.map((request) => ({
    request,
    buyerName: orgById.get(request.org_id)?.name ?? "",
    categoryName: request.category_id ? categoryById.get(request.category_id) ?? null : null,
    matches: matches
      .filter((m) => m.request_id === request.id)
      .map((match) => ({
        match,
        supplierName: orgById.get(match.vendor_org_id)?.name ?? "",
        supplierCode: orgById.get(match.vendor_org_id)?.display_name ?? "",
      })),
  }))
}

/** Approve (which invites the supplier to quote, max 3 per request) or reject a suggested supplier. */
export async function reviewMatch(matchId: string, approve: boolean, note?: string): Promise<void> {
  check(await db.rpc("review_match", { p_match_id: matchId, p_approve: approve, p_note: note }))
}

/** Adds a supplier the AI did not suggest. It still needs approving like any other match. */
export async function addMatchByHand(requestId: string, vendorOrgId: string): Promise<void> {
  check(
    await db.from("request_matches").insert({
      request_id: requestId,
      vendor_org_id: vendorOrgId,
      suggested_by: "admin",
      reasons: ["Added by MPI admin"],
    }),
  )
}

/** Recalculates the suggestions for a request (reviewed matches are kept). Returns how many are waiting. */
export async function recalculateMatches(requestId: string): Promise<number> {
  return unwrap(await db.rpc("suggest_matches", { p_request_id: requestId }))
}

// ---------------------------------------------------------------- payment terms

export interface PaymentTermsSettings {
  platform: PaymentTerms
  byCategory: { categoryId: string; name: string; terms: PaymentTerms | null }[]
}

export async function getPaymentTerms(): Promise<PaymentTermsSettings> {
  const [settings, categories] = await Promise.all([
    db.from("platform_settings").select("payment_terms").single().then(unwrap),
    db.from("catalogue_categories").select("id, name, payment_terms").order("sort_order").then(unwrap),
  ])
  return {
    platform: settings.payment_terms as PaymentTerms,
    byCategory: categories.map((c) => ({ categoryId: c.id, name: c.name, terms: c.payment_terms as PaymentTerms | null })),
  }
}

/** Sets the platform's payment terms. Applies to quotes sent from now on. */
export async function setPlatformPaymentTerms(terms: PaymentTerms): Promise<void> {
  check(await db.rpc("set_payment_terms", { p_terms: terms }))
}

/** Sets one category's payment terms, or `null` to use the platform's again. */
export async function setCategoryPaymentTerms(categoryId: string, terms: PaymentTerms | null): Promise<void> {
  check(await db.rpc("set_payment_terms", { p_terms: terms as string, p_category_id: categoryId }))
}

// ---------------------------------------------------------------- overview

/** Every price offer on the platform, newest first, so the admin can keep an eye on negotiations. */
export async function listAllOffers(limit = 100): Promise<Tables<"quote_negotiations">[]> {
  return unwrap(await db.from("quote_negotiations").select("*").order("created_at", { ascending: false }).limit(limit))
}

export async function listAuditLog(limit = 100): Promise<Tables<"audit_log">[]> {
  return unwrap(await db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit))
}

/** Reloads the investor demo workspace with fresh sample data. */
export async function resetDemoWorkspace(): Promise<string> {
  return unwrap(await db.rpc("reset_demo_workspace"))
}

// ---------------------------------------------------------------- match queue (admin screen)

export interface QueueSupplier {
  name: string
  code: string
  city: string | null
  state: string | null
  certifications: string[]
  /** How full the supplier's production is, 0 to 100, if they told MPI. */
  capacityBookedPct: number | null
}

export interface QueueMatch {
  match: Tables<"request_matches">
  supplier: QueueSupplier
  /** The estimated delivery is after the date the startup needs it by. */
  mayBeLate: boolean
}

export interface QueueRequest {
  request: Tables<"requests">
  lines: Tables<"request_lines">[]
  buyerName: string
  categoryName: string | null
  /** Approved first, then waiting (best score first), then rejected. */
  matches: QueueMatch[]
  approvedCount: number
  waitingCount: number
}

/** Most suppliers a request can invite. The database enforces it too. */
export const MAX_APPROVED = 3

const MATCH_ORDER: Record<Tables<"request_matches">["status"], number> = { approved: 0, suggested: 1, rejected: 2 }

/**
 * Every open request with its suppliers, for the "AI matches to review" screen.
 * Requests with suppliers still waiting come first, oldest first, so nothing
 * waits too long.
 */
export async function listMatchQueue(): Promise<QueueRequest[]> {
  const requests = await withPrivateDetails(
    unwrap(
      await db.from("requests").select(REQUEST_FIELDS).in("status", ["open", "comparing"]).order("created_at"),
    ),
  )
  if (!requests.length) return []
  const requestIds = requests.map((r) => r.id)

  const [matches, lines] = await Promise.all([
    db.from("request_matches").select("*").in("request_id", requestIds).order("score", { ascending: false }).then(unwrap),
    db.from("request_lines").select("*").in("request_id", requestIds).order("sort_order").then(unwrap),
  ])

  const vendorIds = [...new Set(matches.map((m) => m.vendor_org_id))]
  const orgIds = [...new Set([...requests.map((r) => r.org_id), ...vendorIds])]
  const categoryIds = [...new Set(requests.flatMap((r) => (r.category_id ? [r.category_id] : [])))]

  const [orgs, details, categories] = await Promise.all([
    db.from("organisations").select("id, name, display_name, city, state").in("id", orgIds).then(unwrap),
    vendorIds.length
      ? db.from("vendor_details").select("org_id, certifications, capacity_utilisation_pct").in("org_id", vendorIds).then(unwrap)
      : Promise.resolve([]),
    categoryIds.length
      ? db.from("catalogue_categories").select("id, name").in("id", categoryIds).then(unwrap)
      : Promise.resolve([]),
  ])
  const orgById = new Map(orgs.map((o) => [o.id, o]))
  const detailsById = new Map(details.map((d) => [d.org_id, d]))
  const categoryById = new Map(categories.map((c) => [c.id, c.name]))

  const queue = requests.map((request): QueueRequest => {
    const own = matches
      .filter((m) => m.request_id === request.id)
      .sort((a, b) => MATCH_ORDER[a.status] - MATCH_ORDER[b.status] || b.score - a.score)
      .map((match): QueueMatch => {
        const org = orgById.get(match.vendor_org_id)
        const d = detailsById.get(match.vendor_org_id)
        return {
          match,
          supplier: {
            name: org?.name ?? "",
            code: org?.display_name ?? "",
            city: org?.city ?? null,
            state: org?.state ?? null,
            certifications: d?.certifications ?? [],
            capacityBookedPct: d?.capacity_utilisation_pct ?? null,
          },
          mayBeLate: Boolean(
            request.needed_by && match.estimated_delivery_date && match.estimated_delivery_date > request.needed_by,
          ),
        }
      })
    return {
      request,
      lines: lines.filter((l) => l.request_id === request.id),
      buyerName: orgById.get(request.org_id)?.name ?? "",
      categoryName: request.category_id ? categoryById.get(request.category_id) ?? null : null,
      matches: own,
      approvedCount: own.filter((m) => m.match.status === "approved").length,
      waitingCount: own.filter((m) => m.match.status === "suggested").length,
    }
  })

  // Requests with suppliers waiting first; then those still short of 3; oldest first within each.
  const rank = (q: QueueRequest) => (q.waitingCount > 0 && q.approvedCount < MAX_APPROVED ? 0 : q.approvedCount < MAX_APPROVED ? 1 : 2)
  return queue.sort((a, b) => rank(a) - rank(b))
}
