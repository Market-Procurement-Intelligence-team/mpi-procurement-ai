import { useState, SyntheticEvent, ReactNode } from "react"
import { NavProps, Screen } from "../App"
import { MPILogo } from "../components/shared"
import {
  RoleKey,
  RegisterFields,
  validateLoginForm,
  validateRegisterForm,
  mockLogin,
  mockRegister,
  mockGoogleAuth,
  setAdminSession,
} from "../lib/mockAuth"

interface RoleMeta {
  label: string
  shortLabel: string
  sub: string
  desc: string
  color: string
  bg: string
  softBg: string
  icon: ReactNode
  panelTitle: string
  panelCopy: string
  panelPoints: string[]
}

const ROLE_META: Record<RoleKey, RoleMeta> = {
  startup: {
    label: "Startup / Buyer",
    shortLabel: "Startup",
    sub: "Buyers & Procurers",
    desc: "Find verified MPI suppliers, compare quotes, and generate decision-ready RFQs.",
    color: "#051F16",
    bg: "#FAFAFC",
    softBg: "#ECFDF5",
    panelTitle: "Turn specifications into verified procurement.",
    panelCopy:
      "Use MPI AI to convert natural-language project needs into verified MSME matches, automated quote comparisons, and structured RFQs.",
    panelPoints: [
      "AI-assisted supplier discovery",
      "Automated specification extraction",
      "Structured quote comparison matrix",
    ],
    icon: (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
        <path
          d="M14 4L22 9V19L14 24L6 19V9L14 4Z"
          stroke="#051F16"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M14 4V24M6 9L22 9M6 19L22 19"
          stroke="#A3F65C"
          strokeWidth="1.4"
          strokeDasharray="2 2"
        />
        <circle cx="14" cy="14" r="3" fill="#051F16" />
      </svg>
    ),
  },
  msme: {
    label: "MSME / Supplier",
    shortLabel: "MSME",
    sub: "Manufacturers & Providers",
    desc: "Manage your verified profile, showcase capabilities, and respond to high-intent opportunities.",
    color: "#051F16",
    bg: "#FAFAFC",
    softBg: "#F0FDF4",
    panelTitle: "Make your production capacity discoverable.",
    panelCopy:
      "Showcase your machinery, earn the MPI Verified trust badge, and receive matched procurement inquiries from ambitious startups.",
    panelPoints: [
      "Verified trust credentialing",
      "Direct inquiry matching",
      "Transparent proposal pipeline",
    ],
    icon: (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
        <rect
          x="4"
          y="10"
          width="20"
          height="14"
          rx="2"
          stroke="#051F16"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M9 10V7C9 5.34 11.24 4 14 4C16.76 4 19 5.34 19 7V10"
          stroke="#051F16"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="14" cy="17" r="2.5" fill="#A3F65C" />
      </svg>
    ),
  },
  admin: {
    label: "Platform Admin",
    shortLabel: "Admin",
    sub: "Platform Governance",
    desc: "Manage verification queues, review algorithm matches, and oversee ecosystem integrity.",
    color: "#0F172A",
    bg: "#F8FAFC",
    softBg: "#F1F5F9",
    panelTitle: "Ecosystem governance at a glance.",
    panelCopy:
      "Audit verification requests, monitor matching algorithm precision, and maintain procurement dispute-free transparency.",
    panelPoints: [
      "Supplier statutory audit queue",
      "Real-time algorithm monitoring",
      "Ecosystem macro analytics",
    ],
    icon: (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
        <rect
          x="4"
          y="4"
          width="8"
          height="8"
          rx="2"
          fill="#64748B"
          opacity="0.6"
        />
        <rect x="16" y="4" width="8" height="8" rx="2" fill="#64748B" />
        <rect x="4" y="16" width="8" height="8" rx="2" fill="#64748B" />
        <rect x="16" y="16" width="8" height="8" rx="2" fill="#0F172A" />
      </svg>
    ),
  },
}

const ROLE_POST_LOGIN: Record<RoleKey, Screen> = {
  startup: "startup.home",
  msme: "msme.home",
  admin: "admin.home",
}

function isRoleKey(value: string): value is RoleKey {
  return value === "startup" || value === "msme" || value === "admin"
}

function FieldShell({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>
      )}
    </div>
  )
}

const inputClass = (hasError?: string) =>
  `w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#051F16] focus:ring-2 focus:ring-emerald-100 bg-white ${
    hasError ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"
  }`

