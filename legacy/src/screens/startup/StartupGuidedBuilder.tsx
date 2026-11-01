import React, { useState, useRef } from "react"
import { Screen } from "../../App"
import {
  Icons,
  MPIButton,
  MPIStatusBadge,
} from "../../components/design-system/MPIDesignSystem"
import MaterialIcon from "../../components/ui/MaterialIcon"
import { CATALOG_CATEGORIES, CatalogCategory } from "../../lib/mpiCatalog"
import {
  PublicStartupSupplier,
  PublicStartupQuote,
  RFQDetails,
} from "../../context/ProcurementContext"
import { formatScopeDisplay } from "../Home"
import { type ExtractedProcurementSpecs } from "../../services/aiService"
import { useStepTransition } from "../../hooks/useStartupGSAP"
import { trackTelemetryEvent } from "../../services/telemetryService"

interface StartupGuidedBuilderProps {
  navigate: (screen: Screen) => void
  goBack: () => void
  builderStep: number
  setBuilderStep: (step: number) => void
  requirementText: string
  setRequirementText: (text: string) => void
  selectedCategory: CatalogCategory
  setSelectedCategory: (cat: CatalogCategory) => void
  quantity: number
  setQuantity: (qty: number) => void
  targetBudget: number
  setTargetBudget: (budget: number) => void
  deliveryLocation: string
  setDeliveryLocation: (loc: string) => void
  deadlineDate: string
  setDeadlineDate: (date: string) => void
  specifications: string[]
  addSpecification: (spec: string) => void
  removeSpecification: (idx: number) => void
  complianceChecks: string[]
  setComplianceChecks: React.Dispatch<React.SetStateAction<string[]>>
  isExtractingSpecs: boolean
  runAIExtraction: (customText?: string) => Promise<ExtractedProcurementSpecs | null>
  publicStartupSuppliers: PublicStartupSupplier[]
  shortlistedSupplierIds: string[]
  toggleShortlistSupplier: (id: string) => void
  activeRFQ: RFQDetails | null
  createAndDispatchRFQ: (supplierIds?: string[]) => void
  publicStartupQuotes: PublicStartupQuote[]
  onOpenSampleModal: (sup: PublicStartupSupplier) => void
}

