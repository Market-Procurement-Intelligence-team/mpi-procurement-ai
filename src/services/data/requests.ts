/**
 * A startup's purchase requests.
 *
 * A request starts as a draft. Sending it (status "open") makes the database
 * suggest matching suppliers for the admin to review. Approved suppliers are
 * invited automatically; the startup then sees their quotes.
 *
 * Suppliers never see the budget, or the startup's own words and the AI's
 * reading of them (which often mention the budget). The database only lets
 * the request's startup and the admin read those 4 fields, through
 * request_private_details, so requests are always read with REQUEST_FIELDS.
 */

import { db } from "../../lib/db"
import type { Json, Tables, TablesUpdate } from "../../lib/database.types"
import { check, unwrap, unwrapMaybe } from "./errors"
import { getDisplayNames } from "./names"

/** A request with everything, as its own startup and the admin see it. */
export type Request = Tables<"requests">
/** A request as an invited supplier sees it: no budget, no original wording. */
export type SharedRequest = Omit<Request, PrivateField>
export type RequestLine = Tables<"request_lines">

type PrivateField = "budget_min" | "budget_max" | "requirement_text" | "ai_extracted"

/** Every request field anyone who can see the request may read. */
export const REQUEST_FIELDS =
  "id, org_id, created_by, title, description, input_language, required_certifications, scheme_ids, category_id, source, status, needed_by, delivery_city, delivery_state, currency, created_at, updated_at" as const

/**
 * Adds the private fields (budget, original wording, AI reading) to requests
 * the signed-in startup owns, or any request for the admin. For anyone else
 * they stay empty.
 */
export async function withPrivateDetails(requests: SharedRequest[]): Promise<Request[]> {
  if (!requests.length) return []
  const rows = unwrap(
    await db.from("request_private_details").select("*").in("request_id", requests.map((r) => r.id)),
  )
  const byId = new Map(rows.map((p) => [p.request_id, p]))
  return requests.map((r) => {
    const p = byId.get(r.id)
    return {
      ...r,
      budget_min: p?.budget_min ?? null,
      budget_max: p?.budget_max ?? null,
      requirement_text: p?.requirement_text ?? null,
      ai_extracted: p?.ai_extracted ?? null,
    }
  })
}

export interface RequestLineInput {
  itemId?: string | null
  description: string
  quantity: number
  unit?: string
  specs?: Json
}

export interface RequestInput {
  title: string
  description?: string | null
  requirementText?: string | null
  inputLanguage?: string | null
  aiExtracted?: Json | null
  requiredCertifications?: string[]
  /** Government schemes the startup plans to use (ticked on Review & send). */
  schemeIds?: string[]
  categoryId?: string | null
  source?: Request["source"]
  neededBy?: string | null
  deliveryCity?: string | null
  deliveryState?: string | null
  budgetMin?: number | null
  budgetMax?: number | null
  lines: RequestLineInput[]
}

export interface ApprovedMatch {
  match: Tables<"request_matches">
  supplier: {
    displayName: string
    city: string | null
    state: string | null
    certifications: string[]
    leadTimeDays: number | null
    turnoverBand: string | null
  }
}

export interface RequestDetail {
  request: Request
  lines: RequestLine[]
  matches: ApprovedMatch[]
  invitations: (Tables<"rfq_invitations"> & { supplierName: string })[]
  order: Tables<"purchase_orders"> | null
}

/** Creates a request with its lines. With `send: true` it is sent straight away. */
export async function createRequest(orgId: string, userId: string, input: RequestInput, send = false): Promise<Request> {
  // The id is made here so the request can be read back with REQUEST_FIELDS
  // (insert-and-return would ask for the private fields too).
  const id = crypto.randomUUID()
  check(
    await db
      .from("requests")
      .insert({
        id,
        org_id: orgId,
        created_by: userId,
        title: input.title.trim(),
        description: input.description ?? null,
        requirement_text: input.requirementText ?? null,
        input_language: input.inputLanguage ?? null,
        ai_extracted: input.aiExtracted ?? null,
        required_certifications: input.requiredCertifications ?? [],
        scheme_ids: input.schemeIds ?? [],
        category_id: input.categoryId ?? null,
        source: input.source ?? "catalogue",
        needed_by: input.neededBy ?? null,
        delivery_city: input.deliveryCity ?? null,
        delivery_state: input.deliveryState ?? null,
        budget_min: input.budgetMin ?? null,
        budget_max: input.budgetMax ?? null,
        status: "draft",
      }),
  )

  await replaceLines(id, input.lines)
  if (send) return sendRequest(id)
  const request = unwrap(await db.from("requests").select(REQUEST_FIELDS).eq("id", id).single())
  return {
    ...request,
    budget_min: input.budgetMin ?? null,
    budget_max: input.budgetMax ?? null,
    requirement_text: input.requirementText ?? null,
    ai_extracted: input.aiExtracted ?? null,
  }
}

