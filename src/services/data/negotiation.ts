/**
 * Price negotiation on a quote (decided with the client, 23 Oct 2026):
 * - only the startup starts it, and only the total price is negotiated;
 * - the supplier accepts, declines or counters; at most 3 offers per quote;
 * - an accepted price reissues the quote as a new version at that price.
 * Every rule is enforced by the database; these functions just call it.
 */

import { db } from "../../lib/db"
import type { Tables } from "../../lib/database.types"
import { unwrap, unwrapMaybe } from "./errors"

export type Offer = Tables<"quote_negotiations">
export type OfferResponse = "accept" | "decline" | "counter" | "withdraw"

export const MAX_OFFERS_PER_QUOTE = 3

/** Startup: ask for a lower total (including GST). Returns the new offer's id. */
export async function proposePrice(quoteId: string, total: number, message?: string): Promise<string> {
  return unwrap(await db.rpc("propose_price", { p_quote_id: quoteId, p_total: total, p_message: message }))
}

/**
 * Reply to an open offer. Accept returns the new quote version's id, counter
 * returns the new offer's id, decline and withdraw return null.
 */
export async function respondToPrice(
  offerId: string,
  response: OfferResponse,
  options: { counterTotal?: number; message?: string } = {},
): Promise<string | null> {
  return unwrapMaybe(
    await db.rpc("respond_to_price", {
      p_negotiation_id: offerId,
      p_response: response,
      p_counter_total: options.counterTotal,
      p_message: options.message,
    }),
  )
}

/** All offers on the quotes of one request, oldest first. */
export async function listOffersForRequest(requestId: string): Promise<Offer[]> {
  return unwrap(await db.from("quote_negotiations").select("*").eq("request_id", requestId).order("created_at"))
}

/** All offers on one quote, oldest first. */
export async function listOffersForQuote(quoteId: string): Promise<Offer[]> {
  return unwrap(await db.from("quote_negotiations").select("*").eq("quote_id", quoteId).order("created_at"))
}

/** How many more offers can be made on a quote. */
export function offersLeft(offers: Offer[]): number {
  return Math.max(0, MAX_OFFERS_PER_QUOTE - offers.length)
}
