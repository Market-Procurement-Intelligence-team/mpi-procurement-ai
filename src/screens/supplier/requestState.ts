/**
 * Where a supplier stands on one invited request: new, an offer to answer,
 * quote sent, or not interested. Used by the list and the quote page.
 */

import type { InvitationWithRequest, Quote } from "../../services/data/quotes"
import { offerStatus, type Offer } from "../../services/data/negotiation"

export type RequestKind = "new" | "offer" | "sent" | "declined"

export interface RequestState {
  kind: RequestKind
  /** The latest version of the supplier's quote (draft, sent or closed). */
  quote: Quote | null
  /** A buyer's offer still waiting for the supplier's reply. */
  openOffer: Offer | null
  /** All offers on this request, oldest first. */
  offers: Offer[]
  /** The request was ordered elsewhere or cancelled before the supplier quoted. */
  closed: boolean
}

export function requestState(item: InvitationWithRequest, allOffers: Offer[], now = new Date()): RequestState {
  const quote = item.myQuotes.find((q) => q.status !== "superseded") ?? null
  const offers = allOffers.filter((o) => o.request_id === item.request.id)
  const openOffer =
    [...offers].reverse().find((o) => o.proposed_by === "buyer" && offerStatus(o, now) === "open") ?? null
  const sent = quote !== null && ["submitted", "accepted", "rejected"].includes(quote.status)
  const kind: RequestKind =
    item.invitation.status === "declined" ? "declined" : openOffer ? "offer" : sent ? "sent" : "new"
  const closed = kind === "new" && ["ordered", "cancelled"].includes(item.request.status)
  return { kind, quote, openOffer, offers, closed }
}
