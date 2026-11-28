/**
 * Service orders with milestones (freelancers step 6a).
 *
 * When a startup hires a provider on a service brief, the order is split into
 * milestones, one per deliverable of the hired proposal. Each milestone goes:
 *   planned -> in_progress (the startup paid it, MPI holds the money)
 *   -> submitted (the provider shared the work as links)
 *   -> accepted (the startup approved it; the payout waits for MPI)
 *      or changes_asked (back to the provider; counts against the rounds agreed)
 *   -> paid_out (MPI paid the provider, after its commission)
 * The order's own status follows: in progress once milestone 1 is paid,
 * delivered once every milestone is accepted, completed once all are paid out.
 *
 * Step 6b: either side can raise a problem with MPI on a paid milestone
 * (status "problem": nothing moves until MPI decides to pay the provider,
 * refund the startup, or send it back to work). Work with no answer for 5
 * days is accepted automatically (sample rule). After completion the startup
 * reviews the provider once; ratings show on the anonymous profile.
 *
 * Payments are SIMULATED. The startup sees what it pays; the provider sees
 * what it receives; the admin sees both.
 *
 * Typical use:
 *   Order page (any side):  listOrderMilestones(orderId)
 *   Startup:                payMilestone(m.id), answerSubmission(s.id, true | false, note, ticked)
 *   Provider:               submitMilestone(m.id, note, links, ticked)
 *   Admin:                  listPayoutsToSend(), payOutMilestone(m.id)
 *   Problems:               raiseProblem(m.id, ...), listProblemsToResolve(), resolveProblem(p.id, decision, note)
 *   Reviews:                leaveReview(orderId, ...), getOrderReview(orderId), listRatings(orgIds), listReviewNotes(orgId)
 */

import { db } from "../../lib/db"
import type { Json } from "../../lib/database.types"
import { check, unwrap } from "./errors"
import { newPaymentKey } from "./money"

export type MilestoneStatus =
  | "planned"
  | "in_progress"
  | "submitted"
  | "changes_asked"
  | "accepted"
  | "paid_out"
  | "problem"
  | "refunded"

export type ProblemReason = "quality" | "not_as_agreed" | "late" | "no_response" | "payment" | "other"
export type ProblemDecision = "pay_provider" | "refund_startup" | "back_to_work"

export const PROBLEM_REASONS: Record<ProblemReason, string> = {
  quality: "Quality is not good enough",
  not_as_agreed: "Not what was agreed",
  late: "Late",
  no_response: "No response",
  payment: "Payment",
  other: "Something else",
}

export const DECISION_LABEL: Record<ProblemDecision, string> = {
  pay_provider: "Pay the provider",
  refund_startup: "Refund the startup",
  back_to_work: "Send it back to work",
}

/** Days after a submission with no answer before MPI accepts the work (sample rule). */
export const AUTO_ACCEPT_DAYS = 5

export interface Problem {
  id: string
  raised_by: "startup" | "provider"
  reason: ProblemReason
  description: string
  links: string[]
  status: "open" | "resolved"
  decision: ProblemDecision | null
  decision_note: string | null
  created_at: string
  decided_at: string | null
}

export interface Submission {
  id: string
  version: number
  note: string
  links: string[]
  points_done: number[]
  submitted_at: string
  answer: "accepted" | "changes" | null
  answer_note: string | null
  points_checked: number[]
  answered_at: string | null
}

export interface MilestoneEvent {
  status: MilestoneStatus
  note: string | null
  at: string
  by: "startup" | "provider" | "mpi" | "system"
}

export interface Milestone {
  id: string
  seq: number
  title: string
  done_when: string[]
  status: MilestoneStatus
  /** The provider's invoice part for this milestone, incl. GST. */
  amount: number
  /** Startup/admin, next milestone to pay only: what paying it costs now (amount + MPI fee if still due). */
  to_pay: number | null
  mpi_fee_now: number | null
  /** Provider/admin only. */
  commission: number | null
  payout: number | null
  changes_allowed: number
  changes_used: number
  paid_at: string | null
  submitted_at: string | null
  accepted_at: string | null
  paid_out_at: string | null
  refunded_at: string | null
  /** Submitted work only: when MPI accepts it if the startup does not answer. */
  auto_accept_at: string | null
  submissions: Submission[]
  problems: Problem[]
  events: MilestoneEvent[]
}

