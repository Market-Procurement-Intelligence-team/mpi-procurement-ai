/**
 * MPI Production Session & User Journey Manager
 * 
 * Provides centralized session state resolution, role-based access control (RBAC),
 * safe return-path context preservation, and duplicate action mitigation.
 */

import { Screen } from "../App"
import { RoleKey, GoogleAuthUser } from "./mockAuth"
import { supabase } from "./supabaseClient"
import { checkIdempotentExecution, recordIdempotentExecution, createApiSuccess } from "./apiContract"
import { trackTelemetryEvent, TelemetryEventType } from "../services/telemetryService"

export interface PendingActionContext {
  id: string
  targetScreen: Screen
  actionType:
    | "start_mpi"
    | "run_rfq"
    | "launch_workspace"
    | "request_quote"
    | "match_schemes"
    | "register_msme"
    | "experience_intake"
    | "inspect_suppliers"
    | "view_bidding"
    | "explore_savings"
    | "catalog_quote"
    | "ask_ai"
    | "custom"
  requiredRole?: RoleKey
  productContext?: {
    id: string
    name: string
    category: string
    specifications?: string[]
    targetPrice?: number
    image?: string
  }
  procurementContext?: {
    requirementText?: string
    category?: string
    quantity?: number
    targetBudget?: number
  }
  origin: string
  createdAt: number
}

const PENDING_ACTION_STORAGE_KEY = "mpi_pending_procurement_action"

// Memory cache for quick synchronous lookups
let inMemoryPendingAction: PendingActionContext | null = null

// ─── 1. USER SESSION MANAGEMENT ───────────────────────────────────────────────

/**
 * Returns the currently active authenticated user or null.
 */
export function getActiveUser(): GoogleAuthUser | null {
  try {
    const raw = localStorage.getItem("mpi_active_user")
    if (raw) {
      return JSON.parse(raw) as GoogleAuthUser
    }
  } catch (err) {
    console.error("[SessionManager] Failed to read active user from localStorage", err)
  }
  return null
}

/**
 * Checks whether an active user session exists.
 */
export function isAuthenticated(): boolean {
  try {
    // Check local active user
    const user = getActiveUser()
    if (user && user.email) return true

    // Check admin session
    const adminAuth =
      sessionStorage.getItem("mpi_admin_authenticated") === "true" ||
      localStorage.getItem("mpi_admin_authenticated") === "true"
    if (adminAuth) return true
  } catch {
    return false
  }
  return false
}

/**
 * Resolves the role of the currently active user.
 */
export function getUserRole(): RoleKey | null {
  const user = getActiveUser()
  if (user && user.role) {
    return user.role
  }
  if (
    sessionStorage.getItem("mpi_admin_authenticated") === "true" ||
    localStorage.getItem("mpi_admin_authenticated") === "true"
  ) {
    return "admin"
  }
  try {
    const fallbackRole = localStorage.getItem("mpi_user_role") as RoleKey | null
    if (fallbackRole) return fallbackRole
  } catch {}
  return null
}

/**
 * Checks if the user's business profile is marked complete.
 */
export function isProfileComplete(role: RoleKey): boolean {
  try {
    if (role === "startup") {
      const profileRaw = localStorage.getItem("mpi_startup_profile")
      if (profileRaw) {
        const p = JSON.parse(profileRaw)
        return Boolean(p.startupName && p.procurementCategories?.length)
      }
    } else if (role === "msme") {
      const profileRaw = localStorage.getItem("mpi_msme_profile")
      if (profileRaw) {
        const p = JSON.parse(profileRaw)
        return Boolean(p.enterpriseName && p.udyamNumber)
      }
    } else if (role === "admin") {
      return true
    }
  } catch {}
  return false
}

// ─── 2. ROLE-BASED ACCESS CONTROL (RBAC) ──────────────────────────────────────

export interface RoleAccessCheck {
  allowed: boolean
  currentRole: RoleKey | null
  requiredRole?: RoleKey
  reason?: "unauthenticated" | "role_mismatch" | "permitted"
}

/**
 * Validates whether the current active user can access an action/route reserved for a specific role.
 */
export function checkRoleAccess(requiredRole?: RoleKey): RoleAccessCheck {
  if (!requiredRole) {
    return { allowed: true, currentRole: getUserRole(), reason: "permitted" }
  }

  if (!isAuthenticated()) {
    return {
      allowed: false,
      currentRole: null,
      requiredRole,
      reason: "unauthenticated",
    }
  }

  const currentRole = getUserRole()
  if (currentRole === requiredRole || currentRole === "admin") {
    return { allowed: true, currentRole, requiredRole, reason: "permitted" }
  }

  return {
    allowed: false,
    currentRole,
    requiredRole,
    reason: "role_mismatch",
  }
}

