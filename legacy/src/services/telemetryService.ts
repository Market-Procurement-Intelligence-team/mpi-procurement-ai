/**
 * MPI Observability & Procurement Funnel Telemetry Service
 *
 * Implements privacy-preserving telemetry tracking for procurement milestones,
 * AI capability latencies, and operational failure rates.
 * Does NOT track sensitive business secrets, credentials, or PII.
 */

import { hasConsent, hasUserDecided } from "./cookieConsentService"
import { supabase } from "../lib/supabaseClient"

export type TelemetryEventType =
  | "landing_view"
  | "cta_rfq_clicked"
  | "signup_completed"
  | "onboarding_step_viewed"
  | "procurement_started"
  | "rfq_dispatched"
  | "msme_quote_submitted"
  | "scheme_matcher_opened"
  | "scheme_eligibility_started"
  | "scheme_eligibility_completed"
  | "scheme_official_link_clicked"
  | "scheme_saved"
  | "requirement_started"
  | "requirement_submitted"
  | "ai_parsing_completed"
  | "match_generated"
  | "comparison_started"
  | "quote_requested"
  | "escrow_milestone_created"
  | "ai_latency"
  | "ai_error"
  | "rate_limit_exceeded"

export interface TelemetryEvent {
  event: TelemetryEventType
  timestamp: string
  sessionId: string
  metadata?: Record<string, any>
}

// In-memory telemetry buffer with localStorage persistence
const TELEMETRY_STORAGE_KEY = "mpi_telemetry_events"
const MAX_BUFFERED_EVENTS = 100

// Sensitive key patterns that must NEVER be included in telemetry payloads
const SENSITIVE_KEY_PATTERNS = [
  "password",
  "token",
  "secret",
  "key",
  "auth",
  "bearer",
  "cookie",
  "session",
  "credential",
  "gstin",
  "pan",
  "aadhaar",
  "bank",
  "account",
  "document",
  "rawspec",
  "requirementtext",
  "quotecontent",
  "card",
  "cvv",
  "pin",
  "phone",
  "email",
]

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

/**
 * Deeply sanitizes telemetry metadata:
 * 1. Blacklists sensitive keys (tokens, passwords, secrets, financial, PII)
 * 2. Recursively sanitizes nested objects and arrays
 * 3. Scrubs GSTIN and PAN values even under non-sensitive keys
 * 4. Truncates long strings to prevent arbitrary payload dumping
 */
export function sanitizeTelemetryMetadata(
  meta?: Record<string, any>,
): Record<string, any> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {}
  const clean: Record<string, any> = {}

  for (const [k, v] of Object.entries(meta)) {
    const lowerKey = k.toLowerCase().replace(/[^a-z]/g, "")
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => lowerKey.includes(pattern))
    if (isSensitive) continue

    if (v === null || v === undefined) {
      clean[k] = null
    } else if (typeof v === "number" || typeof v === "boolean") {
      clean[k] = v
    } else if (typeof v === "string") {
      const trimmed = v.trim()
      if (GSTIN_REGEX.test(trimmed)) {
        clean[k] = "[REDACTED_GSTIN]"
      } else if (PAN_REGEX.test(trimmed)) {
        clean[k] = "[REDACTED_PAN]"
      } else {
        clean[k] = trimmed.length > 150 ? trimmed.slice(0, 147) + "..." : trimmed
      }
    } else if (Array.isArray(v)) {
      clean[k] = v.slice(0, 10).map((item) => {
        if (typeof item === "string") {
          const trimmed = item.trim()
          if (GSTIN_REGEX.test(trimmed)) return "[REDACTED_GSTIN]"
          if (PAN_REGEX.test(trimmed)) return "[REDACTED_PAN]"
          return trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed
        }
        if (typeof item === "object" && item !== null) {
          return sanitizeTelemetryMetadata(item)
        }
        return item
      })
    } else if (typeof v === "object") {
      clean[k] = sanitizeTelemetryMetadata(v)
    }
  }

  return clean
}

// In-memory deduplication tracker to prevent rapid duplicate event creation
let lastTrackedEventKey = ""
let lastTrackedTimestamp = 0

function getSessionId(): string {
  if (typeof window === "undefined") return "server"
  let sid = sessionStorage.getItem("mpi_session_id")
  if (!sid) {
    sid = `ses_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`
    sessionStorage.setItem("mpi_session_id", sid)
  }
  return sid
}

/**
 * Asynchronously dispatches telemetry to configured production destination:
 * 1. If VITE_ANALYTICS_ENDPOINT is configured, uses navigator.sendBeacon or fetch.
 * 2. If Supabase is configured, attempts insert into `telemetry_events` table.
 * 3. Non-blocking error handling ensures user actions are never interrupted.
 */
