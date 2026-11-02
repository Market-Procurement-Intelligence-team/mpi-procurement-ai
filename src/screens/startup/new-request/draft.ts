/**
 * The request being written in the New request steps, kept in one place so
 * going Back never loses anything. It is also kept in the browser tab
 * (sessionStorage) so a page refresh doesn't wipe it.
 */

import type { Json } from "../../../lib/database.types"
import type { RequestDraft } from "../../../services/data/ai"
import type { Request, RequestInput, RequestLine } from "../../../services/data/requests"

export interface DraftItem {
  /** Only for React lists. */
  key: string
  itemId: string | null
  /** Catalogue item name, when the line came from the catalogue. */
  itemName: string | null
  description: string
  /** Kept as typed, so the box can be empty while editing. */
  quantity: string
  unit: string
}

export interface WizardDraft {
  /** What the startup typed or said in step 1. */
  text: string
  /** The text the AI last read, to know when it has changed. */
  aiReadText: string | null
  /** The AI's untouched reading, saved with the request. */
  aiReading: RequestDraft | null
  language: string | null
  title: string
  description: string
  categoryId: string | null
  items: DraftItem[]
  certifications: string[]
  neededBy: string
  remote: boolean
  deliveryCity: string
  deliveryState: string
  budgetMin: string
  budgetMax: string
  /** Details the AI said the text didn't give, e.g. "needed-by date". */
  missing: string[]
}

export const STEPS = [
  { id: "describe", label: "Describe" },
  { id: "items", label: "Items" },
  { id: "details", label: "Details" },
  { id: "delivery", label: "Delivery & budget" },
  { id: "review", label: "Review & send" },
] as const

export type StepIndex = 0 | 1 | 2 | 3 | 4

export function newKey(): string {
  return crypto.randomUUID()
}

export function emptyItem(): DraftItem {
  return { key: newKey(), itemId: null, itemName: null, description: "", quantity: "", unit: "units" }
}

export function emptyDraft(): WizardDraft {
  return {
    text: "",
    aiReadText: null,
    aiReading: null,
    language: null,
    title: "",
    description: "",
    categoryId: null,
    items: [],
    certifications: [],
    neededBy: "",
    remote: false,
    deliveryCity: "",
    deliveryState: "",
    budgetMin: "",
    budgetMax: "",
    missing: [],
  }
}

/** Fills the draft from the AI's reading. What the person already typed in later steps is kept if the AI found nothing. */
export function applyAiReading(draft: WizardDraft, reading: RequestDraft): WizardDraft {
  return {
    ...draft,
    aiReadText: draft.text,
    aiReading: reading,
    language: reading.language,
    title: reading.title || draft.title,
    description: reading.description ?? draft.description,
    categoryId: reading.categoryId ?? draft.categoryId,
    items: reading.lines.length
      ? reading.lines.map((line) => ({
          key: newKey(),
          itemId: line.itemId,
          itemName: line.itemName,
          description: line.description,
          quantity: line.quantity ? String(line.quantity) : "",
          unit: line.unit || "units",
        }))
      : draft.items,
    certifications: reading.requiredCertifications.length ? reading.requiredCertifications : draft.certifications,
    neededBy: reading.neededBy ?? draft.neededBy,
    remote: reading.remote,
    deliveryCity: reading.deliveryCity ?? draft.deliveryCity,
    deliveryState: reading.deliveryState ?? draft.deliveryState,
    budgetMin: reading.budgetMin != null ? String(reading.budgetMin) : draft.budgetMin,
    budgetMax: reading.budgetMax != null ? String(reading.budgetMax) : draft.budgetMax,
    missing: reading.missing,
  }
}

/** A saved draft request, back into the steps so it can be finished. */
export function fromRequest(request: Request, lines: RequestLine[]): WizardDraft {
  const reading = (request.ai_extracted as unknown as RequestDraft | null) ?? null
  const text = request.requirement_text ?? ""
  return {
    ...emptyDraft(),
    text,
    aiReadText: reading ? text : null,
    aiReading: reading,
    language: request.input_language,
    title: request.title === "Untitled request" ? "" : request.title,
    description: request.description ?? "",
    categoryId: request.category_id,
    items: lines.map((line) => ({
      key: newKey(),
      itemId: line.item_id,
      itemName: line.item_id ? line.description : null,
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
    })),
    certifications: request.required_certifications,
    neededBy: request.needed_by ?? "",
    remote: reading?.remote === true && !request.delivery_city,
    deliveryCity: request.delivery_city ?? "",
    deliveryState: request.delivery_state ?? "",
    budgetMin: request.budget_min != null ? String(request.budget_min) : "",
    budgetMax: request.budget_max != null ? String(request.budget_max) : "",
    missing: reading?.missing ?? [],
  }
}