export interface PayoutToSend {
  milestone_id: string
  po_id: string
  po_number: string
  request_title: string
  vendor_name: string
  seq: number
  title: string
  accepted_at: string
  gross: number
  commission: number
  payout: number
}

/** Short labels for each step, in the words the screens use. */
export const MILESTONE_LABEL: Record<MilestoneStatus, string> = {
  planned: "Waiting for payment",
  in_progress: "In progress",
  submitted: "Work submitted",
  changes_asked: "Changes asked",
  accepted: "Accepted · payout pending",
  paid_out: "Paid out",
  problem: "Problem with MPI",
  refunded: "Refunded",
}

/** A milestone that needs nothing more from anyone. */
export const isClosed = (m: Milestone) => m.status === "paid_out" || m.status === "refunded"
/** Work done as far as the startup is concerned. */
export const isAccepted = (m: Milestone) => m.status === "accepted" || m.status === "paid_out" || m.status === "refunded"

/** The open problem on a milestone, if any. */
export const openProblem = (m: Milestone): Problem | null => m.problems?.find((p) => p.status === "open") ?? null

/** The milestone that needs attention now: the first one not yet paid out (or the last one). */
export function currentMilestone(ms: Milestone[]): Milestone | null {
  if (!ms.length) return null
  return ms.find((m) => !isAccepted(m)) ?? ms.find((m) => m.status === "accepted") ?? ms[ms.length - 1]
}

/** The newest submission of a milestone, if any. */
export const latestSubmission = (m: Milestone): Submission | null => m.submissions.at(-1) ?? null

/** What the startup has to do on an order, if anything. */
export function startupTodo(ms: Milestone[]): { kind: "pay" | "review"; milestone: Milestone } | null {
  const review = ms.find((m) => m.status === "submitted")
  if (review) return { kind: "review", milestone: review }
  const pay = ms.find((m) => m.to_pay != null)
  // Pay the next milestone once the previous one is accepted (or it is the first).
  if (pay && ms.filter((m) => m.seq < pay.seq).every(isAccepted)) {
    return { kind: "pay", milestone: pay }
  }
  return null
}

/** What the provider has to do on an order, if anything. */
export function providerTodo(ms: Milestone[]): Milestone | null {
  return ms.find((m) => m.status === "in_progress" || m.status === "changes_asked") ?? null
}

// ---------------------------------------------------------------- reading

/** An order's milestones with their submissions and history. Empty for goods orders. */
export async function listOrderMilestones(orderId: string): Promise<Milestone[]> {
  return unwrap(await db.rpc("order_milestones", { p_po_id: orderId })) as unknown as Milestone[]
}

/** Admin: accepted milestones waiting for their payout, oldest first. */
export async function listPayoutsToSend(): Promise<PayoutToSend[]> {
  return unwrap(await db.rpc("payouts_to_send")) as PayoutToSend[]
}

// ---------------------------------------------------------------- actions

/** Startup pays a milestone (simulated), with MPI's fee on the first one. */
export async function payMilestone(milestoneId: string, key = newPaymentKey("milestone")): Promise<Json> {
  return unwrap(await db.rpc("pay_milestone", { p_milestone_id: milestoneId, p_idempotency_key: key }))
}

/** Provider submits the work: a note, links, and the "done when" points it confirms (0-based). */
export async function submitMilestone(milestoneId: string, note: string, links: string[], pointsDone: number[]): Promise<string> {
  return unwrap(
    await db.rpc("submit_milestone", { p_milestone_id: milestoneId, p_note: note, p_links: links, p_points_done: pointsDone }),
  )
}

