/**
 * MPI Production Authentication Service
 *
 * Bridges the UI with Supabase Auth, maintains persistent JWT sessions,
 * synchronizes user roles with public.profiles, and ensures all PostgreSQL
 * database operations are executed with valid RLS authentication.
 */

import { supabase } from "../lib/supabaseClient"
import { RoleKey, GoogleAuthUser } from "../lib/mockAuth"

export interface SupabaseAuthResult {
  success: boolean
  error?: string
  user?: GoogleAuthUser
  userId?: string
}

/**
 * Sign in with email and password via Supabase Auth.
 * If user does not exist, automatically signs them up and establishes the session.
 */
export async function signInWithSupabase(
  email: string,
  password: string,
  preferredRole: RoleKey = "startup",
): Promise<SupabaseAuthResult> {
  const trimmedEmail = email.trim().toLowerCase()

  try {
    // 1. Attempt login
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (!signInError && signInData.user && signInData.session) {
      const user = await syncUserProfile(signInData.user.id, trimmedEmail, preferredRole)
      return { success: true, user, userId: signInData.user.id }
    }

    // 2. If login failed due to invalid credentials, attempt signup
    if (signInError) {
      console.info("[Auth] SignIn failed, attempting SignUp:", signInError.message)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedEmail.split("@")[0],
            company_name: preferredRole === "msme" ? "Enterprise Supplier" : "Innovative Startup",
            role: preferredRole,
          },
        },
      })

      if (signUpError) {
        return { success: false, error: signUpError.message }
      }

      // If signup returned session immediately
      if (signUpData.session && signUpData.user) {
        const user = await syncUserProfile(signUpData.user.id, trimmedEmail, preferredRole)
        return { success: true, user, userId: signUpData.user.id }
      }

      // Retry sign-in in case auto-confirm trigger activated
      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (!retryError && retryData.user && retryData.session) {
        const user = await syncUserProfile(retryData.user.id, trimmedEmail, preferredRole)
        return { success: true, user, userId: retryData.user.id }
      }

      return {
        success: false,
        error: retryError?.message || signInError.message || "Authentication pending verification",
      }
    }

    return { success: false, error: "Authentication failed" }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error during authentication",
    }
  }
}

/**
 * Fetch or upsert profile in public.profiles and cache user in localStorage
 */
async function syncUserProfile(
  userId: string,
  email: string,
  fallbackRole: RoleKey,
): Promise<GoogleAuthUser> {
  let profileRole: RoleKey = fallbackRole
  let fullName = email.split("@")[0] || "Executive"
  let companyName = fallbackRole === "msme" ? "Apex Precision Packaging" : "NovaBio Health"
  let city = fallbackRole === "msme" ? "Pune" : "Bengaluru"

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()

    if (profile) {
      profileRole = (profile.role as RoleKey) || fallbackRole
      fullName = profile.full_name || fullName
      companyName = profile.company_name || companyName
      city = profile.city || city
    } else {
      // Ensure profile exists
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        company_name: companyName,
        role: fallbackRole,
        city: city,
        verification_status: "Verified",
      })
    }
  } catch (err) {
    console.warn("[Auth] Profile sync warning:", err)
  }

  const activeUser: GoogleAuthUser = {
    id: userId,
    name: fullName,
    email,
    avatar: "https://lh3.googleusercontent.com/a/default-user",
    role: profileRole,
    orgName: companyName,
    city,
  }

  try {
    localStorage.setItem("mpi_active_user", JSON.stringify(activeUser))
    localStorage.setItem("mpi_user_role", profileRole)
  } catch {}

  return activeUser
}

/**
 * Sign out user from Supabase and clear local cache
 */
export async function signOutSupabase(): Promise<void> {
  try {
    await supabase.auth.signOut()
    localStorage.removeItem("mpi_active_user")
    localStorage.removeItem("mpi_user_role")
  } catch (err) {
    console.error("[Auth] Sign out error:", err)
  }
}

/**
 * Get currently authenticated Supabase user and verify session validity
 */
export async function getVerifiedSupabaseUser(): Promise<{
  isAuthenticated: boolean
  user: GoogleAuthUser | null
  userId: string | null
}> {
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) {
      return { isAuthenticated: false, user: null, userId: null }
    }

    const supaUser = data.session.user
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", supaUser.id)
      .maybeSingle()

    const role = (profile?.role as RoleKey) || (supaUser.user_metadata?.role as RoleKey) || "startup"
    const user: GoogleAuthUser = {
      id: supaUser.id,
      name: profile?.full_name || supaUser.user_metadata?.full_name || supaUser.email?.split("@")[0] || "User",
      email: supaUser.email || "",
      avatar: "https://lh3.googleusercontent.com/a/default-user",
      role,
      orgName: profile?.company_name || supaUser.user_metadata?.company_name || "Enterprise",
      city: profile?.city || "Bengaluru",
    }

    return { isAuthenticated: true, user, userId: supaUser.id }
  } catch {
    return { isAuthenticated: false, user: null, userId: null }
  }
}