/** "1,20,000" or "120000" → 120000; empty or not a number → null. */
export function toNumber(value: string): number | null {
  const cleaned = value.replace(/[,\s₹]/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Today in the person's own time zone, as yyyy-mm-dd for date boxes. */
export function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export type Errors = Record<string, string>

/** What must be fixed before leaving a step. Empty when the step is fine. */
export function errorsFor(step: StepIndex, draft: WizardDraft): Errors {
  const errors: Errors = {}
  if (step === 1) {
    if (!draft.items.length) errors.items = "Add at least one item."
    draft.items.forEach((item) => {
      if (!item.description.trim()) errors[`${item.key}.description`] = "Say what this item is."
      const q = toNumber(item.quantity)
      if (q == null || q <= 0) errors[`${item.key}.quantity`] = "Enter a quantity above 0."
    })
  }
  if (step === 2) {
    if (!draft.title.trim()) errors.title = "Give your request a short title."
    else if (draft.title.trim().length > 120) errors.title = "Keep the title under 120 characters."
  }
  if (step === 3) {
    if (!draft.neededBy) errors.neededBy = "Choose the date you need this by."
    else if (draft.neededBy < todayIso()) errors.neededBy = "This date has passed. Choose a later one."
    if (!draft.remote) {
      if (!draft.deliveryCity.trim()) errors.deliveryCity = "Enter the delivery city."
      if (!draft.deliveryState) errors.deliveryState = "Choose the state."
    }
    const min = toNumber(draft.budgetMin)
    const max = toNumber(draft.budgetMax)
    if (draft.budgetMin.trim() && (min == null || min < 0)) errors.budgetMin = "Enter an amount in rupees."
    if (draft.budgetMax.trim() && (max == null || max < 0)) errors.budgetMax = "Enter an amount in rupees."
    if (min != null && max != null && max < min) errors.budgetMax = "The highest amount should be more than the lowest."
  }
  return errors
}

/** A title for a draft saved before the person wrote one. */
function fallbackTitle(draft: WizardDraft): string {
  const first = draft.items.find((i) => i.description.trim())?.description.trim()
  const fromText = draft.text.trim().split(/\s+/).slice(0, 8).join(" ")
  return (draft.title.trim() || first || fromText || "Untitled request").slice(0, 120)
}

/** Turns the draft into what the data layer saves. */
export function toRequestInput(draft: WizardDraft): RequestInput {
  const text = draft.text.trim()
  return {
    title: fallbackTitle(draft),
    description: draft.description.trim() || null,
    requirementText: text || null,
    inputLanguage: draft.language,
    aiExtracted: (draft.aiReading as unknown as Json) ?? null,
    requiredCertifications: draft.certifications,
    categoryId: draft.categoryId,
    source: draft.aiReading ? "ai_assisted" : "catalogue",
    neededBy: draft.neededBy || null,
    deliveryCity: draft.remote ? null : draft.deliveryCity.trim() || null,
    deliveryState: draft.remote ? null : draft.deliveryState || null,
    budgetMin: toNumber(draft.budgetMin),
    budgetMax: toNumber(draft.budgetMax),
    lines: draft.items
      .filter((item) => item.description.trim())
      .map((item) => ({
        itemId: item.itemId,
        description: item.description.trim(),
        quantity: toNumber(item.quantity) ?? 1,
        unit: item.unit.trim() || "units",
      })),
  }
}

const STORAGE_KEY = "mpi.newRequest"

export interface Saved {
  draft: WizardDraft
  step: StepIndex
  /** Set once the request has been saved as a draft in MPI. */
  requestId: string | null
}

export function loadSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    return saved && saved.draft ? { ...saved, draft: { ...emptyDraft(), ...saved.draft } } : null
  } catch {
    return null
  }
}

export function storeSaved(saved: Saved): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Private windows can block storage; the steps still work.
  }
}

export function clearSaved(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

/** Common certifications to tap; people can add any other. */
export const COMMON_CERTIFICATIONS = ["ISO 9001", "ZED Bronze", "ZED Silver", "ZED Gold", "BIS", "FSSAI", "RoHS", "CE"]

export function formatRupees(value: string): string {
  const n = toNumber(value)
  return n == null ? "" : `₹${n.toLocaleString("en-IN")}`
}

export function formatDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}
