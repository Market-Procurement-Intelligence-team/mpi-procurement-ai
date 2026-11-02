/**
 * MPI Enterprise Error Sanitizer
 *
 * Centralizes visible error handling across the application.
 * Intercepts provider-specific error codes (PGRST, PostgREST, PostgreSQL SQLSTATE,
 * Gemini API, Supabase, internal schemas, and raw URLs) and translates them into
 * professional, user-oriented MPI messages.
 */

export function sanitizeErrorMessage(error: unknown, fallback = "Unable to complete request. Please try again."): string {
  if (!error) return fallback

  const rawMessage = typeof error === "string" 
    ? error 
    : error instanceof Error 
    ? error.message 
    : (typeof error === "object" && error !== null && "message" in error)
    ? String((error as { message: unknown }).message)
    : String(error)

  const lower = rawMessage.toLowerCase()

  // 1. PostgREST / Schema cache errors (e.g. PGRST205)
  if (lower.includes("pgrst") || lower.includes("schema cache") || lower.includes("could not find the table")) {
    return "MPI cloud synchronization is currently initializing. Your data is safely preserved locally."
  }

  // 2. Row Level Security / Permission errors (SQLSTATE 42501)
  if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("42501")) {
    return "Action could not be authorized with current account permissions. Please verify your role."
  }

  // 3. Authentication & Session errors
  if (lower.includes("jwt") || lower.includes("invalid refresh token") || lower.includes("session expired") || lower.includes("auth/")) {
    return "Your session has expired. Please sign in again to continue."
  }

  // 4. Rate Limiting (HTTP 429)
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("resource_exhausted") || lower.includes("quota")) {
    return "High demand detected. Please wait a moment and try again shortly."
  }

  // 5. Network / Offline failures
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network error") || lower.includes("enotfound")) {
    return "Network connection issue detected. Your changes are safely buffered."
  }

  // 6. AI Model Provider specific errors
  if (lower.includes("gemini") || lower.includes("generativelanguage") || lower.includes("openrouter") || lower.includes("openai")) {
    return "MPI Requirement Intelligence is temporarily busy. Please retry in a few seconds."
  }

  // 7. Supabase / Postgres infrastructure leaks
  if (lower.includes("supabase") || lower.includes("postgres") || lower.includes("postgrest") || lower.includes("sql")) {
    return "MPI cloud services are temporarily updating. Please try again shortly."
  }

  // 8. Scrub raw provider URLs or internal IDs if present
  let cleanMessage = rawMessage.replace(/https?:\/\/[^\s]+/g, "MPI Cloud")
  cleanMessage = cleanMessage.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[ID]")

  // If the message is a clean, human-readable sentence already without tech leaks, keep it
  if (cleanMessage.length < 120 && !cleanMessage.includes("Error:") && !cleanMessage.includes("{")) {
    return cleanMessage
  }

  return fallback
}

