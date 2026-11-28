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
 * Payments are SIMULATED. The startup sees what it pays; the provider sees
 * what it receives; the admin sees both.
 *
 * Typical use:
 *   Order page (any side):  listOrderMilestones(orderId)
 *   Startup:                payMilestone(m.id), answerSubmission(s.id, true | false, note, ticked)
 *   Provider:               submitMilestone(m.id, note, links, ticked)
 *   Admin:                  listPayoutsToSend(), payOutMilestone(m.id)
 */

import { db } from "../../lib/db"
import type { Json } from "../../lib/database.types"
import { check, unwrap } from "./errors"
import { newPaymentKey } from "./money"

export type MilestoneStatus = "planned" | "in_progress" | "submitted" | "changes_asked" | "accepted" | "paid_out"

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
  submissions: Submission[]
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
}

/** The milestone that needs attention now: the first one not yet paid out (or the last one). */
export function currentMilestone(ms: Milestone[]): Milestone | null {
  if (!ms.length) return null
  return ms.find((m) => m.status !== "paid_out" && m.status !== "accepted") ?? ms.find((m) => m.status === "accepted") ?? ms[ms.length - 1]
}

/** The newest submission of a milestone, if any. */
export const latestSubmission = (m: Milestone): Submission | null => m.submissions.at(-1) ?? null

/** What the startup has to do on an order, if anything. */
export function startupTodo(ms: Milestone[]): { kind: "pay" | "review"; milestone: Milestone } | null {
  const review = ms.find((m) => m.status === "submitted")
  if (review) return { kind: "review", milestone: review }
  const pay = ms.find((m) => m.to_pay != null)
  // Pay the next milestone once the previous one is accepted (or it is the first).
  if (pay && ms.filter((m) => m.seq < pay.seq).every((m) => m.status === "accepted" || m.status === "paid_out")) {
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
