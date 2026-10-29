/**
 * Price guide for suppliers. While quoting, the supplier sees for each item
 * the usual price range and 3 suggested prices with their chance of winning.
 * The startup's budget is never used.
 *
 * The range comes from MPI's own past quotes for the same item (database
 * function price_guide). With fewer than 5 past prices, the AI estimates the
 * market range instead (netlify/functions/price-estimate.ts) and the screen
 * must label it "AI estimate".
 *
 * Chance of winning: High / Medium / Low from where the price sits in the
 * range. Once an item has 20 decided quotes (won or lost), the real win
 * rate is filled in as chancePct, and screens show the % instead.
 *
 * Typical use on the quote screen, per request line:
 *   const guide = await getPriceGuide(line.id)
 *   // show guide.band and guide.suggestions; as the supplier types a price:
 *   const chance = chanceFor(guide.band, typedUnitPrice)
 */

import { db } from "../../lib/db"
import { DataError, unwrap } from "./errors"

export type Chance = "high" | "medium" | "low"

export interface PriceBand {
  /** Per unit, in rupees, before GST. */
  low: number
  typical: number
  high: number
  /** "past_quotes": MPI's own past prices. "ai_estimate": show it labelled "AI estimate". */
  source: "past_quotes" | "ai_estimate"
  /** How many past prices the range is based on; null for an AI estimate. */
  basedOn: number | null
  /** Real win rates at low, typical and high; null until there is enough history. */
  winPct: { low: number | null; typical: number | null; high: number | null } | null
  /** One short line from the AI on what drives the price; null for past quotes. */
  note: string | null
}

export interface PriceSuggestion {
  label: "Competitive" | "Market rate" | "Premium"
  /** Per unit, before GST. */
  unitPrice: number
  chance: Chance
  /** Real win rate in %, once there is enough history; otherwise null. */
  chancePct: number | null
}

export interface PriceGuide {
  requestLineId: string
  itemName: string | null
  description: string
  quantity: number
  unit: string
  band: PriceBand
  suggestions: PriceSuggestion[]
}

const ESTIMATE_URL = "/api/price-estimate"

/** Plain words for each chance level, for screens. */
export const CHANCE_LABELS: Record<Chance, string> = {
  high: "High chance",
  medium: "Medium chance",
  low: "Low chance",
}

/**
 * Chance of winning for a unit price, from where it sits in the range:
 * up to halfway between low and typical is High, up to halfway between
 * typical and high is Medium, above that is Low.
 */
export function chanceFor(band: PriceBand, unitPrice: number): Chance {
  if (unitPrice <= (band.low + band.typical) / 2) return "high"
  if (unitPrice <= (band.typical + band.high) / 2) return "medium"
  return "low"
}

/** Rounds a price to a sensible step: paise for small amounts, hundreds for big ones. */
export function roundPrice(value: number): number {
  if (value < 10) return Math.round(value * 100) / 100
  if (value < 100) return Math.round(value * 2) / 2
  if (value < 10000) return Math.round(value)
  return Math.round(value / 100) * 100
}

/** The 3 suggested prices for a range, rounded. */
export function suggestPrices(band: PriceBand): PriceSuggestion[] {
  const points: [PriceSuggestion["label"], number, number | null][] = [
    ["Competitive", band.low, band.winPct?.low ?? null],
    ["Market rate", band.typical, band.winPct?.typical ?? null],
    ["Premium", band.high, band.winPct?.high ?? null],
  ]
  return points.map(([label, value, chancePct]) => {
    const unitPrice = roundPrice(value)
    return { label, unitPrice, chance: chanceFor(band, unitPrice), chancePct }
  })
}

async function fetchAiEstimate(requestLineId: string): Promise<PriceBand> {
  const { data } = await db.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new DataError("Please log in first.")

  let response: Response
  try {
    response = await fetch(ESTIMATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ requestLineId }),
    })
  } catch {
    throw new DataError("Couldn't reach the price guide. Check your connection and try again.")
  }

  const body = (await response.json().catch(() => null)) as { band?: PriceBand; error?: string } | null
  if (!response.ok || !body?.band) {
    throw new DataError(body?.error ?? "The AI estimate isn't available right now. Please price this item yourself.")
  }
  return body.band
}

/**
 * The price guide for one line of a request. Invited suppliers and the
 * admin only. Throws a DataError when no guide is available (for example,
 * the AI estimate failed); the quote screen then simply hides the guide.
 */
export async function getPriceGuide(requestLineId: string): Promise<PriceGuide> {
  const rows = unwrap(await db.rpc("price_guide", { p_request_line_id: requestLineId }))
  const row = rows[0]
  if (!row) throw new DataError("Not found.")

  let band: PriceBand
  if (row.source === "past_quotes" && row.low !== null && row.typical !== null && row.high !== null) {
    band = {
      low: Number(row.low),
      typical: Number(row.typical),
      high: Number(row.high),
      source: "past_quotes",
      basedOn: row.price_count,
      winPct: row.win_pct_typical === null ? null
        : { low: row.win_pct_low, typical: row.win_pct_typical, high: row.win_pct_high },
      note: null,
    }
  } else {
    band = await fetchAiEstimate(requestLineId)
  }

  return {
    requestLineId,
    itemName: row.item_name,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    band,
    suggestions: suggestPrices(band),
  }
}
