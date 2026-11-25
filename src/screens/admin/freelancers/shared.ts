/**
 * Small helpers shared by the admin freelancer review screens: which filter a
 * profile falls under, a quick readiness score for the queue, and check icons.
 */

import type { ProviderProfile, ProviderQueueFacts, ProviderStatus } from "../../../services/data/providers"

export type Filter = "review" | "live" | "changes" | "paused" | "suspended" | "drafts"

export const FILTERS: { id: Filter; label: string }[] = [
  { id: "review", label: "To review" },
  { id: "live", label: "Live" },
  { id: "changes", label: "Changes asked" },
  { id: "paused", label: "Paused" },
  { id: "suspended", label: "Suspended" },
  { id: "drafts", label: "Drafts" },
]

/** A draft that MPI sent back carries the note and a review time. */
export const changesAsked = (p: ProviderProfile) => p.status === "draft" && !!p.status_note && !!p.reviewed_at

export function filterOf(p: ProviderProfile): Filter {
  const s = p.status as ProviderStatus
  if (s === "pending_review") return "review"
  if (s === "active") return "live"
  if (s === "paused") return "paused"
  if (s === "suspended") return "suspended"
  return changesAsked(p) ? "changes" : "drafts"
}

export const STATUS_CHIP: Record<Filter, { text: string; tone: "navy" | "orange" | "red" | "line" | "green" }> = {
  review: { text: "To review", tone: "orange" },
  live: { text: "Live", tone: "green" },
  changes: { text: "Changes asked", tone: "red" },
  paused: { text: "Paused", tone: "line" },
  suspended: { text: "Suspended", tone: "red" },
  drafts: { text: "Draft", tone: "line" },
}

/** The same six things the freelancer must fill in before sending (see useBuilder readiness). */
export function quickReady(p: ProviderProfile, f: ProviderQueueFacts | undefined): number {
  const items = [
    !!p.headline?.trim(),
    (p.bio?.trim().length ?? 0) >= 50,
    !!f && f.categoryIds.length > 0,
    !!f && f.skills > 0,
    !!f && f.work > 0,
    !!f && f.activePackages > 0,
  ]
  return Math.round((items.filter(Boolean).length / items.length) * 100)
}

/** The newest check of one kind, or null. Facts come newest first. */
export const latestCheck = (f: ProviderQueueFacts | undefined, kind: string) => f?.checks.find((c) => c.kind === kind)?.status ?? null
