/**
 * Errors from the MPI database, turned into messages a person can act on.
 *
 * The database's own rules raise plain-English messages (for example
 * "A request can invite at most 3 suppliers"), which are shown as they are.
 * Anything technical is replaced with a short generic message.
 */

export class DataError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = "DataError"
    this.code = code
  }
}

interface RawError {
  message?: string
  code?: string
}

const GENERIC = "Something went wrong. Please try again."

export function toDataError(error: unknown): DataError {
  if (error instanceof DataError) return error
  const raw = (error ?? {}) as RawError
  const message = raw.message ?? ""
  const code = raw.code

  // Messages written by our own database functions and triggers.
  if (code === "P0001" && message) return new DataError(message, code)

  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    return new DataError("You don't have access to do that.", code)
  }
  if (code === "23505") return new DataError("This already exists.", code)
  if (code === "23514") return new DataError("Some details are not in the right format.", code)
  if (/invalid login credentials/i.test(message)) return new DataError("Wrong email or password.", code)
  if (/email not confirmed/i.test(message)) return new DataError("Please confirm your email first. Check your inbox.", code)
  if (/user already registered/i.test(message)) return new DataError("An account with this email already exists.", code)
  if (/password should be/i.test(message)) return new DataError(message, code)
  if (/should be different from the old password/i.test(message)) {
    return new DataError("Please choose a password you haven't used before.", code)
  }
  if (/auth session missing/i.test(message)) {
    return new DataError("This reset link has expired or was already used. Please ask for a new one.", code)
  }
  if (/only request this after|rate limit/i.test(message)) {
    return new DataError("Please wait a minute before asking for another link.", code)
  }
  if (/jwt|refresh token|session/i.test(message)) return new DataError("Your session has expired. Please sign in again.", code)
  if (/failed to fetch|network/i.test(message)) return new DataError("Can't reach MPI right now. Check your connection.", code)

  return new DataError(GENERIC, code)
}

/** Returns the data of a Supabase result. Throws a DataError on failure or when nothing was found. */
export function unwrap<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw toDataError(result.error)
  if (result.data === null || result.data === undefined) throw new DataError("Not found.")
  return result.data as NonNullable<T>
}

/** Like unwrap, but nothing found is fine and returns null. */
export function unwrapMaybe<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw toDataError(result.error)
  return result.data
}

/** For writes that return nothing: throws a DataError on failure. */
export function check(result: { error: unknown }): void {
  if (result.error) throw toDataError(result.error)
}
