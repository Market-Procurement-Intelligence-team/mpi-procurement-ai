import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// No fallback project: without these settings the app must not connect anywhere.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill in the Supabase project settings.",
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/**
 * Diagnostic helper to check connection status to Supabase backend
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean
  url: string
  error?: string
}> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`)
    if (res.ok || res.status === 401) {
      return { connected: true, url: supabaseUrl }
    }
    return {
      connected: false,
      url: supabaseUrl,
      error: `HTTP ${res.status}: ${res.statusText}`,
    }
  } catch (err: unknown) {
    return {
      connected: false,
      url: supabaseUrl,
      error: err instanceof Error ? err.message : "Network error",
    }
  }
}
