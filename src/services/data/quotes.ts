/**
 * Quotes. Suppliers see the requests they were invited to and send itemised
 * quotes; startups compare the quotes on their requests and approve one.
 *
 * Totals, GST and payment terms are filled in by the database. A new version
 * of a quote replaces the previous one ("superseded").
 */

import { db } from "../../lib/db"
import type { Tables } from "../../lib/database.types"
import { check, unwrap } from "./errors"
import { getDisplayNames } from "./names"
import { REQUEST_FIELDS, type SharedRequest } from "./requests"

export type Quote = Tables<"quotes">
export type QuoteLine = Tables<"quote_lines">
export type Invitation = Tables<"rfq_invitations">

export interface QuoteWithLines extends Quote {
  lines: QuoteLine[]
  supplierName: string
}

export interface QuoteLineInput {
  requestLineId?: string | null
  lineType?: QuoteLine["line_type"]
  description: string
  quantity: number
  unitPrice: number
  taxRate?: number
}

export interface QuoteInput {
  leadTimeDays?: number | null
  validUntil?: string | null
  notes?: string | null
  discountPct?: number
  lines: QuoteLineInput[]
}

export interface InvitationWithRequest {
  invitation: Invitation
  /** Without the budget: suppliers never see it. */
  request: SharedRequest
  lines: Tables<"request_lines">[]
  buyerName: string
  myQuotes: Quote[]
}

// ---------------------------------------------------------------- supplier

/** Requests the signed-in supplier was invited to, newest first. */
export async function listMyInvitations(vendorOrgId: string): Promise<InvitationWithRequest[]> {
  const invitations = unwrap(
    await db.from("rfq_invitations").select("*").eq("vendor_org_id", vendorOrgId).order("invited_at", { ascending: false }),
  )
  if (!invitations.length) return []
  const requestIds = invitations.map((i) => i.request_id)

  const [requests, lines, quotes] = await Promise.all([
    db.from("requests").select(REQUEST_FIELDS).in("id", requestIds).then(unwrap),
    db.from("request_lines").select("*").in("request_id", requestIds).order("sort_order").then(unwrap),
    db.from("quotes").select("*").eq("vendor_org_id", vendorOrgId).in("request_id", requestIds)
      .order("version", { ascending: false }).then(unwrap),
  ])
  const names = await getDisplayNames(requests.map((r) => r.org_id))
  const requestById = new Map(requests.map((r) => [r.id, r]))

  return invitations.flatMap((invitation) => {
    const request = requestById.get(invitation.request_id)
    if (!request) return []
    return [{
      invitation,
      request,
      lines: lines.filter((l) => l.request_id === request.id),
      buyerName: names.get(request.org_id) ?? "MPI Verified Buyer",
      myQuotes: quotes.filter((q) => q.invitation_id === invitation.id),
    }]
  })
}

export async function markInvitationViewed(invitationId: string): Promise<void> {
  check(
    await db.from("rfq_invitations").update({ status: "viewed", responded_at: new Date().toISOString() })
      .eq("id", invitationId).eq("status", "invited"),
  )
}

export async function declineInvitation(invitationId: string): Promise<void> {
  check(
    await db.from("rfq_invitations").update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", invitationId),
  )
}

/**
 * Creates a quote (or a new version of one) for an invitation. With
 * `submit: true` it is sent to the startup straight away; otherwise it stays
 * a draft the supplier can keep editing.
 */
export async function createQuote(invitation: Invitation, input: QuoteInput, submit = false): Promise<Quote> {
  const previous = unwrap(
    await db.from("quotes").select("version").eq("invitation_id", invitation.id).order("version", { ascending: false }).limit(1),
  )
  const quote = unwrap(
    await db
      .from("quotes")
      .insert({
        invitation_id: invitation.id,
        request_id: invitation.request_id,
        vendor_org_id: invitation.vendor_org_id,
        version: (previous[0]?.version ?? 0) + 1,
        status: "draft",
        lead_time_days: input.leadTimeDays ?? null,
        valid_until: input.validUntil ?? null,
        notes: input.notes ?? null,
        discount_pct: input.discountPct ?? 0,
      })
      .select()
      .single(),
  )
  await replaceQuoteLines(quote.id, input.lines)
  return submit ? submitQuote(quote.id) : getQuote(quote.id)
}

/** Replaces the lines of a draft quote. */
export async function replaceQuoteLines(quoteId: string, lines: QuoteLineInput[]): Promise<void> {
  check(await db.from("quote_lines").delete().eq("quote_id", quoteId))
  if (!lines.length) return
  check(
    await db.from("quote_lines").insert(
      lines.map((line, i) => ({
        quote_id: quoteId,
        request_line_id: line.requestLineId ?? null,
        line_type: line.lineType ?? "item",
        description: line.description.trim(),
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate ?? 18,
        sort_order: i,
      })),
    ),
  )
}

/** Edits a draft quote's terms (not its lines). */
export async function updateDraftQuote(
  quoteId: string,
  fields: { leadTimeDays?: number | null; validUntil?: string | null; notes?: string | null; discountPct?: number },
): Promise<void> {
  check(
    await db.from("quotes").update({
      lead_time_days: fields.leadTimeDays,
      valid_until: fields.validUntil,
      notes: fields.notes,
      discount_pct: fields.discountPct,
    }).eq("id", quoteId).eq("status", "draft"),
  )
}

export async function submitQuote(quoteId: string): Promise<Quote> {
  return unwrap(await db.from("quotes").update({ status: "submitted" }).eq("id", quoteId).select().single())
}

export async function withdrawQuote(quoteId: string): Promise<void> {
  check(await db.from("quotes").update({ status: "withdrawn" }).eq("id", quoteId).eq("status", "submitted"))
}

export async function getQuote(quoteId: string): Promise<Quote> {
  return unwrap(await db.from("quotes").select("*").eq("id", quoteId).single())
}

// ---------------------------------------------------------------- startup

/**
 * Quotes on one request, with their lines and the supplier's anonymous name.
 * By default only current versions (not superseded or withdrawn) are returned.
 */
export async function listQuotesForRequest(requestId: string, includeOld = false): Promise<QuoteWithLines[]> {
  let query = db.from("quotes").select("*").eq("request_id", requestId).order("total", { ascending: true })
  if (!includeOld) query = query.in("status", ["submitted", "accepted", "rejected"])
  const quotes = unwrap(await query)
  if (!quotes.length) return []

  const [lines, names] = await Promise.all([
    db.from("quote_lines").select("*").in("quote_id", quotes.map((q) => q.id)).order("sort_order").then(unwrap),
    getDisplayNames(quotes.map((q) => q.vendor_org_id)),
  ])
  return quotes.map((q) => ({
    ...q,
    lines: lines.filter((l) => l.quote_id === q.id),
    supplierName: names.get(q.vendor_org_id) ?? "MPI Verified Supplier",
  }))
}

/** Approves one quote. Creates the purchase order and closes the request. Returns the order id. */
export async function approveQuote(quoteId: string): Promise<string> {
  return unwrap(await db.rpc("approve_quote", { p_quote_id: quoteId }))
}
