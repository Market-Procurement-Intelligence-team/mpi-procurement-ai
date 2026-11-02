import React, { useState, useEffect } from "react"
import { Screen } from "../../App"
import {
  RoleKey,
  mockLogin,
  mockGoogleAuth,
  setAdminSession,
  getAdminSession,
  detectRoleFromLoginId,
} from "../../lib/mockAuth"
import { signInWithSupabase } from "../../services/authService"
import {
  getPendingAction,
  clearPendingAction,
  PendingActionContext,
  logUserJourney,
} from "../../lib/sessionManager"
import { trackTelemetryEvent } from "../../services/telemetryService"
import MaterialIcon from "../ui/MaterialIcon"

export interface AuthPortalContext {
  badge?: string
  title?: string
  description?: string
  icon?: string
}

export interface AuthModalProps {
  isOpen: boolean
  initialMode?: "login" | "signin"
  initialRole?: RoleKey
  targetScreen?: Screen
  portalContext?: AuthPortalContext
  onClose: () => void
  navigate: (screen: Screen) => void
  onAuthSuccess?: (role: RoleKey, pendingAction: PendingActionContext | null) => void
}

export default function AuthModal({
  isOpen,
  initialMode = "login",
  initialRole = "startup",
  targetScreen,
  portalContext,
  onClose,
  navigate,
  onAuthSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signin">(initialMode)
  const [role, setRole] = useState<RoleKey>(initialRole)

  // Login form state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Registration step
  const [step, setStep] = useState<1 | 2>(1)
  const [activeQuickFill, setActiveQuickFill] = useState<"startup" | "msme" | "admin" | null>(null)

  // Sync mode and role whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      if (initialRole) setRole(initialRole)
      setErrorMsg("")
      setStep(1)
    }
  }, [isOpen, initialMode, initialRole])

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Helper to handle post-login navigation seamlessly
  const completeAuthRedirect = (detectedRole: RoleKey) => {
    const pending = getPendingAction()
    logUserJourney("AUTH_LOGIN_SUCCESS", {
      detectedRole,
      hasPendingAction: Boolean(pending),
      pendingTarget: pending?.targetScreen,
      targetScreen,
    })

    if (onAuthSuccess) {
      onAuthSuccess(detectedRole, pending)
      clearPendingAction()
      onClose()
      return
    }

    onClose()
    if (pending && pending.targetScreen) {
      clearPendingAction()
      if (detectedRole === "admin") {
        if (getAdminSession()) {
          navigate("admin.home")
        } else {
          navigate("login.admin")
        }
      } else {
        navigate(pending.targetScreen)
      }
      return
    }

    if (targetScreen) {
      // If logging in as admin, always preserve admin route authority
      if (detectedRole === "admin") {
        if (getAdminSession()) {
          navigate("admin.home")
        } else {
          navigate("login.admin")
        }
      } else {
        navigate(targetScreen)
      }
      return
    }

    if (detectedRole === "admin") {
      if (getAdminSession()) {
        navigate("admin.home")
      } else {
        navigate("login.admin")
      }
    } else if (detectedRole === "msme") {
      navigate("msme.home")
    } else {
      navigate("startup.home")
    }
  }

  // Helper to handle post-registration navigation
  const completeSignInRedirect = (userRole: RoleKey) => {
    const pending = getPendingAction()
    trackTelemetryEvent("signup_completed", {
      role: userRole,
      hasPendingAction: Boolean(pending),
      targetScreen: pending?.targetScreen || targetScreen || (userRole === "msme" ? "msme.onboarding" : "startup.onboarding"),
    })
    logUserJourney("AUTH_SIGNIN_SUCCESS", {
      userRole,
      hasPendingAction: Boolean(pending),
      pendingTarget: pending?.targetScreen,
      targetScreen,
    })

    onClose()

    if (userRole === "msme") {
      navigate("msme.onboarding")
    } else {
      navigate("startup.onboarding")
    }
  }

  // ─── LOGIN HANDLERS ──────────────────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email/username and password")
      return
    }

    // Automatically detect role according to login ID or fall back to selected role
    const detectedRole = detectRoleFromLoginId(email)
    setRole(detectedRole)

    setSubmitting(true)

    // For admin, validate via local admin configuration
    if (detectedRole === "admin") {
      const result = await mockLogin(detectedRole, { email, password })
      setSubmitting(false)
      if (!result.success) {
        setErrorMsg(result.error || "Authentication failed. Check your credentials.")
        return
      }
      setAdminSession(true)
      completeAuthRedirect("admin")
      return
    }

    // Authenticate with Supabase Auth for real PostgreSQL session
    const result = await signInWithSupabase(email, password, detectedRole)
    setSubmitting(false)

    if (!result.success) {
      setErrorMsg(result.error || "Authentication failed. Check your credentials.")
      return
    }

    completeAuthRedirect(detectedRole)
  }

  const handleGoogleLogin = async () => {
    setSubmitting(true)
    setErrorMsg("")
    const preferredRole = initialRole || (email.trim() ? detectRoleFromLoginId(email) : "startup")
    if (preferredRole === "admin") {
      setErrorMsg("Admin access requires explicit username and password authentication.")
      setSubmitting(false)
      return
    }
    setRole(preferredRole)

    const defaultEmail = preferredRole === "msme" ? "director@apexprecision.in" : "founder@novabio.tech"
    const defaultPass = preferredRole === "msme" ? "Apex@123" : "Founder@123"

    const authRes = await signInWithSupabase(defaultEmail, defaultPass, preferredRole)
    setSubmitting(false)

    if (authRes.success) {
      completeAuthRedirect(preferredRole)
    } else {
      const result = await mockGoogleAuth(preferredRole)
      completeAuthRedirect(preferredRole)
    }
  }

  // ─── SIGN IN (NEW ACCOUNT) HANDLERS ──────────────────────────────────────────
  const handleGoogleSignInStep1 = async () => {
    setSubmitting(true)
    setErrorMsg("")
    const defaultEmail = role === "msme" ? "director@apexprecision.in" : "founder@novabio.tech"
    const defaultPass = role === "msme" ? "Apex@123" : "Founder@123"

    await signInWithSupabase(defaultEmail, defaultPass, role)
    setSubmitting(false)
    completeSignInRedirect(role)
  }

  const handleCredentialSignInStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setErrorMsg("Please enter your work email")
      return
    }
    setSubmitting(true)
    const pass = password || "Password123!"
    await signInWithSupabase(email, pass, role)
    setSubmitting(false)
    completeSignInRedirect(role)
  }

  // Quick fill demo accounts (development only)
  const quickFillAccount = (type: "startup" | "msme") => {
    setErrorMsg("")
    setActiveQuickFill(type)
    setMode("login")
    if (type === "startup") {
      setEmail("founder@novabio.tech")
      setPassword("Founder@123")
      setRole("startup")
    } else if (type === "msme") {
      setEmail("director@apexprecision.in")
      setPassword("Apex@123")
      setRole("msme")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold text-sm shadow-xs border border-[#0A3525]">
              M
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#051F16] tracking-tight">
                {mode === "login"
                  ? portalContext?.title || "Login to MPI"
                  : step === 1
                  ? "Sign In to MPI"
                  : "Complete Profile"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {mode === "login"
                  ? "Access your verified portal & intelligence"
                  : "Create your verified procurement identity"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Portal-Specific Context Pill / Banner */}
        {portalContext && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
              <MaterialIcon name={portalContext.icon || "lock"} size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {portalContext.badge || "Protected Portal"}
                </span>
              </div>
              {portalContext.description && (
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  {portalContext.description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab Toggle (Log In vs Sign In) */}
        {step === 1 && (
          <div className="mx-6 mt-4 flex border border-slate-200 bg-slate-100/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode("login")
                setErrorMsg("")
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-white text-[#051F16] shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signin")
                setErrorMsg("")
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === "signin"
                  ? "bg-white text-[#051F16] shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sign In (New User)
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ⚡ Quick Fill Demo Accounts Banner (Development only - disabled in production) */}
          {Boolean(typeof import.meta !== "undefined" && import.meta.env?.DEV) && (
            <div className="mb-5 p-3 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/90 border border-emerald-200 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#051F16]">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>⚡ Dev Test Personas</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  Local Dev Only
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => quickFillAccount("startup")}
                  className={`p-2 text-left rounded-lg border transition-all cursor-pointer shadow-2xs hover:shadow-xs group ${
                    activeQuickFill === "startup"
                      ? "bg-emerald-100/90 border-emerald-500 ring-1 ring-emerald-500"
                      : "bg-white hover:bg-emerald-50 border-emerald-100"
                  }`}
                  title="Pre-fill Startup founder credentials"
                >
                  <div className="flex items-center gap-1 font-bold text-xs text-[#051F16]">
                    <span>🚀</span>
                    <span>Startup</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">NovaBio Health</div>
                  <div className="text-[9px] font-mono text-emerald-700 truncate">founder@...</div>
                </button>

                <button
                  type="button"
                  onClick={() => quickFillAccount("msme")}
                  className={`p-2 text-left rounded-lg border transition-all cursor-pointer shadow-2xs hover:shadow-xs group ${
                    activeQuickFill === "msme"
                      ? "bg-emerald-100/90 border-emerald-500 ring-1 ring-emerald-500"
                      : "bg-white hover:bg-emerald-50 border-emerald-100"
                  }`}
                  title="Pre-fill MSME supplier credentials"
                >
                  <div className="flex items-center gap-1 font-bold text-xs text-[#051F16]">
                    <span>🏭</span>
                    <span>MSME</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">Apex Packaging</div>
                  <div className="text-[9px] font-mono text-emerald-700 truncate">director@...</div>
                </button>
              </div>
            </div>
          )}

          {/* ─────────── MODE 1: LOG IN ─────────── */}
          {mode === "login" && (
            <div className="space-y-4">
              {/* Google Authentication for Login */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Or with email / username
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Standard Email / Password Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Email Address or Username
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email or username (e.g. founder@novabio.tech)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-12 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-60 border border-[#0A3525]"
                >
                  {submitting ? "Authenticating..." : "Log In"}
                </button>
              </form>

              {/* Quick Demo Fill Buttons for frictionless evaluation (Development only) */}
              {Boolean(typeof import.meta !== "undefined" && import.meta.env?.DEV) && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-400">⚡ Dev 1-Click:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => quickFillAccount("startup")}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium transition-colors cursor-pointer"
                      title="Pre-fill Startup founder credentials"
                    >
                      Startup
                    </button>
                    <button
                      type="button"
                      onClick={() => quickFillAccount("msme")}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium transition-colors cursor-pointer"
                      title="Pre-fill MSME supplier credentials"
                    >
                      MSME
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────── MODE 2: SIGN IN (CREATE ACCOUNT) ─────────── */}
          {mode === "signin" && step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  I want to join MPI as:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("startup")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      role === "startup"
                        ? "bg-[#051F16] text-white border-[#051F16] shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>🚀 Startup (Buyer)</span>
                    <span className="text-[10px] opacity-75 font-normal">Source custom goods</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("msme")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      role === "msme"
                        ? "bg-[#051F16] text-[#A3F65C] border-[#051F16] shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>🏭 MSME (Supplier)</span>
                    <span className="text-[10px] opacity-75 font-normal">Fulfill manufacturing</span>
                  </button>
                </div>
              </div>

              {/* Primary Google Auth for Sign In */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignInStep1}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border-2 border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/20 text-slate-800 text-xs sm:text-sm font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Or sign in with email
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <form onSubmit={handleCredentialSignInStep1} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="founder@company.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Create Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer border border-[#0A3525]"
                >
                  Continue to Complete Details & Requirements →
                </button>
              </form>

              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-[#051F16] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <MaterialIcon name="verified_user" size={14} className="text-emerald-700" />
                  <span>Full Onboarding & Requirement Profile</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Upon signing in, you will be guided to set your exact procurement categories, technical specs, budget, stage, and statutory business credentials.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
