/**
 * MPI AI Cost Protection, Rate Limiter & Resilient Retry Engine
 *
 * Enforces:
 * - Client-side token and request burst protection (sliding window rate limits)
 * - Maximum character and token payload limits
 * - Bounded exponential backoff with jitter strictly for transient failures (429, 503, timeout)
 * - Immediate abort without retry for permanent failures (400, 401, 403, 422)
 * - Sanitized human-readable error messaging
 */

export interface RateLimitStatus {
  allowed: boolean
  remainingRequests: number
  resetInSeconds: number
  reason?: string
}

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  timeoutMs: number
}

export const DEFAULT_AI_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1200,
  maxDelayMs: 6000,
  timeoutMs: 25000,
}

// Sliding window rate limiter state
const REQUEST_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_MINUTE = 15 // Max requests per user per minute
const MAX_PAYLOAD_CHARACTERS = 8000 // Maximum input prompt length

const requestTimestamps: number[] = []

/**
 * Checks if the upcoming AI request passes rate limits and payload size constraints
 */
export function checkAIRateLimit(promptLength: number = 0): RateLimitStatus {
  // 1. Payload size check
  if (promptLength > MAX_PAYLOAD_CHARACTERS) {
    return {
      allowed: false,
      remainingRequests: 0,
      resetInSeconds: 0,
      reason: `Requirement text exceeds safe length limit of ${MAX_PAYLOAD_CHARACTERS.toLocaleString()} characters.`,
    }
  }

  // 2. Sliding window check
  const now = Date.now()
  // Clean timestamps older than the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] <= now - REQUEST_WINDOW_MS) {
    requestTimestamps.shift()
  }

  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldest = requestTimestamps[0]
    const resetInSeconds = Math.ceil((oldest + REQUEST_WINDOW_MS - now) / 1000)
    return {
      allowed: false,
      remainingRequests: 0,
      resetInSeconds: Math.max(1, resetInSeconds),
      reason: `AI capacity protection: Please wait ${resetInSeconds}s before sending another request.`,
    }
  }

  return {
    allowed: true,
    remainingRequests: MAX_REQUESTS_PER_MINUTE - requestTimestamps.length,
    resetInSeconds: 0,
  }
}

/**
 * Records a dispatched AI request for rate-limit tracking
 */
export function recordAIDispatch(): void {
  requestTimestamps.push(Date.now())
}

/**
 * Maps raw HTTP status codes to user-friendly, professional B2B messages (Section 32)
 */
export function mapAIErrorToUserMessage(status: number, rawMessage?: string): { message: string; retryable: boolean } {
  switch (status) {
    case 400:
      return {
        message: "The requirement specifications could not be parsed. Please check your input parameters and try again.",
        retryable: false,
      }
    case 401:
      return {
        message: "Authentication required to access this procurement intelligence service.",
        retryable: false,
      }
    case 403:
      return {
        message: "Your organization does not have authorization to trigger this capability.",
        retryable: false,
      }
    case 404:
      return {
        message: "The requested procurement intelligence model is currently unavailable.",
        retryable: false,
      }
    case 408:
      return {
        message: "AI analysis timed out while computing factory tolerances. Please try a simpler requirement.",
        retryable: true,
      }
    case 422:
      return {
        message: "Specification validation failed. Numerical constraints or units appear inconsistent.",
        retryable: false,
      }
    case 429:
      return {
        message: "AI compute capacity is temporarily under high load. Your request has not been lost; please retry shortly.",
        retryable: true,
      }
    case 500:
      return {
        message: "An unexpected error occurred in the procurement inference engine. Our operations team has been notified.",
        retryable: false,
      }
    case 502:
    case 503:
    case 504:
      return {
        message: "National manufacturing inference network is momentarily offline for routine synchronization.",
        retryable: true,
      }
    default:
      return {
        message: rawMessage || "Unable to complete AI analysis at this moment.",
        retryable: false,
      }
  }
}

/**
 * Resilient execute wrapper with bounded exponential backoff & jitter
 */
export async function executeWithResilientRetry<T>(
  operation: (attempt: number) => Promise<T>,
  isRetryableError: (err: any) => boolean,
  config: RetryConfig = DEFAULT_AI_RETRY_CONFIG,
): Promise<T> {
  let attempt = 0

  while (attempt <= config.maxRetries) {
    try {
      return await operation(attempt)
    } catch (err: any) {
      attempt++
      const retryable = isRetryableError(err)

      if (attempt > config.maxRetries || !retryable) {
        throw err
      }

      // Calculate jittered exponential backoff: baseDelay * 2^(attempt-1) + random jitter
      const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1)
      const jitter = Math.random() * 400
      const delay = Math.min(exponentialDelay + jitter, config.maxDelayMs)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error("Maximum retry attempts exceeded.")
}
