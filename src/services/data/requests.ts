/**
 * A startup's purchase requests.
 *
 * A request starts as a draft. Sending it (status "open") makes the database
 * suggest matching suppliers for the admin to review. Approved suppliers are
 * invited automatically; the startup then sees their quotes.
 */

import { db } from "../../lib/db"
import type { Json, Tables, TablesUpdate } from "../../lib/database.types"
import { check, unwrap, unwrapMaybe } from "./errors"
import { getDisplayNames } from "./names"

export type Request = Tables<"requests">
export type RequestLine = Tables<"request_lines">

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
  const request = unwrap(
    await db
      .from("requests")
      .insert({
        org_id: orgId,
        created_by: userId,
        title: input.title.trim(),
        description: input.description ?? null,
        requirement_text: input.requirementText ?? null,
        input_language: input.inputLanguage ?? null,
        ai_extracted: input.aiExtracted ?? null,
        required_certifications: input.requiredCertifications ?? [],
        category_id: input.categoryId ?? null,
        source: input.source ?? "catalogue",
        needed_by: input.neededBy ?? null,
        delivery_city: input.deliveryCity ?? null,
        delivery_state: input.deliveryState ?? null,
        budget_min: input.budgetMin ?? null,
        budget_max: input.budgetMax ?? null,
        status: "draft",
      })
      .select()
      .single(),
  )

  await replaceLines(request.id, input.lines)
  return send ? sendRequest(request.id) : request
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
  return unwrap(await db.from("requests").update({ status: "open" }).eq("id", requestId).select().single())
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
  return unwrap(await db.from("requests").select("*").eq("org_id", orgId).order("created_at", { ascending: false }))
}

/** Everything the startup sees about one request: lines, approved matches, invited suppliers and the order. */
export async function getRequestDetail(requestId: string): Promise<RequestDetail> {
  const [request, lines, matches, invitations, order] = await Promise.all([
    db.from("requests").select("*").eq("id", requestId).single().then(unwrap),
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
