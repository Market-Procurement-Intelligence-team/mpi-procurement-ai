/**
 * Sign-up, sign-in and the signed-in person's own account (email only).
 *
 * At sign-up the database creates the person's organisation, profile and an
 * empty business profile, and gives the organisation its anonymous code
 * ("MPI Verified Buyer #004"). Admin accounts can never be chosen at sign-up.
 */

import type { Session } from "@supabase/supabase-js"
import { db } from "../../lib/db"
import type { Tables, TablesUpdate } from "../../lib/database.types"
import { check, toDataError, unwrap, unwrapMaybe } from "./errors"

export type AccountType = "startup" | "vendor"

export interface SignUpInput {
  email: string
  password: string
  accountType: AccountType
  orgName: string
  fullName?: string
}

export interface Me {
  userId: string
  email: string
  profile: Tables<"profiles">
  organisation: Tables<"organisations">
  startupDetails: Tables<"startup_details"> | null
  vendorDetails: Tables<"vendor_details"> | null
}

/** Creates an account. `needsEmailConfirmation` is true when Supabase sent a confirmation email. */
export async function signUp(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await db.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        account_type: input.accountType,
        org_name: input.orgName.trim(),
        full_name: input.fullName?.trim() || null,
      },
    },
  })
  if (error) throw toDataError(error)
  return { needsEmailConfirmation: !data.session }
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await db.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw toDataError(error)
  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await db.auth.signOut()
  if (error) throw toDataError(error)
}

/**
 * Emails a reset link. `redirectTo` is the page that opens from the link
 * (e.g. `${location.origin}/reset-password`); it must be listed under
 * Supabase > Authentication > URL Configuration > Redirect URLs.
 */
export async function sendPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const { error } = await db.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
  if (error) throw toDataError(error)
}

/**
 * Calls `callback` when the person arrives from a reset link: Supabase signs
 * them in for this purpose only, and the page should then ask for a new
 * password. Returns a function that stops listening.
 */
export function onPasswordRecovery(callback: () => void): () => void {
  const { data } = db.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") callback()
  })
  return () => data.subscription.unsubscribe()
}

/** Sets a new password for the signed-in person (after a reset link, or from their profile). */
export async function setNewPassword(password: string): Promise<void> {
  const { error } = await db.auth.updateUser({ password })
  if (error) throw toDataError(error)
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await db.auth.getSession()
  if (error) throw toDataError(error)
  return data.session
}

/** Calls `callback` whenever the person signs in or out. Returns a function that stops listening. */
export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = db.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

/** The signed-in person with their organisation and business profile, or null when signed out. */
export async function getMe(): Promise<Me | null> {
  const session = await getSession()
  if (!session) return null
  const userId = session.user.id

  const profile = unwrap(await db.from("profiles").select("*").eq("id", userId).single())
  const organisation = unwrap(await db.from("organisations").select("*").eq("id", profile.org_id).single())

  let startupDetails: Tables<"startup_details"> | null = null
  let vendorDetails: Tables<"vendor_details"> | null = null
  if (organisation.type === "startup") {
    startupDetails = unwrapMaybe(await db.from("startup_details").select("*").eq("org_id", organisation.id).maybeSingle())
  } else if (organisation.type === "vendor") {
    vendorDetails = unwrapMaybe(await db.from("vendor_details").select("*").eq("org_id", organisation.id).maybeSingle())
  }

  return { userId, email: session.user.email ?? profile.email ?? "", profile, organisation, startupDetails, vendorDetails }
}

export async function updateMyProfile(fields: Pick<TablesUpdate<"profiles">, "full_name" | "phone">): Promise<void> {
  const session = await getSession()
  if (!session) throw toDataError({ message: "session missing" })
  check(await db.from("profiles").update(fields).eq("id", session.user.id))
}

export async function updateMyOrganisation(
  orgId: string,
  fields: Pick<TablesUpdate<"organisations">, "name" | "gstin" | "udyam_number" | "city" | "state">,
): Promise<void> {
  check(await db.from("organisations").update(fields).eq("id", orgId))
}

export type StartupDetailsUpdate = Omit<TablesUpdate<"startup_details">, "org_id" | "updated_at">
export type VendorDetailsUpdate = Omit<TablesUpdate<"vendor_details">, "org_id" | "updated_at">

export async function updateStartupDetails(orgId: string, fields: StartupDetailsUpdate): Promise<void> {
  check(await db.from("startup_details").update(fields).eq("org_id", orgId))
}

export async function updateVendorDetails(orgId: string, fields: VendorDetailsUpdate): Promise<void> {
  check(await db.from("vendor_details").update(fields).eq("org_id", orgId))
}

/** Replaces the catalogue categories a supplier serves. */
export async function setVendorCategories(orgId: string, categoryIds: string[]): Promise<void> {
  const current = unwrap(await db.from("vendor_categories").select("category_id").eq("vendor_org_id", orgId))
  const have = new Set(current.map((c) => c.category_id))
  const want = new Set(categoryIds)

  const toRemove = [...have].filter((id) => !want.has(id))
  const toAdd = [...want].filter((id) => !have.has(id))

  if (toRemove.length) {
    check(await db.from("vendor_categories").delete().eq("vendor_org_id", orgId).in("category_id", toRemove))
  }
  if (toAdd.length) {
    check(await db.from("vendor_categories").insert(toAdd.map((category_id) => ({ vendor_org_id: orgId, category_id }))))
  }
}