function RoleTabs({
  activeRole,
  navigate,
}: {
  activeRole: RoleKey
  navigate: NavProps["navigate"]
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3"
      aria-label="Choose your MPI role"
    >
      {(Object.keys(ROLE_META) as RoleKey[]).map((key) => {
        const meta = ROLE_META[key]
        const active = key === activeRole
        return (
          <button
            key={key}
            type="button"
            onClick={() => navigate(`login.${key}` as Screen)}
            className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg border text-center transition-all ${
              active
                ? "bg-slate-900 text-white border-slate-900 shadow-xs font-semibold"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="text-xs font-bold">{meta.shortLabel}</span>
            <span className="text-[10px] text-slate-400 leading-none">
              {meta.sub.split("&")[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PortalShell({
  navigate,
  goBack,
  children,
  wide = false,
}: {
  navigate: NavProps["navigate"]
  children: ReactNode
  wide?: boolean
  goBack?: () => void
  canGoBack?: boolean
}) {
  return (
    <div className="min-h-screen animated-gradient flex flex-col font-sans">
      <nav className="glass-nav sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("home")}
            className="hover:opacity-85 transition-opacity text-left cursor-pointer"
          >
            <MPILogo small />
          </button>
          {goBack && (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
              title="Go back"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Back</span>
            </button>
          )}
        </div>
        <button
          onClick={() => navigate("home")}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          🏠 Return to Marketplace
        </button>
      </nav>
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div
          className={`w-full ${
            wide ? "max-w-5xl" : "max-w-md"
          } animate-fade-in-up`}
        >
          {children}
        </div>
      </main>
    </div>
  )
}

function LoginCard({
  role,
  navigate,
  goBack,
  canGoBack,
}: {
  role: RoleKey
  navigate: NavProps["navigate"]
  goBack: () => void
  canGoBack?: boolean
}) {
  const meta = ROLE_META[role]
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [showForgotNote, setShowForgotNote] = useState(false)

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    const validationErrors = validateLoginForm(email, password, role)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    const result = await mockLogin(role, { email, password })
    setSubmitting(false)

    if (!result.success) {
      setErrors({ password: result.error || "Authentication failed." })
      return
    }

    if (role === "admin") {
      setAdminSession(true)
    }
    navigate(ROLE_POST_LOGIN[role])
  }

  const handleGoogleLogin = async () => {
    setSubmitting(true)
    const result = await mockGoogleAuth(role)
    setSubmitting(false)
    if (result.success) {
      if (role === "admin") {
        setAdminSession(true)
      }
      navigate(ROLE_POST_LOGIN[role])
    }
  }

  return (
    <PortalShell navigate={navigate} wide goBack={goBack} canGoBack={canGoBack}>
      <section className="grid grid-cols-1 md:grid-cols-12 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Left Side: Enterprise Visual & Value Prop */}
        <div className="md:col-span-5 p-8 bg-slate-900 text-white flex flex-col justify-between border-r border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              MPI {meta.shortLabel} Portal
            </div>

            <h2
              className="text-2xl font-bold mt-6 tracking-tight text-white"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              {meta.panelTitle}
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {meta.panelCopy}
            </p>

            <div className="mt-8 space-y-3">
              {meta.panelPoints.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-2.5 text-xs text-slate-300 font-medium"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-emerald-400 shrink-0"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="7"
                      fill="#1E293B"
                      stroke="#334155"
                    />
                    <path
                      d="M5 8L7 10L11 6"
                      stroke="#A3F65C"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 mt-8">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Production verified environment</span>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:col-span-7 p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h1
              className="text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              Sign In
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Select your access role and enter your credentials.
            </p>
          </div>

          <RoleTabs activeRole={role} navigate={navigate} />

          <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>{meta.desc}</span>
          </div>

          {/* Google Auth Button on Login */}
          {role !== "admin" && (
            <div className="mt-6">
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

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Or continue with credentials
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-2" noValidate>
            <FieldShell
              label={role === "admin" ? "Admin Username" : "Business Email"}
              error={errors.email}
            >
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === "admin" ? "Enter admin username" : "you@company.com"}
                className={inputClass(errors.email)}
                autoComplete="username"
              />
            </FieldShell>

            <FieldShell label="Password" error={errors.password}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass(errors.password)} pr-16`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </FieldShell>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900"
                />
                <span>Remember this workstation</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotNote(true)}
                className="font-semibold text-emerald-700 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {showForgotNote && (
              <div className="text-xs text-slate-600 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 animate-fade-in">
                Password recovery instructions will be sent to your registered organization email.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#051F16] hover:bg-[#083A28] text-white flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <span>
                {submitting ? "Authenticating…" : `Enter as ${meta.shortLabel}`}
              </span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 3L11 8L6 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>

          {role !== "admin" ? (
            <p className="text-center text-xs text-slate-500 mt-6 pt-4 border-t border-slate-100">
              New to the platform?{" "}
              <button
                onClick={() => navigate(`register.${role}` as Screen)}
                className="font-semibold text-emerald-700 hover:underline ml-1"
              >
                Create an account →
              </button>
            </p>
          ) : (
            <p className="text-center text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100">
              Admin credentials are provisioned exclusively through platform
              operations.
            </p>
          )}
        </div>
      </section>
    </PortalShell>
  )
}

type RegistrableRole = "startup" | "msme"

function RegisterCard({
  role,
  navigate,
  goBack,
  canGoBack,
}: {
  role: RegistrableRole
  navigate: NavProps["navigate"]
  goBack: () => void
  canGoBack?: boolean
}) {
  const meta = ROLE_META[role]
  const nameLabel =
    role === "startup" ? "Founder / Contact Name" : "Authorized Representative"
  const orgLabel =
    role === "startup" ? "Startup Organization" : "MSME Business Entity"

  const [name, setName] = useState("")
  const [orgName, setOrgName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] =
    useState<Partial<Record<keyof RegisterFields, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    const fields: RegisterFields = {
      name,
      orgName,
      email,
      password,
      confirmPassword,
    }
    const validationErrors = validateRegisterForm(fields, orgLabel, nameLabel)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    await mockRegister(role, fields)
    setSubmitting(false)
    setSuccess(true)
    setTimeout(() => navigate(role === "startup" ? "startup.home" : "msme.home"), 800)
  }

  const handleGoogleRegister = async () => {
    setSubmitting(true)
    const res = await mockGoogleAuth(role)
    setSubmitting(false)
    if (res.success) {
      setName(res.user.name)
      setEmail(res.user.email)
      setOrgName(res.user.orgName || (role === "msme" ? "Precision Works Pvt Ltd" : "Nova Innovations"))
    }
  }

  if (success) {
    return (
      <PortalShell navigate={navigate} goBack={goBack} canGoBack={canGoBack}>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-4 font-bold">
            ✓
          </div>
          <h2
            className="text-xl font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Account Created
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Directing you to your {meta.label} dashboard…
          </p>
        </div>
      </PortalShell>
    )
  }

  return (
    <PortalShell navigate={navigate} goBack={goBack} canGoBack={canGoBack}>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="mb-6">
          <h1
            className="text-xl font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Create {meta.shortLabel} Account
          </h1>
          <p className="text-xs text-slate-500 mt-1">{meta.desc}</p>
        </div>

        {/* Google Quick Sign-Up */}
        <div className="mb-6">
          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogleRegister}
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
            <span>Sign up with Google (Auto-fill details)</span>
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Or fill business profile
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FieldShell label={nameLabel} error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={nameLabel}
              className={inputClass(errors.name)}
              autoComplete="name"
            />
          </FieldShell>

          <FieldShell label={orgLabel} error={errors.orgName}>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={orgLabel}
              className={inputClass(errors.orgName)}
              autoComplete="organization"
            />
          </FieldShell>

          <FieldShell label="Business Email" error={errors.email}>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputClass(errors.email)}
              autoComplete="email"
            />
          </FieldShell>

          <FieldShell label="Password" error={errors.password}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputClass(errors.password)} pr-16`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </FieldShell>

          <FieldShell label="Confirm Password" error={errors.confirmPassword}>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass(errors.confirmPassword)}
              autoComplete="new-password"
            />
          </FieldShell>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6 pt-4 border-t border-slate-100">
          Already have an account?{" "}
          <button
            onClick={() => navigate(`login.${role}` as Screen)}
            className="font-semibold text-emerald-700 hover:underline ml-1"
          >
            Sign in
          </button>
        </p>
      </div>
    </PortalShell>
  )
}

function AdminRegisterNotice({
  navigate,
  goBack,
  canGoBack,
}: {
  navigate: NavProps["navigate"]
  goBack: () => void
  canGoBack?: boolean
}) {
  return (
    <PortalShell navigate={navigate} goBack={goBack} canGoBack={canGoBack}>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <h2
          className="text-xl font-bold text-slate-900 tracking-tight"
          style={{ fontFamily: "Plus Jakarta Sans" }}
        >
          Restricted Administrator Console
        </h2>
        <p className="text-xs text-slate-500 mt-2 mb-6">
          Admin access is restricted to verified platform operations personnel.
        </p>
        <button
          onClick={() => navigate("login.admin")}
          className="btn-primary py-2 px-4 rounded-lg text-xs font-semibold"
        >
          Return to Admin Login
        </button>
      </div>
    </PortalShell>
  )
}

export default function LoginPortal({
  navigate,
  goBack,
  currentScreen,
  canGoBack,
}: NavProps) {
  const [namespace, roleSegment] = currentScreen.split(".")
  const role: RoleKey = isRoleKey(roleSegment) ? roleSegment : "startup"

  if (namespace === "register") {
    if (role === "admin")
      return (
        <AdminRegisterNotice
          navigate={navigate}
          goBack={goBack}
          canGoBack={canGoBack}
        />
      )
    return (
      <RegisterCard
        role={role}
        navigate={navigate}
        goBack={goBack}
        canGoBack={canGoBack}
      />
    )
  }

  return (
    <LoginCard
      role={role}
      navigate={navigate}
      goBack={goBack}
      canGoBack={canGoBack}
    />
  )
}
