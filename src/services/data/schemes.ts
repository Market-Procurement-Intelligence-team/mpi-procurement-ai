/**
 * Government schemes (subsidies, grants, loans) for startups and MSMEs.
 * Readable by every signed-in user; the admin adds, edits or switches them off.
 * Details come from the MSME schemes booklet, so screens should link to each
 * scheme's official portal and say to check it for current terms.
 */

import { db } from "../../lib/db"
import type { Tables } from "../../lib/database.types"
import { check, unwrap } from "./errors"

export type Scheme = Tables<"government_schemes">

export interface SchemeSuggestion {
  scheme: Scheme
  /** 30 to 100. Only schemes scoring 50 or more are suggested. */
  score: number
  /** Plain-language reasons, e.g. "Covers Packaging & Printing", "You are DPIIT recognised". */
  reasons: string[]
}

/** All active schemes (admin also sees switched-off ones), A to Z. */
export async function listSchemes(): Promise<Scheme[]> {
  return unwrap(await db.from("government_schemes").select("*").order("short_name"))
}

export async function getScheme(id: string): Promise<Scheme> {
  return unwrap(await db.from("government_schemes").select("*").eq("id", id).single())
}

/**
 * The schemes that fit the signed-in startup or supplier best, best first,
 * with the reasons. Uses their categories, stage or size, industry, what they
 * buy or make, and their DPIIT and Udyam registration. A suggestion, not a
 * decision on eligibility.
 */
export async function suggestSchemes(limit = 10): Promise<SchemeSuggestion[]> {
  const scores = unwrap(await db.rpc("suggest_schemes", { p_limit: limit }))
  if (!scores.length) return []
  const schemes = unwrap(await db.from("government_schemes").select("*").in("id", scores.map((s) => s.scheme_id)))
  const byId = new Map(schemes.map((s) => [s.id, s]))
  return scores.flatMap((s) => {
    const scheme = byId.get(s.scheme_id)
    return scheme ? [{ scheme, score: s.score, reasons: s.reasons }] : []
  })
}

/** Admin: switch a scheme on or off. Switched-off schemes are hidden from everyone else. */
export async function setSchemeActive(id: string, active: boolean): Promise<void> {
  check(await db.from("government_schemes").update({ is_active: active }).eq("id", id))
}
