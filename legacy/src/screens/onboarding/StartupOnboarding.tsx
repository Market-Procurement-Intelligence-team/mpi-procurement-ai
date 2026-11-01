import React, { useState, useEffect } from "react"
import { NavProps, Screen } from "../../App"
import {
  useProcurement,
  StartupBusinessProfile,
} from "../../context/ProcurementContext"
import { CATALOG_CATEGORIES, CatalogCategory } from "../../lib/mpiCatalog"
import {
  Icons,
  MPIButton,
  MPIStatusBadge,
} from "../../components/design-system/MPIDesignSystem"
import { MPILogo } from "../../components/shared"
import { mockRegister } from "../../lib/mockAuth"
import {
  getPendingAction,
  clearPendingAction,
  getActiveUser,
  isAuthenticated,
} from "../../lib/sessionManager"
import { trackTelemetryEvent } from "../../services/telemetryService"
import MaterialIcon from "../../components/ui/MaterialIcon"

const STAGES = [
  { id: "Idea", label: "Idea Stage", desc: "Concept stage, problem validation" },
  { id: "Prototype", label: "Prototyping", desc: "Building initial hardware or software mockups" },
  { id: "MVP", label: "MVP / Pilot Batch", desc: "First production batch for pilot testing" },
  { id: "Early Revenue", label: "Early Revenue", desc: "Repeat customer orders & recurring demand" },
  { id: "Growth", label: "Growth & Scaling", desc: "Scaling batch quantities & vendor tiering" },
] as const

const SAMPLE_PROMPT_CHIPS = [
  {
    label: "Rigid Packaging Box",
    cat: "Packaging & Printing" as CatalogCategory,
    text: "Need 500 custom rigid printed boxes for our D2C organic skincare launch by next month, budget under ₹80k with custom EVA foam inserts",
    qty: 500,
    budget: 75000,
  },
  {
    label: "CNC Precision Machining",
    cat: "Prototyping & Product Development" as CatalogCategory,
    text: "Looking for 5-axis CNC machining for 20 sets of 6061-T6 aluminum drone arm chassis with ±0.05mm tolerance and black anodizing, budget ₹1.2 Lakh",
    qty: 20,
    budget: 120000,
  },
  {
    label: "Cloud ERP & Integration",
    cat: "IT & Digital Services" as CatalogCategory,
    text: "Need full-stack development team for custom ERP inventory workflow with enterprise cloud architecture and Next.js 15, budget ₹1.8 Lakh",
    qty: 1,
    budget: 180000,
  },
]

const ONBOARDING_DRAFT_KEY = "mpi_startup_onboarding_draft"

