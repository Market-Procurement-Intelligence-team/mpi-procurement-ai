// ─────────────────────────────────────────────────────────────────────────
// Mock authentication layer for the MPI prototype.
//
// This is intentionally isolated from the UI (screens/Login.tsx) so that it
// can later be swapped for a real provider (e.g. Supabase Auth) by only
// changing the implementations below — the calling components only depend
// on these function signatures and the AuthResult shape.
// ─────────────────────────────────────────────────────────────────────────

export type RoleKey = "startup" | "msme" | "admin"

export interface AuthCredentials {
  email: string
  password: string
}

export interface AuthResult {
  success: boolean
  error?: string
}

export interface RegisterFields {
  name: string
  orgName: string
  email: string
  password: string
  confirmPassword: string
}

export type LoginErrors = Partial<Record<"email" | "password", string>>
export type RegisterErrors = Partial<Record<keyof RegisterFields, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

export const ADMIN_CONFIG = {
  username: "admin",
  path: "/1982/admin",
}

const ADMIN_SESSION_STORAGE_KEY = "mpi_admin_authenticated"

export function getAdminSession(): boolean {
  try {
    return (
      sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === "true" ||
      localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === "true"
    )
  } catch {
    return false
  }
}

export function setAdminSession(authenticated: boolean): void {
  try {
    if (authenticated) {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "true")
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "true")
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
    }
  } catch {
    // Ignore storage restrictions
  }
}

/**
 * Auto-detect user role (startup, msme, or admin) from login ID / email.
 */
export function detectRoleFromLoginId(loginId: string): RoleKey {
  const id = loginId.trim().toLowerCase()

  // 1. Admin detection
  if (id === "admin" || id.includes("admin") || id.startsWith("adm_")) {
    return "admin"
  }

  // 2. Check if user already registered or saved in localStorage
  try {
    const activeUserStr = localStorage.getItem("mpi_active_user")
    if (activeUserStr) {
      const activeUser = JSON.parse(activeUserStr)
      if (activeUser.email?.toLowerCase() === id && activeUser.role) {
        return activeUser.role as RoleKey
      }
    }
    const msmeReg = localStorage.getItem("mpi_registered_msme_email")
    if (msmeReg && msmeReg.toLowerCase() === id) {
      return "msme"
    }
    const startupReg = localStorage.getItem("mpi_registered_startup_email")
    if (startupReg && startupReg.toLowerCase() === id) {
      return "startup"
    }
  } catch {
    // Ignore storage restrictions
  }

  // 3. MSME keywords or known MSME supplier domains/names
  const msmeKeywords = [
    "msme",
    "supplier",
    "vendor",
    "mfg",
    "factory",
    "apex",
    "precision",
    "industries",
    "packaging",
    "director@apexprecision.in",
  ]
  if (msmeKeywords.some((kw) => id.includes(kw))) {
    return "msme"
  }

  // 4. Default to Startup / Buyer
  return "startup"
}

export function validateLoginForm(
  email: string,
  password: string,
  role?: RoleKey,
): LoginErrors {
  const errors: LoginErrors = {}
  const trimmed = email.trim()
  if (!trimmed) {
    errors.email = role === "admin" ? "Username or email is required" : "Email is required"
  } else if (role !== "admin" && !validateEmail(trimmed)) {
    errors.email = "Enter a valid email address"
  }
  if (!password) {
    errors.password = "Password is required"
  }
  return errors
}

export function validateRegisterForm(
  fields: RegisterFields,
  orgLabel: string,
  nameLabel: string,
): RegisterErrors {
  const errors: RegisterErrors = {}
  if (!fields.name.trim()) errors.name = `${nameLabel} is required`
  if (!fields.orgName.trim()) errors.orgName = `${orgLabel} is required`
  if (!fields.email.trim()) {
    errors.email = "Email is required"
  } else if (!validateEmail(fields.email)) {
    errors.email = "Enter a valid email address"
  }
  if (!fields.password) {
    errors.password = "Password is required"
  } else if (fields.password.length < 6) {
    errors.password = "Password must be at least 6 characters"
  }
  if (fields.confirmPassword !== fields.password) {
    errors.confirmPassword = "Passwords do not match"
  }
  return errors
}

// Simulated network delay so the UI can show a realistic "signing in" state.
const MOCK_DELAY_MS = 550

/**
 * Mock login call. Validates role credentials.
 * For admin, validates username: "admin" and password: "bhavesh@123".
 */
export function mockLogin(
  role: RoleKey,
  credentials: AuthCredentials,
): Promise<AuthResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (role === "admin") {
        const enteredUser = credentials.email.trim().toLowerCase()
        const enteredPass = credentials.password
        const isValidUser =
          enteredUser === "admin" ||
          enteredUser === "admin@mpi.gov.in" ||
          enteredUser === "admin@mpi.org"

        const expectedPass =
          (typeof import.meta !== "undefined" && import.meta.env?.VITE_ADMIN_PASSWORD) ||
          (typeof import.meta !== "undefined" && import.meta.env?.DEV ? "AdminDev@2026" : "")

        const isValidPass = Boolean(expectedPass && enteredPass === expectedPass)

        if (isValidUser && isValidPass) {
          setAdminSession(true)
          resolve({ success: true })
        } else {
          resolve({
            success: false,
            error: "Invalid admin credentials. Please verify your administrative authorization.",
          })
        }
        return
      }

      resolve({ success: true })
    }, MOCK_DELAY_MS)
  })
}

/**
 * Mock registration call. Always succeeds for the prototype — replace with a
 * real Supabase Auth sign-up call when the backend is ready.
 */
export function mockRegister(
  _role: Exclude<RoleKey, "admin">,
  _fields: RegisterFields,
): Promise<AuthResult> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ success: true }), MOCK_DELAY_MS)
  })
}

export interface GoogleAuthUser {
  id?: string
  name: string
  email: string
  avatar: string
  role?: RoleKey
  orgName?: string
  city?: string
}

/**
 * Mock Google Authentication provider with realistic profile payload.
 */
export function mockGoogleAuth(role?: RoleKey): Promise<{ success: boolean; user: GoogleAuthUser }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const email = role === "msme" ? "director@apexprecision.in" : "founder@novabio.tech"
      const name = role === "msme" ? "Rajesh Sharma" : "Aarav Mehta"
      const orgName = role === "msme" ? "Apex Precision Engineering" : "NovaBio Health"
      const user: GoogleAuthUser = {
        name,
        email,
        avatar: "https://lh3.googleusercontent.com/a/default-user",
        role: role || "startup",
        orgName,
      }
      try {
        localStorage.setItem("mpi_active_user", JSON.stringify(user))
        localStorage.setItem("mpi_user_role", role || "startup")
      } catch {
        // Ignore storage exceptions
      }
      resolve({ success: true, user })
    }, 600)
  })
}

/**
 * Retrieve the active stored user session if available.
 */
export function getActiveUser(): GoogleAuthUser | null {
  try {
    const raw = localStorage.getItem("mpi_active_user")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Log out active session across all roles.
 */
export function logoutUser(): void {
  try {
    localStorage.removeItem("mpi_active_user")
    localStorage.removeItem("mpi_user_role")
    sessionStorage.removeItem("mpi_admin_authenticated")
    localStorage.removeItem("mpi_admin_authenticated")
  } catch {}
}


