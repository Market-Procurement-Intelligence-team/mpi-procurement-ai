/**
 * MPI Production API Contracts & Idempotency System
 * 
 * Provides unified contract envelopes, standard HTTP status codes,
 * deterministic error classifications, and client/server idempotency tracking.
 */

export type ApiStatusCode = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504

export interface ApiMeta {
  timestamp: string
  requestId: string
  latencyMs?: number
  version: string
  idempotencyKey?: string
  [key: string]: unknown
}

export interface ApiErrorPayload {
  code: 
    | "BAD_REQUEST"
    | "UNAUTHENTICATED"
    | "UNAUTHORIZED"
    | "NOT_FOUND"
    | "CONFLICT"
    | "UNPROCESSABLE_ENTITY"
    | "RATE_LIMITED"
    | "TIMEOUT"
    | "INTERNAL_SERVER_ERROR"
    | "SERVICE_UNAVAILABLE"
    | "NETWORK_ERROR"
  message: string
  status: ApiStatusCode
  details?: unknown
  retryable: boolean
}

export interface ApiResponse<T = unknown> {
  data: T | null
  meta: ApiMeta
  error: ApiErrorPayload | null
}

/**
 * Creates a standardized successful ApiResponse envelope
 */
export function createApiSuccess<T>(data: T, metaProps: Partial<ApiMeta> = {}): ApiResponse<T> {
  return {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `req_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`,
      version: "v1.0",
      ...metaProps,
    },
    error: null,
  }
}

/**
 * Creates a standardized error ApiResponse envelope
 */
export function createApiError<T = null>(
  code: ApiErrorPayload["code"],
  message: string,
  status: ApiStatusCode,
  details?: unknown,
  metaProps: Partial<ApiMeta> = {},
): ApiResponse<T> {
  const retryable = status === 429 || status === 503 || status === 504 || code === "TIMEOUT"

  return {
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `err_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`,
      version: "v1.0",
      ...metaProps,
    },
    error: {
      code,
      message,
      status,
      details,
      retryable,
    },
  }
}

/**
 * Idempotency Key Manager
 * Prevents accidental duplicate submissions (e.g. double clicking 'Create RFQ' or 'Submit Quote')
 */
const idempotencyStore = new Map<string, { timestamp: number; response: ApiResponse<any> }>()
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function generateIdempotencyKey(actionPrefix: string = "act"): string {
  return `${actionPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function checkIdempotentExecution<T>(
  key: string,
): { exists: boolean; cachedResponse?: ApiResponse<T> } {
  if (!key) return { exists: false }
  
  const record = idempotencyStore.get(key)
  if (!record) return { exists: false }

  // Check TTL
  if (Date.now() - record.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyStore.delete(key)
    return { exists: false }
  }

  return { exists: true, cachedResponse: record.response as ApiResponse<T> }
}

export function recordIdempotentExecution<T>(key: string, response: ApiResponse<T>): void {
  if (!key) return
  idempotencyStore.set(key, {
    timestamp: Date.now(),
    response,
  })

  // Cleanup old keys periodically if map grows large
  if (idempotencyStore.size > 200) {
    const now = Date.now()
    for (const [k, v] of idempotencyStore.entries()) {
      if (now - v.timestamp > IDEMPOTENCY_TTL_MS) {
        idempotencyStore.delete(k)
      }
    }
  }
}
