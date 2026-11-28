/**
 * Proposals: a freelancer's (or service business's) reply to a service brief.
 *
 * A proposal is saved as a normal quote, so price offers, MPI's fee and
 * hiring (approve_quote) work exactly as for goods. On top of a quote it has
 * the rounds of changes included and the package it started from. Each
 * deliverable of the brief gets its own price: that split is the milestone
 * plan, paid one milestone at a time from step 6.
 *
 * The startup can ask for a change that is not about price (at most 3 per
 * proposal, one open at a time); the provider's next version answers it.
 * Price changes go through price offers (negotiation.ts) as before.
 */

import { db } from "../../lib/db"
import type { Json, Tables } from "../../lib/database.types"
import { check, unwrap } from "./errors"
import { listMyInvitations, type InvitationWithRequest, type Quote } from "./quotes"

export type ProposalChange = Tables<"proposal_changes">
export type InvitationDecline = Tables<"invitation_declines">

export const MAX_CHANGES = 3
/** Sample rule (client to confirm): reply within 3 days of MPI's approval. Shown only, not enforced. */
export const REPLY_DAYS = 3

export interface PriceLine {
  requestLineId: string
  description: string
  price: number
}

export interface ProposalInput {
  lines: PriceLine[]
  days: number | null
  revisions: number | null
  packageId: string | null
  note: string | null
  /** 0 for a freelancer without GSTIN, 18 otherwise. */
  taxRate: number
}

export interface ProposalPreview {
  supplier: {
    invoice_total: number
    gst: number
    commission: number
    commission_gst: number
    commission_invoice: number
    payout: number
    schedule: { seq: number; pct: number; amount: number }[]
  }
  payment_terms: string
  fee_rule: { version: number; needs_review: boolean; commission_pct: number }
}

export type ProposalScore = {
  quote_id: string
  provider_alias: string
  is_freelancer: boolean
  total_cost: number
  checkout_total: number
  days: number | null
  revision_rounds: number | null
  price_points: number
  fit_points: number
  time_points: number
  revision_points: number
  score: number
  rank: number
  budget_fit: "within" | "a_little_above" | "above" | null
  reasons: string[]
}

export type BriefTab = "new" | "sent" | "won" | "closed"

export interface Brief extends InvitationWithRequest {
  changes: ProposalChange[]
  decline: InvitationDecline | null
  /** Newest version first. */
  latest: Quote | null
  tab: BriefTab
  replyBy: Date
}

/** Which inbox tab a brief belongs to. */
export function briefTab(b: InvitationWithRequest): BriefTab {
  const latest = b.myQuotes[0]
  if (b.myQuotes.some((q) => q.status === "accepted")) return "won"
  if (b.invitation.status === "declined" || b.myQuotes.some((q) => q.status === "rejected")) return "closed"
  if (b.request.status === "ordered" || b.request.status === "cancelled") return "closed"
  if (b.myQuotes.some((q) => q.status === "submitted")) return "sent"
  return latest?.status === "withdrawn" ? "closed" : "new"
}

export function replyByOf(invitedAt: string): Date {
  return new Date(new Date(invitedAt).getTime() + REPLY_DAYS * 86_400_000)
}

// ---------------------------------------------------------------- provider

/** Service briefs the signed-in provider was invited to, with changes asked and declines. */
export async function listMyBriefs(vendorOrgId: string): Promise<Brief[]> {
  const all = (await listMyInvitations(vendorOrgId)).filter((b) => b.request.kind === "service")
  if (!all.length) return []
  const ids = all.map((b) => b.request.id)
  const [changes, declines] = await Promise.all([
    db.from("proposal_changes").select("*").eq("vendor_org_id", vendorOrgId).in("request_id", ids).order("created_at").then(unwrap),
    db.from("invitation_declines").select("*").in("invitation_id", all.map((b) => b.invitation.id)).then(unwrap),
  ])
  return all.map((b) => ({
    ...b,
    changes: changes.filter((c) => c.request_id === b.request.id),
    decline: declines.find((d) => d.invitation_id === b.invitation.id) ?? null,
    latest: b.myQuotes[0] ?? null,
    tab: briefTab(b),
    replyBy: replyByOf(b.invitation.invited_at),
  }))
}

