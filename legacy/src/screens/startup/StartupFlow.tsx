import { useState, useEffect } from "react"
import { NavProps, Screen } from "../../App"
import {
  useProcurement,
  PublicStartupSupplier,
  PublicStartupQuote,
  SourcingHistoryEvent,
} from "../../context/ProcurementContext"
import { CATALOG_CATEGORIES } from "../../lib/mpiCatalog"
import StartupSidebar from "./StartupSidebar"
import StartupHelpModal from "./StartupHelpModal"
import StartupCommandCenter from "./StartupCommandCenter"
import StartupGuidedBuilder from "./StartupGuidedBuilder"
import StartupSettings from "./StartupSettings"
import {
  Icons,
  MPIButton,
  MPICard,
  MPIStatCard,
  MPIVerifiedBadge,
  MPIStatusBadge,
} from "../../components/design-system/MPIDesignSystem"
import MaterialIcon from "../../components/ui/MaterialIcon"
import { trackTelemetryEvent } from "../../services/telemetryService"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  chatWithProcurementCopilot,
  fallbackCopilotReply,
  auditRFQReadinessWithAI,
  RFQReadinessResult,
  analyzeAndNegotiateQuoteWithAI,
  QuoteNegotiationResult,
  generateAwardMemoWithAI,
  AwardMemoResult,
  preScreenSchemeEligibilityWithAI,
  SchemeEligibilityChecklist,
  draftDisputeResolutionWithAI,
  DisputeMediationResult,
  isGreetingOrInsufficientRequirement,
  type ExtractedProcurementSpecs,
} from "../../services/aiService"
import { formatScopeDisplay } from "../Home"