export default function StartupGuidedBuilder({
  navigate,
  goBack,
  builderStep,
  setBuilderStep,
  requirementText,
  setRequirementText,
  selectedCategory,
  setSelectedCategory,
  quantity,
  setQuantity,
  targetBudget,
  setTargetBudget,
  deliveryLocation,
  setDeliveryLocation,
  deadlineDate,
  setDeadlineDate,
  specifications,
  addSpecification,
  removeSpecification,
  complianceChecks,
  setComplianceChecks,
  isExtractingSpecs,
  runAIExtraction,
  publicStartupSuppliers,
  shortlistedSupplierIds,
  toggleShortlistSupplier,
  createAndDispatchRFQ,
  publicStartupQuotes,
  onOpenSampleModal,
}: StartupGuidedBuilderProps) {
  const stepContainerRef = useRef<HTMLDivElement>(null)

  // Attach scoped GSAP step transition
  useStepTransition(stepContainerRef, builderStep)

  // Form local state
  const [isLaunching, setIsLaunching] = useState(false)
  const [newSpecInput, setNewSpecInput] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [aiProcessingStage, setAiProcessingStage] = useState<string>("")
  const [targetTolerance, setTargetTolerance] = useState("High Precision (±0.05mm)")
  const [surfaceFinish, setSurfaceFinish] = useState("Standard Matte / Anodized")
  const [paymentTerms, setPaymentTerms] = useState(
    "Tripartite Milestone Escrow (20% Advance / 40% QC / 40% Delivery)"
  )
  const [evaluationWeights, setEvaluationWeights] = useState({
    price: 40,
    quality: 30,
    leadTime: 20,
    compliance: 10,
  })

  // The 7 official guided sourcing steps strictly matching prompt specification
  const STEPS = [
    { num: 1, label: "Plain-Language Intake" },
    { num: 2, label: "Scope & Objectives" },
    { num: 3, label: "Stakeholder Input" },
    { num: 4, label: "Sourcing Strategy" },
    { num: 5, label: "Supplier Discovery" },
    { num: 6, label: "Evaluation Builder" },
    { num: 7, label: "Review & Launch" },
  ]

  // Sample prompt guidance chips that populate input without auto-submitting
  const GUIDANCE_CHIPS = [
    {
      label: "What problem are we solving?",
      prompt: "\n- Problem to solve: High tooling costs and defect rates in our current batch.",
      icon: "help_outline",
    },
    {
      label: "Who will use this and how?",
      prompt: "\n- Target end-users: Tier-1 consumer electronics and high-durability field hardware.",
      icon: "people",
    },
    {
      label: "What outcome do we need?",
      prompt: "\n- Target outcome: Drop-tested enclosure with ±0.05mm tolerance and matte black finish.",
      icon: "verified",
    },
    {
      label: "What constraints should we consider?",
      prompt: "\n- Constraints: Strict delivery within 20 days and budget under ₹1.5 Lakh.",
      icon: "tune",
    },
  ]

  // Industry preset chips
  const INDUSTRY_PRESETS = [
    {
      label: "Packaging Sample",
      category: "Packaging & Printing" as CatalogCategory,
      qty: 500,
      budget: 75000,
      text: "Need 500 custom rigid printed boxes for our D2C organic skincare launch by next month, budget under ₹80k with EVA foam inserts",
      icon: "inventory_2",
      iconColor: "text-amber-600",
    },
    {
      label: "Drone CNC Sample",
      category: "Prototyping & Product Development" as CatalogCategory,
      qty: 20,
      budget: 120000,
      text: "Looking for 5-axis CNC machining for 20 sets of 6061-T6 aluminum drone arm chassis with ±0.05mm tolerance and black anodizing, budget ₹1.2 Lakh",
      icon: "precision_manufacturing",
      iconColor: "text-emerald-700",
    },
    {
      label: "Digital ERP Sample",
      category: "IT & Digital Services" as CatalogCategory,
      qty: 1,
      budget: 180000,
      text: "Need full-stack development team for custom ERP inventory workflow with enterprise cloud architecture and Next.js 15, budget ₹1.8 Lakh",
      icon: "terminal",
      iconColor: "text-blue-700",
    },
  ]

  // Add specification tag handler
  const handleAddSpec = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSpecInput.trim()) return
    addSpecification(newSpecInput.trim())
    setNewSpecInput("")
  }

  // Handle Step 1 Analyze & Proceed
  const handleAnalyzeAndProceed = async () => {
    if (!requirementText.trim() || requirementText.trim().length < 15) {
      setValidationError("Please enter at least 15 characters describing what your business needs.")
      return
    }
    setValidationError(null)

    trackTelemetryEvent("procurement_started", {
      category: selectedCategory,
      targetBudget,
      quantity,
      intakeLength: requirementText.trim().length,
    })

    // Meaningful processing stage feedback
    setAiProcessingStage("Submitting requirement...")
    setTimeout(() => setAiProcessingStage("Understanding specification & extracting tolerances..."), 400)
    setTimeout(() => setAiProcessingStage("Checking MSME cluster capabilities..."), 800)

    try {
      const extracted = await runAIExtraction(requirementText)
      if (extracted?.category) {
        setSelectedCategory(extracted.category as CatalogCategory)
      }
      if (extracted?.targetBudget) {
        setTargetBudget(extracted.targetBudget)
      }
      if (extracted?.quantity) {
        setQuantity(extracted.quantity)
      }
      setAiProcessingStage("")
      setBuilderStep(2)
    } catch {
      setAiProcessingStage("")
      // If AI fails, preserve requirement and gracefully advance to Step 2
      setBuilderStep(2)
    }
  }

  // Step 7 Launch Procurement Event
  const handleLaunchProcurement = () => {
    if (isLaunching) return
    setIsLaunching(true)
    trackTelemetryEvent("rfq_dispatched", {
      category: selectedCategory,
      quantity,
      targetBudget,
      suppliersCount: shortlistedSupplierIds.length,
    })
    createAndDispatchRFQ(shortlistedSupplierIds)
    navigate("startup.home")
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ─── SEVEN-STEP PROGRESS NAVIGATION (Sticky Header) ───────────────────── */}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-xl rounded-2xl border border-[#EAECEF] p-4 sm:p-5 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[620px] relative px-2">
          {/* Background Connecting Line */}
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 z-0" />
          {/* Active Progress Fill Line */}
          <div
            className="absolute top-4 left-6 h-0.5 bg-[#051F16] z-0 transition-all duration-300 ease-out"
            style={{ width: `${((builderStep - 1) / 6) * 100}%` }}
          />

          {STEPS.map((s) => {
            const isCompleted = s.num < builderStep
            const isActive = s.num === builderStep
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setBuilderStep(s.num)}
                className="relative z-10 flex flex-col items-center group cursor-pointer"
                title={`Jump to Step ${s.num}: ${s.label}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? "bg-[#051F16] text-white ring-4 ring-[#A3F65C]/40 scale-110 shadow-xs"
                      : isCompleted
                      ? "bg-[#051F16] text-[#A3F65C] ring-2 ring-emerald-900"
                      : "bg-white text-slate-400 border-2 border-slate-200 group-hover:border-slate-300 group-hover:text-slate-600"
                  }`}
                >
                  {isCompleted ? (
                    <Icons.Check className="w-4 h-4 text-[#A3F65C]" />
                  ) : (
                    s.num
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold mt-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? "text-[#051F16] font-extrabold"
                      : isCompleted
                      ? "text-slate-700"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── MAIN STEP WORKSPACE CONTAINER ────────────────────────────────────── */}
      <div ref={stepContainerRef}>
        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1: PLAIN-LANGUAGE INTAKE
        ══════════════════════════════════════════════════════════════════════ */}
        {builderStep === 1 && (
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C]" />
                <span>STEP 1 OF 7</span>
              </div>
              <h2
                className="text-xl sm:text-2xl font-extrabold text-[#051F16]"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Plain-Language Requirement Intake
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Describe what your business needs. MPI can help structure the information for sourcing.
              </p>
            </div>

            {/* Sample Guidance Section (Prompt Chips) */}
            <div className="space-y-2.5 bg-[#F2F6F8] p-4 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Icons.Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Sample Guidance (Click to add structured prompts to your input)</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {GUIDANCE_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const newText = requirementText
                        ? `${requirementText.trim()} ${chip.prompt.trim()}`
                        : chip.prompt.trim()
                      setRequirementText(newText)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-2xs"
                  >
                    <MaterialIcon icon={chip.icon} size={14} className="text-slate-500" />
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              {/* Industry Presets */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Or load sample preset:
                </span>
                {INDUSTRY_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRequirementText(p.text)
                      setSelectedCategory(p.category)
                      setQuantity(p.qty)
                      setTargetBudget(p.budget)
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer shadow-2xs"
                  >
                    <MaterialIcon icon={p.icon} size={13} className={p.iconColor} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Multiline Requirement Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Detailed Procurement Requirement <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {requirementText.length} characters (min 15 recommended)
                </span>
              </div>

              <textarea
                value={requirementText}
                onChange={(e) => {
                  setRequirementText(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                rows={5}
                placeholder="e.g. We require 500 custom rigid printed boxes for our D2C organic skincare launch by next month. Needs food-grade cardboard, black matte lamination, gold foil embossing on top lid, and custom EVA foam insert slots for 3 glass serum bottles. Target budget under ₹80k..."
                className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16] text-xs sm:text-sm text-slate-800 leading-relaxed placeholder:text-slate-400 transition-all resize-y"
              />

              {validationError && (
                <div className="text-xs text-red-600 font-semibold flex items-center gap-1 pt-1">
                  <Icons.AlertCircle className="w-3.5 h-3.5" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* AI Processing Status Feedback */}
            {isExtractingSpecs && (
              <div className="p-4 bg-[#F4FBF7] rounded-xl border border-emerald-200 flex items-center gap-3 animate-fade-in">
                <div className="w-5 h-5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="text-xs text-emerald-900 font-semibold">
                  <span>{aiProcessingStage || "Processing requirement with MPI AI Spec Engine..."}</span>
                </div>
              </div>
            )}

            {/* Analyze & Proceed Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAnalyzeAndProceed}
                disabled={isExtractingSpecs}
                className="w-full py-4 rounded-xl font-bold text-sm bg-[#051F16] text-[#A3F65C] hover:bg-[#0A3525] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>{isExtractingSpecs ? "Analyzing Requirements..." : "Analyze & Proceed"}</span>
                <Icons.ArrowRight className="w-4 h-4 text-[#A3F65C] transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2: SCOPE & OBJECTIVES
        ══════════════════════════════════════════════════════════════════════ */}
        {builderStep === 2 && (
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C]" />
                <span>STEP 2 OF 7</span>
              </div>
              <h2
                className="text-xl sm:text-2xl font-extrabold text-[#051F16]"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Scope & Technical Objectives
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Select your industrial manufacturing category and verify extracted technical specifications.
              </p>
            </div>

            {/* Category Selector Grid */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Primary Industrial Sourcing Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CATALOG_CATEGORIES.map((cat) => {
                  const isCatSelected = selectedCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`p-3 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer flex flex-col justify-between h-20 ${
                        isCatSelected
                          ? "bg-[#051F16] text-white border-[#051F16] shadow-xs"
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className="line-clamp-2">{cat}</span>
                      {isCatSelected && (
                        <span className="text-[10px] text-[#A3F65C] font-semibold flex items-center gap-1">
                          <Icons.Check className="w-3 h-3" />
                          <span>Selected</span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Extracted Specifications Manager */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                Extracted Engineering & Material Specifications
              </label>

              <div className="flex flex-wrap gap-2 min-h-[44px] p-3 rounded-xl bg-[#F2F6F8] border border-slate-200">
                {specifications.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">
                    No specifications added yet. Add custom specs below.
                  </span>
                ) : (
                  specifications.map((spec, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-semibold text-slate-800 border border-slate-200 shadow-2xs"
                    >
                      <span>{spec}</span>
                      <button
                        type="button"
                        onClick={() => removeSpecification(i)}
                        className="text-slate-400 hover:text-red-600 font-bold ml-0.5 cursor-pointer"
                        title="Remove specification"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add Custom Spec Field */}
              <form onSubmit={handleAddSpec} className="flex gap-2">
                <input
                  type="text"
                  value={newSpecInput}
                  onChange={(e) => setNewSpecInput(e.target.value)}
                  placeholder="e.g. UL94-V0 Flame Retardant / 6061-T6 Aluminum / NABL Certified"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16] text-xs text-slate-800"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#051F16] text-white hover:bg-[#0A3525] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  + Add Spec
                </button>
              </form>
            </div>

            {/* Tolerances & Surface Finish Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dimensional Tolerance Target
                </label>
                <select
                  value={targetTolerance}
                  onChange={(e) => setTargetTolerance(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#051F16]"
                >
                  <option>High Precision (±0.05mm)</option>
                  <option>Standard Industrial (±0.15mm)</option>
                  <option>Commercial Batch (±0.5mm)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Surface Treatment & Finishing
                </label>
                <select
                  value={surfaceFinish}
                  onChange={(e) => setSurfaceFinish(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#051F16]"
                >
                  <option>Standard Matte / Anodized</option>
                  <option>Gloss Lamination / Powder Coated</option>
                  <option>Raw Machined / As Extruded</option>
                </select>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <MPIButton variant="outline" size="md" onClick={() => setBuilderStep(1)}>
                ← Back to Intake
              </MPIButton>
              <MPIButton variant="primary" size="md" onClick={() => setBuilderStep(3)}>
                Continue to Stakeholder Input →
              </MPIButton>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 3: STAKEHOLDER INPUT
        ══════════════════════════════════════════════════════════════════════ */}
        {builderStep === 3 && (
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C]" />
                <span>STEP 3 OF 7</span>
              </div>
              <h2
                className="text-xl sm:text-2xl font-extrabold text-[#051F16]"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Stakeholder Input & Commercial Constraints
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Define batch quantities, commercial target budget, and delivery timeline requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              {/* Batch Quantity */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Target Batch Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#051F16] font-bold text-sm"
                  min="1"
                />
                <div className="flex gap-1.5 pt-1">
                  {[100, 500, 1000, 5000].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer ${
                        quantity === q
                          ? "bg-[#051F16] text-[#A3F65C] border-[#051F16]"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {q.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Budget */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Target Commercial Budget (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={targetBudget}
                  onChange={(e) => setTargetBudget(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#051F16] font-bold text-sm"
                  step="5000"
                />
                <span className="text-[11px] text-slate-500 block">
                  Formatted: <strong>₹{targetBudget.toLocaleString("en-IN")}</strong> (Est. Unit: ₹
                  {Math.round(targetBudget / Math.max(1, quantity))})
                </span>
              </div>

              {/* Delivery Location */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Delivery Destination (City / State) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  placeholder="e.g. Bengaluru, Karnataka 560038"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#051F16]"
                  required
                />
              </div>

              {/* Target Deadline */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Target Delivery Deadline <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#051F16]"
                  required
                />
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <MPIButton variant="outline" size="md" onClick={() => setBuilderStep(2)}>
                ← Back to Scope
              </MPIButton>
              <MPIButton variant="primary" size="md" onClick={() => setBuilderStep(4)}>
                Continue to Sourcing Strategy →
              </MPIButton>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 4: SOURCING STRATEGY
        ══════════════════════════════════════════════════════════════════════ */}
        {builderStep === 4 && (
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C]" />
                <span>STEP 4 OF 7</span>
              </div>
              <h2
                className="text-xl sm:text-2xl font-extrabold text-[#051F16]"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Sourcing Strategy & Statutory Compliance
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Configure manufacturer qualification audits, testing protocols, and milestone escrow terms.
              </p>
            </div>

            {/* Statutory Compliance Checklist */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Mandatory Manufacturer Audits & Certifications
              </label>

              {[
                "ISO 9001:2015 Quality Management Standard",
                "ZED (Zero Defect Zero Effect) Gold/Silver Certified",
                "Udyam Statutory MSME Registration",
                "NABL Accredited Third-Party Lab Testing Validation",
              ].map((cert) => {
                const isChecked = complianceChecks.includes(cert)
                return (
                  <div
                    key={cert}
                    onClick={() => {
                      setComplianceChecks((prev) =>
                        isChecked ? prev.filter((c) => c !== cert) : [...prev, cert]
                      )
                    }}
                    className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? "bg-[#F4FBF7] border-emerald-300 text-[#051F16]"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-xs font-bold">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked
                            ? "bg-[#051F16] border-[#051F16] text-[#A3F65C]"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isChecked && <Icons.Check className="w-3 h-3 text-[#A3F65C]" />}
                      </div>
                      <span>{cert}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                      {cert.includes("ZED") ? "Gov Grant Eligible" : "Audited"}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Commercial Payment Terms */}
            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <label className="block font-bold text-slate-700">
                Payment Protection & Escrow Protocol
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#051F16]"
              >
                <option>Tripartite Milestone Escrow (20% Advance / 40% QC / 40% Delivery)</option>
                <option>100% Milestone Release Post-NABL QC Inspection Pass</option>
                <option>Net-30 Invoice Financing (Requires DPIIT Registration)</option>
              </select>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <MPIButton variant="outline" size="md" onClick={() => setBuilderStep(3)}>
                ← Back to Stakeholder Input
              </MPIButton>
              <MPIButton variant="primary" size="md" onClick={() => setBuilderStep(5)}>
                Continue to Supplier Discovery →
              </MPIButton>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 5: SUPPLIER DISCOVERY
        ══════════════════════════════════════════════════════════════════════ */}
        {builderStep === 5 && (
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C]" />
                  <span>STEP 5 OF 7</span>
                </div>
                <h2
                  className="text-xl sm:text-2xl font-extrabold text-[#051F16]"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Supplier Discovery & Cluster Matching
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Review anonymized verified MSME manufacturers matched by machine capacity and statutory audits.
                </p>
              </div>

              <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shrink-0">
                {shortlistedSupplierIds.length} Shortlisted for RFP
              </span>
            </div>

            {/* Supplier Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicStartupSuppliers.map((sup) => {
                const isShortlisted = shortlistedSupplierIds.includes(sup.id)
                return (
                  <div
                    key={sup.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1.5">
                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                          {sup.displayName}
                        </h4>
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {sup.matchScore}% Match
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {sup.category} · {sup.city}, {sup.state}
                      </div>

                      <div className="mt-2.5 p-2 bg-[#F2F6F8] rounded-lg text-[11px] text-slate-600 space-y-0.5">
                        <div>
                          <strong>MOQ:</strong> {sup.moq}
                        </div>
                        <div>
                          <strong>Lead Time:</strong> {sup.leadTime}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSampleModal(sup)}
                        className="text-[11px] font-bold text-slate-700 hover:text-[#051F16] underline cursor-pointer"
                      >
                        Request Sample
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleShortlistSupplier(sup.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isShortlisted
                            ? "bg-[#051F16] text-[#A3F65C]"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {isShortlisted ? "✓ Shortlisted" : "+ Shortlist"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <MPIButton variant="outline" size="md" onClick={() => setBuilderStep(4)}>
                ← Back to Strategy
              </MPIButton>
              <MPIButton variant="primary" size="md" onClick={() => setBuilderStep(6)}>
                Continue to Evaluation Builder →
              </MPIButton>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 6: EVALUATION BUILDER
        ══════════════════════════════════════════════════════════════════════ */}
        {builderStep === 6 && (
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C]" />
                <span>STEP 6 OF 7</span>
              </div>
              <h2
                className="text-xl sm:text-2xl font-extrabold text-[#051F16]"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Quote Evaluation Matrix & Commercial Modeling
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Configure scoring criteria weights and review baseline cost benchmarks.
              </p>
            </div>

            {/* Evaluation Weights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-[#F2F6F8] rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Price Competitiveness
                </span>
                <span className="text-xl font-extrabold text-[#051F16]">
                  {evaluationWeights.price}%
                </span>
              </div>
              <div className="p-3.5 bg-[#F2F6F8] rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Quality Assurance
                </span>
                <span className="text-xl font-extrabold text-[#051F16]">
                  {evaluationWeights.quality}%
                </span>
              </div>
              <div className="p-3.5 bg-[#F2F6F8] rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Lead Time Feasibility
                </span>
                <span className="text-xl font-extrabold text-[#051F16]">
                  {evaluationWeights.leadTime}%
                </span>
              </div>
              <div className="p-3.5 bg-[#F2F6F8] rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  ZED Compliance
                </span>
                <span className="text-xl font-extrabold text-[#051F16]">
                  {evaluationWeights.compliance}%
                </span>
              </div>
            </div>

            {/* Itemized Cost Breakdown Preview */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-200 flex justify-between">
                <span>Estimated Cost Breakdown Benchmark</span>
                <span className="text-emerald-700">Market Baseline: ₹85,000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tooling & Setup Amortization:</span>
                <span className="font-mono">₹15,000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Unit Production ({quantity} units):</span>
                <span className="font-mono">₹45,000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Quality Inspection & Drop Testing:</span>
                <span className="font-mono">₹5,000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Logistics & GST (18%):</span>
                <span className="font-mono">₹10,000</span>
              </div>
              <div className="flex justify-between text-slate-900 font-extrabold pt-2 border-t border-slate-200 text-sm">
                <span>Target Landed Cost:</span>
                <span className="text-[#051F16]">₹{targetBudget.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <MPIButton variant="outline" size="md" onClick={() => setBuilderStep(5)}>
                ← Back to Supplier Discovery
              </MPIButton>
              <MPIButton variant="primary" size="md" onClick={() => setBuilderStep(7)}>
                Continue to Review & Launch →
              </MPIButton>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 7: REVIEW & LAUNCH
        ══════════════════════════════════════════════════════════════════════ */}
        {builderStep === 7 && (
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C]" />
                <span>STEP 7 OF 7</span>
              </div>
              <h2
                className="text-xl sm:text-2xl font-extrabold text-[#051F16]"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Review Sourcing Package & Launch Procurement
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Confirm your procurement parameters before generating the official RFQ and dispatching to matched suppliers.
              </p>
            </div>

            {/* Summary Review Card */}
            <div className="p-5 bg-[#F2F6F8] rounded-xl border border-slate-200 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Category & Scope
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {selectedCategory}
                  </span>
                  <span className="text-slate-500 block">
                    {formatScopeDisplay(selectedCategory, quantity)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Commercial Target Budget
                  </span>
                  <span className="font-extrabold text-[#051F16] text-sm">
                    ₹{targetBudget.toLocaleString("en-IN")}
                  </span>
                  <span className="text-slate-500 block">
                    Delivery to {deliveryLocation} by {deadlineDate}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Verified MSME Suppliers Selected ({shortlistedSupplierIds.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {shortlistedSupplierIds.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Contextual Non-Blocking Government Schemes Callout */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-600 text-white">
                    <Icons.Award className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-bold text-emerald-950">
                    Government Subsidy Opportunities for this Procurement
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                  Non-Dilutive Benefit
                </span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                Depending on your supplier&apos;s statutory certifications (e.g. ZED Gold, MSME Udyam), your startup may qualify for up to 80% reimbursement on quality testing, tooling, or intellectual property fees post-procurement through central DC-MSME and DPIIT schemes.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-emerald-200/60 text-[11px]">
                <span className="text-emerald-800">
                  Subsidies are post-procurement statutory claims and do NOT reduce the payable PO amount to the supplier.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    trackTelemetryEvent("scheme_matcher_opened", {
                      source: "guided_builder_step7",
                      category: selectedCategory,
                      targetBudget,
                    })
                    navigate("startup.schemes")
                  }}
                  className="font-bold text-emerald-900 hover:text-emerald-950 underline cursor-pointer shrink-0"
                >
                  Explore Schemes for this RFQ →
                </button>
              </div>
            </div>

            {/* Launch Action */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <MPIButton variant="outline" size="md" onClick={() => setBuilderStep(6)}>
                ← Back to Evaluation Builder
              </MPIButton>

              <button
                type="button"
                onClick={handleLaunchProcurement}
                disabled={isLaunching}
                className="px-6 py-3.5 rounded-xl font-bold text-sm bg-[#051F16] text-[#A3F65C] hover:bg-[#0A3525] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Icons.Sparkles className="w-4 h-4 text-[#A3F65C]" />
                <span>{isLaunching ? "Dispatching RFQ..." : "Launch Procurement Event & Dispatch RFQ"}</span>
                <Icons.ArrowRight className="w-4 h-4 text-[#A3F65C] transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
