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

/** What a request says, for matching schemes to it. */
export interface RequestForSchemes {
  categoryId: string | null
  categoryName?: string | null
  title: string
  description?: string | null
  items: string[]
  certifications: string[]
}

/** Lower-case words of a text, for keyword matching. */
function textOf(parts: (string | null | undefined)[]): string {
  return ` ${parts.filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9&+]+/g, " ")} `
}

/** Does the request text mention this keyword (also without a plural "s")? */
function mentions(text: string, keyword: string): boolean {
  const k = keyword.toLowerCase().trim()
  if (k.length < 3) return false
  const stem = k.endsWith("s") ? k.slice(0, -1) : k
  return text.includes(` ${k}`) || text.includes(` ${stem}`)
}

/**
 * The schemes that fit one request best (for Review & send), best first.
 * Looks at the request's category, what is being bought (title, description,
 * items), the certifications asked for, and the startup's own profile fit
 * (suggest_schemes). Only schemes open to startups. A suggestion, not a
 * decision on eligibility. Returns every scheme that fits; the screen shows
 * the top few.
 */
export async function matchSchemesToRequest(req: RequestForSchemes): Promise<SchemeSuggestion[]> {
  const [schemes, profile] = await Promise.all([listSchemes(), suggestSchemes(30).catch(() => [] as SchemeSuggestion[])])
  const byProfile = new Map(profile.map((p) => [p.scheme.id, p.score]))
  const text = textOf([req.title, req.description, ...req.items])

  const out: SchemeSuggestion[] = []
  for (const scheme of schemes) {
    if (!scheme.is_active || !scheme.for_startups) continue
    const reasons: string[] = []
    let points = 0

    if (req.categoryId && scheme.category_ids.includes(req.categoryId)) {
      points += 20
      reasons.push(req.categoryName ? `Covers ${req.categoryName}` : "Covers this kind of purchase")
    }

    const hits = [...new Set([...scheme.procurement_triggers, ...scheme.industry_keywords].filter((k) => mentions(text, k)))]
    if (hits.length) {
      points += Math.min(30, hits.length * 10)
      reasons.push(`Helps with what you're buying: ${hits.slice(0, 3).join(", ")}`)
    }
    // Schemes for one industry (food, textiles...) only when the request is about it.
    if (scheme.sector_specific && !hits.length) continue

    const schemeText = textOf([scheme.name, scheme.short_name, scheme.description, ...scheme.key_benefits, ...scheme.eligibility, ...scheme.documents_required])
    const certs = req.certifications.filter((c) => {
      const word = c.toLowerCase().split(/\s+/)[0]
      return word.length >= 3 && schemeText.includes(` ${word}`)
    })
    if (certs.length) {
      points += 8
      reasons.push(`Linked to the ${certs.join(", ")} you asked for`)
    }

    const fit = byProfile.get(scheme.id)
    if (fit != null) {
      points += Math.min(5, Math.max(2, Math.round((fit - 50) / 8)))
      reasons.push("Fits your business profile")
    }

    if (points < 20) continue
    // Most specific reason first: what is being bought, then the rest.
    reasons.sort((a, b) => Number(b.startsWith("Helps")) - Number(a.startsWith("Helps")))
    out.push({ scheme, score: Math.min(98, 35 + points), reasons })
  }
  return out.sort((a, b) => b.score - a.score || a.scheme.short_name.localeCompare(b.scheme.short_name))
}

/** Short names and links for the schemes saved on a request. Unknown or switched-off ones are left out. */
export async function getSchemesByIds(ids: string[]): Promise<Scheme[]> {
  if (!ids.length) return []
  return unwrap(await db.from("government_schemes").select("*").in("id", ids).order("short_name"))
}

/**
 * Admin: how many sent requests picked each scheme (Review & send), by
 * scheme id. Drafts are not counted.
 */
export async function countSchemePicks(): Promise<Map<string, number>> {
  const rows = unwrap(await db.from("requests").select("scheme_ids").neq("status", "draft"))
  const counts = new Map<string, number>()
  for (const r of rows) for (const id of r.scheme_ids ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}