/** What the provider receives for a price, with MPI's fee rule and payment terms. */
export async function previewProposal(invitationId: string, price: number, taxRate: number): Promise<ProposalPreview> {
  const json: Json = unwrap(await db.rpc("proposal_preview", { p_invitation_id: invitationId, p_price: price, p_tax_rate: taxRate }))
  return json as unknown as ProposalPreview
}

/**
 * Saves a proposal. A draft is edited in place; otherwise a new version is
 * made (version 2 after a change was asked). With `send` it goes to the
 * startup straight away.
 */
export async function saveProposal(b: Pick<Brief, "invitation" | "myQuotes">, input: ProposalInput, send: boolean): Promise<Quote> {
  const draft = b.myQuotes.find((q) => q.status === "draft")
  const fields = {
    lead_time_days: input.days,
    revision_rounds: input.revisions,
    package_id: input.packageId,
    notes: input.note?.trim() || null,
  }
  let quoteId: string
  if (draft) {
    check(await db.from("quotes").update(fields).eq("id", draft.id).eq("status", "draft"))
    quoteId = draft.id
  } else {
    const version = Math.max(0, ...b.myQuotes.map((q) => q.version)) + 1
    const quote = unwrap(
      await db
        .from("quotes")
        .insert({
          invitation_id: b.invitation.id,
          request_id: b.invitation.request_id,
          vendor_org_id: b.invitation.vendor_org_id,
          version,
          status: "draft",
          ...fields,
        })
        .select()
        .single(),
    )
    quoteId = quote.id
  }

  check(await db.from("quote_lines").delete().eq("quote_id", quoteId))
  const priced = input.lines.filter((l) => l.price > 0)
  if (priced.length) {
    check(
      await db.from("quote_lines").insert(
        priced.map((l, i) => ({
          quote_id: quoteId,
          request_line_id: l.requestLineId,
          line_type: "item" as const,
          description: l.description.trim(),
          quantity: 1,
          unit_price: Math.round(l.price * 100) / 100,
          tax_rate: input.taxRate,
          sort_order: i,
        })),
      ),
    )
  }
  if (send) {
    return unwrap(await db.from("quotes").update({ status: "submitted" }).eq("id", quoteId).select().single())
  }
  return unwrap(await db.from("quotes").select("*").eq("id", quoteId).single())
}

/** "Not for me", with an optional reason only MPI sees. */
export async function declineBrief(invitationId: string, reason?: string): Promise<void> {
  check(await db.rpc("decline_invitation", { p_invitation_id: invitationId, p_reason: reason ?? undefined }))
}

// ---------------------------------------------------------------- startup

export async function compareProposals(requestId: string): Promise<ProposalScore[]> {
  return unwrap(await db.rpc("compare_proposals", { p_request_id: requestId }))
}

/** Ask for a change that is not about price. Returns the change's id. */
export async function askForChange(quoteId: string, message: string): Promise<string> {
  return unwrap(await db.rpc("ask_for_change", { p_quote_id: quoteId, p_message: message }))
}

/** All changes asked on a brief (startup, admin), oldest first. */
export async function listChangesForRequest(requestId: string): Promise<ProposalChange[]> {
  return unwrap(await db.from("proposal_changes").select("*").eq("request_id", requestId).order("created_at"))
}

// ---------------------------------------------------------------- admin

/** Declines with their reasons on some requests (admin only). */
export async function listDeclines(invitationIds: string[]): Promise<InvitationDecline[]> {
  if (!invitationIds.length) return []
  return unwrap(await db.from("invitation_declines").select("*").in("invitation_id", invitationIds))
}

/** Share of the total for each deliverable, rounded to whole percent. */
export function splitPct(prices: number[]): number[] {
  const total = prices.reduce((a, b) => a + b, 0)
  if (total <= 0) return prices.map(() => 0)
  return prices.map((p) => Math.round((p / total) * 100))
}