async function dispatchToProductionDestination(item: TelemetryEvent): Promise<boolean> {
  let dispatched = false

  // 1. Check for configured HTTP beacon/REST analytics endpoint
  const analyticsEndpoint =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_ANALYTICS_ENDPOINT) || ""
  if (analyticsEndpoint && typeof window !== "undefined") {
    try {
      const payload = JSON.stringify(item)
      if (navigator.sendBeacon) {
        dispatched = navigator.sendBeacon(analyticsEndpoint, payload)
      } else {
        await fetch(analyticsEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        })
        dispatched = true
      }
    } catch {
      // Non-blocking fallback
    }
  }

  // 2. Dispatch to Supabase PostgreSQL if client is configured
  try {
    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
    if (supabaseUrl && supabaseKey) {
      const { error } = await supabase.from("telemetry_events").insert({
        event: item.event,
        session_id: item.sessionId,
        metadata: item.metadata,
        created_at: item.timestamp,
      })
      if (!error) {
        dispatched = true
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return dispatched
}

export function trackTelemetryEvent(
  event: TelemetryEventType,
  metadata?: Record<string, string | number | boolean | null>,
): void {
  // Enforce GDPR/DPDP analytics consent:
  // Do NOT record optional analytics telemetry until user has granted explicit 'analytics' consent.
  // Essential error alerts (ai_error, rate_limit_exceeded) are exempted for platform stability.
  const isEssentialError = event === "ai_error" || event === "rate_limit_exceeded"
  if (!isEssentialError && !hasConsent("analytics")) {
    return
  }

  const cleanMetadata = sanitizeTelemetryMetadata(metadata)

  // Deduplication guard: ignore accidental duplicate rapid triggers within 1200ms
  const currentKey = `${event}:${JSON.stringify(cleanMetadata)}`
  const now = Date.now()
  if (currentKey === lastTrackedEventKey && now - lastTrackedTimestamp < 1200) {
    return
  }
  lastTrackedEventKey = currentKey
  lastTrackedTimestamp = now

  const telemetryItem: TelemetryEvent = {
    event,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    metadata: cleanMetadata,
  }

  // Debug logging in development mode
  if (import.meta.env.DEV) {
    console.debug(`[MPI Telemetry] ${event}`, telemetryItem.metadata)
  }

  if (typeof window === "undefined") return

  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY)
    const list: TelemetryEvent[] = raw ? JSON.parse(raw) : []
    list.push(telemetryItem)
    if (list.length > MAX_BUFFERED_EVENTS) {
      list.shift()
    }
    localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // LocalStorage quota or access exception silently handled
  }

  // Asynchronously dispatch to production analytics destination
  // Fire-and-forget: does not block execution or raise uncaught errors
  dispatchToProductionDestination(telemetryItem).catch(() => {
    // Silently ignore network transport errors
  })
}

/**
 * Tracks AI invocation latency and outcome (Section 34)
 */
export function trackAILatency(capabilityId: string, latencyMs: number, status: "success" | "error" | "rate_limited"): void {
  trackTelemetryEvent("ai_latency", {
    capabilityId,
    latencyMs,
    status,
  })
}

/**
 * Retrieves recent telemetry events from local storage buffer
 */
export function getRecentTelemetryEvents(): TelemetryEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Aggregates local conversion funnel totals
 */
export function getLocalTelemetrySummary(): Record<string, number> {
  const events = getRecentTelemetryEvents()
  const summary: Record<string, number> = {}
  events.forEach((e) => {
    summary[e.event] = (summary[e.event] || 0) + 1
  })
  return summary
}

/**
 * Queries authoritative telemetry events from Supabase PostgreSQL (admin inspection)
 */
export async function fetchLiveTelemetrySummary(): Promise<{
  fromDatabase: boolean
  totalCount: number
  eventCounts: Record<string, number>
  recentEvents: Array<{
    id: number
    event: string
    sessionId: string
    createdAt: string
    metadata: Record<string, any>
  }>
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from("telemetry_events")
      .select("id, event, session_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      return {
        fromDatabase: false,
        totalCount: 0,
        eventCounts: {},
        recentEvents: [],
        error: error.message,
      }
    }

    const counts: Record<string, number> = {}
    ;(data || []).forEach((row) => {
      counts[row.event] = (counts[row.event] || 0) + 1
    })

    return {
      fromDatabase: true,
      totalCount: data ? data.length : 0,
      eventCounts: counts,
      recentEvents: (data || []).map((r) => ({
        id: r.id,
        event: r.event,
        sessionId: r.session_id,
        createdAt: r.created_at,
        metadata: r.metadata || {},
      })),
    }
  } catch (err) {
    return {
      fromDatabase: false,
      totalCount: 0,
      eventCounts: {},
      recentEvents: [],
      error: err instanceof Error ? err.message : "Network error",
    }
  }
}