/** Startup accepts the work, or asks for changes (a note is required). */
export async function answerSubmission(submissionId: string, accept: boolean, note: string | null, pointsChecked: number[]): Promise<void> {
  check(
    await db.rpc("answer_submission", {
      p_submission_id: submissionId,
      p_accept: accept,
      p_note: note,
      p_points_checked: pointsChecked,
    }),
  )
}

/** Admin pays an accepted milestone out to the provider, after commission (simulated). */
export async function payOutMilestone(milestoneId: string, key = newPaymentKey("milestone-payout")): Promise<Json> {
  return unwrap(await db.rpc("pay_out_milestone", { p_milestone_id: milestoneId, p_idempotency_key: key }))
}

// ---------------------------------------------------------------- problems

export interface ProblemToResolve {
  problem_id: string
  milestone_id: string
  po_id: string
  po_number: string
  request_title: string
  buyer_name: string
  vendor_name: string
  seq: number
  title: string
  raised_by_side: "startup" | "provider"
  reason: ProblemReason
  description: string
  amount: number
  created_at: string
}

/** Startup or provider raises a problem with MPI on a paid milestone. */
export async function raiseProblem(milestoneId: string, reason: ProblemReason, description: string, links: string[]): Promise<string> {
  return unwrap(
    await db.rpc("raise_problem", { p_milestone_id: milestoneId, p_reason: reason, p_description: description, p_links: links }),
  )
}

/** Admin: open problems, oldest first. */
export async function listProblemsToResolve(): Promise<ProblemToResolve[]> {
  return unwrap(await db.rpc("problems_to_resolve")) as ProblemToResolve[]
}

/** Admin decides a problem. Both sides see the note. */
export async function resolveProblem(problemId: string, decision: ProblemDecision, note: string): Promise<void> {
  check(await db.rpc("resolve_problem", { p_problem_id: problemId, p_decision: decision, p_note: note }))
}

// ---------------------------------------------------------------- reviews

export type ReviewTag = "on_time" | "good_quality" | "easy_to_work_with"
export const REVIEW_TAGS: Record<ReviewTag, string> = {
  on_time: "On time",
  good_quality: "Good quality",
  easy_to_work_with: "Easy to work with",
}

export interface Rating {
  rating: number
  reviews: number
}

export interface ReviewNote {
  id: string
  rating: number
  tags: ReviewTag[]
  note: string | null
  created_at: string
}

/** Startup reviews a completed service order, once. */
export async function leaveReview(orderId: string, rating: number, tags: ReviewTag[], note: string | null): Promise<string> {
  return unwrap(await db.rpc("leave_review", { p_po_id: orderId, p_rating: rating, p_tags: tags, p_note: note }))
}

/** The review left on an order, if any (its startup, its provider or admin). */
export async function getOrderReview(orderId: string): Promise<ReviewNote | null> {
  const row = unwrap(await db.from("provider_reviews").select("id, rating, tags, note, created_at").eq("po_id", orderId).maybeSingle())
  return row ? ({ ...row, tags: row.tags as ReviewTag[] } as ReviewNote) : null
}

/** Average rating and count per provider, for the providers the asker can see. */
export async function listRatings(orgIds?: string[]): Promise<Map<string, Rating>> {
  let query = db.from("provider_ratings").select("*")
  if (orgIds) {
    if (!orgIds.length) return new Map()
    query = query.in("org_id", orgIds)
  }
  const rows = unwrap(await query)
  return new Map(rows.filter((r) => r.org_id).map((r) => [r.org_id!, { rating: Number(r.rating ?? 0), reviews: r.reviews ?? 0 }]))
}

/** Recent reviews of one provider, newest first, without who wrote them. */
export async function listReviewNotes(orgId: string, limit = 5): Promise<ReviewNote[]> {
  const rows = unwrap(
    await db.from("provider_review_notes").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(limit),
  )
  return rows.map((r) => ({ id: r.id!, rating: r.rating ?? 0, tags: (r.tags ?? []) as ReviewTag[], note: r.note, created_at: r.created_at! }))
}