export default function StartupOnboarding({ navigate, goBack }: NavProps) {
  const {
    startupProfile,
    updateStartupProfile,
    setRequirementText,
    setSelectedCategory,
    setQuantity,
    setTargetBudget,
  } = useProcurement()

  // 2-Stage Lean Onboarding (Stage 1: Essential Profile, Stage 2: First Requirement)
  const [currentStage, setCurrentStage] = useState<1 | 2>(1)
  const totalStages = 2

  // Track stage view in telemetry
  useEffect(() => {
    trackTelemetryEvent("onboarding_step_viewed", {
      stepNumber: currentStage,
      stepName:
        currentStage === 1
          ? "Essential Company Profile"
          : "First Procurement Requirement",
      role: "startup",
    })
  }, [currentStage])

  // Resolve authenticated user & pending context
  const activeUser = getActiveUser()
  const pending = getPendingAction()

  // Load any previously saved draft from localStorage (scoped to active user)
  const savedDraft = (() => {
    if (typeof window === "undefined") return null
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      // Guard against cross-user draft pollution: if active user exists and draft has a different email, ignore it
      if (activeUser?.email && parsed?.email && parsed.email.trim().toLowerCase() !== activeUser.email.trim().toLowerCase()) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  })()

  // Stage 1 Fields: Essential Profile
  const [founderName, setFounderName] = useState(
    savedDraft?.founderName ||
      activeUser?.name ||
      startupProfile.founderName ||
      "",
  )
  const [startupName, setStartupName] = useState(
    savedDraft?.startupName ||
      activeUser?.orgName ||
      startupProfile.startupName ||
      "",
  )
  const [email, setEmail] = useState(
    savedDraft?.email ||
      activeUser?.email ||
      startupProfile.email ||
      "",
  )
  const [phone, setPhone] = useState(
    savedDraft?.phone || startupProfile.phone || "",
  )
  const [city, setCity] = useState(
    savedDraft?.city || startupProfile.city || "Bengaluru",
  )
  const [state, setState] = useState(
    savedDraft?.state || startupProfile.state || "Karnataka",
  )
  const [stage, setStage] = useState<StartupBusinessProfile["stage"]>(
    savedDraft?.stage || startupProfile.stage || "MVP",
  )

  // Password fields (only shown if user is not already logged in or did not supply credentials)
  const [password, setPassword] = useState(() => {
    try {
      return localStorage.getItem("mpi_temp_password") || ""
    } catch {
      return ""
    }
  })
  const [confirmPassword, setConfirmPassword] = useState(() => {
    try {
      return localStorage.getItem("mpi_temp_password") || ""
    } catch {
      return ""
    }
  })

  // Stage 2 Fields: First Procurement Requirement
  const [category, setCategory] = useState<CatalogCategory>(
    savedDraft?.category ||
      (pending?.procurementContext?.category as CatalogCategory) ||
      startupProfile.procurementCategories?.[0] ||
      "Packaging & Printing",
  )
  const [description, setDescription] = useState(
    savedDraft?.description ||
      pending?.procurementContext?.requirementText ||
      startupProfile.procurementDescription ||
      "",
  )
  const [qty, setQty] = useState<number>(
    savedDraft?.qty ||
      pending?.procurementContext?.quantity ||
      500,
  )
  const [qtyUnit, setQtyUnit] = useState<string>(
    savedDraft?.qtyUnit || "units",
  )
  const [budget, setBudget] = useState<number>(
    savedDraft?.budget ||
      pending?.procurementContext?.targetBudget ||
      75000,
  )
  const [deliveryLocation, setDeliveryLocation] = useState(
    savedDraft?.deliveryLocation || city || "Bengaluru",
  )
  const [leadTimeDays, setLeadTimeDays] = useState(
    savedDraft?.leadTimeDays || "20-25 Calendar Days",
  )

  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-save draft changes to localStorage for save/resume support
  useEffect(() => {
    try {
      const draft = {
        founderName,
        startupName,
        email,
        phone,
        city,
        state,
        stage,
        category,
        description,
        qty,
        qtyUnit,
        budget,
        deliveryLocation,
        leadTimeDays,
      }
      localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Ignore quota exceptions
    }
  }, [
    founderName,
    startupName,
    email,
    phone,
    city,
    state,
    stage,
    category,
    description,
    qty,
    qtyUnit,
    budget,
    deliveryLocation,
    leadTimeDays,
  ])

  // Validation
  const validateStage1 = (): boolean => {
    setErrorMessage("")
    if (!founderName.trim() || founderName.trim().length < 2) {
      setErrorMessage("Please enter the founder or lead contact name (min 2 characters).")
      return false
    }
    if (!startupName.trim() || startupName.trim().length < 2) {
      setErrorMessage("Please enter your startup or company legal name.")
      return false
    }
    if (!email.trim() || !email.includes("@") || !email.includes(".")) {
      setErrorMessage("Please enter a valid work email address.")
      return false
    }
    if (!city.trim()) {
      setErrorMessage("Please enter your operating city.")
      return false
    }

    // If unauthenticated, validate password
    const authed = isAuthenticated()
    if (!authed) {
      if (!password || password.length < 6) {
        setErrorMessage("Please enter an account password (minimum 6 characters).")
        return false
      }
      if (password !== confirmPassword) {
        setErrorMessage("Account passwords do not match.")
        return false
      }
    }
    return true
  }

  const validateStage2 = (): boolean => {
    setErrorMessage("")
    if (!category) {
      setErrorMessage("Please select a primary sourcing category.")
      return false
    }
    if (!description.trim() || description.trim().length < 15) {
      setErrorMessage(
        "Please provide at least 15 characters describing what you need to procure.",
      )
      return false
    }
    if (qty <= 0 || isNaN(qty)) {
      setErrorMessage("Please enter a valid positive batch quantity.")
      return false
    }
    if (budget <= 0 || isNaN(budget)) {
      setErrorMessage("Please enter a realistic commercial target budget in ₹ INR.")
      return false
    }
    return true
  }

  const handleStage1Next = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStage1()) return
    setDeliveryLocation(city)
    setCurrentStage(2)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStage2()) return

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      // 1. Build updated business profile conforming to StartupBusinessProfile
      const newProfile: StartupBusinessProfile = {
        founderName: founderName.trim(),
        startupName: startupName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        city: city.trim(),
        state: state.trim() || "Karnataka",
        stage,
        productsSold: description.slice(0, 140),
        industry: category,
        procurementCategories: [category],
        procurementSubcategories: [],
        procurementDescription: description.trim(),
        annualProcurementBudget: budget * 4,
        turnaroundPriority: "Standard",
        fundingStage: "Seed",
        hasDpiit: false,
        teamSize: "1-10 employees",
        governmentInterests: [
          "ZED Quality Certification Subsidy",
          "Design Clinic Packaging Grant",
        ],
        createdAt: new Date().toISOString().split("T")[0],
      }

      // Persist to context and localStorage
      updateStartupProfile(newProfile)
      try {
        localStorage.setItem("mpi_startup_profile", JSON.stringify(newProfile))
      } catch {}

      // 2. Set current procurement context state
      setRequirementText(description.trim())
      setSelectedCategory(category)
      setQuantity(qty)
      setTargetBudget(budget)

      // 3. Register mock session credentials if new
      if (!isAuthenticated() && password) {
        await mockRegister("startup", {
          name: founderName.trim(),
          orgName: startupName.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        })
      }

      // Clear draft storage
      try {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY)
        localStorage.removeItem("mpi_temp_password")
      } catch {}

      // 4. Resolve destination screen
      const currentPending = getPendingAction()
      if (
        currentPending &&
        currentPending.targetScreen &&
        currentPending.targetScreen !== "startup.onboarding"
      ) {
        clearPendingAction()
        navigate(currentPending.targetScreen)
      } else {
        // Direct new startup into Guided Builder with their requirement loaded
        navigate("startup.procurement")
      }
    } catch {
      setErrorMessage("An unexpected error occurred while saving your profile. Please retry.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1220] flex flex-col font-sans selection:bg-[#051F16] selection:text-white">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => navigate("home")}
            className="hover:opacity-85 transition-opacity text-left cursor-pointer shrink-0"
          >
            <MPILogo small />
          </button>

          {/* Back Button */}
          <button
            onClick={() => {
              if (currentStage === 2) {
                setCurrentStage(1)
              } else {
                goBack()
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Go back"
          >
            <Icons.ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {currentStage === 2 ? "Back to Profile" : "Back"}
            </span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
              <button
                onClick={() => navigate("home")}
                className="hover:text-slate-900 hover:underline cursor-pointer shrink-0"
              >
                Home
              </button>
              <span>/</span>
              <span className="text-[#051F16] font-semibold truncate">
                Startup Onboarding
              </span>
            </div>

            <div className="text-xs sm:text-sm font-bold text-[#051F16] truncate">
              Startup Quick-Activation Protocol (2 Stages)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => navigate("home")}
            className="hidden sm:flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>Marketplace</span>
          </button>
          <button
            onClick={() => navigate("login.startup")}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Log In →
          </button>
        </div>
      </header>

      {/* ── 2-Stage Progress Bar ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold text-xs ring-4 ring-[#A3F65C]/20 shadow-2xs">
              {currentStage}
            </span>
            <div>
              <div className="text-xs font-extrabold text-[#051F16]">
                {currentStage === 1
                  ? "Stage 1 of 2: Essential Company Profile"
                  : "Stage 2 of 2: First Procurement Requirement"}
              </div>
              <div className="text-[11px] text-slate-500">
                {currentStage === 1
                  ? "Basic identity to calibrate factory negotiations"
                  : "Define technical scope to generate instant supplier matches"}
              </div>
            </div>
          </div>
          <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            {currentStage === 1 ? "50% Complete" : "100% Ready to Activate"}
          </span>
        </div>

        <div className="max-w-3xl mx-auto w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-[#051F16] h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${(currentStage / totalStages) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Main Form Container ─────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-10 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <Icons.AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STAGE 1: ESSENTIAL PROFILE
          ══════════════════════════════════════════════════════════════════ */}
          {currentStage === 1 && (
            <form onSubmit={handleStage1Next} className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Stage 1 · Essential Profile
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Set up your buyer workspace
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  We use your company details to verify eligibility for MSME reverse-margins and government grants.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Founder / Lead Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={founderName}
                    onChange={(e) => setFounderName(e.target.value)}
                    placeholder="e.g. Aarav Mehta"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Startup / Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={startupName}
                    onChange={(e) => setStartupName(e.target.value)}
                    placeholder="e.g. TechNova Innovations"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="founder@startup.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Operating City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru, Pune, Delhi NCR"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    State / Region
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka, Maharashtra"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                  />
                </div>
              </div>

              {/* Startup Maturity Stage Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Company Maturity Stage
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STAGES.map((s) => {
                    const isSelected = stage === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStage(s.id as StartupBusinessProfile["stage"])}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#051F16] text-white border-[#051F16] shadow-2xs"
                            : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"
                        }`}
                      >
                        <div className="text-xs font-bold">{s.label}</div>
                        <div className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                          {s.desc}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Security / Password check */}
              {isAuthenticated() ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <Icons.Check className="w-4 h-4 text-emerald-700" />
                    <span>Authenticated session confirmed for <strong>{email || activeUser?.email}</strong></span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Create Workspace Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[#051F16] text-[#A3F65C] hover:bg-[#083A28] active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center gap-2 group"
                >
                  <span>Continue to Procurement Requirement</span>
                  <Icons.ArrowRight className="w-4 h-4 text-[#A3F65C] group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STAGE 2: FIRST PROCUREMENT REQUIREMENT
          ══════════════════════════════════════════════════════════════════ */}
          {currentStage === 2 && (
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Stage 2 · First Requirement
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  What do you need to procure?
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Describe what your company is looking to build or buy. MPI extracts engineering specs and matches vetted MSME factories instantly.
                </p>
              </div>

              {/* Sample Guidance Prompt Chips */}
              <div className="p-3.5 bg-[#F2F6F8] rounded-xl border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Icons.Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Load Sample Requirement:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PROMPT_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCategory(chip.cat)
                        setDescription(chip.text)
                        setQty(chip.qty)
                        setBudget(chip.budget)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-2xs"
                    >
                      <MaterialIcon name="auto_awesome" size={13} className="text-emerald-700" />
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sourcing Category Grid */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Primary Sourcing Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATALOG_CATEGORIES.map((cat) => {
                    const isSelected = category === cat
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex flex-col justify-between h-16 ${
                          isSelected
                            ? "bg-[#051F16] text-white border-[#051F16] shadow-2xs"
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span className="line-clamp-2 leading-tight">{cat}</span>
                        {isSelected && (
                          <span className="text-[10px] text-[#A3F65C] font-semibold flex items-center gap-0.5">
                            <Icons.Check className="w-3 h-3" />
                            <span>Selected</span>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Detailed Requirement Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Requirement Description <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {description.length} characters (min 15)
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. We require 500 custom rigid printed boxes for our D2C organic skincare launch by next month. Needs food-grade kappa board, matte black lamination, gold foil embossing, and custom EVA foam inserts. Target budget under ₹80k..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16] leading-relaxed resize-y"
                />
              </div>

              {/* Commercials: Quantity & Target Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Batch Quantity & Unit <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      required
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-2/3 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                    />
                    <select
                      value={qtyUnit}
                      onChange={(e) => setQtyUnit(e.target.value)}
                      className="w-1/3 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#051F16]"
                    >
                      <option value="units">units</option>
                      <option value="pieces">pieces</option>
                      <option value="boxes">boxes</option>
                      <option value="sets">sets</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Target Commercial Budget (₹ INR) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step={5000}
                      min={5000}
                      required
                      value={budget}
                      onChange={(e) => setBudget(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Delivery Destination City
                  </label>
                  <input
                    type="text"
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    placeholder="e.g. Bengaluru, Pune"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Target Turnaround Timeline
                  </label>
                  <input
                    type="text"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    placeholder="e.g. 15-20 Days"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/40 focus:border-[#051F16]"
                  />
                </div>
              </div>

              {/* Value Assurance Callout */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1 text-xs text-emerald-950">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <Icons.ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Buyer Privacy & Reverse-Margin Guarantee</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Your startup identity remains strictly confidential. Only anonymized requirements are dispatched to audited MSME manufacturers, ensuring uninflated factory-direct pricing.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStage(1)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  ← Back to Profile
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[#051F16] text-[#A3F65C] hover:bg-[#083A28] active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? "Activating Workspace..." : "Activate Workspace & Analyze Requirement"}</span>
                  <Icons.ArrowRight className="w-4 h-4 text-[#A3F65C] group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
