/**
 * MPI (Market Procurement Intelligence) — Cookie Consent & Privacy Service
 * 
 * Provides production-grade storage, category definitions, and a subscription API
 * for managing user cookie and privacy preferences in accordance with GDPR, DPDP
 * (Digital Personal Data Protection Act, India), and B2B SaaS best practices.
 */

export interface CookieCategories {
  /** Critical for core platform operations, authentication, CSRF, and session integrity. Always true. */
  necessary: boolean
  /** Saves UI layout preferences, selected language, and filter states. */
  preferences: boolean
  /** Gathers anonymized telemetry, procurement funnel conversion, and performance metrics. */
  analytics: boolean
  /** Delivers MSME partner announcements, subsidy alerts, and ecosystem updates. */
  marketing: boolean
}

export interface CookieConsentRecord {
  categories: CookieCategories
  timestamp: string // ISO 8601 string
  version: string
  consentGiven: boolean
}

export const COOKIE_STORAGE_KEY = "mpi_cookie_consent_v1"
export const CURRENT_CONSENT_VERSION = "1.0.0"

export const DEFAULT_COOKIE_CONSENT: CookieConsentRecord = {
  categories: {
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false,
  },
  timestamp: "",
  version: CURRENT_CONSENT_VERSION,
  consentGiven: false,
}

// In-memory fallback if localStorage is unavailable (e.g., privacy mode / disabled cookies)
let memoryStore: CookieConsentRecord | null = null

// Custom Event Names
export const EVENT_CONSENT_UPDATED = "mpi:cookie-consent-updated"
export const EVENT_OPEN_PREFERENCES = "mpi:open-cookie-preferences"
export const EVENT_CLOSE_PREFERENCES = "mpi:close-cookie-preferences"

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

/**
 * Safely retrieves stored cookie consent from localStorage or in-memory fallback.
 */
export function getStoredConsent(): CookieConsentRecord | null {
  if (!isBrowser()) {
    return memoryStore
  }

  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY)
    if (!raw) return memoryStore

    const parsed = JSON.parse(raw) as Partial<CookieConsentRecord>
    if (!parsed || typeof parsed !== "object" || !parsed.categories) {
      return memoryStore
    }

    // Ensure necessary is always true
    const categories: CookieCategories = {
      necessary: true,
      preferences: Boolean(parsed.categories.preferences),
      analytics: Boolean(parsed.categories.analytics),
      marketing: Boolean(parsed.categories.marketing),
    }

    const record: CookieConsentRecord = {
      categories,
      timestamp: parsed.timestamp || new Date().toISOString(),
      version: parsed.version || CURRENT_CONSENT_VERSION,
      consentGiven: Boolean(parsed.consentGiven),
    }

    memoryStore = record
    return record
  } catch (err) {
    console.warn("[MPI Cookie Consent] Failed to read from localStorage:", err)
    return memoryStore
  }
}

/**
 * Conceptual API alias for getStoredConsent
 */
export const getCookieConsent = getStoredConsent


/**
 * Checks whether the user has already made an explicit consent decision.
 */
export function hasUserDecided(): boolean {
  const record = getStoredConsent()
  return Boolean(record && record.consentGiven)
}

/**
 * Persists cookie consent record to localStorage and dispatches change events.
 */
export function saveConsent(choices: Partial<CookieCategories>): CookieConsentRecord {
  const current = getStoredConsent() || DEFAULT_COOKIE_CONSENT

  const updatedCategories: CookieCategories = {
    necessary: true, // Always locked on
    preferences: choices.preferences !== undefined ? Boolean(choices.preferences) : current.categories.preferences,
    analytics: choices.analytics !== undefined ? Boolean(choices.analytics) : current.categories.analytics,
    marketing: choices.marketing !== undefined ? Boolean(choices.marketing) : current.categories.marketing,
  }

  const record: CookieConsentRecord = {
    categories: updatedCategories,
    timestamp: new Date().toISOString(),
    version: CURRENT_CONSENT_VERSION,
    consentGiven: true,
  }

  memoryStore = record

  if (isBrowser()) {
    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(record))
    } catch (err) {
      console.warn("[MPI Cookie Consent] Failed to write to localStorage:", err)
    }

    // Broadcast update across the application
    window.dispatchEvent(
      new CustomEvent<CookieConsentRecord>(EVENT_CONSENT_UPDATED, {
        detail: record,
      })
    )
  }

  return record
}

/**
 * Grants consent for all cookie categories.
 */
export function acceptAllCookies(): CookieConsentRecord {
  return saveConsent({
    necessary: true,
    preferences: true,
    analytics: true,
    marketing: true,
  })
}

/**
 * Rejects all optional categories, retaining only essential/necessary cookies.
 */
export function rejectOptionalCookies(): CookieConsentRecord {
  return saveConsent({
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false,
  })
}

/**
 * Checks if a specific cookie category has been consented to.
 */
export function hasConsent(category: keyof CookieCategories): boolean {
  if (category === "necessary") return true
  const record = getStoredConsent()
  if (!record || !record.consentGiven) return false
  return Boolean(record.categories[category])
}

/**
 * Resets stored consent (clears storage for testing or manual user reset).
 */
export function resetConsent(): void {
  memoryStore = null
  if (isBrowser()) {
    try {
      localStorage.removeItem(COOKIE_STORAGE_KEY)
    } catch (err) {
      console.warn("[MPI Cookie Consent] Failed to clear localStorage:", err)
    }

    window.dispatchEvent(
      new CustomEvent<CookieConsentRecord | null>(EVENT_CONSENT_UPDATED, {
        detail: null,
      })
    )
  }
}

/**
 * Triggers the Cookie Preferences Modal from anywhere in the application (e.g., footer link).
 */
export function openCookiePreferencesModal(): void {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(EVENT_OPEN_PREFERENCES))
  }
}

/**
 * Closes the Cookie Preferences Modal.
 */
export function closeCookiePreferencesModal(): void {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(EVENT_CLOSE_PREFERENCES))
  }
}

/**
 * Subscribes to cookie consent changes across the application.
 * Returns an unsubscription function.
 */
export function onConsentChange(callback: (consent: CookieConsentRecord | null) => void): () => void {
  if (!isBrowser()) return () => {}

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<CookieConsentRecord | null>
    callback(customEvent.detail)
  }

  window.addEventListener(EVENT_CONSENT_UPDATED, handler)
  return () => window.removeEventListener(EVENT_CONSENT_UPDATED, handler)
}

/**
 * Subscribes to requests to open the preferences modal.
 */
export function onOpenPreferencesRequest(callback: () => void): () => void {
  if (!isBrowser()) return () => {}

  const handler = () => callback()
  window.addEventListener(EVENT_OPEN_PREFERENCES, handler)
  return () => window.removeEventListener(EVENT_OPEN_PREFERENCES, handler)
}