// Markdown and inline formatting parser for real conversational LLM responses
function parseInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="bg-slate-200/80 px-1 py-0.5 rounded text-[10px] font-mono text-blue-900 font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function renderCopilotMarkdown(text: string) {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []

  let listBuffer: string[] = []
  let listType: "ul" | "ol" | null = null

  const flushList = () => {
    if (listBuffer.length > 0 && listType) {
      if (listType === "ul") {
        elements.push(
          <ul
            key={`list-${elements.length}`}
            className="my-1.5 space-y-1 pl-4 list-disc marker:text-emerald-700"
          >
            {listBuffer.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {parseInlineFormatting(item)}
              </li>
            ))}
          </ul>,
        )
      } else {
        elements.push(
          <ol
            key={`list-${elements.length}`}
            className="my-1.5 space-y-1 pl-4 list-decimal marker:font-bold marker:text-[#051F16]"
          >
            {listBuffer.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {parseInlineFormatting(item)}
              </li>
            ))}
          </ol>,
        )
      }
      listBuffer = []
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!line) {
      flushList()
      continue
    }

    if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
      if (listType !== "ul") flushList()
      listType = "ul"
      listBuffer.push(line.replace(/^[-*•]\s+/, ""))
      continue
    }

    const numMatch = line.match(/^\d+\.\s+(.+)$/)
    if (numMatch) {
      if (listType !== "ol") flushList()
      listType = "ol"
      listBuffer.push(numMatch[1])
      continue
    }

    flushList()

    if (line.startsWith("### ")) {
      elements.push(
        <h4
          key={i}
          className="font-bold text-slate-900 mt-2 mb-1 text-xs sm:text-sm"
        >
          {parseInlineFormatting(line.replace(/^###\s+/, ""))}
        </h4>,
      )
      continue
    }

    elements.push(
      <p key={i} className="my-1 leading-relaxed">
        {parseInlineFormatting(line)}
      </p>,
    )
  }

  flushList()
  return elements
}

interface CopilotNextAction {
  label: string
  query?: string
  screen?: string
  badge?: string
  icon?: string
}

interface CopilotMessageItem {
  role: "ai" | "user"
  text: string
  time: string
  isLive?: boolean
  suggestedSpecs?: string[]
  suggestedNavigation?: {
    screen: string
    label: string
  }
  recommendedNextActions?: CopilotNextAction[]
}

function getRecommendedNextActions(
  messageText: string,
  category: string,
  quantity: number,
  targetBudget: number,
): CopilotNextAction[] {
  const lower = (messageText || "").toLowerCase()
  if (lower.includes("pricing") || lower.includes("cost") || lower.includes("budget") || lower.includes("rate") || lower.includes("amortiz")) {
    return [
      {
        label: "Calculate MSME ZED Subsidy Grant (Save up to 80%)",
        query: `Calculate our exact subsidy grant eligibility under MSME ZED & Design Clinic for ₹${targetBudget.toLocaleString("en-IN")} order.`,
        badge: "Grant Savings",
        icon: "💰",
      },
      {
        label: "Compare Shortlisted Supplier Bids",
        screen: "startup.procurement",
        badge: "Live Quotes",
        icon: "🏭",
      },
      {
        label: "Draft Volume Discount Negotiation Message",
        query: "Draft a formal supplier negotiation message requesting a 10% repeat order discount with milestone payment escrow.",
        badge: "Negotiation",
        icon: "📝",
      },
      {
        label: "Add Tooling Amortization Clause to RFQ",
        query: "How do we draft the RFQ clause to amortize tooling over 3 repeat production runs?",
        badge: "Legal / PO",
        icon: "⚖️",
      },
    ]
  } else if (lower.includes("scheme") || lower.includes("subsidy") || lower.includes("zed") || lower.includes("grant") || lower.includes("sisfs")) {
    return [
      {
        label: "View All 30 Government Schemes for Startups",
        screen: "government-schemes.match",
        badge: "30 Schemes",
        icon: "📜",
      },
      {
        label: "Add ZED Quality Audit Verification to RFQ",
        query: "Add standard ZED Gold certification & ISO 9001 compliance criteria into our RFQ specifications.",
        badge: "Quality Spec",
        icon: "✨",
      },
      {
        label: "Simulate Landed Cost with Subsidy Applied",
        query: `Simulate our final landed purchase price after deducting eligible central government manufacturing subsidies for ${category}.`,
        badge: "Landed Cost",
        icon: "📊",
      },
      {
        label: "Proceed to Supplier Quotation Comparison",
        screen: "startup.procurement",
        badge: "Workspace",
        icon: "🚀",
      },
    ]
  } else if (lower.includes("spec") || lower.includes("quality") || lower.includes("drop") || lower.includes("tolerance") || lower.includes("audit")) {
    return [
      {
        label: "Verify MSME Machine Capacity & Audits",
        screen: "startup.procurement",
        badge: "Vetted MSMEs",
        icon: "⚙️",
      },
      {
        label: "Draft 10-Milestone Inspection Pass Gates",
        query: "Generate a 10-milestone quality inspection checklist and sign-off criteria for this production run.",
        badge: "QC Gates",
        icon: "🛡️",
      },
      {
        label: "Run Landed Pricing Simulation",
        query: `What is the benchmark manufacturing cost per unit for ${quantity} units with these quality specifications?`,
        badge: "Benchmarking",
        icon: "📈",
      },
      {
        label: "Check Applicable MSME Quality Subsidies",
        query: "Can we claim quality certification subsidies under the Ministry of MSME for these testing protocols?",
        badge: "Subsidy Match",
        icon: "📜",
      },
    ]
  }

  // Default universal next-step recommendations
  return [
    {
      label: "Benchmark Unit Pricing & Tooling Amortization",
      query: `Break down the industrial unit economics, tooling fee amortization across ${quantity} units, and target landed cost for ${category}.`,
      badge: "Pricing Intelligence",
      icon: "📊",
    },
    {
      label: "Unlock MSME ZED Testing Subsidies (Save Up to 80%)",
      query: `Which central government MSME schemes, such as ZED Certification or Design Clinic, can subsidize our tooling and testing costs for ${category}?`,
      badge: "Subsidies",
      icon: "💰",
    },
    {
      label: "Match & Compare Verified MSME Suppliers",
      screen: "startup.procurement",
      badge: "Supplier Search",
      icon: "🏭",
    },
    {
      label: "Draft Supplier Negotiation Script & Milestone Terms",
      query: `Draft a professional negotiation message for suppliers for ${category} with 10-milestone escrow protection and volume repeat discount.`,
      badge: "Negotiation",
      icon: "🤝",
    },
  ]
}

export default function StartupFlow({
  navigate,
  goBack,
  currentScreen,
}: NavProps) {
  const {
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
    isExtractingSpecs,
    runAIExtraction,
    publicStartupSuppliers,
    shortlistedSupplierIds,
    toggleShortlistSupplier,
    activeRFQ,
    createAndDispatchRFQ,
    publicStartupQuotes,
    selectedQuoteId,
    selectQuote,
    loadDemoQuotes,
    currentMilestone,
    advanceMilestone,
    setMilestone,
    ordersList,
    sourcingHistory,
    MARKET_BASELINE_COST,
    sampleRequests,
    requestSample,
    updateSampleStatus,
    approveSampleAndProceedToRFQ,
    startupProfile,
    updateStartupProfile,
    backendSyncState,
    refreshBackendSync,
    rfqPersistenceStatus,
    rfqPersistenceError,
  } = useProcurement()

  // Sample Request Modal & Help Modal State
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [sampleModalOpen, setSampleModalOpen] = useState(false)
  const [selectedSampleSupplier, setSelectedSampleSupplier] =
    useState<PublicStartupSupplier | null>(null)
  const [sampleQty, setSampleQty] = useState(2)
  const [sampleCustomNotes, setSampleCustomNotes] = useState("")
  const [sampleShippingAddress, setSampleShippingAddress] = useState(
    "AuraVeda Labs, 4th Floor, Indiranagar 100ft Road, Bengaluru, Karnataka 560038",
  )
  const [samplePhone, setSamplePhone] = useState("+91 98450 12890")

  // Evaluation state for My Samples review
  const [evaluatingSampleId, setEvaluatingSampleId] = useState<string | null>(
    null,
  )
  const [evalRating, setEvalRating] = useState(5)
  const [evalDimensionPass, setEvalDimensionPass] = useState(true)
  const [evalFinishPass, setEvalFinishPass] = useState(true)
  const [evalDurabilityPass, setEvalDurabilityPass] = useState(true)
  const [evalNotes, setEvalNotes] = useState(
    "Dimensions verified against CAD tolerance. Surface finish is clean and free of bubbles.",
  )

  // Builder step state (1 to 7)
  const [builderStep, setBuilderStep] = useState(
    currentScreen === "startup.match-results" || currentScreen === "startup.shortlist"
      ? 5
      : currentScreen === "startup.ai-analysis"
      ? 2
      : currentScreen === "startup.rfq" || currentScreen === "startup.procurement"
      ? (specifications.length > 0 ? 2 : 1)
      : 1,
  )

  // Sync builderStep if screen changes while component is mounted
  useEffect(() => {
    if (currentScreen === "startup.match-results" || currentScreen === "startup.shortlist") {
      setBuilderStep(5)
    } else if (currentScreen === "startup.ai-analysis") {
      setBuilderStep(2)
    } else if (currentScreen === "startup.rfq" || currentScreen === "startup.procurement") {
      // Enter the RFQ creation flow at Step 1 (or Step 2 if specifications are already extracted)
      setBuilderStep((prev) => {
        if (prev >= 1 && prev <= 7 && prev !== 6) return prev
        return specifications.length > 0 ? 2 : 1
      })
    }
  }, [currentScreen, specifications.length])
  const [step1Guidance, setStep1Guidance] = useState<string | null>(null)
  const [newSpecInput, setNewSpecInput] = useState("")
  const [complianceChecks, setComplianceChecks] = useState<string[]>([
    "ISO 9001:2015 Quality Management",
    "ZED (Zero Defect Zero Effect) Certified",
    "Udyam Statutory MSME Registration",
  ])

  // AI Copilot state
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessageItem[]>([
    {
      role: "ai",
      text: `Hello! I am your MPI procurement support. I have calibrated your active requirement for **${selectedCategory} (${formatScopeDisplay(selectedCategory, quantity)})** (Target Budget: ₹${targetBudget.toLocaleString("en-IN")}).\n\nI can assist you with:\n- **Unit Pricing Benchmarks & Amortization**\n- **MSME Schemes (ZED, SISFS, CGTMSE Subsidies)**\n- **Technical Engineering Specs & Quality Clauses**\n- **Supplier Negotiation Script & Milestone Terms**\n\nWhat would you like to examine?`,
      time: "10:00 AM",
      isLive: true,
      suggestedSpecs: [
        "ISTA-1A Certified Drop-Test Compliance",
        "MSME ZED Quality Audit Verification",
      ],
      recommendedNextActions: [
        {
          label: "Benchmark Unit Pricing & Tooling Amortization",
          query: `Break down the industrial unit economics, tooling fee amortization across ${quantity} units, and target landed cost for ${selectedCategory}.`,
          badge: "Unit Economics",
          icon: "📊",
        },
        {
          label: "Unlock MSME ZED Testing Subsidies (Save Up to 80%)",
          query: `Which central government MSME schemes, such as ZED Certification or Design Clinic, can subsidize our tooling and testing costs for ${selectedCategory}?`,
          badge: "Subsidies",
          icon: "💰",
        },
        {
          label: "Match & Compare Verified MSME Suppliers",
          screen: "startup.procurement",
          badge: "Supplier Search",
          icon: "🏭",
        },
        {
          label: "Draft Supplier Negotiation Script & Milestone Terms",
          query: `Draft a professional negotiation message for suppliers for ${selectedCategory} with 10-milestone escrow protection and volume repeat discount.`,
          badge: "Negotiation",
          icon: "🤝",
        },
      ],
    },
  ])
  const [copilotInput, setCopilotInput] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi" | "ta" | "te" | "mr" | "gu">("en")
  const [isCopilotTyping, setIsCopilotTyping] = useState(false)
  const [specAddedToast, setSpecAddedToast] = useState<string | null>(null)

  // Voice Assistant state in AI Copilot Workspace
  const [isCopilotVoiceActive, setIsCopilotVoiceActive] = useState(false)
  const [copilotVoiceStatus, setCopilotVoiceStatus] = useState("")
  const [copilotAudioLevel, setCopilotAudioLevel] = useState(0)

  // Mobile sidebar drawer
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Modal states
  const [selectedHistoryInsight, setSelectedHistoryInsight] =
    useState<SourcingHistoryEvent | null>(null)
  const [selectedSupplierDetail, setSelectedSupplierDetail] =
    useState<PublicStartupSupplier | null>(null)
  const [orderFilter, setOrderFilter] =
    useState<"All" | "In Production" | "QC Pass" | "In Transit" | "Delivered">(
      "All",
    )

  // ─── BLUEPRINT AI CAPABILITY STATES ─────────────────────────────────────────
  // 1. AI RFQ Readiness Gate & Specification Completeness Auditor (Items 5, 7, 11, 13, 14)
  const [readinessResult, setReadinessResult] =
    useState<RFQReadinessResult | null>(null)
  const [isAuditingReadiness, setIsAuditingReadiness] = useState(false)

  // 2. AI Negotiation Preparation Copilot (Items 33, 36, 37)
  const [negotiationModal, setNegotiationModal] = useState<{
    isOpen: boolean
    quote: PublicStartupQuote | null
    result: QuoteNegotiationResult | null
    isLoading: boolean
    copied: boolean
  }>({
    isOpen: false,
    quote: null,
    result: null,
    isLoading: false,
    copied: false,
  })

  // 3. AI Institutional Award Memorandum & Decision Record (Items 38, 39, 57)
  const [awardMemoModal, setAwardMemoModal] = useState<{
    isOpen: boolean
    result: AwardMemoResult | null
    isLoading: boolean
    copied: boolean
    weights: { price: number; quality: number; delivery: number; location: number }
  }>({
    isOpen: false,
    result: null,
    isLoading: false,
    copied: false,
    weights: { price: 35, quality: 35, delivery: 20, location: 10 },
  })

  // 4. AI Government Scheme Pre-Screen & Document Checklist (Items 40, 41, 43)
  const [schemeModal, setSchemeModal] = useState<{
    isOpen: boolean
    schemeName: string
    result: SchemeEligibilityChecklist | null
    isLoading: boolean
    checkedDocs: Record<string, boolean>
  }>({
    isOpen: false,
    schemeName: "",
    result: null,
    isLoading: false,
    checkedDocs: {},
  })

  // 5. AI Neutral Dispute & Escrow Mediation Assistant (Item 60)
  const [disputeModal, setDisputeModal] = useState<{
    isOpen: boolean
    orderId: string
    supplierName: string
    buyerName: string
    disputeReason: string
    claimedAmount: number
    result: DisputeMediationResult | null
    isLoading: boolean
    copied: boolean
  }>({
    isOpen: false,
    orderId: "PO-2026-0891",
    supplierName: "Apex Precision Packaging Ltd.",
    buyerName: "TechNova Innovations",
    disputeReason: "Batch sample received with 12% dimensional variance and color bleeding on spot-UV coating.",
    claimedAmount: 18500,
    result: null,
    isLoading: false,
    copied: false,
  })

  const handleOpenDisputeModal = async (customReason?: string) => {
    const reasonToUse = customReason || disputeModal.disputeReason
    setDisputeModal((prev) => ({
      ...prev,
      isOpen: true,
      isLoading: true,
      result: null,
      copied: false,
    }))

    try {
      const res = await draftDisputeResolutionWithAI({
        orderId: disputeModal.orderId,
        supplierName: disputeModal.supplierName,
        buyerName: disputeModal.buyerName,
        disputeReason: reasonToUse,
        milestoneStep: currentMilestone,
        claimedAmount: disputeModal.claimedAmount,
      })
      setDisputeModal((prev) => ({
        ...prev,
        result: res,
        isLoading: false,
      }))
    } catch (err) {
      console.warn("Dispute mediation error:", err)
      setDisputeModal((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleAuditRFQReadiness = async (extractedOverride?: ExtractedProcurementSpecs) => {
    setIsAuditingReadiness(true)
    try {
      const res = await auditRFQReadinessWithAI({
        requirementText,
        category: extractedOverride?.category || selectedCategory,
        quantity: extractedOverride?.quantity ?? quantity,
        targetBudget: extractedOverride?.targetBudget ?? targetBudget,
        specifications: extractedOverride?.specifications || specifications,
        deliveryLocation,
        deadlineDate,
      })
      setReadinessResult(res)
    } catch (err) {
      console.warn("Readiness audit error:", err)
    } finally {
      setIsAuditingReadiness(false)
    }
  }

  const handleOpenNegotiationModal = async (q: PublicStartupQuote) => {
    setNegotiationModal({
      isOpen: true,
      quote: q,
      result: null,
      isLoading: true,
      copied: false,
    })
    try {
      const res = await analyzeAndNegotiateQuoteWithAI(
        { category: selectedCategory, quantity, targetBudget },
        {
          supplierName: q.supplierDisplayName,
          finalLandedCost: q.finalLandedCost,
          unitPrice: q.unitPrice,
          leadDays: q.deliveryDays,
          breakdown: q.breakdown,
        },
      )
      setNegotiationModal((prev) => ({
        ...prev,
        result: res,
        isLoading: false,
      }))
    } catch (err) {
      console.warn("Negotiation analysis error:", err)
      setNegotiationModal((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleOpenAwardMemoModal = async (customWeights?: {
    price: number
    quality: number
    delivery: number
    location: number
  }) => {
    const weights = customWeights || awardMemoModal.weights
    const chosenQuote =
      publicStartupQuotes.find((q) => q.id === selectedQuoteId) ||
      publicStartupQuotes[0]

    setAwardMemoModal((prev) => ({
      ...prev,
      isOpen: true,
      isLoading: true,
      weights,
    }))

    try {
      const res = await generateAwardMemoWithAI(
        {
          category: selectedCategory,
          quantity,
          targetBudget,
          deadline: deadlineDate || "Next 30 Days",
        },
        {
          supplierName: chosenQuote.supplierDisplayName,
          finalLandedCost: chosenQuote.finalLandedCost,
          unitPrice: chosenQuote.unitPrice,
          qualityScore: chosenQuote.qualityScore,
          deliveryDays: chosenQuote.deliveryDays,
        },
        weights,
      )
      setAwardMemoModal((prev) => ({
        ...prev,
        result: res,
        isLoading: false,
      }))
    } catch (err) {
      console.warn("Award memo generation error:", err)
      setAwardMemoModal((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handlePreScreenScheme = async (schemeName: string) => {
    setSchemeModal({
      isOpen: true,
      schemeName,
      result: null,
      isLoading: true,
      checkedDocs: {},
    })

    try {
      const res = await preScreenSchemeEligibilityWithAI(schemeName, {
        type: "Startup",
        category: selectedCategory,
        stage: startupProfile.stage || "Early Stage MVP",
        city: deliveryLocation || "Bengaluru",
      })
      const initialChecked: Record<string, boolean> = {}
      res.mandatoryDocuments.forEach((doc, idx) => {
        initialChecked[doc] = idx < 2
      })
      setSchemeModal((prev) => ({
        ...prev,
        result: res,
        isLoading: false,
        checkedDocs: initialChecked,
      }))
    } catch (err) {
      console.warn("Scheme pre-screen error:", err)
      setSchemeModal((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleResetCopilotChat = () => {
    setCopilotMessages([
      {
        role: "ai",
        text: `New procurement intelligence session initialized for **${selectedCategory} (${formatScopeDisplay(selectedCategory, quantity)})** (Target Budget: ₹${targetBudget.toLocaleString("en-IN")}). How can I assist you with quotes, specs, or vendor negotiations?`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isLive: true,
      },
    ])
  }

  // Voice Assistant: Web Speech API for AI Copilot Workspace
  const toggleCopilotVoice = () => {
    if (isCopilotVoiceActive) {
      setIsCopilotVoiceActive(false)
      setCopilotVoiceStatus("")
      return
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    // Map selected language to BCP-47 tag
    const langMap: Record<string, string> = {
      en: "en-IN",
      hi: "hi-IN",
      ta: "ta-IN",
      te: "te-IN",
      mr: "mr-IN",
      gu: "gu-IN",
    }
    const recognitionLang = langMap[selectedLanguage] || "en-IN"

    if (!SpeechRecognition) {
      // Fallback voice simulation if browser does not support Web Speech API
      setIsCopilotVoiceActive(true)
      setCopilotVoiceStatus("Listening to voice command...")
      const simulatedVoiceText =
        "Can you benchmark standard tooling fees for 1500 units and suggest three mandatory quality testing clauses?"

      let charIdx = 0
      const interval = setInterval(() => {
        charIdx += 6
        setCopilotInput(simulatedVoiceText.slice(0, charIdx))
        setCopilotAudioLevel(Math.random() * 80 + 20)
        if (charIdx >= simulatedVoiceText.length) {
          clearInterval(interval)
          setIsCopilotVoiceActive(false)
          setCopilotVoiceStatus("Voice command captured!")
          setCopilotAudioLevel(0)
          handleCopilotSend(simulatedVoiceText)
        }
      }, 120)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = recognitionLang

      recognition.onstart = () => {
        setIsCopilotVoiceActive(true)
        setCopilotVoiceStatus(`Listening in ${recognitionLang}... Speak your requirement or question.`)
      }

      recognition.onresult = (event: any) => {
        let transcript = ""
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript
        }
        if (transcript) {
          setCopilotInput(transcript)
        }
      }

      recognition.onerror = (event: any) => {
        console.warn("Copilot voice recognition error:", event.error)
        setIsCopilotVoiceActive(false)
        setCopilotVoiceStatus(`Microphone notice: ${event.error}`)
      }

      recognition.onend = () => {
        setIsCopilotVoiceActive(false)
        setCopilotVoiceStatus("Voice input completed.")
        if (copilotInput.trim().length > 3) {
          handleCopilotSend(copilotInput)
        }
      }

      recognition.start()
    } catch (e) {
      console.error("Speech recognition could not be started", e)
      setIsCopilotVoiceActive(false)
      setCopilotVoiceStatus("Microphone access unavailable.")
    }
  }

  const handleCopilotSend = async (customPrompt?: string) => {
    const userMsg = (customPrompt || copilotInput).trim()
    if (!userMsg) return
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const updatedMessages: CopilotMessageItem[] = [
      ...copilotMessages,
      { role: "user", text: userMsg, time: nowTime },
    ]
    setCopilotMessages(updatedMessages)
    setCopilotInput("")
    setIsCopilotTyping(true)

    try {
      const response = await chatWithProcurementCopilot(
        updatedMessages.map((m) => ({ role: m.role, text: m.text })),
        {
          category: selectedCategory,
          quantity,
          targetBudget,
          deliveryLocation,
          specifications,
          language: selectedLanguage,
        },
      )
      setCopilotMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: response.reply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isLive: response.isLive,
          suggestedSpecs: response.suggestedSpecs,
          suggestedNavigation: response.suggestedNavigation,
          recommendedNextActions: getRecommendedNextActions(
            response.reply,
            selectedCategory,
            quantity,
            targetBudget,
          ),
        },
      ])

      // Automatically sync detected parameters from conversation to the live RFQ ledger
      if (response.detectedParameters) {
        if (response.detectedParameters.quantity && response.detectedParameters.quantity !== quantity) {
          setQuantity(response.detectedParameters.quantity)
        }
        if (response.detectedParameters.targetBudget && response.detectedParameters.targetBudget !== targetBudget) {
          setTargetBudget(response.detectedParameters.targetBudget)
        }
        if (response.detectedParameters.category && response.detectedParameters.category !== selectedCategory) {
          setSelectedCategory(response.detectedParameters.category)
        }
      }
    } catch (err) {
      console.warn("Copilot execution error, dynamic fallback engaged:", err)
      const fallback = fallbackCopilotReply(userMsg, {
        category: selectedCategory,
        quantity,
        targetBudget,
        deliveryLocation,
        specifications,
        language: selectedLanguage,
      })
      setCopilotMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: fallback.reply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isLive: false,
          suggestedSpecs: fallback.suggestedSpecs,
          suggestedNavigation: fallback.suggestedNavigation,
          recommendedNextActions: getRecommendedNextActions(
            fallback.reply,
            selectedCategory,
            quantity,
            targetBudget,
          ),
        },
      ])
      if (fallback.detectedParameters) {
        if (fallback.detectedParameters.quantity && fallback.detectedParameters.quantity !== quantity) {
          setQuantity(fallback.detectedParameters.quantity)
        }
        if (fallback.detectedParameters.targetBudget && fallback.detectedParameters.targetBudget !== targetBudget) {
          setTargetBudget(fallback.detectedParameters.targetBudget)
        }
        if (fallback.detectedParameters.category && fallback.detectedParameters.category !== selectedCategory) {
          setSelectedCategory(fallback.detectedParameters.category)
        }
      }
    } finally {
      setIsCopilotTyping(false)
    }
  }

  const navItems = [
    {
      screen: "startup.home" as Screen,
      label: "Overview",
      icon: <Icons.Building className="w-4 h-4" />,
    },
    {
      screen: "startup.procurement" as Screen,
      label: "Guided Sourcing (7 Steps)",
      icon: <Icons.Sparkles className="w-4 h-4" />,
    },
    {
      screen: "startup.ai-assistant" as Screen,
      label: "AI Copilot Workspace",
      icon: <Icons.MessageSquare className="w-4 h-4" />,
    },
    {
      screen: "startup.match-results" as Screen,
      label: "Verified Supplier Matches",
      icon: <Icons.Search className="w-4 h-4" />,
    },
    {
      screen: "startup.samples" as Screen,
      label: "My Samples (Try Before Bulk)",
      icon: <Icons.Package className="w-4 h-4" />,
    },
    {
      screen: "startup.comparison" as Screen,
      label: "Quote Comparison Matrix",
      icon: <Icons.BarChart3 className="w-4 h-4" />,
    },
    {
      screen: "startup.schemes" as Screen,
      label: "Government Schemes",
      icon: <Icons.Coins className="w-4 h-4" />,
    },
    {
      screen: "startup.analytics" as Screen,
      label: "Analytics Studio",
      icon: <Icons.TrendingUp className="w-4 h-4" />,
    },
    {
      screen: "startup.shortlist" as Screen,
      label: "Shortlisted Suppliers",
      icon: <Icons.ShieldCheck className="w-4 h-4" />,
    },
    {
      screen: "startup.status" as Screen,
      label: "10-Milestone Order Tracker",
      icon: <Icons.Clock className="w-4 h-4" />,
    },
    {
      screen: "startup.history" as Screen,
      label: "Sourcing History",
      icon: <Icons.FileText className="w-4 h-4" />,
    },
  ]

  // Shell Layout
  const renderShell = (
    content: React.ReactNode,
    title: string,
    subtitle?: string,
  ) => (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1220] flex font-sans selection:bg-[#051F16] selection:text-white">
      {/* ─── SIDEBAR (Deep Forest #051F16) ───────────────────────────────────────── */}
      <StartupSidebar
        currentScreen={currentScreen}
        navigate={navigate}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        startupProfile={startupProfile}
        ordersList={ordersList}
        onOpenHelp={() => setHelpModalOpen(true)}
      />

      {/* ─── MAIN CONTENT AREA ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 shrink-0 cursor-pointer"
              aria-label="Open Navigation Sidebar"
            >
              <Icons.Menu className="w-5 h-5" />
            </button>

            {/* Back Button */}
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shrink-0"
              title="Go back to previous page"
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
                  onClick={() => navigate("startup.home")}
                  className={`hover:text-slate-900 hover:underline cursor-pointer shrink-0 ${
                    currentScreen === "startup.home" ? "font-bold text-[#051F16]" : ""
                  }`}
                >
                  Startup Hub
                </button>
                {currentScreen !== "startup.home" && (
                  <>
                    <span>/</span>
                    <span className="text-[#051F16] font-semibold truncate max-w-30 sm:max-w-50">
                      {title}
                    </span>
                  </>
                )}
              </div>

              <div
                className="text-sm sm:text-lg font-bold text-[#051F16] tracking-tight truncate"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                {title}
              </div>
              {subtitle && (
                <div className="text-[11px] text-slate-500 truncate hidden sm:block">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Supabase Persistence Sync Pill */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                backendSyncState.isTableExposed
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : backendSyncState.pendingMigration
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
              title={backendSyncState.statusMessage}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendSyncState.isTableExposed
                    ? "bg-emerald-500 animate-pulse"
                    : backendSyncState.pendingMigration
                    ? "bg-amber-500"
                    : "bg-slate-400"
                }`}
              />
              <span>
                {backendSyncState.isTableExposed
                  ? "Cloud Sync Active"
                  : backendSyncState.pendingMigration
                  ? "Sync Initializing"
                  : "Local Session"}
              </span>
            </div>

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
              onClick={() => navigate("startup.analytics")}
              className="flex items-center gap-2 bg-[#FFF7D6] hover:bg-[#ffefb3] text-[#8C6B00] border border-yellow-300 px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              <Icons.TrendingUp className="w-3.5 h-3.5 text-[#D9A400]" />
              <span className="hidden sm:inline">Analytics Studio</span>
              <span className="sm:hidden">Analytics</span>
            </button>

            <MPIButton
              variant="ai"
              size="sm"
              onClick={() => navigate("startup.procurement")}
              icon={<Icons.Sparkles className="w-3.5 h-3.5" />}
            >
              <span className="hidden sm:inline">New Procurement</span>
              <span className="sm:hidden">+ RFQ</span>
            </MPIButton>
          </div>
        </header>

        {/* Sync Status Notice */}
        {backendSyncState.pendingMigration && (
          <div className="bg-amber-500/10 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                Sync Notice
              </span>
              <span>
                Cloud synchronization is initializing. Your RFQ data is safely preserved in your local session.
              </span>
            </div>
            <button
              onClick={() => refreshBackendSync()}
              className="text-amber-800 hover:text-amber-950 font-semibold underline text-xs cursor-pointer ml-2 shrink-0"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {content}
        </main>
      </div>

      {/* SOURCING CYCLE INSIGHTS MODAL */}
      {selectedHistoryInsight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Procurement Sourcing Cycle Dossier
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedHistoryInsight.request}
                </h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {selectedHistoryInsight.id} ·{" "}
                  {selectedHistoryInsight.category} ·{" "}
                  {selectedHistoryInsight.date}
                </div>
              </div>
              <button
                onClick={() => setSelectedHistoryInsight(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            {/* Savings & Baseline Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Market Baseline
                </div>
                <div className="text-sm font-extrabold text-slate-700">
                  ₹{MARKET_BASELINE_COST.toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Landed Price
                </div>
                <div className="text-sm font-extrabold text-[#051F16]">
                  ₹
                  {(
                    MARKET_BASELINE_COST - selectedHistoryInsight.savingsAmount
                  ).toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Net Savings
                </div>
                <div className="text-sm font-extrabold text-[#D9A400]">
                  ₹
                  {selectedHistoryInsight.savingsAmount.toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Time Saved
                </div>
                <div className="text-sm font-extrabold text-emerald-700">
                  {selectedHistoryInsight.timeSaved}
                </div>
              </div>
            </div>

            {/* Anonymized Supplier Context */}
            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <div className="font-bold text-[#051F16] flex items-center justify-between mb-1">
                  <span>Selected Fulfillment Partner:</span>
                  <MPIVerifiedBadge label="Anonymity Guaranteed" />
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  {selectedHistoryInsight.supplierDisplayName}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Direct identity is permanently masked to eliminate broker fee
                  leakage and ensure verified escrow adherence.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">
                    Competitive Quote Spread
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {selectedHistoryInsight.insights.quoteSpread}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">
                    Supplier Competition
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {selectedHistoryInsight.insights.supplierCompetition}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900">
                  Category Intelligence
                </div>
                <div className="text-[11px] text-slate-600">
                  {selectedHistoryInsight.insights.categoryInsight}
                </div>
              </div>

              <div className="p-3 bg-[#FFF7D6] rounded-xl border border-yellow-200 space-y-1">
                <div className="font-bold text-yellow-900">
                  MPI Procurement Support Sourcing Recommendation
                </div>
                <div className="text-[11px] text-yellow-800">
                  {selectedHistoryInsight.insights.procurementRecommendation}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Status: {selectedHistoryInsight.orderStatus}
              </span>
              <MPIButton
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedHistoryInsight(null)
                  navigate("startup.comparison")
                }}
              >
                Open Comparison Matrix →
              </MPIButton>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER DETAILS MODAL (STRICT PRIVACY) */}
      {selectedSupplierDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedSupplierDetail.displayName}
                  </h3>
                  <MPIVerifiedBadge label="Verified MSME" />
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {selectedSupplierDetail.city}, {selectedSupplierDetail.state}{" "}
                  · {selectedSupplierDetail.category}
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplierDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-blue-900">
              <span className="font-bold">MPI Privacy Architecture:</span> Real
              company names, phone numbers, and direct emails are hidden to
              protect quote integrity and institutional escrow protection.
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Match Compatibility</div>
                  <div className="font-bold text-[#051F16] text-sm">
                    {selectedSupplierDetail.matchScore}% Fit
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Standard Lead Time</div>
                  <div className="font-bold text-slate-800 text-sm">
                    {selectedSupplierDetail.leadTime}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Minimum Order Qty (MOQ)</div>
                  <div className="font-bold text-slate-800">
                    {selectedSupplierDetail.moq}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Monthly Capacity</div>
                  <div className="font-bold text-slate-800">
                    {selectedSupplierDetail.capacityPerMonth}
                  </div>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-900 mb-1">
                  Installed Machinery & Equipment:
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[11px]">
                  {selectedSupplierDetail.machinery.join(" • ")}
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-900 mb-1">
                  Statutory Audited Certifications:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSupplierDetail.certifications.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <MPIButton
                variant="outline"
                size="sm"
                onClick={() => {
                  toggleShortlistSupplier(selectedSupplierDetail.id)
                  setSelectedSupplierDetail(null)
                }}
              >
                {shortlistedSupplierIds.includes(selectedSupplierDetail.id)
                  ? "Remove Shortlist"
                  : "+ Shortlist Supplier"}
              </MPIButton>
              <MPIButton
                variant="ai"
                size="sm"
                onClick={() => {
                  const sup = selectedSupplierDetail
                  setSelectedSupplierDetail(null)
                  setSelectedSampleSupplier(sup)
                  setSampleModalOpen(true)
                }}
              >
                Request Sample
              </MPIButton>
            </div>
          </div>
        </div>
      )}

      {/* ─── SAMPLE REQUEST MODAL ────────────────────────────────────────── */}
      {sampleModalOpen && selectedSampleSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  Pre-Production Sourcing Protocol
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Request Sample from {selectedSampleSupplier.displayName}
                </h3>
                <div className="text-xs text-slate-500">
                  {selectedSampleSupplier.category} ·{" "}
                  {selectedSampleSupplier.city}
                </div>
              </div>
              <button
                onClick={() => setSampleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-blue-900 leading-relaxed">
              <strong>Sample Assurance:</strong> Pre-production units allow
              physical evaluation of dimensional fitment, drop testing, and
              printing color tolerance before committing capital to 500+ units
              bulk batches.
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Sample Quantity:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 5].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSampleQty(q)}
                      className={`py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        sampleQty === q
                          ? "bg-[#051F16] text-white border-[#051F16]"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {q} {q === 1 ? "Unit" : "Units"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Technical Sample Specifications:
                </label>
                <textarea
                  rows={3}
                  value={
                    sampleCustomNotes ||
                    specifications[0] ||
                    "Rigid box with custom EVA foam insert"
                  }
                  onChange={(e) => setSampleCustomNotes(e.target.value)}
                  placeholder="Specify key dimensions, finishes, or custom mockup fit requirements..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#051F16]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Dispatch Destination Address:
                </label>
                <input
                  type="text"
                  value={sampleShippingAddress}
                  onChange={(e) => setSampleShippingAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#051F16]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Contact Phone for Courier Delivery:
                </label>
                <input
                  type="tel"
                  value={samplePhone}
                  onChange={(e) => setSamplePhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#051F16]"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  Sample Cost / Deposit:
                </span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ₹0 Free Sample (Refundable Deposit)
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <MPIButton
                variant="outline"
                size="sm"
                onClick={() => setSampleModalOpen(false)}
              >
                Cancel
              </MPIButton>
              <MPIButton
                variant="primary"
                size="sm"
                onClick={() => {
                  requestSample({
                    supplierId: selectedSampleSupplier.id,
                    supplierDisplayName: selectedSampleSupplier.displayName,
                    productTitle: `${selectedCategory} (${formatScopeDisplay(selectedCategory, quantity)}) Sample Mockup`,
                    category: selectedCategory,
                    sampleQuantity: sampleQty,
                    specifications:
                      sampleCustomNotes ||
                      specifications[0] ||
                      "Pre-production verified mockup",
                    targetDeliveryDate: "2026-10-02",
                    shippingAddress: sampleShippingAddress,
                    contactPhone: samplePhone,
                    sampleCost: 0,
                  })
                  setSampleModalOpen(false)
                  navigate("startup.samples")
                }}
                icon={<Icons.Package className="w-4 h-4" />}
              >
                Transmit Sample Request →
              </MPIButton>
            </div>
          </div>
        </div>
      )}

      {/* ─── SAMPLE QUALITY EVALUATION MODAL ──────────────────────────────── */}
      {evaluatingSampleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Quality Audit Pass
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Evaluate & Approve Sample #{evaluatingSampleId}
                </h3>
              </div>
              <button
                onClick={() => setEvaluatingSampleId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">
                  Sample Quality Rating:
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEvalRating(star)}
                      className={`text-lg transition-transform hover:scale-110 cursor-pointer ${
                        evalRating >= star ? "text-amber-400" : "text-slate-200"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-600 ml-2">
                    {evalRating} of 5 Stars
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-800 block">
                  Inspection Checklist:
                </label>
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evalDimensionPass}
                    onChange={(e) => setEvalDimensionPass(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>
                    Dimensional Accuracy within Tolerances (CMM / Caliper pass)
                  </span>
                </label>
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evalFinishPass}
                    onChange={(e) => setEvalFinishPass(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Material Finish, Color Accuracy & Surface Quality</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evalDurabilityPass}
                    onChange={(e) => setEvalDurabilityPass(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Drop-Test / Durability & Structural Rigidity</span>
                </label>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Evaluation Notes for Production Batch:
                </label>
                <textarea
                  rows={3}
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#051F16]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <MPIButton
                variant="outline"
                size="sm"
                onClick={() => setEvaluatingSampleId(null)}
              >
                Cancel
              </MPIButton>
              <MPIButton
                variant="primary"
                size="sm"
                onClick={() => {
                  updateSampleStatus(evaluatingSampleId, "Approved", {
                    qualityRating: evalRating,
                    dimensionPass: evalDimensionPass,
                    finishPass: evalFinishPass,
                    durabilityPass: evalDurabilityPass,
                    evaluationNotes: evalNotes,
                  })
                  approveSampleAndProceedToRFQ(evaluatingSampleId)
                  setEvaluatingSampleId(null)
                  navigate("startup.comparison")
                }}
                icon={<Icons.Check className="w-4 h-4" />}
              >
                Approve Sample & Proceed to Bulk RFQ →
              </MPIButton>
            </div>
          </div>
        </div>
      )}

      {/* ─── AI QUOTE NEGOTIATION MODAL (Blueprint Items 33, 36, 37) ──────── */}
      {negotiationModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <Icons.Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#051F16]">
                    AI Quote Negotiation Copilot
                  </h3>
                  <p className="text-xs text-slate-500">
                    Targeting {negotiationModal.quote?.supplierDisplayName} · Reverse Margin & Headroom Analysis
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNegotiationModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-4 h-4" />
              </button>
            </div>

            {negotiationModal.isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-600">
                  Calibrating reverse-margin headroom and drafting vendor counter-script with MPI AI...
                </p>
              </div>
            ) : negotiationModal.result ? (
              <div className="space-y-4">
                {/* Target savings banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                      Recommended Negotiation Target
                    </div>
                    <div className="text-xl font-extrabold text-amber-950 mt-0.5">
                      {negotiationModal.result.suggestedTargetDiscountPercent}% Target Discount
                    </div>
                    <div className="text-xs text-amber-900">
                      Achievable Savings: ₹{negotiationModal.result.achievableSavingsINR.toLocaleString("en-IN")} on landed volume
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2.5 py-1 rounded-full">
                      {negotiationModal.result.isLive ? "Live MPI AI Analysis" : "Calibrated Benchmark"}
                    </span>
                  </div>
                </div>

                {/* Strategy summary */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="text-xs font-bold text-slate-900 mb-1">
                    Leverage Strategy & Reasoning:
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {negotiationModal.result.strategySummary}
                  </p>
                </div>

                {/* Key Levers & Scope Differences */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                    <div className="font-bold text-[#051F16] flex items-center gap-1.5">
                      <Icons.TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Key Negotiation Levers:</span>
                    </div>
                    <ul className="space-y-1 text-slate-600 pl-4 list-disc marker:text-emerald-700">
                      {negotiationModal.result.keyNegotiationLevers.map((lever, i) => (
                        <li key={i}>{lever}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                    <div className="font-bold text-[#051F16] flex items-center gap-1.5">
                      <Icons.FileText className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Scope Observations:</span>
                    </div>
                    <ul className="space-y-1 text-slate-600 pl-4 list-disc marker:text-emerald-700">
                      {negotiationModal.result.scopeDifferences.map((diff, i) => (
                        <li key={i}>{diff}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Ready email script */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900">
                      Authoritative Counter-Offer Proposal:
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(negotiationModal.result?.readyEmailScript || "")
                        setNegotiationModal((prev) => ({ ...prev, copied: true }))
                        setTimeout(() => setNegotiationModal((prev) => ({ ...prev, copied: false })), 2500)
                      }}
                      className="text-xs text-[#051F16] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {negotiationModal.copied ? (
                        <>
                          <Icons.Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <span>Copy Full Script</span>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                    {negotiationModal.result.readyEmailScript}
                  </pre>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <MPIButton
                variant="outline"
                size="sm"
                onClick={() => setNegotiationModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Close
              </MPIButton>
            </div>
          </div>
        </div>
      )}

      {/* ─── AI AWARD MEMORANDUM & DECISION RECORD MODAL (Blueprint Items 38, 39, 57) ── */}
      {awardMemoModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-950/10 text-[#051F16] flex items-center justify-center">
                  <Icons.Award className="w-5 h-5 text-[#051F16]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#051F16]">
                    Institutional Procurement Award Memorandum
                  </h3>
                  <p className="text-xs text-slate-500">
                    Audit-ready decision record with buyer-weighted multi-criteria justification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAwardMemoModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-4 h-4" />
              </button>
            </div>

            {/* Buyer Weight Sliders */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Buyer Decision Criteria Weightings:
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-500">
                  Total: {awardMemoModal.weights.price + awardMemoModal.weights.quality + awardMemoModal.weights.delivery + awardMemoModal.weights.location}%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Price</span>
                    <strong className="text-[#051F16]">{awardMemoModal.weights.price}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    value={awardMemoModal.weights.price}
                    onChange={(e) => {
                      const p = Number(e.target.value)
                      setAwardMemoModal((prev) => ({
                        ...prev,
                        weights: { ...prev.weights, price: p },
                      }))
                    }}
                    className="w-full accent-[#051F16]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Quality</span>
                    <strong className="text-[#051F16]">{awardMemoModal.weights.quality}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    value={awardMemoModal.weights.quality}
                    onChange={(e) => {
                      const q = Number(e.target.value)
                      setAwardMemoModal((prev) => ({
                        ...prev,
                        weights: { ...prev.weights, quality: q },
                      }))
                    }}
                    className="w-full accent-[#051F16]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Delivery</span>
                    <strong className="text-[#051F16]">{awardMemoModal.weights.delivery}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={awardMemoModal.weights.delivery}
                    onChange={(e) => {
                      const d = Number(e.target.value)
                      setAwardMemoModal((prev) => ({
                        ...prev,
                        weights: { ...prev.weights, delivery: d },
                      }))
                    }}
                    className="w-full accent-[#051F16]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Location/GST</span>
                    <strong className="text-[#051F16]">{awardMemoModal.weights.location}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={awardMemoModal.weights.location}
                    onChange={(e) => {
                      const l = Number(e.target.value)
                      setAwardMemoModal((prev) => ({
                        ...prev,
                        weights: { ...prev.weights, location: l },
                      }))
                    }}
                    className="w-full accent-[#051F16]"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <MPIButton
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenAwardMemoModal(awardMemoModal.weights)}
                  isLoading={awardMemoModal.isLoading}
                  icon={<Icons.Sparkles className="w-3.5 h-3.5 text-emerald-700" />}
                >
                  Recalculate Award Memo with MPI AI
                </MPIButton>
              </div>
            </div>

            {awardMemoModal.isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-3 border-[#051F16] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-600">
                  Formulating institutional award memorandum and compiling scorecard...
                </p>
              </div>
            ) : awardMemoModal.result ? (
              <div className="space-y-4 border border-slate-200 rounded-xl p-5 bg-white shadow-xs">
                {/* Formal header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-[10px] font-mono text-slate-400">
                      DOCUMENT REF: {awardMemoModal.result.memoId}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      Procurement Award & Commercial Justification Memo
                    </div>
                    <div className="text-xs text-slate-500">
                      Category: {selectedCategory} · Scope: {formatScopeDisplay(selectedCategory, quantity)} · Date: {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ✓ Audit Pass
                    </span>
                  </div>
                </div>

                {/* Recommendation summary card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Recommended Vendor</span>
                    <strong className="text-[#051F16] text-sm">{awardMemoModal.result.recommendedSupplier}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Award Value</span>
                    <strong className="text-slate-900 text-sm">₹{awardMemoModal.result.totalAwardValue.toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Projected Baseline Savings</span>
                    <strong className="text-emerald-700 text-sm">₹{awardMemoModal.result.projectedSavings.toLocaleString("en-IN")}</strong>
                  </div>
                </div>

                {/* Justification narrative */}
                <div className="text-xs text-slate-700 leading-relaxed space-y-2">
                  <div className="font-bold text-slate-900">1. Sourcing Committee Recommendation & Rationale:</div>
                  <p className="bg-slate-50/70 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {awardMemoModal.result.evaluationSummary}
                  </p>
                </div>

                {/* Multi-criteria Scorecard Table */}
                <div className="text-xs space-y-1.5">
                  <div className="font-bold text-slate-900">2. Weighted Evaluation Scorecard:</div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Evaluation Pillar</th>
                          <th className="p-2.5">Weight</th>
                          <th className="p-2.5">Score</th>
                          <th className="p-2.5">Evaluation Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {awardMemoModal.result.criteriaScorecard.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-semibold text-slate-800">{item.criteria}</td>
                            <td className="p-2.5 text-slate-600">{item.weight}%</td>
                            <td className="p-2.5 font-bold text-[#051F16]">{item.score}/100</td>
                            <td className="p-2.5 text-slate-500 text-[11px]">{item.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Trail Stamp */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Cryptographic Proof: {awardMemoModal.result.auditTrailHash}</span>
                  <span className="text-emerald-700 font-bold">MPI Protocol v2.4 Compliant</span>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  const text = `MPI PROCUREMENT AWARD MEMORANDUM\nRef: ${awardMemoModal.result?.memoId}\nVendor: ${awardMemoModal.result?.recommendedSupplier}\nValue: ₹${awardMemoModal.result?.totalAwardValue}\nSavings: ₹${awardMemoModal.result?.projectedSavings}\n\nSummary:\n${awardMemoModal.result?.evaluationSummary}`
                  navigator.clipboard.writeText(text)
                  setAwardMemoModal((prev) => ({ ...prev, copied: true }))
                  setTimeout(() => setAwardMemoModal((prev) => ({ ...prev, copied: false })), 2000)
                }}
                className="text-xs text-[#051F16] font-bold hover:underline cursor-pointer"
              >
                {awardMemoModal.copied ? "✓ Copied Memo" : "Copy Plaintext Memo"}
              </button>
              <div className="flex gap-2">
                <MPIButton
                  variant="outline"
                  size="sm"
                  onClick={() => setAwardMemoModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  Close
                </MPIButton>
                <MPIButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setAwardMemoModal((prev) => ({ ...prev, isOpen: false }))
                    const chosen = publicStartupQuotes.find((q) => q.id === selectedQuoteId) || publicStartupQuotes[0]
                    selectQuote(chosen.id)
                    setMilestone(4)
                    navigate("startup.status")
                  }}
                >
                  Confirm Award & Issue Purchase Order →
                </MPIButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── AI GOVERNMENT SCHEME PRE-SCREEN & CHECKLIST MODAL (Items 40, 41, 43) ─ */}
      {schemeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <Icons.ShieldCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#051F16]">
                    AI Government Scheme Pre-Screen
                  </h3>
                  <p className="text-xs text-slate-500">
                    {schemeModal.schemeName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSchemeModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-4 h-4" />
              </button>
            </div>

            {schemeModal.isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-600">
                  Pre-screening eligibility criteria and statutory document requirements with MPI AI...
                </p>
              </div>
            ) : schemeModal.result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-medium text-blue-900">
                  <MaterialIcon name="info" size={14} className="text-blue-700 shrink-0" />
                  <span>AI Pre-Screening Estimate — Indicative guidance based on public scheme rules. Final eligibility and grant disbursements require statutory sanction by the nodal ministry.</span>
                </div>
                {/* Fit Score & Financial Assistance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div>
                    <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">
                      Eligibility Fit Score
                    </span>
                    <div className="text-2xl font-extrabold text-orange-950 mt-0.5">
                      {schemeModal.result.fitScore}% Fit
                    </div>
                    <span className="text-xs font-semibold text-orange-800">
                      {schemeModal.result.eligibilityStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">
                      Estimated Financial Benefit
                    </span>
                    <div className="text-sm font-extrabold text-orange-950 mt-1">
                      {schemeModal.result.financialAssistanceEstimate}
                    </div>
                    <span className="text-[11px] text-orange-900 block mt-0.5">
                      Nodal: {schemeModal.result.ministry}
                    </span>
                  </div>
                </div>

                {/* Mandatory Documents Checklist */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Mandatory Application Document Checklist:
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {Object.values(schemeModal.checkedDocs).filter(Boolean).length} / {schemeModal.result.mandatoryDocuments.length} Prepared
                    </span>
                  </div>
                  <div className="space-y-2">
                    {schemeModal.result.mandatoryDocuments.map((doc, idx) => {
                      const isChecked = Boolean(schemeModal.checkedDocs[doc])
                      return (
                        <label
                          key={idx}
                          className="flex items-start gap-2.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setSchemeModal((prev) => ({
                                ...prev,
                                checkedDocs: { ...prev.checkedDocs, [doc]: checked },
                              }))
                            }}
                            className="mt-0.5 accent-[#051F16]"
                          />
                          <span className={isChecked ? "line-through text-slate-400" : "text-slate-800 font-medium"}>
                            {doc}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Step-by-Step Application Roadmap */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <span className="text-xs font-bold text-slate-900 block">
                    Official Application Roadmap:
                  </span>
                  <ol className="space-y-1.5 pl-4 list-decimal text-xs text-slate-600 marker:font-bold marker:text-[#051F16]">
                    {schemeModal.result.applicationSteps.map((step, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Caveats / Rules */}
                {schemeModal.result.riskOrCaveats.length > 0 && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="font-bold text-amber-900">Statutory Caveats & Rules:</div>
                    <ul className="list-disc pl-4 text-amber-800 space-y-0.5 text-[11px]">
                      {schemeModal.result.riskOrCaveats.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Backed by verified DPIIT & MSME policy guidelines
              </span>
              <MPIButton
                variant="primary"
                size="sm"
                onClick={() => setSchemeModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Done
              </MPIButton>
            </div>
          </div>
        </div>
      )}

      {/* ─── AI DISPUTE & ESCROW MEDIATION MODAL (Blueprint Item 60) ────────── */}
      {disputeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
                  <Icons.ShieldCheck className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#051F16]">
                    AI Escrow Dispute & Neutral Arbitration
                  </h3>
                  <p className="text-xs text-slate-500">
                    Milestone evidence timeline & binding arbitration draft for {disputeModal.orderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDisputeModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-4 h-4" />
              </button>
            </div>

            {/* Input Details */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Dispute Issue Description:
                </label>
                <input
                  type="text"
                  value={disputeModal.disputeReason}
                  onChange={(e) => setDisputeModal((prev) => ({ ...prev, disputeReason: e.target.value }))}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-[#051F16]"
                  placeholder="Describe non-conformance or SLA breach..."
                />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "12% dimensional tolerance variance on batch",
                  "Spot-UV color bleeding & lamination peeling",
                  "Sample delivery 5 days past agreed turnaround SLA",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setDisputeModal((prev) => ({ ...prev, disputeReason: preset }))
                      handleOpenDisputeModal(preset)
                    }}
                    className="text-[10px] bg-white border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-full text-slate-700 transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Claimed Disputed Amount (₹):</label>
                  <input
                    type="number"
                    value={disputeModal.claimedAmount}
                    onChange={(e) => setDisputeModal((prev) => ({ ...prev, claimedAmount: Number(e.target.value) || 0 }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <MPIButton
                    variant="ai"
                    fullWidth
                    size="sm"
                    disabled={disputeModal.isLoading}
                    onClick={() => handleOpenDisputeModal()}
                    icon={<Icons.Sparkles className="w-3.5 h-3.5" />}
                  >
                    {disputeModal.isLoading ? "Arbitrating..." : "Run AI Evidence Arbitration"}
                  </MPIButton>
                </div>
              </div>
            </div>

            {/* Arbitration Result */}
            {disputeModal.isLoading ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-600">
                  Organizing milestone ledger timeline and evaluating contractual clauses with MPI AI...
                </p>
              </div>
            ) : disputeModal.result ? (
              <div className="space-y-4 animate-fade-in text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900">
                  <MaterialIcon name="gavel" size={14} className="text-amber-700 shrink-0" />
                  <span>AI Mediation Draft — Non-binding recommendation for commercial alignment. Escrow fund release requires mutual party confirmation or appointed arbitrator sign-off.</span>
                </div>
                {/* Ruling banner */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-800 uppercase font-bold">
                      TICKET ID: {disputeModal.result.disputeTicketId}
                    </span>
                    <span className="text-xs font-extrabold bg-[#051F16] text-white px-2.5 py-0.5 rounded-full">
                      Action: {disputeModal.result.suggestedEscrowAction}
                    </span>
                  </div>
                  <p className="text-xs text-amber-950 leading-relaxed">
                    <strong>Arbitrator Analysis:</strong> {disputeModal.result.mediationRecommendation}
                  </p>
                </div>

                {/* Milestone Evidence Timeline */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                  <span className="font-bold text-slate-900 block">
                    Verified Milestone Evidence Trail:
                  </span>
                  <div className="space-y-2 divide-y divide-slate-100">
                    {disputeModal.result.timelineEvidence.map((ev, i) => (
                      <div key={i} className="pt-2 flex items-start justify-between gap-3 text-[11px]">
                        <div>
                          <div className="font-semibold text-slate-800">{ev.event}</div>
                          <div className="text-slate-400 font-mono text-[10px]">{ev.timestamp}</div>
                        </div>
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200 shrink-0">
                          ✓ {ev.verifiedBy}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ready mediation draft */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                  <span className="font-bold text-slate-900 block">
                    Official Escrow Arbitration Notice Draft:
                  </span>
                  <pre className="text-[11px] font-sans text-slate-800 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {disputeModal.result.readyMediationDraft}
                  </pre>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (disputeModal.result?.readyMediationDraft) {
                    navigator.clipboard.writeText(disputeModal.result.readyMediationDraft)
                    setDisputeModal((prev) => ({ ...prev, copied: true }))
                    setTimeout(() => setDisputeModal((prev) => ({ ...prev, copied: false })), 2000)
                  }
                }}
                className="text-xs text-[#051F16] font-bold hover:underline cursor-pointer"
              >
                {disputeModal.copied ? "✓ Copied Notice" : "Copy Arbitration Notice"}
              </button>
              <div className="flex gap-2">
                <MPIButton
                  variant="outline"
                  size="sm"
                  onClick={() => setDisputeModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  Close
                </MPIButton>
                <MPIButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    alert(`Arbitration notice ${disputeModal.result?.disputeTicketId || "DISP-2026"} transmitted to Escrow Trustee and ${disputeModal.supplierName}. Escrow status set to arbitration hold.`)
                    setDisputeModal((prev) => ({ ...prev, isOpen: false }))
                  }}
                >
                  Transmit to Escrow Desk & Vendor →
                </MPIButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help & Support Modal */}
      <StartupHelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        startupProfile={startupProfile}
      />
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // 1. OVERVIEW DASHBOARD (startup.home) — PROCUREMENT COMMAND CENTER
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.home") {
    return renderShell(
      <StartupCommandCenter
        navigate={navigate}
        startupProfile={startupProfile}
        activeRFQ={activeRFQ}
        selectedCategory={selectedCategory}
        quantity={quantity}
        targetBudget={targetBudget}
        currentMilestone={currentMilestone}
        ordersList={ordersList}
        sourcingHistory={sourcingHistory}
        publicStartupQuotes={publicStartupQuotes}
        shortlistedSupplierIds={shortlistedSupplierIds}
        publicStartupSuppliers={publicStartupSuppliers}
        onSelectHistoryInsight={(item) => setSelectedHistoryInsight(item)}
      />,
      "Procurement Command Center",
      "A real-time overview of your sourcing, procurement activity and supplier performance.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. 7-STEP GUIDED SOURCING BUILDER (startup.procurement, startup.rfq)
  // ════════════════════════════════════════════════════════════════════════════
  if (
    currentScreen === "startup.procurement" ||
    currentScreen === "startup.rfq" ||
    currentScreen === "startup.ai-analysis" ||
    currentScreen === "startup.match-results" ||
    currentScreen === "startup.shortlist"
  ) {
    return renderShell(
      <StartupGuidedBuilder
        navigate={navigate}
        goBack={goBack}
        builderStep={builderStep}
        setBuilderStep={setBuilderStep}
        requirementText={requirementText}
        setRequirementText={setRequirementText}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        quantity={quantity}
        setQuantity={setQuantity}
        targetBudget={targetBudget}
        setTargetBudget={setTargetBudget}
        deliveryLocation={deliveryLocation}
        setDeliveryLocation={setDeliveryLocation}
        deadlineDate={deadlineDate}
        setDeadlineDate={setDeadlineDate}
        specifications={specifications}
        addSpecification={addSpecification}
        removeSpecification={removeSpecification}
        complianceChecks={complianceChecks}
        setComplianceChecks={setComplianceChecks}
        isExtractingSpecs={isExtractingSpecs}
        runAIExtraction={runAIExtraction}
        publicStartupSuppliers={publicStartupSuppliers}
        shortlistedSupplierIds={shortlistedSupplierIds}
        toggleShortlistSupplier={toggleShortlistSupplier}
        activeRFQ={activeRFQ}
        createAndDispatchRFQ={createAndDispatchRFQ}
        publicStartupQuotes={publicStartupQuotes}
        onOpenSampleModal={(sup) => {
          setSelectedSampleSupplier(sup)
          setSampleModalOpen(true)
        }}
      />,
      "Guided Sourcing Builder",
      "7-step automated procurement flow from requirement to RFQ dispatch.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. SPLIT-SCREEN AI COPILOT WORKSPACE (startup.ai-assistant)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.ai-assistant") {
    return renderShell(
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        {/* Left Pane: Conversational Copilot Chat */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 flex flex-col justify-between overflow-hidden shadow-xs">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold text-xs border border-emerald-800 shadow-xs shrink-0">
                AI
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap">
                  MPI Procurement Copilot
                </div>
                <div className="text-[10px] text-[#051F16] font-semibold flex items-center gap-1 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#051F16] animate-pulse shrink-0" />
                  Active session · RFQ-2026-0891
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as any)}
                className="text-[11px] font-semibold bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-700 outline-none cursor-pointer hover:bg-slate-50"
                title="Voice & Transcription Language"
              >
                <option value="en">English (IN)</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
              </select>
              <button
                type="button"
                onClick={handleResetCopilotChat}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shadow-2xs"
                title="Reset Copilot Conversation"
              >
                <Icons.Clock className="w-3.5 h-3.5" />
                <span>New Session</span>
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                <span>MPI AI</span>
                <Icons.Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              </div>
            </div>
          </div>

          {/* Toast Notification for Added Specs */}
          {specAddedToast && (
            <div className="bg-emerald-500 text-white px-3 py-1.5 text-[11px] font-semibold flex items-center justify-between animate-fade-in shadow-xs">
              <div className="flex items-center gap-1.5">
                <Icons.Check className="w-3.5 h-3.5" />
                <span>Added to Live RFQ: "{specAddedToast}"</span>
              </div>
              <button
                onClick={() => setSpecAddedToast(null)}
                className="text-white/80 hover:text-white"
              >
                ×
              </button>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {copilotMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[90%] text-xs p-3.5 sm:p-4 rounded-2xl shadow-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#051F16] text-white rounded-br-xs"
                      : "bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs"
                  }`}
                >
                  {msg.role === "ai" ? (
                    <div className="space-y-1">
                      {renderCopilotMarkdown(msg.text)}

                      {/* What I Recommend Next (Clean & Compact) */}
                      {msg.role === "ai" && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 flex items-center gap-1.5 tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C]" />
                            <span>What I recommend next:</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {(
                              msg.recommendedNextActions ||
                              getRecommendedNextActions(
                                msg.text,
                                selectedCategory,
                                quantity,
                                targetBudget,
                              )
                            ).map((action, aIdx) => (
                              <button
                                key={aIdx}
                                type="button"
                                disabled={isCopilotTyping}
                                onClick={() => {
                                  if (action.query) {
                                    handleCopilotSend(action.query)
                                  } else if (action.screen) {
                                    navigate(action.screen as Screen)
                                  }
                                }}
                                className="group/action text-left px-2.5 py-1.5 rounded-lg bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-emerald-500/50 transition-all cursor-pointer flex items-center justify-between gap-2 shadow-2xs"
                              >
                                <div className="min-w-0 flex items-center gap-1.5">
                                  {action.icon && (
                                    <span className="text-[11px] shrink-0">{action.icon}</span>
                                  )}
                                  <span className="text-[10.5px] font-semibold text-slate-700 group-hover/action:text-[#051F16] truncate leading-tight">
                                    {action.label}
                                  </span>
                                </div>
                                <Icons.ArrowRight className="w-3 h-3 text-slate-400 group-hover/action:text-emerald-700 shrink-0 transition-transform group-hover/action:translate-x-0.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {msg.suggestedNavigation && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        MPI Navigation Copilot:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(msg.suggestedNavigation!.screen as Screen)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#051F16] text-white hover:bg-black transition-colors cursor-pointer shadow-xs"
                      >
                        <span>👉 {msg.suggestedNavigation.label}</span>
                        <Icons.ArrowRight className="w-3 h-3 text-emerald-700" />
                      </button>
                    </div>
                  )}

                  <div
                    className={`text-[9px] mt-1.5 flex items-center justify-between ${
                      msg.role === "user" ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    <span>
                      {msg.role === "ai"
                        ? msg.isLive
                          ? "⚡ MPI AI Live Response"
                          : "Verified Knowledge"
                        : "Founder"}
                    </span>
                    <span>{msg.time}</span>
                  </div>
                </div>
              </div>
            ))}
            {isCopilotTyping && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 w-fit animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-bounce [animation-delay:0.4s]" />
                <span className="font-medium text-[11px]">
                  MPI procurement support is analyzing market benchmarks & Indian MSME
                  capacity...
                </span>
              </div>
            )}
          </div>

          {/* Voice Recording Live Indicator Strip */}
          {isCopilotVoiceActive && (
            <div className="px-4 py-2 bg-linear-to-r from-purple-50 via-indigo-50 to-purple-50 border-t border-purple-200 text-purple-900 flex items-center justify-between text-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"
                  style={{ transform: `scale(${1 + copilotAudioLevel / 100})` }}
                />
                <span className="font-semibold text-[11px]">
                  {copilotVoiceStatus || "Listening to voice command... Speak clearly."}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleCopilotVoice}
                className="px-2.5 py-0.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Input Box with Voice Assistant Mic */}
          <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
            {/* Voice Command Button */}
            <button
              type="button"
              onClick={toggleCopilotVoice}
              disabled={isCopilotTyping}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                isCopilotVoiceActive
                  ? "bg-red-500 text-white border-red-600 animate-pulse shadow-sm"
                  : "bg-slate-50 border-slate-200 hover:border-purple-400 hover:text-purple-600 text-slate-600 hover:bg-purple-50"
              }`}
              title="Voice Assistant: Speak requirement or prompt"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>

            <input
              type="text"
              value={copilotInput}
              disabled={isCopilotTyping}
              onChange={(e) => setCopilotInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isCopilotTyping) handleCopilotSend()
              }}
              placeholder="Ask about pricing benchmarks, specs, or speak using the mic..."
              className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#051F16] disabled:opacity-60 font-medium"
            />

            <MPIButton
              variant="ai"
              size="sm"
              isLoading={isCopilotTyping}
              disabled={isCopilotTyping || !copilotInput.trim()}
              onClick={() => handleCopilotSend()}
            >
              Send
            </MPIButton>
          </div>
        </div>

        {/* Right Pane: Live Updating RFQ Specification Document */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between overflow-y-auto shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Live Procurement Specification
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedCategory} ({formatScopeDisplay(selectedCategory, quantity)})
                </h3>
              </div>
              <MPIStatusBadge status="Verified Draft" />
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">
                  Commercial Parameters
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    Target Budget:{" "}
                    <strong>₹{targetBudget.toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    Quantity / Scope: <strong>{formatScopeDisplay(selectedCategory, quantity)}</strong>
                  </div>
                  <div>
                    Delivery Date: <strong>{deadlineDate}</strong>
                  </div>
                  <div>
                    Destination: <strong>{deliveryLocation}</strong>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-900 mb-1.5">
                  Technical Specs Ledger ({specifications.length})
                </div>
                <ul className="space-y-1.5">
                  {specifications.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px]"
                    >
                      <span className="text-emerald-700 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#FFF7D6] p-3 rounded-xl border border-yellow-200 text-xs">
                <div className="font-bold text-yellow-900 flex items-center gap-1.5 mb-1">
                  <Icons.TrendingUp className="w-4 h-4 text-[#D9A400]" />
                  <span>Government Scheme Eligibility Detected</span>
                </div>
                <p className="text-[11px] text-yellow-800 leading-relaxed">
                  Under the MSME ZED Certification & Design Clinic Scheme, this
                  project qualifies for up to ₹7,250 in direct subsidy
                  reimbursement.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              MPI Sourcing Contract v2
            </span>
            <MPIButton
              variant="primary"
              size="sm"
              onClick={() => navigate("startup.comparison")}
              icon={<Icons.ArrowRight className="w-3.5 h-3.5" />}
            >
              Compare Supplier Quotes Matrix →
            </MPIButton>
          </div>
        </div>
      </div>,
      "Split-Screen AI Copilot",
      "Refine engineering tolerances interactively while previewing the live RFQ specification.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. MULTI-QUOTE COMPARISON MATRIX (startup.comparison)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.comparison") {
    return renderShell(
      <div className="space-y-6">
        {/* Banner with clearly defined Baseline Market Benchmark */}
        <div className="bg-[#FFF7D6] border border-yellow-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#D9A400] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Icons.TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-yellow-950">
                AI Reverse Margin Analysis vs Market Benchmark
              </div>
              <div className="text-xs text-yellow-900 mt-1 leading-relaxed">
                Baseline Market Benchmark:{" "}
                <strong>₹{MARKET_BASELINE_COST.toLocaleString("en-IN")}</strong>{" "}
                (Standard offline distributor quote). Best verified quote
                provides <strong>₹23,250 (27.4%) in total savings</strong> and
                cuts delivery time by <strong>6–8 days</strong>.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <MPIVerifiedBadge label="All Suppliers Audited" />
          </div>
        </div>

        {/* Institutional Decision Support Bar (Blueprint Items 38, 39, 57) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Icons.Award className="w-4 h-4 text-[#051F16]" />
              <span>Multi-Criteria Decision Engine & Formal Award Record</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Configure buyer weightings (Price, Quality, Delivery, Cluster) and compile an audit-ready Institutional Award Memorandum with MPI AI.
            </div>
          </div>
          <MPIButton
            variant="ai"
            size="sm"
            onClick={() => handleOpenAwardMemoModal()}
            icon={<Icons.FileText className="w-4 h-4" />}
          >
            Generate AI Award Memo & Decision Record
          </MPIButton>
        </div>

        {/* Side-by-side comparative cards or Empty Awaiting Quotes State */}
        {publicStartupQuotes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
              <Icons.Clock className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                Awaiting MSME Quotations
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {rfqPersistenceStatus === "saved_to_supabase"
                  ? `Your RFQ (${activeRFQ?.title || "Custom Batch Run"}) has been authoritatively persisted and dispatched to verified manufacturing clusters. Suppliers in our audited network evaluate tooling specs and submit binding proposals within 24–48 hours.`
                  : rfqPersistenceStatus === "saving"
                  ? `Transmitting your RFQ (${activeRFQ?.title || "Custom Batch Run"}) to the MPI cloud network...`
                  : `Your RFQ (${activeRFQ?.title || "Custom Batch Run"}) is saved in this browser session. Synchronization is pending; remote saving and supplier dispatch have not been confirmed.`}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {rfqPersistenceStatus === "saved_to_supabase" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Dispatched & Confirmed (ID: {activeRFQ?.id})</span>
                  </span>
                ) : rfqPersistenceStatus === "saving" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-spin" />
                    <span>Syncing with MPI Network...</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                    title={rfqPersistenceError || "Stored locally in browser session"}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Saved in Local Session Buffer</span>
                  </span>
                )}
              </div>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <MPIButton
                variant="outline"
                size="sm"
                onClick={() => navigate("msme.opportunities")}
              >
                Switch to MSME Portal to Review &amp; Transmit Quote →
              </MPIButton>
              <button
                type="button"
                onClick={() => loadDemoQuotes()}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
              >
                Inspect Sample Demonstration Quotes
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {publicStartupQuotes.slice(0, 3).map((q, idx) => {
            const isSelected = selectedQuoteId === q.id
            const isTopRecommended = idx === 1

            const tiers = [
              {
                name: "Good",
                badge: "bg-slate-100 text-slate-700 border-slate-300",
                accent: "Cost-Effective Baseline",
              },
              {
                name: "Better",
                badge: "bg-amber-100 text-amber-900 border-amber-300 font-extrabold",
                accent: "MPI AI Sweet Spot",
              },
              {
                name: "Best",
                badge: "bg-emerald-100/60 text-[#051F16] border-emerald-300 font-bold",
                accent: "Fastest Turnaround",
              },
            ]
            const currentTier = tiers[idx] || tiers[0]

            return (
              <div
                key={q.id}
                className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden transition-all duration-300 shadow-2xs hover:shadow-xl hover:-translate-y-1.5 ${
                  isSelected
                    ? "border-[#051F16] ring-2 ring-[#051F16] shadow-lg shadow-blue-900/10"
                    : isTopRecommended
                      ? "border-emerald-500 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/10"
                      : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  {/* Top recommendation pill */}
                  {isTopRecommended ? (
                    <div className="bg-[#051F16] text-white text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 text-center flex items-center justify-center gap-1.5">
                      <Icons.Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                      <span>MPI AI Recommended</span>
                    </div>
                  ) : (
                    <div className="hidden md:block h-7.75" />
                  )}

                  <div className="p-5">
                    {/* Anonymized Supplier Title & Tier Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-wider ${currentTier.badge}`}
                          >
                            {currentTier.name}
                          </span>
                          {isTopRecommended && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Icons.Sparkles className="w-3 h-3 text-emerald-700" /> Recommended
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {q.supplierDisplayName}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {q.supplierId}
                        </span>
                      </div>
                      <MPIStatusBadge status="Verified" />
                    </div>

                    {/* Badges strip */}
                    <div className="flex flex-wrap gap-1 my-2">
                      {q.badges.map((b) => (
                        <span
                          key={b}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFF7D6] text-[#8C6B00] border border-yellow-300"
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    {/* Quoted Total Price */}
                    <div className="mt-3">
                      <div
                        className="text-2xl font-extrabold text-[#051F16] tracking-tight"
                        style={{ fontFamily: "Plus Jakarta Sans" }}
                      >
                        ₹{q.quotedTotal.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Payable Supplier Invoice (₹{q.unitPrice}/unit)
                      </div>
                    </div>

                    {/* Savings vs Baseline */}
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Market Baseline Benchmark:</span>
                        <span className="line-through">
                          ₹{q.baselineCost.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-[#051F16]">
                        <span>Direct Factory Savings:</span>
                        <span className="text-[#D9A400]">
                          ₹{q.totalSavings.toLocaleString("en-IN")} (
                          {q.savingsPercent}%)
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Est. Turnaround SLA:</span>
                        <span className="font-semibold text-emerald-700">
                          {q.estimatedTimeSaved}
                        </span>
                      </div>
                    </div>

                    {/* Landed Cost Breakdown */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Base Tooling & Setup:</span>
                        <span className="font-semibold text-slate-900">
                          ₹
                          {q.breakdown.baseToolingOrSetup.toLocaleString(
                            "en-IN",
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Unit Manufacturing:</span>
                        <span className="font-semibold text-slate-900">
                          ₹
                          {q.breakdown.unitManufacturing.toLocaleString(
                            "en-IN",
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>QA & Drop Testing:</span>
                        <span className="font-semibold text-slate-900">
                          ₹{q.breakdown.qualityTesting.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Logistics & GST (18%):</span>
                        <span className="font-semibold text-slate-900">
                          ₹
                          {(
                            q.breakdown.logisticsAndPackaging +
                            q.breakdown.gstAmount
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>
                      {q.schemeSubsidyApplied > 0 ? (
                        <div className="mt-2.5 p-2 bg-[#FFF7D6]/60 border border-[#FFE799] rounded-lg text-[11px] space-y-0.5">
                          <div className="flex justify-between font-bold text-[#8C6B00]">
                            <span>Gov Scheme Subsidy Eligibility:</span>
                            <span>Est. ₹{q.schemeSubsidyApplied.toLocaleString("en-IN")}</span>
                          </div>
                          <p className="text-[10px] text-[#A37D00] leading-tight">
                            Separate post-procurement ZED/Design reimbursement track. Claimable via Ministry upon compliance audit; not deducted from payable invoice.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2 p-1.5 bg-slate-50 border border-slate-200/80 rounded-md text-[10px] text-slate-500 text-center">
                          Scheme benefit unverified for this batch category.
                        </div>
                      )}
                    </div>

                    {/* Operational metrics */}
                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <div className="text-slate-400">Lead Time</div>
                        <div className="font-bold text-slate-800">
                          {q.deliveryDays} Days
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <div className="text-slate-400">Quality Score</div>
                        <div className="font-bold text-[#051F16]">
                          {q.qualityScore}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[11px] text-slate-500 leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                      <strong>AI Rationale:</strong> {q.recommendationReason}
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 space-y-2">
                  <MPIButton
                    variant={isSelected ? "ai" : "outline"}
                    fullWidth
                    size="sm"
                    onClick={() => {
                      selectQuote(q.id)
                      setMilestone(4)
                      navigate("startup.status")
                    }}
                    icon={
                      isSelected ? (
                        <Icons.Check className="w-4 h-4" />
                      ) : undefined
                    }
                  >
                    {isSelected ? "Selected (View PO)" : "Select & Issue PO →"}
                  </MPIButton>
                  <button
                    type="button"
                    onClick={() => handleOpenNegotiationModal(q)}
                    className="w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Icons.Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    AI Negotiation Strategy & Script
                  </button>
                  <button
                    onClick={() =>
                      alert(
                        `Clarification channel opened with ${q.supplierDisplayName} via MPI Escrow Desk. Direct buyer identity remains masked.`,
                      )
                    }
                    className="w-full text-center text-[11px] text-slate-500 hover:text-[#051F16] py-1 transition-colors cursor-pointer"
                  >
                    Ask Clarification (Masked)
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        )}
      </div>,
      "Multi-Quote Comparison Matrix",
      "Side-by-side transparent landed cost evaluation against defined baseline market benchmarks.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. STARTUP ANALYTICS STUDIO (startup.analytics)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.analytics") {
    const filteredOrders =
      orderFilter === "All"
        ? ordersList
        : ordersList.filter((o) => o.status === orderFilter)

    const savingsChartData = [
      { cycle: "Q1 Req 1", baseline: 85000, landed: 65250, savings: 19750 },
      { cycle: "Q2 Req 2", baseline: 120000, landed: 92400, savings: 27600 },
      { cycle: "Q3 Req 3", baseline: 60000, landed: 46200, savings: 13800 },
      { cycle: "Q4 Req 4", baseline: 95000, landed: 71250, savings: 23750 },
    ]

    const categorySpendData = [
      { cat: "Packaging & Printing", spend: 42 },
      { cat: "Prototyping & Product Development", spend: 24 },
      { cat: "IT & Digital Services", spend: 18 },
      { cat: "Compliance & Legal Support", spend: 16 },
    ]

    return renderShell(
      <div className="space-y-6">
        {/* Top KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <MPIStatCard
            title="Active RFQs"
            value="3"
            change="100% on schedule"
            trend="neutral"
            icon={<Icons.FileText className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Quotes Received"
            value="12"
            change="Avg 4 quotes/RFQ"
            trend="up"
            icon={<Icons.ShieldCheck className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Total Baseline Savings"
            value="₹84,900"
            change="24.8% reverse-margin"
            trend="up"
            icon={<Icons.TrendingUp className="w-4 h-4 text-[#D9A400]" />}
          />
          <MPIStatCard
            title="Avg Time Saved"
            value="5.8 Days"
            change="vs market cycles"
            trend="up"
            icon={<Icons.Clock className="w-4 h-4 text-emerald-700" />}
          />
          <MPIStatCard
            title="Orders in Flight"
            value={ordersList.length.toString()}
            change="2 in production"
            trend="neutral"
            icon={<Icons.Coins className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Escrow Protected"
            value="₹1,40,250"
            change="100% Milestone locked"
            trend="neutral"
            icon={<Icons.Award className="w-4 h-4 text-[#D9A400]" />}
          />
        </div>

        {/* Charts: Baseline vs Landed Savings & Time Saved */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Baseline vs Actual Sourcing Bar Chart */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Procurement Savings vs Market Baseline
                </h3>
                <p className="text-xs text-slate-500">
                  Comparison of offline distributor benchmark vs MPI verified
                  landed cost
                </p>
              </div>
              <span className="text-xs font-bold text-[#D9A400] bg-[#FFF7D6] px-2.5 py-1 rounded-md border border-yellow-300">
                Save 24.8% Avg
              </span>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={savingsChartData}>
                <XAxis
                  dataKey="cycle"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any) =>
                    `₹${Number(value).toLocaleString("en-IN")}`
                  }
                />
                <Bar
                  dataKey="baseline"
                  name="Market Baseline (₹)"
                  fill="#CBD5E1"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="landed"
                  name="MPI Landed Price (₹)"
                  fill="#051F16"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Time Saved & Efficiency Metrics */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  Turnaround Velocity Metrics
                </h3>
                <span className="text-xs text-emerald-700 font-bold">
                  MPI Fast-Track
                </span>
              </div>

              <div className="space-y-3.5 mt-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>RFQ Specification & Structuring</span>
                    <span className="text-[#051F16] font-bold">
                      2.4 mins vs 4.5 days
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#051F16] h-full rounded-full"
                      style={{ width: "92%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Verified Supplier Quoting</span>
                    <span className="text-[#051F16] font-bold">
                      36 hrs vs 14 days
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#051F16] h-full rounded-full"
                      style={{ width: "78%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Commercial PO & Escrow Signoff</span>
                    <span className="text-[#051F16] font-bold">
                      1 click vs 8 emails
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#D9A400] h-full rounded-full"
                      style={{ width: "85%" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <strong className="text-slate-900">Cumulative Time Saved:</strong>{" "}
              28 business days saved across all 4 procurement runs this fiscal
              year.
            </div>
          </div>
        </div>

        {/* Order Management Table (Strict Supplier Anonymity) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Order Management & Fulfillment Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Live order execution with verified suppliers under MPI escrow
                protection
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto">
              {([
                "All",
                "In Production",
                "QC Pass",
                "In Transit",
                "Delivered",
              ] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setOrderFilter(tab)}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    orderFilter === tab
                      ? "bg-white text-[#051F16] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Requirement</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Supplier Partner</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Savings</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Delivery ETA</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-[#051F16]">
                      {order.id}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 max-w-xs truncate">
                      {order.requirement}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {order.category}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#051F16]">
                        {order.supplierDisplayName}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      ₹{order.orderValue.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#D9A400]">
                      ₹{order.savings.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3">
                      <MPIStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                      {order.expectedDelivery}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <MPIButton
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("startup.status")}
                      >
                        Track
                      </MPIButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7-Category Procurement Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Procurement Spend by Approved Category
            </h3>
            <div className="space-y-3">
              {categorySpendData.map((c) => (
                <div key={c.cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{c.cat}</span>
                    <span className="text-[#051F16] font-bold">{c.spend}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#051F16] h-full rounded-full"
                      style={{ width: `${c.spend * 2}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#051F16] text-white rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0A3525] text-orange-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                <Icons.Sparkles className="w-3.5 h-3.5" />
                Sourcing Intelligence
              </div>
              <h3
                className="text-base font-bold text-white mb-2"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                AI Volume Consolidation Recommendation
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                By bundling your next 2 packaging runs with{" "}
                <strong>MPI Verified Supplier #001</strong>, you can save an
                additional <strong>₹12,400 (16%)</strong> on tooling setup costs
                and unlock ZED Gold subsidies.
              </p>
            </div>

            <div className="pt-3 border-t border-[#0A3525] flex justify-between items-center">
              <span className="text-xs text-slate-400">MPI Algorithm v2.4</span>
              <MPIButton
                variant="ai"
                size="sm"
                onClick={() => navigate("startup.procurement")}
              >
                Start Bundled Sourcing →
              </MPIButton>
            </div>
          </div>
        </div>
      </div>,
      "Startup Analytics Studio",
      "Comprehensive reverse-margin analytics, order management, and time saved intelligence.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. 10-MILESTONE ORDER TRACKER (startup.status)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.status") {
    const milestones = [
      {
        step: 1,
        title: "Requirement Intake & Specification",
        status: "Passed",
        date: "Sep 21, 2026",
      },
      {
        step: 2,
        title: "AI RFQ Dispatched to Verified Suppliers",
        status: "Passed",
        date: "Sep 22, 2026",
      },
      {
        step: 3,
        title: "Multi-Quote Evaluation Complete",
        status: "Passed",
        date: "Sep 23, 2026",
      },
      {
        step: 4,
        title: "Commercial PO & Agreement Issued",
        status: currentMilestone >= 4 ? "Active" : "Pending",
        date: "Sep 24, 2026",
      },
      {
        step: 5,
        title: "Pre-production Sample Approval",
        status: currentMilestone >= 5 ? "Active" : "Pending",
        date: "Est. Sep 28",
      },
      {
        step: 6,
        title: "Raw Material & Stock In-Transit",
        status: currentMilestone >= 6 ? "Active" : "Pending",
        date: "Est. Oct 02",
      },
      {
        step: 7,
        title: "Tooling & Batch Manufacturing Run",
        status: currentMilestone >= 7 ? "Active" : "Pending",
        date: "Est. Oct 08",
      },
      {
        step: 8,
        title: "Quality Inspection & ISTA-1A Drop Pass",
        status: currentMilestone >= 8 ? "Active" : "Pending",
        date: "Est. Oct 14",
      },
      {
        step: 9,
        title: "Dispatch & Real-time Waybill In-Transit",
        status: currentMilestone >= 9 ? "Active" : "Pending",
        date: "Est. Oct 18",
      },
      {
        step: 10,
        title: "Delivered & Landed Escrow Reconciliation",
        status: currentMilestone >= 10 ? "Completed" : "Pending",
        date: "Est. Oct 22",
      },
    ]

    return renderShell(
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ORDER CONTRACT #MPI-PO-8910
            </span>
            <h3 className="text-lg font-bold text-[#051F16] mt-0.5">
              500x Custom Rigid Boxes — MPI Verified Supplier #001
            </h3>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span>
                Landed Amount:{" "}
                <strong className="text-slate-900">₹65,250</strong>
              </span>
              <span>•</span>
              <span>
                Escrow Status:{" "}
                <strong className="text-[#051F16] font-bold">
                  Funded & Protected
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <MPIButton
              variant="outline"
              size="sm"
              onClick={() => advanceMilestone()}
            >
              Simulate Next Milestone →
            </MPIButton>
            <MPIButton
              variant="outline"
              size="sm"
              onClick={() => handleOpenDisputeModal()}
              className="border-red-300 text-red-700 hover:bg-red-50"
              icon={<Icons.AlertCircle className="w-4 h-4 text-red-600" />}
            >
              Raise AI Dispute Notice (Item 60)
            </MPIButton>
            <MPIButton
              variant="primary"
              size="sm"
              onClick={() =>
                alert(
                  "Purchase Order PDF and Statutory Tax Invoice generated successfully!",
                )
              }
              icon={<Icons.Download className="w-4 h-4" />}
            >
              Download PO
            </MPIButton>
          </div>
        </div>

        {/* 10-Milestone Progress Tracker */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h4 className="text-sm font-bold text-slate-900 mb-6">
            10-Milestone Sourcing Audit Ledger
          </h4>

          <div className="space-y-4 relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200 z-0" />

            {milestones.map((m) => {
              const isDone = m.step < currentMilestone
              const isCurrent = m.step === currentMilestone
              return (
                <div
                  key={m.step}
                  className="flex items-start gap-4 relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      isDone
                        ? "bg-[#051F16] text-white"
                        : isCurrent
                          ? "bg-[#051F16] text-white ring-4 ring-orange-100 scale-105"
                          : "bg-white text-slate-400 border-2 border-slate-300"
                    }`}
                  >
                    {isDone ? <Icons.Check className="w-4 h-4" /> : m.step}
                  </div>

                  <div
                    onClick={() => setMilestone(m.step)}
                    className={`flex-1 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer transition-all ${
                      isCurrent
                        ? "bg-emerald-50/40 border-emerald-500"
                        : isDone
                          ? "bg-slate-50/70 border-slate-200"
                          : "bg-white border-slate-200 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {m.title}
                      </div>
                      <div className="text-[11px] text-slate-500">{m.date}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MPIStatusBadge
                        status={
                          isDone ? "Approved" : isCurrent ? "Active" : "Pending"
                        }
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>,
      "10-Milestone Order Lifecycle Tracker",
      "Real-time statutory audit trail from PO signing to final landed delivery and QC signoff.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. SOURCING HISTORY (startup.history)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.history") {
    return renderShell(
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Procurement Sourcing History
            </h3>
            <p className="text-xs text-slate-500">
              Historical audit trail of all sourcing inquiries, quotes, and
              landed savings
            </p>
          </div>
          <MPIButton
            variant="primary"
            size="sm"
            onClick={() => navigate("startup.procurement")}
            icon={<Icons.Sparkles className="w-4 h-4" />}
          >
            New Procurement
          </MPIButton>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Request</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">RFQ Status</th>
                  <th className="py-3 px-3">Quotes</th>
                  <th className="py-3 px-3">Savings</th>
                  <th className="py-3 px-3">Time Saved</th>
                  <th className="py-3 px-3">Order Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sourcingHistory.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {item.request}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.id}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 font-medium">
                      {item.category}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                      {item.date}
                    </td>
                    <td className="py-3.5 px-3">
                      <MPIStatusBadge status={item.rfqStatus} />
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">
                      {item.quotesCount} quotes
                    </td>
                    <td className="py-3.5 px-3 font-bold text-[#D9A400]">
                      ₹{item.savingsAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-emerald-700">
                      {item.timeSaved}
                    </td>
                    <td className="py-3.5 px-3">
                      <MPIStatusBadge status={item.orderStatus} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <MPIButton
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedHistoryInsight(item)}
                      >
                        View Insights
                      </MPIButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>,
      "Sourcing History & Dossiers",
      "Track all completed and active procurement cycles with itemized savings telemetry.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 8. MY SAMPLES LIFECYCLE TRACKER (startup.samples)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.samples") {
    return renderShell(
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
          <div>
            <h3
              className="text-lg font-extrabold text-[#051F16]"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              My Pre-Production Samples Tracker
            </h3>
            <p className="text-xs text-slate-500">
              Track sample fabrication, courier transit, quality inspection, and
              sample approval before bulk RFQ dispatch.
            </p>
          </div>
          <MPIButton
            variant="primary"
            size="sm"
            onClick={() => {
              if (publicStartupSuppliers.length > 0) {
                setSelectedSampleSupplier(publicStartupSuppliers[0])
                setSampleModalOpen(true)
              } else {
                navigate("startup.match-results")
              }
            }}
            icon={<Icons.Package className="w-4 h-4" />}
          >
            + Request New Sample
          </MPIButton>
        </div>

        {/* 8 Lifecycle States Legend */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 overflow-x-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Sample Procurement Lifecycle (8 Audit States):
          </div>
          <div className="flex items-center gap-1.5 min-w-max text-[11px] font-semibold text-slate-600">
            {[
              "Requested",
              "Accepted",
              "Preparing",
              "Dispatched",
              "Delivered",
              "Under Review",
              "Approved",
              "Rejected",
            ].map((st, sIdx, arr) => (
              <div key={st} className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800">
                  {sIdx + 1}. {st}
                </span>
                {sIdx < arr.length - 1 && (
                  <span className="text-slate-400">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Samples List */}
        <div className="space-y-4">
          {sampleRequests.map((sample) => {
            const isApproved = sample.status === "Approved"
            const isUnderReview =
              sample.status === "Under Review" || sample.status === "Delivered"

            return (
              <MPICard
                key={sample.id}
                className={`p-6 transition-all ${
                  isApproved
                    ? "border-2 border-emerald-500 bg-emerald-50/10"
                    : isUnderReview
                      ? "border-2 border-emerald-500 bg-emerald-50/20"
                      : "border border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-[#051F16] bg-slate-100 px-2 py-0.5 rounded">
                        {sample.id}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {sample.supplierDisplayName}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {sample.category}
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-[#051F16]">
                      {sample.productTitle} ({sample.sampleQuantity} Sample
                      Units)
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                      {sample.specifications}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${
                        sample.status === "Approved"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : sample.status === "Under Review"
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : sample.status === "Dispatched"
                              ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                              : sample.status === "Preparing"
                                ? "bg-emerald-100/60 text-emerald-900 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      Status: {sample.status}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Requested on {sample.createdAt}
                    </div>
                  </div>
                </div>

                {/* Logistics & Dispatch Info if dispatched */}
                {sample.trackingNumber && (
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Icons.Package className="w-4 h-4 text-emerald-700" />
                      <span>
                        Carrier: <strong>{sample.carrierName}</strong> ·
                        Tracking:{" "}
                        <strong className="font-mono">
                          {sample.trackingNumber}
                        </strong>
                      </span>
                    </div>
                    {sample.deliveredDate ? (
                      <span className="text-emerald-700 font-bold">
                        Delivered on {sample.deliveredDate} ✓
                      </span>
                    ) : (
                      <span className="text-emerald-800 font-bold">
                        Dispatched on {sample.dispatchedDate} (In Transit)
                      </span>
                    )}
                  </div>
                )}

                {/* Evaluation Callout if Approved */}
                {isApproved && (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                        <Icons.Check className="w-4 h-4" />
                        <span>Sample Quality Approved for Bulk Order</span>
                      </div>
                      <p className="text-xs text-emerald-900/80 mt-0.5">
                        {sample.evaluationNotes ||
                          "Specifications calibrated. EVA foam contour and Kappa board rigidity confirmed."}
                      </p>
                    </div>

                    <MPIButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        approveSampleAndProceedToRFQ(sample.id)
                        navigate("startup.comparison")
                      }}
                      icon={<Icons.ArrowRight className="w-4 h-4" />}
                    >
                      Proceed to Bulk RFQ →
                    </MPIButton>
                  </div>
                )}

                {/* Review Action if Under Review / Delivered */}
                {isUnderReview && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Sample delivered to destination. Ready for dimensional &
                      material verification.
                    </span>
                    <MPIButton
                      variant="ai"
                      size="sm"
                      onClick={() => setEvaluatingSampleId(sample.id)}
                    >
                      Evaluate & Approve Sample →
                    </MPIButton>
                  </div>
                )}
              </MPICard>
            )
          })}
        </div>
      </div>,
      "My Pre-Production Samples",
      "Track 8 lifecycle audit states for pre-production samples prior to bulk manufacturing.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 9. GOVERNMENT SCHEMES DASHBOARD (startup.schemes)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.schemes") {
    return renderShell(
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D9A400] bg-[#FFF7D6] px-2.5 py-0.5 rounded-full border border-yellow-200">
              Personalized Statutory Scheme Matching
            </span>
            <h3
              className="text-lg font-extrabold text-[#051F16] mt-1"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              Government Subsidies & Sourcing Grants for Your Startup
            </h3>
            <p className="text-xs text-slate-500">
              Algorithmic matches calibrated for{" "}
              {startupProfile.startupName || "Your Startup"} (
              {startupProfile.stage || "MVP"} Stage) in {selectedCategory}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MPIButton
              variant="ai"
              size="sm"
              onClick={() => {
                trackTelemetryEvent("scheme_matcher_opened", {
                  source: "startup_schemes_dashboard",
                  role: "startup",
                })
                navigate("government-schemes.match")
              }}
              icon={<Icons.Sparkles className="w-3.5 h-3.5" />}
            >
              Interactive Matcher →
            </MPIButton>
            <MPIButton
              variant="outline"
              size="sm"
              onClick={() => navigate("government-schemes.browse")}
            >
              Browse All 30 Schemes →
            </MPIButton>
          </div>
        </div>

        {/* Schemes Match Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white p-6 rounded-2xl border-2 border-emerald-500 ring-2 ring-emerald-50 shadow-xs space-y-4">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                O/o DC-MSME · Quality Support
              </span>
              <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                98% Match
              </span>
            </div>
            <h4 className="text-base font-extrabold text-[#051F16]">
              ZED Certification Quality Reimbursement Scheme
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Provides up to 80% reimbursement on quality testing and statutory
              certification costs when sourcing from ZED Gold certified
              suppliers.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between items-center">
              <span className="font-semibold text-slate-500">Max Benefit:</span>
              <span className="font-extrabold text-slate-900">
                Up to ₹5,00,000 per facility
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-emerald-700 font-bold">
                Post-Procurement Reimbursement · Directly Claimable from DC-MSME
              </span>
              <div className="flex items-center gap-2">
                <MPIButton
                  variant="ai"
                  size="sm"
                  onClick={() =>
                    handlePreScreenScheme("ZED Certification Quality Reimbursement Scheme")
                  }
                  icon={<Icons.Sparkles className="w-3.5 h-3.5" />}
                >
                  AI Pre-Screen & Checklist
                </MPIButton>
                <a
                  href="https://zed.msme.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackTelemetryEvent("scheme_official_link_clicked", {
                      schemeId: "SCH-ZED-01",
                      schemeName: "ZED Certification Quality Reimbursement Scheme",
                      url: "https://zed.msme.gov.in",
                    })
                  }}
                  className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1 p-1"
                >
                  <Icons.ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                DC-MSME · Design Clinic
              </span>
              <span className="text-sm font-extrabold text-[#051F16] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                92% Match
              </span>
            </div>
            <h4 className="text-base font-extrabold text-[#051F16]">
              Design Clinic Sourcing Assistance Scheme
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Financial grant of 60% up to ₹9,00,000 for product design, custom
              packaging tooling, and structural box engineering.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between items-center">
              <span className="font-semibold text-slate-500">Max Benefit:</span>
              <span className="font-extrabold text-slate-900">
                Up to ₹9,00,000 tooling grant
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Applicable on Packaging & Prototyping · Post-Procurement Grant
              </span>
              <div className="flex items-center gap-2">
                <MPIButton
                  variant="ai"
                  size="sm"
                  onClick={() =>
                    handlePreScreenScheme("Design Clinic Sourcing Assistance Scheme")
                  }
                  icon={<Icons.Sparkles className="w-3.5 h-3.5" />}
                >
                  AI Pre-Screen & Checklist
                </MPIButton>
                <a
                  href="https://designclinicsmsme.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackTelemetryEvent("scheme_official_link_clicked", {
                      schemeId: "SCH-DESIGN-01",
                      schemeName: "Design Clinic Sourcing Assistance Scheme",
                      url: "https://designclinicsmsme.org",
                    })
                  }}
                  className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1 p-1"
                >
                  <Icons.ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>,
      "Government Schemes Intelligence",
      "Statutory subsidies and central grants matched to your startup stage and procurement categories.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 10. STARTUP SETTINGS & ACCOUNT GOVERNANCE (startup.settings)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "startup.settings") {
    return renderShell(
      <StartupSettings
        startupProfile={startupProfile}
        updateStartupProfile={updateStartupProfile}
        navigate={navigate}
      />,
      "Startup Profile & Procurement Settings",
      "Manage your statutory DPIIT credentials, annual sourcing threshold, and escrow parameters.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 11. DEFAULT FALLBACK / SHORTLIST / MATCHES SCREENS
  // ════════════════════════════════════════════════════════════════════════════
  return renderShell(
    <div className="space-y-6">
      {/* ─── TRY A SAMPLE BEFORE YOUR BULK ORDER CARD ───────────────────────── */}
      <div className="bg-linear-to-r from-[#051F16] to-[#0A3525] rounded-2xl p-6 text-white shadow-lg border border-blue-400/20 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#051F16] text-white px-2.5 py-0.5 rounded-full">
              Zero Production Risk
            </span>
            <span className="text-xs text-[#FFF7D6] font-semibold">
              Quality Pre-Validation Protocol
            </span>
          </div>
          <h3
            className="text-lg sm:text-xl font-extrabold text-white"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Try a Sample Before Your Bulk Order
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Avoid expensive batch mistakes and tooling misalignment. Request 1-3
            physical pre-production samples from your top matched supplier.
            Evaluate material density, color finish, and drop resilience before
            issuing a bulk PO.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <MPIButton
            variant="ai"
            size="md"
            onClick={() => {
              if (publicStartupSuppliers.length > 0) {
                setSelectedSampleSupplier(publicStartupSuppliers[0])
                setSampleModalOpen(true)
              }
            }}
            icon={<Icons.Package className="w-4 h-4" />}
          >
            Request Pre-Production Sample
          </MPIButton>
          <button
            onClick={() => navigate("startup.samples")}
            className="text-xs font-bold text-white hover:text-[#FFF7D6] underline underline-offset-4 cursor-pointer px-2"
          >
            Track Existing Samples ({sampleRequests.length}) →
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Top 5 MPI Verified Supplier Matches ({publicStartupSuppliers.length}
            )
          </h3>
          <p className="text-xs text-slate-500">
            Strictly anonymized suppliers filtered by machine capabilities,
            statutory audits, and lead time reliability.
          </p>
        </div>
        <MPIButton
          variant="outline"
          size="sm"
          onClick={() => navigate("startup.comparison")}
        >
          View Side-by-Side Quote Matrix →
        </MPIButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {publicStartupSuppliers.map((sup) => (
          <div
            key={sup.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {sup.displayName}
                  </h4>
                  <div className="text-xs text-slate-500">
                    {sup.category} · {sup.city}, {sup.state}
                  </div>
                </div>
                <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {sup.matchScore}% Fit
                </span>
              </div>

              <div className="text-xs text-slate-600 mt-2 mb-3 bg-slate-50 p-2.5 rounded-lg space-y-1">
                <div>
                  <strong>MOQ:</strong> {sup.moq}
                </div>
                <div>
                  <strong>Lead Time:</strong> {sup.leadTime}
                </div>
                <div>
                  <strong>Capacity:</strong> {sup.capacityPerMonth}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {sup.certifications.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedSupplierDetail(sup)}
                className="text-xs text-[#051F16] font-semibold hover:underline cursor-pointer"
              >
                View Match
              </button>
              <div className="flex items-center gap-1.5">
                <MPIButton
                  variant="ai"
                  size="sm"
                  onClick={() => {
                    setSelectedSampleSupplier(sup)
                    setSampleModalOpen(true)
                  }}
                >
                  Request Sample
                </MPIButton>
                <MPIButton
                  variant={
                    shortlistedSupplierIds.includes(sup.id)
                      ? "primary"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => toggleShortlistSupplier(sup.id)}
                >
                  {shortlistedSupplierIds.includes(sup.id)
                    ? "Shortlisted"
                    : "+ Shortlist"}
                </MPIButton>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    "Verified Supplier Matches",
    "Audited manufacturing partners filtered by capability and machine capacity.",
  )
}