/** Edits a draft or open request. Lines are changed with replaceLines. */
export async function updateRequest(
  requestId: string,
  fields: Omit<TablesUpdate<"requests">, "id" | "org_id" | "created_by" | "status" | "created_at" | "updated_at">,
): Promise<void> {
  check(await db.from("requests").update(fields).eq("id", requestId))
}

export async function replaceLines(requestId: string, lines: RequestLineInput[]): Promise<void> {
  check(await db.from("request_lines").delete().eq("request_id", requestId))
  if (!lines.length) return
  check(
    await db.from("request_lines").insert(
      lines.map((line, i) => ({
        request_id: requestId,
        item_id: line.itemId ?? null,
        description: line.description.trim(),
        quantity: line.quantity,
        unit: line.unit ?? "unit",
        specs: line.specs ?? {},
        sort_order: i,
      })),
    ),
  )
}

/** Sends a draft. The database then suggests suppliers and alerts the admin. */
export async function sendRequest(requestId: string): Promise<Request> {
  check(await db.from("requests").update({ status: "open" }).eq("id", requestId))
  const request = unwrap(await db.from("requests").select(REQUEST_FIELDS).eq("id", requestId).single())
  const [withDetails] = await withPrivateDetails([request])
  return withDetails
}

export async function cancelRequest(requestId: string): Promise<void> {
  check(await db.from("requests").update({ status: "cancelled" }).eq("id", requestId))
}

/** Only drafts can be deleted. */
export async function deleteDraft(requestId: string): Promise<void> {
  check(await db.from("requests").delete().eq("id", requestId).eq("status", "draft"))
}

/** The signed-in startup's requests, newest first. */
export async function listMyRequests(orgId: string): Promise<Request[]> {
  const requests = unwrap(
    await db.from("requests").select(REQUEST_FIELDS).eq("org_id", orgId).order("created_at", { ascending: false }),
  )
  return withPrivateDetails(requests)
}

/** Everything the startup sees about one request: lines, approved matches, invited suppliers and the order. */
export async function getRequestDetail(requestId: string): Promise<RequestDetail> {
  const [request, lines, matches, invitations, order] = await Promise.all([
    db.from("requests").select(REQUEST_FIELDS).eq("id", requestId).single().then(unwrap)
      .then((r) => withPrivateDetails([r])).then(([r]) => r),
    db.from("request_lines").select("*").eq("request_id", requestId).order("sort_order").then(unwrap),
    db.from("request_matches").select("*").eq("request_id", requestId).eq("status", "approved")
      .order("score", { ascending: false }).then(unwrap),
    db.from("rfq_invitations").select("*").eq("request_id", requestId).order("invited_at").then(unwrap),
    db.from("purchase_orders").select("*").eq("request_id", requestId).maybeSingle().then(unwrapMaybe),
  ])

  const vendorIds = [...new Set([...matches.map((m) => m.vendor_org_id), ...invitations.map((i) => i.vendor_org_id)])]
  const [names, directory] = await Promise.all([
    getDisplayNames(vendorIds),
    vendorIds.length
      ? db.from("supplier_directory").select("*").in("id", vendorIds).then(unwrap)
      : Promise.resolve([]),
  ])
  const byId = new Map(directory.map((d) => [d.id, d]))

  return {
    request,
    lines,
    matches: matches.map((match) => {
      const d = byId.get(match.vendor_org_id)
      return {
        match,
        supplier: {
          displayName: names.get(match.vendor_org_id) ?? "MPI Verified Supplier",
          city: d?.city ?? null,
          state: d?.state ?? null,
          certifications: d?.certifications ?? [],
          leadTimeDays: d?.lead_time_days ?? null,
          turnoverBand: d?.turnover_band ?? null,
        },
      }
    }),
    invitations: invitations.map((i) => ({ ...i, supplierName: names.get(i.vendor_org_id) ?? "MPI Verified Supplier" })),
    order,
  }
}

/** One row of the startup's My requests list. */
export interface RequestCard {
  request: Request
  lines: RequestLine[]
  /** Quotes the startup can compare now (sent, not withdrawn or replaced). */
  quoteCount: number
  /** The order placed from this request, if any. */
  orderId: string | null
}

/** The signed-in startup's requests with their items, quote count and order, newest first. */
export async function listMyRequestCards(orgId: string): Promise<RequestCard[]> {
  const requests = await listMyRequests(orgId)
  if (!requests.length) return []
  const ids = requests.map((r) => r.id)
  const [lines, quotes, orders] = await Promise.all([
    db.from("request_lines").select("*").in("request_id", ids).order("sort_order").then(unwrap),
    db.from("quotes").select("request_id, status").in("request_id", ids).in("status", ["submitted", "accepted"]).then(unwrap),
    db.from("purchase_orders").select("id, request_id").in("request_id", ids).then(unwrap),
  ])
  return requests.map((request) => ({
    request,
    lines: lines.filter((l) => l.request_id === request.id),
    quoteCount: quotes.filter((q) => q.request_id === request.id).length,
    orderId: orders.find((o) => o.request_id === request.id)?.id ?? null,
  }))
}
