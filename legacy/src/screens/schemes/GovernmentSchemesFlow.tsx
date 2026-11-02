import { useState, useMemo, useEffect } from "react"
import { NavProps } from "../../App"
import { useProcurement } from "../../context/ProcurementContext"
import {
  MpiScheme,
  SchemeMatcherProfile,
  SchemeMatchResult,
} from "../../data/mpiSchemesData"
import { CATALOG_CATEGORIES, CatalogCategory } from "../../lib/mpiCatalog"
import {
  Icons,
  MPIButton,
  MPICard,
} from "../../components/design-system/MPIDesignSystem"
import { MPILogo } from "../../components/shared"
import MaterialIcon from "../../components/ui/MaterialIcon"
import { getActiveUser } from "../../lib/mockAuth"
import { trackTelemetryEvent } from "../../services/telemetryService"

interface GovernmentSchemesFlowProps extends NavProps {
  initialMode?: "match" | "browse" | "detail"
  presetProfile?: SchemeMatcherProfile
}

export default function GovernmentSchemesFlow({
  navigate,
  goBack,
  currentScreen,
}: GovernmentSchemesFlowProps) {
  const {
    mpiSchemes,
    matchSchemes,
    startupProfile,
    msmeProfile,
    selectedCategory,
    activeRFQ,
  } = useProcurement()

  const activeUser = getActiveUser()
  const isMSMEContext = currentScreen === "msme.schemes" || activeUser?.role === "msme"

  // Mode derivation
  const isMatchScreen = currentScreen === "government-schemes.match"
  const isStartupSchemesScreen = currentScreen === "startup.schemes"
  const isMSMESchemesScreen = currentScreen === "msme.schemes"

  // Active view tab: 'match' | 'browse' | 'detail'
  const [activeTab, setActiveTab] = useState<"match" | "browse" | "detail">(
    isMatchScreen || isStartupSchemesScreen || isMSMESchemesScreen
      ? "match"
      : "browse",
  )

  // Selected scheme for detail drawer / page
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("SCH-ZED-01")

  // Saved / Bookmarked schemes state backed by localStorage
  const [savedSchemeIds, setSavedSchemeIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("mpi_saved_schemes")
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const toggleSaveScheme = (schemeId: string, schemeName: string) => {
    setSavedSchemeIds((prev) => {
      const isSaved = prev.includes(schemeId)
      const next = isSaved ? prev.filter((id) => id !== schemeId) : [...prev, schemeId]
      try {
        localStorage.setItem("mpi_saved_schemes", JSON.stringify(next))
      } catch {}
      if (!isSaved) {
        trackTelemetryEvent("scheme_saved", {
          schemeId,
          schemeName,
          role: matchBusinessType,
        })
      }
      return next
    })
  }

  // Matcher Questionnaire Form State — prefilled from authenticated profile and procurement context
  const initialBusinessType = isMSMEContext ? "msme" : "startup"
  const [matchBusinessType, setMatchBusinessType] =
    useState<"startup" | "msme">(initialBusinessType)
  const [matchStage, setMatchStage] = useState<SchemeMatcherProfile["stage"]>(
    startupProfile.stage || "MVP",
  )
  const [matchEnterpriseType, setMatchEnterpriseType] =
    useState<SchemeMatcherProfile["enterpriseType"]>(
      msmeProfile.enterpriseType || "Micro",
    )
  const [matchSelectedCategories, setMatchSelectedCategories] =
    useState<CatalogCategory[]>([selectedCategory || (activeRFQ?.category as CatalogCategory) || "Packaging & Printing"])
  const [matchProcurementIntent, setMatchProcurementIntent] = useState<string>(
    activeRFQ?.title || `${selectedCategory || "Packaging & Printing"} tooling, testing, and batch production`,
  )
  const [hasUdyam, setHasUdyam] = useState<boolean>(
    Boolean(msmeProfile.udyamNumber || true)
  )
  const [hasDpiit, setHasDpiit] = useState<boolean>(
    Boolean(startupProfile.hasDpiit || startupProfile.dpiitNumber || true)
  )
  const [isWomenOrScSt, setIsWomenOrScSt] = useState<boolean>(false)
  const [targetInterests, setTargetInterests] = useState<string[]>([
    "Quality & Testing Subsidy",
    "Tooling & Design Grant",
  ])

  // Track Scheme Matcher Telemetry
  useEffect(() => {
    trackTelemetryEvent("scheme_matcher_opened", {
      source: isStartupSchemesScreen ? "startup_schemes" : isMSMESchemesScreen ? "msme_schemes" : "schemes_portal",
      role: initialBusinessType,
      activeTab,
    })
    trackTelemetryEvent("scheme_eligibility_started", {
      role: initialBusinessType,
      category: selectedCategory || "Packaging & Printing",
    })
  }, [])

  // Browse search & filter state
  const [browseSearch, setBrowseSearch] = useState("")
  const [selectedMinistryFilter, setSelectedMinistryFilter] = useState("All")
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All")
  const [selectedBeneficiaryFilter, setSelectedBeneficiaryFilter] =
    useState<"all" | "startup" | "msme">("all")

  // Build current profile for matcher
  const currentMatcherProfile = useMemo<SchemeMatcherProfile>(() => {
    return {
      businessType: matchBusinessType,
      stage: matchStage,
      enterpriseType: matchEnterpriseType,
      categories: matchSelectedCategories,
      procurementNeeds: matchProcurementIntent,
      hasUdyam,
      hasDpiit,
      isWomenOrScSt,
      targetInterests,
    }
  }, [
    matchBusinessType,
    matchStage,
    matchEnterpriseType,
    matchSelectedCategories,
    matchProcurementIntent,
    hasUdyam,
    hasDpiit,
    isWomenOrScSt,
    targetInterests,
  ])

  // Compute matched schemes using explainable matching algorithm
  const matchedResults = useMemo<SchemeMatchResult[]>(() => {
    return matchSchemes(currentMatcherProfile)
  }, [matchSchemes, currentMatcherProfile])

  // Track Scheme Eligibility Completed when matches recalculate
  useEffect(() => {
    if (matchedResults.length > 0) {
      trackTelemetryEvent("scheme_eligibility_completed", {
        role: matchBusinessType,
        qualifiedCount: matchedResults.length,
        topSchemeId: matchedResults[0]?.scheme.id,
        topScore: matchedResults[0]?.relevanceScore,
        category: matchSelectedCategories[0] || selectedCategory || "General",
      })
    }
  }, [matchedResults.length, matchBusinessType, matchSelectedCategories])

  // Selected scheme object
  const currentDetailScheme = useMemo<MpiScheme>(() => {
    return mpiSchemes.find((s) => s.id === selectedSchemeId) || mpiSchemes[0]
  }, [mpiSchemes, selectedSchemeId])

  // Filtered browse list
  const filteredBrowseSchemes = useMemo(() => {
    return mpiSchemes.filter((sch) => {
      const matchSearch =
        sch.name.toLowerCase().includes(browseSearch.toLowerCase()) ||
        sch.shortName.toLowerCase().includes(browseSearch.toLowerCase()) ||
        sch.description.toLowerCase().includes(browseSearch.toLowerCase()) ||
        sch.ministry.toLowerCase().includes(browseSearch.toLowerCase())

      const matchMinistry =
        selectedMinistryFilter === "All" ||
        sch.ministry.includes(selectedMinistryFilter)

      const matchCategory =
        selectedCategoryFilter === "All" ||
        sch.categories.includes(selectedCategoryFilter as CatalogCategory)

      const matchBeneficiary =
        selectedBeneficiaryFilter === "all" ||
        sch.targetBeneficiaries.includes(selectedBeneficiaryFilter)

      return matchSearch && matchMinistry && matchCategory && matchBeneficiary
    })
  }, [
    mpiSchemes,
    browseSearch,
    selectedMinistryFilter,
    selectedCategoryFilter,
    selectedBeneficiaryFilter,
  ])

  // Ministries list for filter
  const ministriesList = useMemo(() => {
    const list = Array.from(new Set(mpiSchemes.map((s) => s.ministry)))
    return ["All", ...list]
  }, [mpiSchemes])

  const toggleCategory = (cat: CatalogCategory) => {
    setMatchSelectedCategories((prev) =>
      prev.includes(cat)
        ? prev.length > 1
          ? prev.filter((c) => c !== cat)
          : prev
        : [...prev, cat],
    )
  }

  const toggleInterest = (interest: string) => {
    setTargetInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFC] text-slate-900 flex flex-col font-sans selection:bg-[#051F16] selection:text-white antialiased">
      {/* ─── NAVIGATION BAR (MPI White/Navy Header) ────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => {
              if (isStartupSchemesScreen) navigate("startup.home")
              else if (isMSMESchemesScreen) navigate("msme.home")
              else navigate("home")
            }}
            className="hover:opacity-85 transition-opacity text-left cursor-pointer shrink-0"
          >
            <MPILogo small />
          </button>

          {/* Back Button */}
          <button
            onClick={() => {
              if (isStartupSchemesScreen) navigate("startup.home")
              else if (isMSMESchemesScreen) navigate("msme.home")
              else if (goBack) goBack()
              else navigate("home")
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Go back"
          >
            <Icons.ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="min-w-0">
            {/* Interactive Clickable Breadcrumbs */}
            <div className="flex items-center gap-1 text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
              <button
                onClick={() => navigate("home")}
                className="hover:text-slate-900 hover:underline cursor-pointer shrink-0"
              >
                Home
              </button>
              <span>/</span>
              <button
                onClick={() => {
                  if (isStartupSchemesScreen) navigate("startup.home")
                  else if (isMSMESchemesScreen) navigate("msme.home")
                  else navigate("government-schemes.match")
                }}
                className="hover:text-slate-900 hover:underline cursor-pointer shrink-0"
              >
                {isStartupSchemesScreen
                  ? "Startup Hub"
                  : isMSMESchemesScreen
                  ? "MSME Portal"
                  : "Government Schemes"}
              </button>
              <span>/</span>
              <span className="text-[#051F16] font-semibold truncate max-w-[140px] sm:max-w-[240px]">
                {activeTab === "match" ? "Eligibility Matcher" : "Central & State Schemes"}
              </span>
            </div>

            <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#051F16] flex items-center gap-1.5 truncate">
              <span>Government Schemes Engine</span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-bold px-2 py-0.2 rounded-full hidden md:inline">
                {mpiSchemes.length} Schemes Available
              </span>
            </div>
          </div>
        </div>

        {/* View mode toggle, Hub switchers & Exit */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Hub Navigation Links */}
          <button
            onClick={() => navigate("home")}
            className="hidden xl:flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Return to Marketplace Home"
          >
            <span>🏠</span>
            <span>Home</span>
          </button>
          <button
            onClick={() => navigate("startup.home")}
            className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Switch to Startup Buyer Hub"
          >
            <span>🚀</span>
            <span>Startup Hub</span>
          </button>
          <button
            onClick={() => navigate("msme.home")}
            className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Switch to MSME Supplier Portal"
          >
            <span>🏭</span>
            <span>MSME Portal</span>
          </button>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("match")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "match"
                  ? "bg-[#051F16] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Matcher
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "browse"
                  ? "bg-[#051F16] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Browse ({mpiSchemes.length})
            </button>
          </div>
        </div>
      </header>

      {/* ─── MANDATORY STATUTORY DISCLAIMER BANNER ──────────────────────────── */}
      <div className="bg-[#051F16] text-white px-4 py-2 text-xs border-b border-[#0A3525] flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center gap-2">
          <Icons.ShieldCheck className="w-4 h-4 text-[#A3F65C] shrink-0" />
          <span className="text-slate-200 leading-tight">
            <strong>Statutory Compliance Disclaimer:</strong> MPI Relevance
            Scores are algorithmic recommendations based on verified government
            compendium criteria (ALL-MSME-SCHEMES-DETAILS-2.pdf). MPI provides
            procurement support and does not issue final statutory grants.
            Always verify final guidelines on respective ministry portals.
          </span>
        </div>
      </div>

      {/* ─── CONTEXTUAL RETURN BANNER TO PRESERVE ACTIVE PROCUREMENT ───────── */}
      {activeRFQ && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-950 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span>
                <strong>Active Procurement Preserved:</strong> {activeRFQ.title || activeRFQ.category} (RFQ #{activeRFQ.id})
              </span>
            </div>
            <button
              onClick={() => {
                if (isStartupSchemesScreen) navigate("startup.home")
                else if (isMSMESchemesScreen) navigate("msme.home")
                else if (goBack) goBack()
                else navigate("startup.home")
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-white hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300 transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
            >
              <Icons.ArrowLeft className="w-3.5 h-3.5" />
              <span>← Return to Active Procurement Workflow</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ==================================================================== */}
        {/* MODE 1: SCHEME MATCHER QUESTIONNAIRE & EXPLAINABLE RESULTS           */}
        {/* ==================================================================== */}
        {activeTab === "match" && (
          <div className="space-y-8">
            {/* Header intro */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Interactive Matching Algorithm
                </span>
                <h1
                  className="text-2xl sm:text-3xl font-extrabold text-[#051F16] mt-2 tracking-tight"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Find Central Government Schemes Fitted to Your Business
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                  Answer 4 key operational parameters to calculate your
                  personalized <strong>MPI Relevance Score</strong> across 30+
                  central schemes, unlock up to 80% non-dilutive subsidies, and
                  lower your landed procurement costs.
                </p>
              </div>

              {/* Business type selector pill */}
              <div className="shrink-0 bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex items-center gap-1">
                <button
                  onClick={() => setMatchBusinessType("startup")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    matchBusinessType === "startup"
                      ? "bg-[#051F16] text-[#A3F65C] shadow-xs"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Startup / Buyer Track
                </button>
                <button
                  onClick={() => setMatchBusinessType("msme")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    matchBusinessType === "msme"
                      ? "bg-[#051F16] text-[#A3F65C] shadow-xs"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  MSME / Supplier Track
                </button>
              </div>
            </div>

            {/* Two-Column Grid: Form Left, Matched Schemes Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* ── Left Column: Questionnaire Form ──────────────────────── */}
              <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 sticky top-20">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-[#051F16] flex items-center gap-2">
                    <Icons.SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                    <span>Your Business Profile Parameters</span>
                  </h2>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    Step-by-Step Calibration
                  </span>
                </div>

                {/* 1. Stage / Enterprise Type */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-2">
                    {matchBusinessType === "startup"
                      ? "1. Startup Maturity Stage"
                      : "1. Enterprise Classification"}
                  </label>
                  {matchBusinessType === "startup" ? (
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        "Idea",
                        "Prototype",
                        "MVP",
                        "Early Revenue",
                        "Traction",
                        "Growth",
                      ] as const).map((stg) => (
                        <button
                          key={stg}
                          type="button"
                          onClick={() => setMatchStage(stg)}
                          className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                            matchStage === stg
                              ? "bg-[#051F16] text-white border-[#051F16] shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {stg}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {(["Micro", "Small", "Medium"] as const).map((et) => (
                        <button
                          key={et}
                          type="button"
                          onClick={() => setMatchEnterpriseType(et)}
                          className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                            matchEnterpriseType === et
                              ? "bg-[#051F16] text-white border-[#051F16] shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {et}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Procurement Categories */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-2">
                    2. Primary Procurement / Production Categories
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATALOG_CATEGORIES.map((cat) => {
                      const isSelected = matchSelectedCategories.includes(cat)
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#051F16] text-[#A3F65C] border-[#051F16] shadow-xs font-bold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 3. Procurement Intent / Needs Keywords */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    3. Target Intent / Procurement Triggers
                  </label>
                  <input
                    type="text"
                    value={matchProcurementIntent}
                    onChange={(e) => setMatchProcurementIntent(e.target.value)}
                    placeholder="e.g. Packaging, Tooling, Quality Testing, Patents, Machinery"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#051F16] bg-slate-50"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      "Tooling & Design Grant",
                      "Quality & Testing Subsidy",
                      "Collateral-Free Credit",
                      "Export & Trade Fair",
                      "Patent Protection",
                    ].map((tg) => (
                      <button
                        key={tg}
                        type="button"
                        onClick={() => toggleInterest(tg)}
                        className={`text-[10px] px-2 py-1 rounded-md border font-semibold transition-all cursor-pointer ${
                          targetInterests.includes(tg)
                            ? "bg-[#051F16] text-white border-[#051F16]"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        + {tg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Statutory Qualifications & Inclusivity */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-2">
                    4. Statutory Registrations & Priority Criteria
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasUdyam}
                        onChange={(e) => setHasUdyam(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span>
                        Active MSME Udyam Registration (Opens DC-MSME subsidies)
                      </span>
                    </label>

                    {matchBusinessType === "startup" && (
                      <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasDpiit}
                          onChange={(e) => setHasDpiit(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>
                          DPIIT Recognized Startup (Qualifies for SISFS & SIPP
                          Fast-Track)
                        </span>
                      </label>
                    )}

                    <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isWomenOrScSt}
                        onChange={(e) => setIsWomenOrScSt(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span>
                        Women Entrepreneur / SC/ST Promoter (Unlocks +10-15%
                        extra subsidy)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 text-[11px] text-emerald-900 leading-relaxed">
                  <strong>MPI Concierge Note:</strong> Changes update your
                  relevance ranking in real-time. Highest scoring schemes can be
                  bundled directly with your live RFQ.
                </div>
              </div>

              {/* ── Right Column: Ranked Scheme Matches ───────────────────── */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h2
                      className="text-lg font-bold text-[#051F16]"
                      style={{ fontFamily: "Plus Jakarta Sans" }}
                    >
                      Top Scheme Recommendations ({matchedResults.length}{" "}
                      Qualified)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Sorted by <strong>MPI Relevance Score</strong> based on
                      your business stage, procurement categories, and statutory
                      criteria.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                    Updated Live
                  </span>
                </div>

                {matchedResults.map((result, idx) => {
                  const {
                    scheme,
                    relevanceScore,
                    matchTier,
                    matchReasons,
                  } = result
                  const isTopMatch = idx === 0
                  const isSaved = savedSchemeIds.includes(scheme.id)

                  return (
                    <MPICard
                      key={scheme.id}
                      hover
                      className={`p-5 sm:p-6 transition-all duration-300 ${
                        isTopMatch
                          ? "border-2 border-emerald-500 ring-2 ring-emerald-200/60 shadow-lg shadow-emerald-500/10 bg-white"
                          : "border border-slate-200/90 bg-white"
                      }`}
                    >
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {scheme.department}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {scheme.ministry}
                            </span>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Potential Match • Requires Confirmation
                            </span>
                          </div>

                          <h3
                            className="text-base sm:text-lg font-extrabold text-[#051F16] tracking-tight leading-snug cursor-pointer hover:text-emerald-700"
                            onClick={() => {
                              setSelectedSchemeId(scheme.id)
                              setActiveTab("detail")
                            }}
                          >
                            {scheme.name}
                          </h3>
                        </div>

                        {/* Relevance Score Badge */}
                        <div className="text-right shrink-0">
                          <div
                            className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border font-bold text-center ${
                              relevanceScore >= 85
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                : relevanceScore >= 70
                                  ? "bg-emerald-50/60 border-emerald-200 text-[#051F16]"
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                            }`}
                          >
                            <span className="text-xl font-extrabold leading-none">
                              {relevanceScore}%
                            </span>
                            <span className="text-[9px] uppercase tracking-wider font-semibold mt-0.5">
                              MPI Match
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 mt-1">
                            {matchTier}
                          </div>
                        </div>
                      </div>

                      {/* Assistance Breakdown & Max Savings */}
                      <div className="my-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-slate-500">
                            Maximum Grant / Benefit:
                          </span>
                          <span className="font-extrabold text-slate-900 ml-1.5 text-sm">
                            {scheme.assistanceAmountMax}
                          </span>
                        </div>
                        {scheme.subsidyPercentMax && (
                          <div className="text-right sm:text-left">
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold px-2 py-0.5 rounded text-[11px]">
                              Up to {scheme.subsidyPercentMax}% Subsidy
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Brief Description */}
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        {scheme.description}
                      </p>

                      {/* Why this scheme matched — Explainable AI Badges */}
                      <div className="space-y-1.5 mb-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <Icons.Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Why this scheme matched your requirement:</span>
                        </div>
                        <ul className="space-y-1">
                          {matchReasons.map((reason, rIdx) => (
                            <li
                              key={rIdx}
                              className="text-xs text-slate-700 flex items-start gap-2 bg-emerald-50/50 px-2.5 py-1 rounded-md border border-emerald-100"
                            >
                              <span className="text-emerald-600 font-bold shrink-0">
                                ✓
                              </span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Source Citation & Actions */}
                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="text-[11px] text-slate-400">
                          Source:{" "}
                          <span className="font-medium text-slate-600">
                            {scheme.sourceDocument}
                          </span>{" "}
                          ({scheme.sourceChapter})
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Post-procurement benefit · Does not deduct from supplier invoice
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSaveScheme(scheme.id, scheme.name)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs transition-colors cursor-pointer ${
                              isSaved
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                            title={isSaved ? "Remove from saved schemes" : "Save this scheme"}
                          >
                            <span>{isSaved ? "★" : "☆"}</span>
                            <span>{isSaved ? "Saved" : "Save Scheme"}</span>
                          </button>

                          <MPIButton
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSchemeId(scheme.id)
                              setActiveTab("detail")
                            }}
                          >
                            Full Dossier
                          </MPIButton>
                          <a
                            href={scheme.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              trackTelemetryEvent("scheme_official_link_clicked", {
                                schemeId: scheme.id,
                                schemeName: scheme.name,
                                url: scheme.officialUrl,
                              })
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#051F16] hover:bg-[#083A28] text-white font-bold text-xs transition-colors cursor-pointer"
                          >
                            <span>Official Portal</span>
                            <Icons.ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </MPICard>
                  )
                })}

                {matchedResults.length === 0 && (
                  <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-xl font-bold">
                      🔍
                    </div>
                    <h3 className="text-base font-extrabold text-[#051F16]">
                      No Schemes Directly Matching Current Filter Criteria
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Try selecting additional procurement categories, broadening your business stage, or enabling statutory registrations (Udyam/DPIIT).
                    </p>
                    <div className="pt-2">
                      <MPIButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMatchSelectedCategories(CATALOG_CATEGORIES.slice(0, 3))
                          setHasUdyam(true)
                          setHasDpiit(true)
                        }}
                      >
                        Reset to Recommended Parameters
                      </MPIButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODE 2: BROWSE ALL 30 CENTRAL SCHEMES WITH FACETED FILTERS           */}
        {/* ==================================================================== */}
        {activeTab === "browse" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h1
                className="text-2xl sm:text-3xl font-extrabold text-[#051F16] tracking-tight"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Comprehensive Central MSME & Startup Schemes Repository
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                Structured reference catalog compiled from official compendium
                data across all central ministries. Filter by ministry,
                beneficiary group, or catalog category.
              </p>

              {/* Search & Filters */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-6 pt-4 border-t border-slate-100">
                <div className="md:col-span-5 relative">
                  <Icons.Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={browseSearch}
                    onChange={(e) => setBrowseSearch(e.target.value)}
                    placeholder="Search by scheme name, keyword, or subsidy benefit..."
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <div className="md:col-span-3">
                  <select
                    value={selectedMinistryFilter}
                    onChange={(e) => setSelectedMinistryFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#051F16] font-medium"
                  >
                    <option value="All">
                      All Ministries ({mpiSchemes.length})
                    </option>
                    {ministriesList
                      .filter((m) => m !== "All")
                      .map((min) => (
                        <option key={min} value={min}>
                          {min}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#051F16] font-medium"
                  >
                    <option value="All">All 7 Categories</option>
                    {CATALOG_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <select
                    value={selectedBeneficiaryFilter}
                    onChange={(e) =>
                      setSelectedBeneficiaryFilter(e.target.value as any)
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#051F16] font-medium"
                  >
                    <option value="all">All Beneficiaries</option>
                    <option value="startup">Startups Only</option>
                    <option value="msme">MSMEs Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Schemes Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBrowseSchemes.map((scheme) => (
                <div
                  key={scheme.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {scheme.targetBeneficiaries
                          .map((b) => b.toUpperCase())
                          .join(" & ")}
                      </span>
                      {scheme.subsidyPercentMax && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {scheme.subsidyPercentMax}% Subsidy
                        </span>
                      )}
                    </div>

                    <h3
                      className="text-base font-extrabold text-[#051F16] group-hover:text-emerald-700 transition-colors leading-snug cursor-pointer"
                      onClick={() => {
                        setSelectedSchemeId(scheme.id)
                        setActiveTab("detail")
                      }}
                    >
                      {scheme.name}
                    </h3>

                    <div className="text-[11px] text-slate-500 line-clamp-1 font-medium">
                      {scheme.ministry}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {scheme.description}
                    </p>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Assistance Limit:
                      </div>
                      <div className="font-extrabold text-slate-900 mt-0.5">
                        {scheme.assistanceAmountMax}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedSchemeId(scheme.id)
                        setActiveTab("detail")
                      }}
                      className="text-xs font-bold text-[#051F16] hover:text-emerald-700 cursor-pointer flex items-center gap-1"
                    >
                      <span>Inspect Dossier</span>
                      <Icons.ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSaveScheme(scheme.id, scheme.name)}
                        className={`text-[11px] font-bold px-2 py-1 rounded border transition-colors cursor-pointer ${
                          savedSchemeIds.includes(scheme.id)
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        title={savedSchemeIds.includes(scheme.id) ? "Saved" : "Save Scheme"}
                      >
                        {savedSchemeIds.includes(scheme.id) ? "★ Saved" : "☆ Save"}
                      </button>

                      <a
                        href={scheme.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          trackTelemetryEvent("scheme_official_link_clicked", {
                            schemeId: scheme.id,
                            schemeName: scheme.name,
                            url: scheme.officialUrl,
                          })
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <span>Official Portal</span>
                        <Icons.ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredBrowseSchemes.length === 0 && (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
                <Icons.Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-800">
                  No schemes found matching criteria
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Try resetting search filters or keywords.
                </p>
                <div className="mt-4">
                  <MPIButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBrowseSearch("")
                      setSelectedMinistryFilter("All")
                      setSelectedCategoryFilter("All")
                      setSelectedBeneficiaryFilter("all")
                    }}
                  >
                    Clear All Filters
                  </MPIButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODE 3: FULL DEDICATED INSTITUTIONAL SCHEME DOSSIER                 */}
        {/* ==================================================================== */}
        {activeTab === "detail" && (
          <div className="space-y-6">
            {/* Navigation back to match/browse */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab("match")}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
              >
                <Icons.ArrowLeft className="w-4 h-4" />
                <span>Back to Matching Results</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Icons.Check className="w-3.5 h-3.5" />
                  <span>{currentDetailScheme.verificationStatus}</span>
                </span>
              </div>
            </div>

            {/* Dossier Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-8">
              {/* Header */}
              <div className="border-b border-slate-100 pb-6">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-2">
                  <span>{currentDetailScheme.department}</span>
                  <span>·</span>
                  <span className="text-slate-500">
                    {currentDetailScheme.ministry}
                  </span>
                </div>
                <h1
                  className="text-2xl sm:text-3xl font-extrabold text-[#051F16] tracking-tight leading-tight"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  {currentDetailScheme.name}
                </h1>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-4xl">
                  {currentDetailScheme.description}
                </p>
              </div>

              {/* Key Quick Metric Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Assistance Ceiling
                  </div>
                  <div className="text-base font-extrabold text-[#051F16] mt-1">
                    {currentDetailScheme.assistanceAmountMax}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Beneficiaries
                  </div>
                  <div className="text-base font-extrabold text-[#051F16] mt-1 capitalize">
                    {currentDetailScheme.targetBeneficiaries.join(" & ")}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Applicable Categories
                  </div>
                  <div className="text-xs font-bold text-[#051F16] mt-1">
                    {currentDetailScheme.categories.join(", ")}
                  </div>
                </div>
              </div>

              {/* Nature of Assistance */}
              <div>
                <h2 className="text-base font-bold text-[#051F16] mb-2 flex items-center gap-2">
                  <Icons.Coins className="w-5 h-5 text-emerald-600" />
                  <span>Nature & Quantum of Financial Assistance</span>
                </h2>
                <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200 text-xs sm:text-sm text-slate-800 leading-relaxed">
                  {currentDetailScheme.natureOfAssistance}
                </div>
              </div>

              {/* Key Benefits Bulleted */}
              <div>
                <h2 className="text-base font-bold text-[#051F16] mb-3 flex items-center gap-2">
                  <Icons.Sparkles className="w-5 h-5 text-emerald-600" />
                  <span>Key Strategic Benefits for Sourcing & Production</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentDetailScheme.keyBenefits.map((benefit, bIdx) => (
                    <div
                      key={bIdx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-start gap-2.5"
                    >
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Who Can Apply & Eligibility Criteria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-base font-bold text-[#051F16] mb-3 flex items-center gap-2">
                    <Icons.Users className="w-5 h-5 text-emerald-700" />
                    <span>Who Can Apply</span>
                  </h2>
                  <ul className="space-y-2">
                    {currentDetailScheme.whoCanApply.map((item, i) => (
                      <li
                        key={i}
                        className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-start gap-2"
                      >
                        <span className="text-slate-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h2 className="text-base font-bold text-[#051F16] mb-3 flex items-center gap-2">
                    <Icons.CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Statutory Eligibility Criteria</span>
                  </h2>
                  <ul className="space-y-2">
                    {currentDetailScheme.eligibilityCriteria.map((item, i) => (
                      <li
                        key={i}
                        className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-start gap-2"
                      >
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Step-by-Step How to Apply */}
              <div>
                <h2 className="text-base font-bold text-[#051F16] mb-3 flex items-center gap-2">
                  <Icons.FileText className="w-5 h-5 text-emerald-700" />
                  <span>Step-by-Step Application Roadmap</span>
                </h2>
                <div className="space-y-2.5">
                  {currentDetailScheme.howToApply.map((step, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#051F16] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                        {sIdx + 1}
                      </div>
                      <div className="pt-0.5 leading-relaxed">{step}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents Required Checklist */}
              <div>
                <h2 className="text-base font-bold text-[#051F16] mb-3 flex items-center gap-2">
                  <Icons.FolderCheck className="w-5 h-5 text-emerald-700" />
                  <span>Mandatory Statutory Documents Checklist</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {currentDetailScheme.documentsRequired.map((doc, dIdx) => (
                    <div
                      key={dIdx}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2"
                    >
                      <span className="text-slate-400">📄</span>
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Bar Footer */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  Nodal Office:{" "}
                  <span className="font-semibold text-slate-700">
                    {currentDetailScheme.contactOffice}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSaveScheme(currentDetailScheme.id, currentDetailScheme.name)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border font-bold text-xs transition-colors cursor-pointer ${
                      savedSchemeIds.includes(currentDetailScheme.id)
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{savedSchemeIds.includes(currentDetailScheme.id) ? "★" : "☆"}</span>
                    <span>{savedSchemeIds.includes(currentDetailScheme.id) ? "Saved Scheme" : "Save Scheme"}</span>
                  </button>

                  <MPIButton
                    variant="outline"
                    onClick={() => {
                      // Pre-fill procurement requirement with scheme triggers
                      setActiveTab("match")
                    }}
                  >
                    Calibrate in Matcher
                  </MPIButton>

                  <a
                    href={currentDetailScheme.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      trackTelemetryEvent("scheme_official_link_clicked", {
                        schemeId: currentDetailScheme.id,
                        schemeName: currentDetailScheme.name,
                        url: currentDetailScheme.officialUrl,
                      })
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white font-extrabold text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    <span>Visit Official Ministry Portal</span>
                    <Icons.ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
