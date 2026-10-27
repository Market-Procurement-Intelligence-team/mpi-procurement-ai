/**
 * AI request reader: the startup types or speaks what they need, and the AI
 * turns it into a draft request for them to check. The AI runs on the server
 * (netlify/functions/request-reader.ts); the browser never sees the AI key.
 *
 * Typical use on the "New request" screen:
 *   const draft = await readRequirement(text)
 *   // show the draft in the form, let the startup edit it, then:
 *   await createRequest(orgId, userId, draftToRequestInput(draft, text), send)
 */

import { db } from "../../lib/db"
import type { Json } from "../../lib/database.types"
import { DataError } from "./errors"
import type { RequestInput } from "./requests"

export interface DraftLine {
  /** Catalogue item it matched, or null when nothing in the catalogue fits. */
  itemId: string | null
  itemName: string | null
  description: string
  quantity: number
  unit: string
}

export interface RequestDraft {
  title: string
  description: string | null
  categoryId: string | null
  lines: DraftLine[]
  neededBy: string | null
  deliveryCity: string | null
  deliveryState: string | null
  /** True for work that can be done online; there is then no delivery place. */
  remote: boolean
  requiredCertifications: string[]
  budgetMin: number | null
  budgetMax: number | null
  /** "en", "hi" or "hinglish". */
  language: string
  /** Important details the text didn't give, e.g. "needed-by date", to ask for in the form. */
  missing: string[]
}

const READER_URL = "/api/request-reader"

/** Reads a requirement (English, Hindi or Hinglish) and returns a draft request. Startups only. */
export async function readRequirement(text: string): Promise<RequestDraft> {
  const { data } = await db.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new DataError("Please log in first.")

  let response: Response
  try {
    response = await fetch(READER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    })
  } catch {
    throw new DataError("Couldn't reach the AI reader. Check your connection and try again.")
  }

  const body = (await response.json().catch(() => null)) as { draft?: RequestDraft; error?: string } | null
  if (!response.ok || !body?.draft) {
    throw new DataError(body?.error ?? "The AI couldn't read this right now. Please fill the form yourself.")
  }
  return body.draft
}

/**
 * Turns the checked (possibly edited) draft into the input for createRequest.
 * Pass the AI's untouched reading as `aiReading` so it is kept alongside the
 * original text; without it, the draft itself is kept.
 */
export function draftToRequestInput(draft: RequestDraft, originalText: string, aiReading: RequestDraft = draft): RequestInput {
  return {
    title: draft.title,
    description: draft.description,
    requirementText: originalText,
    inputLanguage: draft.language,
    aiExtracted: aiReading as unknown as Json,
    requiredCertifications: draft.requiredCertifications,
    categoryId: draft.categoryId,
    source: "ai_assisted",
    neededBy: draft.neededBy,
    deliveryCity: draft.remote ? null : draft.deliveryCity,
    deliveryState: draft.remote ? null : draft.deliveryState,
    budgetMin: draft.budgetMin,
    budgetMax: draft.budgetMax,
    lines: draft.lines.map((line) => ({
      itemId: line.itemId,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
    })),
  }
}