// ─── 3. SAFE RETURN-PATH CONTEXT PRESERVATION ──────────────────────────────────

/**
 * Saves a pending action and context before interrupting the flow with authentication.
 */
export function savePendingAction(
  action: Omit<PendingActionContext, "id" | "createdAt">,
): PendingActionContext {
  const pending: PendingActionContext = {
    ...action,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  }

  inMemoryPendingAction = pending

  try {
    sessionStorage.setItem(PENDING_ACTION_STORAGE_KEY, JSON.stringify(pending))
  } catch (err) {
    console.warn("[SessionManager] Could not write pending action to sessionStorage", err)
  }

  logUserJourney("ACTION_PRESERVED", {
    actionType: pending.actionType,
    targetScreen: pending.targetScreen,
    hasProduct: Boolean(pending.productContext),
  })

  return pending
}

/**
 * Retrieves the preserved pending action if valid (TTL: 30 minutes).
 */
export function getPendingAction(): PendingActionContext | null {
  if (inMemoryPendingAction) {
    if (Date.now() - inMemoryPendingAction.createdAt < 30 * 60 * 1000) {
      return inMemoryPendingAction
    }
    inMemoryPendingAction = null
  }

  try {
    const raw = sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PendingActionContext
      if (Date.now() - parsed.createdAt < 30 * 60 * 1000) {
        inMemoryPendingAction = parsed
        return parsed
      }
      clearPendingAction()
    }
  } catch {}

  return null
}

/**
 * Clears any preserved pending action once fulfilled.
 */
export function clearPendingAction(): void {
  inMemoryPendingAction = null
  try {
    sessionStorage.removeItem(PENDING_ACTION_STORAGE_KEY)
  } catch {}
}

/**
 * Checks whether a pending action is currently queued.
 */
export function hasPendingAction(): boolean {
  return Boolean(getPendingAction())
}

// ─── 4. LOGOUT & SESSION RESET ────────────────────────────────────────────────

/**
 * Cleanly logs out the active user and clears local session cache.
 */
export async function logoutUserSession(): Promise<void> {
  try {
    // Attempt Supabase sign out if connected
    await supabase.auth.signOut().catch(() => {})
  } catch {}

  try {
    localStorage.removeItem("mpi_active_user")
    localStorage.removeItem("mpi_user_role")
    sessionStorage.removeItem("mpi_admin_authenticated")
    localStorage.removeItem("mpi_admin_authenticated")
    clearPendingAction()
  } catch {}

  logUserJourney("USER_LOGGED_OUT")
}

// ─── 5. USER JOURNEY DEVELOPMENT LOGGER ───────────────────────────────────────

/**
 * Lightweight, non-intrusive logging for tracking CTA journeys in development.
 */
export function logUserJourney(event: string, meta?: Record<string, unknown>): void {
  if (typeof window !== "undefined" && (import.meta as any).env?.DEV) {
    const timestamp = new Date().toLocaleTimeString()
    console.info(`%c[MPI Journey ${timestamp}] ${event}`, "color: #10B981; font-weight: bold;", meta || "")
  }

  // Bridge known funnel transitions into privacy-safe telemetry
  const telemetryMapping: Record<string, TelemetryEventType> = {
    CTA_CLICKED: "cta_rfq_clicked",
    AUTH_SIGNIN_SUCCESS: "signup_completed",
  }

  const mapped = telemetryMapping[event]
  if (mapped) {
    const safeMeta: Record<string, string | number | boolean | null> = {}
    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean" ||
          v === null
        ) {
          safeMeta[k] = v
        }
      }
    }
    trackTelemetryEvent(mapped, safeMeta)
  }
}

// ─── 6. DUPLICATE ACTION MITIGATION ──────────────────────────────────────────

/**
 * Guards critical user actions from double clicks and duplicate submissions.
 */
export function executeGuardedAction<T>(
  actionKey: string,
  fn: () => T,
): { executed: boolean; result?: T } {
  const idempotency = checkIdempotentExecution<T>(actionKey)
  if (idempotency.exists) {
    logUserJourney("DUPLICATE_ACTION_BLOCKED", { actionKey })
    return { executed: false, result: idempotency.cachedResponse?.data ?? undefined }
  }

  const result = fn()
  recordIdempotentExecution(actionKey, createApiSuccess(result))
  return { executed: true, result }
}
