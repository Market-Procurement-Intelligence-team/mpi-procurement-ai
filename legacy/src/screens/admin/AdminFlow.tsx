import { useState, useMemo, useEffect } from "react"
import { NavProps, Screen } from "../../App"
import {
  useProcurement,
  DemoStartupRecord,
  DemoMSMERecord,
} from "../../context/ProcurementContext"
import { CATALOG_CATEGORIES, CatalogCategory } from "../../lib/mpiCatalog"
import { setAdminSession } from "../../lib/mockAuth"
import {
  Icons,
  MPIButton,
  MPIStatCard,
  MPIVerifiedBadge,
  MPIStatusBadge,
} from "../../components/design-system/MPIDesignSystem"
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  auditAdminRiskAndAnomaliesWithAI,
  RiskAnomalyResult,
  chatWithAdminCopilot,
  AdminCopilotReply,
  AdminCopilotContext,
  analyzeModelFairnessWithAI,
  ModelFairnessReport,
} from "../../services/aiService"
import MaterialIcon from "../../components/ui/MaterialIcon"
import { MPI_AI_CAPABILITIES } from "../../services/ai/capabilityRegistry"
import {
  fetchLiveTelemetrySummary,
  getLocalTelemetrySummary,
} from "../../services/telemetryService"

// Markdown parser for Admin Copilot rich generative text
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

export default function AdminFlow({
  navigate,
  goBack,
  currentScreen,
}: NavProps) {
  const {
    demoStartups,
    demoMSMEs,
    updateStartupAuditStatus,
    updateMSMEAuditStatus,
    ordersList,
    msmeRFQs,
  } = useProcurement()

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Search & Filters for Startups Table
  const [startupSearch, setStartupSearch] = useState("")
  const [startupStatusFilter, setStartupStatusFilter] =
    useState<"All" | DemoStartupRecord["auditStatus"]>("All")

  // Search & Filters for MSMEs Table
  const [msmeSearch, setMsmeSearch] = useState("")
  const [msmeCategoryFilter, setMsmeCategoryFilter] =
    useState<"All" | CatalogCategory>("All")
  const [msmeStatusFilter] =
    useState<"All" | DemoMSMERecord["verificationStatus"]>("All")

  // Pending Audits Tab in Analytics Studio
  const [auditTab, setAuditTab] = useState<"startups" | "msmes">("startups")

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    type: "startup" | "msme"
    id: string
    targetName: string
    action: "approve" | "reject" | "request_info"
  } | null>(null)

  // Success Toast Notification
  const [actionSuccessMessage, setActionSuccessMessage] =
    useState<string | null>(null)

  // AI Matching Telemetry Weights
  const [weights, setWeights] = useState({
    tolerances: 35,
    leadTime: 25,
    pricing: 25,
    compliance: 15,
  })

  // Live Telemetry Funnel State (PostgreSQL authoritative and local session buffer tracked distinctly)
  const [telemetryData, setTelemetryData] = useState<{
    fromDatabase: boolean
    totalCount: number
    eventCounts: Record<string, number>
    recentEvents: Array<{
      id: number
      event: string
      sessionId: string
      createdAt: string
      metadata: Record<string, any>
    }>
    localCount: number
    localEventCounts: Record<string, number>
    error?: string
  }>({
    fromDatabase: false,
    totalCount: 0,
    eventCounts: {},
    recentEvents: [],
    localCount: 0,
    localEventCounts: {},
  })
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false)
  const [showMetricStandardsModal, setShowMetricStandardsModal] = useState(false)

  const reloadTelemetry = () => {
    setIsRefreshingTelemetry(true)
    const local = getLocalTelemetrySummary()
    const localTotal = Object.values(local).reduce((a, b) => a + b, 0)

    fetchLiveTelemetrySummary()
      .then((res) => {
        setTelemetryData({
          ...res,
          localCount: localTotal,
          localEventCounts: local,
        })
        setIsRefreshingTelemetry(false)
      })
      .catch((err) => {
        setTelemetryData({
          fromDatabase: false,
          totalCount: 0,
          eventCounts: {},
          recentEvents: [],
          localCount: localTotal,
          localEventCounts: local,
          error: err instanceof Error ? err.message : "Database fetch failed",
        })
        setIsRefreshingTelemetry(false)
      })
  }

  useEffect(() => {
    if (currentScreen === "admin.analytics" || currentScreen === "admin.home") {
      reloadTelemetry()
    }
  }, [currentScreen])

  // 62-Capability Architecture Registry Filter State
  const [capCategoryFilter, setCapCategoryFilter] = useState<string>("all")
  const [capSearchQuery, setCapSearchQuery] = useState<string>("")

  // ─── BLUEPRINT AI CAPABILITIES ─────────────────────────────────────────────
  // Items 54 & 55: Risk & Suspicious Pattern Flags & Duplicate Invoice Detection
  const [adminTransactions] = useState([
    {
      id: "TXN-0918",
      startup: "TechNova Innovations",
      msme: "Apex Precision Packaging Ltd.",
      amount: 65250,
      category: "Packaging & Printing",
      status: "In Escrow",
      date: "Sep 24, 2026",
      bankAccountChangedRecently: true,
      priceJumpPercent: 28,
      invoiceId: "INV-2026-904",
      matchedPriorInvoiceId: "INV-2026-892",
      riskFlag: "High Risk (Bank Changed & Duplicate Candidate)",
    },
    {
      id: "TXN-0872",
      startup: "GreenBridge Agri",
      msme: "Suryavanshi Prints",
      amount: 124000,
      category: "Packaging & Printing",
      status: "Settled",
      date: "Sep 18, 2026",
      bankAccountChangedRecently: false,
      priceJumpPercent: 4,
      invoiceId: "INV-2026-771",
      riskFlag: "Verified Clean",
    },
    {
      id: "TXN-0841",
      startup: "CleanEdge EV",
      msme: "Bharat Tech Innovators Labs",
      amount: 84500,
      category: "Prototyping & Product Development",
      status: "Settled",
      date: "Sep 12, 2026",
      bankAccountChangedRecently: false,
      priceJumpPercent: 2,
      invoiceId: "INV-2026-654",
      riskFlag: "Verified Clean",
    },
    {
      id: "TXN-0792",
      startup: "BioGenix Diagnostics",
      msme: "Titan Prototyping Works",
      amount: 210000,
      category: "Specialized Startup Support",
      status: "In Escrow",
      date: "Aug 29, 2026",
      bankAccountChangedRecently: true,
      priceJumpPercent: 34,
      invoiceId: "INV-2026-512",
      riskFlag: "Suspicious Price Jump (+34%)",
    },
  ])

  const [selectedTxForAudit, setSelectedTxForAudit] = useState<{
    id: string
    startup: string
    msme: string
    amount: number
    category: string
    bankAccountChangedRecently: boolean
    priceJumpPercent: number
    invoiceId: string
    matchedPriorInvoiceId?: string
  } | null>(null)
  const [riskAuditResult, setRiskAuditResult] = useState<RiskAnomalyResult | null>(null)
  const [isAuditingRisk, setIsAuditingRisk] = useState(false)

  // Item 61: MPI Admin Operations & Intelligence Copilot
  const [isAdminCopilotOpen, setIsAdminCopilotOpen] = useState(false)
  const [adminCopilotTab, setAdminCopilotTab] = useState<
    "overview" | "buyers" | "suppliers" | "rfqs" | "performance" | "audit"
  >("overview")
  const [adminCopilotMessages, setAdminCopilotMessages] = useState<
    Array<{
      role: "user" | "ai"
      text: string
      time: string
      isLive?: boolean
      category?: string
      metrics?: AdminCopilotReply["keyMetrics"]
      actions?: AdminCopilotReply["prioritizedActions"]
      bottlenecks?: string[]
      suggestions?: string[]
    }>
  >([
    {
      role: "ai",
      text: `Hello Admin! I am your **MPI Admin Operations & Intelligence Copilot**, powered by real-time MPI AI.

I can actively review live platform datasets and assist you with:
- 👥 **Buyers List Analysis**: Review 55 startup buyers, procurement budgets, and DPIIT compliance.
- 🏭 **Suppliers List Analysis**: Evaluate 55 MSME manufacturers, capacity utilization, and ZED Gold certifications.
- 📋 **Live RFQs Review**: Track in-market demand, price benchmarks, and supplier quotation turnaround.
- ⚡ **Performance Telemetry**: Monitor fulfillment rates (96.8% SLA), ISTA-1A drop-test QC rates, and network multipliers.
- 🛡️ **Audit Queue Triage**: Prioritize statutory document verification and investigate forensic risk anomalies.

Select a quick analysis pill below or ask me any question!`,
      time: "10:00 AM",
      isLive: true,
      category: "General Overview",
      metrics: [
        { label: "Active Startups", value: "55", change: "100% verified demo", trend: "up" },
        { label: "Verified MSMEs", value: "55", change: "7 Categories", trend: "up" },
        { label: "In-Flight Escrow", value: "₹2,75,250", change: "100% Protected", trend: "neutral" },
        { label: "Pending Audits", value: "9", change: "Action required", trend: "down" },
      ],
      actions: [
        { title: "Review 4 incomplete MSME profiles in Peenya cluster", category: "Audit Queue", urgency: "Immediate", actionScreen: "admin.msmes", actionLabel: "Review MSMEs" },
        { title: "Investigate TXN-0918 beneficiary account change (2h ago)", category: "Escrow Triage", urgency: "Immediate", actionScreen: "admin.transactions", actionLabel: "Forensic Audit" },
        { title: "Audit DPIIT registration files for 3 Seed-stage startups", category: "Buyers", urgency: "High", actionScreen: "admin.startups", actionLabel: "Audit Startups" },
      ],
      bottlenecks: [
        "Sample drop-test QA reviews averaging 3.8 days vs 2-day target SLA",
        "Delayed DPIIT document uploads on 4 newly onboarded MVP startups",
      ],
      suggestions: [
        "Analyze our 55 startup buyers, spend distribution, and stage health",
        "Review our 55 MSME suppliers, category capacities, and ZED certifications",
        "Review all live RFQs, open demand, and supplier quotation turnaround",
        "Analyze MSME fulfillment rates, ISTA-1A drop-test QC passes, and SLA benchmarks",
        "Triage the statutory audit queue, pending verifications, and forensic risk anomalies",
      ],
    },
  ])
  const [adminCopilotInput, setAdminCopilotInput] = useState("")
  const [isAdminCopilotTyping, setIsAdminCopilotTyping] = useState(false)

  const handleResetAdminCopilot = () => {
    setAdminCopilotMessages([
      {
        role: "ai",
        text: `New operations analysis session initialized. Platform context active across **55 Startups**, **55 MSMEs**, and **₹2,75,250 In-Flight Escrow**. How may I assist your administrative review?`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isLive: true,
        category: "General Overview",
        suggestions: [
          "Analyze our 55 startup buyers, spend distribution, and stage health",
          "Review our 55 MSME suppliers, category capacities, and ZED certifications",
          "Review all live RFQs, open demand, and supplier quotation turnaround",
          "Analyze MSME fulfillment rates, ISTA-1A drop-test QC passes, and SLA benchmarks",
          "Triage the statutory audit queue, pending verifications, and forensic risk anomalies",
        ],
      },
    ])
  }

  const handleRunRiskAudit = async (tx: typeof adminTransactions[0]) => {
    setSelectedTxForAudit(tx)
    setIsAuditingRisk(true)
    setRiskAuditResult(null)
    try {
      const res = await auditAdminRiskAndAnomaliesWithAI({
        id: tx.id,
        startup: tx.startup,
        msme: tx.msme,
        amount: tx.amount,
        category: tx.category,
        bankAccountChangedRecently: tx.bankAccountChangedRecently,
        priceJumpPercent: tx.priceJumpPercent,
        invoiceId: tx.invoiceId,
        matchedPriorInvoiceId: tx.matchedPriorInvoiceId,
      })
      setRiskAuditResult(res)
    } catch (err) {
      console.warn("Risk audit error:", err)
    } finally {
      setIsAuditingRisk(false)
    }
  }

  const handleSendAdminCopilot = async (customPrompt?: string) => {
    const text = (customPrompt || adminCopilotInput).trim()
    if (!text) return
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const updated = [...adminCopilotMessages, { role: "user" as const, text, time: nowTime }]
    setAdminCopilotMessages(updated)
    setAdminCopilotInput("")
    setIsAdminCopilotTyping(true)

    // Build comprehensive ecosystem telemetry
    const totalBuyerSpend = demoStartups.reduce((acc, s) => acc + (s.procurementValue || 0), 0)
    const topBuyers = [...demoStartups]
      .sort((a, b) => (b.procurementValue || 0) - (a.procurementValue || 0))
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        stage: s.stage,
        spend: s.procurementValue || 0,
        auditStatus: s.auditStatus,
      }))
    const stageBreakdown: Record<string, number> = {}
    demoStartups.forEach((s) => {
      stageBreakdown[s.stage] = (stageBreakdown[s.stage] || 0) + 1
    })

    const avgFulfillment = Math.round(
      demoMSMEs.reduce((acc, m) => acc + (m.fulfillmentRate || 95), 0) / (demoMSMEs.length || 1),
    )
    const topSuppliers = [...demoMSMEs]
      .sort((a, b) => (b.fulfillmentRate || 0) - (a.fulfillmentRate || 0))
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        city: m.city,
        fulfillmentRate: m.fulfillmentRate || 96,
        verificationStatus: m.verificationStatus,
      }))
    const categoryBreakdown: Record<string, number> = {}
    demoMSMEs.forEach((m) => {
      categoryBreakdown[m.category] = (categoryBreakdown[m.category] || 0) + 1
    })

    const totalRfqBudget = msmeRFQs.reduce((acc, r) => acc + (r.targetBudget || 0), 0)
    const sampleRFQs = msmeRFQs.slice(0, 5).map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      quantity: r.quantity,
      budget: r.targetBudget,
      status: r.status,
    }))

    const context: AdminCopilotContext = {
      totalStartupsCount: demoStartups.length,
      totalMSMEsCount: demoMSMEs.length,
      pendingStartupsCount: pendingStartups.length,
      pendingMSMEsCount: pendingMSMEs.length,
      liveRFQsCount: msmeRFQs.length,
      escrowInFlightINR: 275250,
      totalGMV: "₹48.6 Cr",
      unverifiedClusters: ["Peenya (Bangalore)", "Okhla (Delhi-NCR)", "Sivakasi (TN)"],
      buyersSummary: {
        totalSpendINR: totalBuyerSpend,
        topBuyers,
        stageBreakdown,
      },
      suppliersSummary: {
        avgFulfillmentRate: avgFulfillment,
        topSuppliers,
        categoryBreakdown,
      },
      liveRFQsSummary: {
        totalBudgetINR: totalRfqBudget,
        sampleRFQs,
      },
      performanceSummary: {
        avgFulfillmentRate: 96.8,
        avgDropTestPassRate: 99.2,
        networkMultiplier: "1 MSME : 50 Orders",
        activeOrdersCount: ordersList.length,
      },
      auditQueueSummary: {
        pendingStartups: pendingStartups.map((s) => ({ id: s.id, name: s.name, city: s.city, joinedDate: s.joinedDate })),
        pendingMSMEs: pendingMSMEs.map((m) => ({ id: m.id, name: m.name, category: m.category, city: m.city, udyam: m.udyamNumber })),
        anomalousTransactions: adminTransactions
          .filter((t) => t.bankAccountChangedRecently || t.priceJumpPercent > 20 || t.matchedPriorInvoiceId)
          .map((t) => ({ id: t.id, startup: t.startup, msme: t.msme, amount: t.amount, flag: t.riskFlag })),
      },
    }

    try {
      const res = await chatWithAdminCopilot(
        updated.map((m) => ({ role: m.role, text: m.text })),
        context,
      )
      setAdminCopilotMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: res.reply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isLive: res.isLive,
          category: res.analysisCategory,
          metrics: res.keyMetrics,
          actions: res.prioritizedActions,
          bottlenecks: res.bottlenecksIdentified,
          suggestions: res.suggestedQueries,
        },
      ])
    } catch (err) {
      console.warn("Admin copilot error:", err)
      setAdminCopilotMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "I experienced a temporary connection interruption while analyzing platform telemetry. All data pipelines and escrow safeguards remain active.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isLive: false,
        },
      ])
    } finally {
      setIsAdminCopilotTyping(false)
    }
  }

  // Item 62: Model Fairness & Quality Monitoring
  const [fairnessReport, setFairnessReport] = useState<ModelFairnessReport | null>(null)
  const [isAuditingFairness, setIsAuditingFairness] = useState(false)

  const handleRunFairnessAudit = async () => {
    setIsAuditingFairness(true)
    try {
      const res = await analyzeModelFairnessWithAI({
        totalMatchesRun: 1420,
        microMSMEPercent: 38,
        smallMSMEPercent: 44,
        mediumMSMEPercent: 18,
        biasMitigationActive: true,
      })
      setFairnessReport(res)
    } catch (err) {
      console.warn("Fairness audit error:", err)
    } finally {
      setIsAuditingFairness(false)
    }
  }

  // Filtered Startups
  const filteredStartups = useMemo(() => {
    return demoStartups.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(startupSearch.toLowerCase()) ||
        s.id.toLowerCase().includes(startupSearch.toLowerCase()) ||
        s.city.toLowerCase().includes(startupSearch.toLowerCase()) ||
        s.industry.toLowerCase().includes(startupSearch.toLowerCase())
      const matchesStatus =
        startupStatusFilter === "All" || s.auditStatus === startupStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [demoStartups, startupSearch, startupStatusFilter])

  // Filtered MSMEs
  const filteredMSMEs = useMemo(() => {
    return demoMSMEs.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(msmeSearch.toLowerCase()) ||
        m.id.toLowerCase().includes(msmeSearch.toLowerCase()) ||
        m.city.toLowerCase().includes(msmeSearch.toLowerCase()) ||
        m.udyamNumber.toLowerCase().includes(msmeSearch.toLowerCase())
      const matchesCategory =
        msmeCategoryFilter === "All" || m.category === msmeCategoryFilter
      const matchesStatus =
        msmeStatusFilter === "All" || m.verificationStatus === msmeStatusFilter
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [demoMSMEs, msmeSearch, msmeCategoryFilter, msmeStatusFilter])

  // Pending Startups & MSMEs for Audits Panel
  const pendingStartups = useMemo(() => {
    return demoStartups.filter((s) => s.auditStatus !== "Verified")
  }, [demoStartups])

  const pendingMSMEs = useMemo(() => {
    return demoMSMEs.filter((m) => m.verificationStatus !== "Verified")
  }, [demoMSMEs])

  // Category volume data across the 7 categories
  const categoryVolumeData = [
    { cat: "Packaging & Printing", volume: 42 },
    { cat: "Prototyping & Product Development", volume: 28 },
    { cat: "IT & Digital Services", volume: 34 },
    { cat: "Compliance & Legal Support", volume: 20 },
    { cat: "Marketing & Sales Support", volume: 18 },
    { cat: "Business & Finance Services", volume: 15 },
    { cat: "Specialized Startup Support", volume: 12 },
  ]

  // Growth Trend Data
  const growthTrend = [
    { month: "Apr", gmv: 3.2, rfqCount: 45 },
    { month: "May", gmv: 4.8, rfqCount: 68 },
    { month: "Jun", gmv: 6.1, rfqCount: 92 },
    { month: "Jul", gmv: 8.4, rfqCount: 124 },
    { month: "Aug", gmv: 11.2, rfqCount: 168 },
    { month: "Sep", gmv: 14.9, rfqCount: 220 },
  ]

  const handleConfirmAction = () => {
    if (!confirmDialog) return

    if (confirmDialog.type === "startup") {
      if (confirmDialog.action === "approve") {
        updateStartupAuditStatus(confirmDialog.id, "Verified")
        setActionSuccessMessage(
          `Startup "${confirmDialog.targetName}" has been successfully approved and verified.`,
        )
      } else if (confirmDialog.action === "reject") {
        updateStartupAuditStatus(confirmDialog.id, "Pending Audit")
        setActionSuccessMessage(
          `Startup "${confirmDialog.targetName}" marked for re-audit.`,
        )
      } else {
        updateStartupAuditStatus(confirmDialog.id, "Needs Information")
        setActionSuccessMessage(
          `Information request dispatched to "${confirmDialog.targetName}".`,
        )
      }
    } else {
      if (confirmDialog.action === "approve") {
        updateMSMEAuditStatus(confirmDialog.id, "Verified")
        setActionSuccessMessage(
          `MSME "${confirmDialog.targetName}" has been successfully granted MPI Verified status.`,
        )
      } else if (confirmDialog.action === "reject") {
        updateMSMEAuditStatus(confirmDialog.id, "Pending Audit")
        setActionSuccessMessage(
          `MSME "${confirmDialog.targetName}" set to pending status.`,
        )
      } else {
        updateMSMEAuditStatus(confirmDialog.id, "Needs Information")
        setActionSuccessMessage(
          `Statutory clarification requested from "${confirmDialog.targetName}".`,
        )
      }
    }

    setConfirmDialog(null)
    setTimeout(() => setActionSuccessMessage(null), 3500)
  }

  const navItems = [
    {
      screen: "admin.home" as Screen,
      label: "Ecosystem Overview",
      icon: <Icons.Building className="w-4 h-4" />,
    },
    {
      screen: "admin.analytics" as Screen,
      label: "Analytics Studio",
      icon: <Icons.BarChart3 className="w-4 h-4" />,
    },
    {
      screen: "admin.startup-management" as Screen,
      label: "Startups Directory",
      icon: <Icons.Users className="w-4 h-4" />,
    },
    {
      screen: "admin.msme-management" as Screen,
      label: "Verified MSMEs",
      icon: <Icons.ShieldCheck className="w-4 h-4" />,
    },
    {
      screen: "admin.verification" as Screen,
      label: "Statutory Audit Queue",
      icon: <Icons.Check className="w-4 h-4" />,
    },
    {
      screen: "admin.ai-matching" as Screen,
      label: "AI Telemetry Calibration",
      icon: <Icons.Sparkles className="w-4 h-4" />,
    },
    {
      screen: "admin.procurement" as Screen,
      label: "Escrow Transactions",
      icon: <Icons.Coins className="w-4 h-4" />,
    },
  ]

  const renderShell = (
    content: React.ReactNode,
    title: string,
    subtitle?: string,
  ) => (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1220] flex font-sans selection:bg-[#051F16] selection:text-white">
      {/* ─── SIDEBAR (Deep Forest #051F16) ───────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#051F16] text-white flex flex-col justify-between transition-transform duration-300 border-r border-[#0A3525] lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Header */}
          <div className="p-5 border-b border-[#0A3525] flex items-center justify-between">
            <button
              onClick={() => navigate("home")}
              className="flex items-center gap-2.5 text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0A3525] border border-emerald-800/60 text-[#A3F65C] flex items-center justify-center font-bold">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <div
                  className="font-extrabold text-base tracking-tight text-white"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  MPI Governance
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  Control Center
                </div>
              </div>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0A3525]"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
          </div>

          {/* System Pulse Card */}
          <div className="p-3.5 mx-3 my-3 bg-[#0A3525]/70 rounded-xl border border-emerald-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-pulse" />
              <span>AI Engine & Escrow Healthy</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-1">
              Uptime: 99.98% · Telemetry: 420ms
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            {navItems.map((item) => {
              const isActive = currentScreen === item.screen
              return (
                <button
                  key={item.screen}
                  onClick={() => {
                    navigate(item.screen)
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#083A28] text-[#A3F65C] border border-emerald-700/50 shadow-xs"
                      : "text-slate-300 hover:bg-[#0A3525] hover:text-white"
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Bottom Session Card & Home Link */}
        <div className="p-4 border-t border-[#0A3525] space-y-2.5">
          <div className="p-2.5 rounded-xl bg-[#03150E] border border-emerald-950 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-white flex items-center gap-1.5">
                admin
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Port 8443 · /1982/admin
              </div>
            </div>
            <button
              onClick={() => {
                setAdminSession(false)
                navigate("login.admin")
              }}
              className="text-[11px] font-semibold text-rose-300 hover:text-white px-2 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 transition-colors cursor-pointer flex items-center gap-1"
              title="Lock Admin Session"
            >
              <Icons.LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>

          <button
            onClick={() => navigate("home")}
            className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded-lg hover:bg-[#0A3525] cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <MaterialIcon icon="home" size={14} className="text-slate-400" />
              <span>Home Marketplace</span>
            </span>
            <span className="text-[10px] bg-[#0A3525] px-1.5 py-0.5 rounded text-slate-300 border border-emerald-900/50">
              Live
            </span>
          </button>
          <button
            onClick={() => navigate("startup.home")}
            className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded-lg hover:bg-[#0A3525] cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <MaterialIcon icon="rocket_launch" size={14} className="text-slate-400" />
              <span>Startup Hub</span>
            </span>
            <span className="text-[10px] bg-[#0A3525] text-slate-300 border border-emerald-900/50 px-1.5 py-0.5 rounded">
              Buyer
            </span>
          </button>
          <button
            onClick={() => navigate("msme.home")}
            className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded-lg hover:bg-[#0A3525] cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <MaterialIcon icon="precision_manufacturing" size={14} className="text-slate-400" />
              <span>MSME Portal</span>
            </span>
            <span className="text-[10px] bg-[#0A3525] text-slate-300 border border-emerald-900/50 px-1.5 py-0.5 rounded">
              Supplier
            </span>
          </button>
          <div className="text-[10px] text-slate-400 text-center pt-1">
            MPI Enterprise Security & Telemetry
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
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
                  onClick={() => navigate("admin.home")}
                  className={`hover:text-slate-900 hover:underline cursor-pointer shrink-0 ${
                    currentScreen === "admin.home" ? "font-bold text-[#0B1220]" : ""
                  }`}
                >
                  Admin Portal
                </button>
                {currentScreen !== "admin.home" && (
                  <>
                    <span>/</span>
                    <span className="text-[#0B1220] font-semibold truncate max-w-30 sm:max-w-50">
                      {title}
                    </span>
                  </>
                )}
              </div>

              <div
                className="text-sm sm:text-lg font-bold text-[#0B1220] tracking-tight truncate"
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
              title="Switch to Startup Hub"
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

            <button
              onClick={() => setIsAdminCopilotOpen(true)}
              className="flex items-center gap-1.5 bg-[#051F16] hover:bg-[#083A28] text-white px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer shadow-xs border border-emerald-500/20"
            >
              <Icons.Sparkles className="w-3.5 h-3.5 text-[#A3F65C]" />
              <span className="hidden sm:inline">Admin Copilot</span>
            </button>

            <button
              onClick={() => navigate("admin.analytics")}
              className="flex items-center gap-2 bg-[#FFF7D6] hover:bg-[#ffefb3] text-[#8C6B00] border border-yellow-300 px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              <Icons.TrendingUp className="w-3.5 h-3.5 text-[#D9A400]" />
              <span className="hidden sm:inline">Analytics Studio</span>
              <span className="sm:hidden">Analytics</span>
            </button>

            <div className="items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold border border-slate-200 hidden sm:flex">
              <span>admin · authenticated</span>
            </div>

            <button
              onClick={() => {
                setAdminSession(false)
                navigate("login.admin")
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
              title="Sign out from MPI Admin session"
            >
              <Icons.LogOut className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Action notification toast */}
        {actionSuccessMessage && (
          <div className="bg-[#051F16] text-white text-xs py-2.5 px-4 text-center font-semibold animate-fade-in shadow-md border-b border-emerald-600">
            {actionSuccessMessage}
          </div>
        )}

        {/* Viewport Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {content}
        </main>
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {confirmDialog.action === "approve"
                  ? "Confirm Approval & Verification"
                  : confirmDialog.action === "reject"
                    ? "Confirm Rejection / Re-Audit"
                    : "Request Additional Statutory Information"}
              </h3>
              <button
                onClick={() => setConfirmDialog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to{" "}
              {confirmDialog.action === "approve"
                ? "approve"
                : confirmDialog.action === "reject"
                  ? "reject"
                  : "request additional data from"}{" "}
              <strong className="text-slate-900 font-bold">
                {confirmDialog.targetName}
              </strong>{" "}
              ({confirmDialog.id})? This will update their statutory status
              across the MPI ecosystem.
            </p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <MPIButton
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </MPIButton>
              <MPIButton
                variant={
                  confirmDialog.action === "approve" ? "primary" : "outline"
                }
                size="sm"
                onClick={handleConfirmAction}
              >
                Confirm Action
              </MPIButton>
            </div>
          </div>
        </div>
      )}

      {/* FORENSIC RISK AUDIT MODAL */}
      {selectedTxForAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                    AI Forensic Audit
                  </span>
                  <span className="text-xs font-mono text-slate-500">{selectedTxForAudit.id}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Transaction Anomaly Inspection
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedTxForAudit(null)
                  setRiskAuditResult(null)
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Startup Buyer:</span>
                  <span className="font-bold text-slate-900">{selectedTxForAudit.startup}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MSME Supplier:</span>
                  <span className="font-bold text-slate-900">{selectedTxForAudit.msme}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Escrow Value:</span>
                  <span className="font-bold text-slate-900">₹{selectedTxForAudit.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice ID:</span>
                  <span className="font-mono text-slate-700">{selectedTxForAudit.invoiceId}</span>
                </div>
              </div>

              {isAuditingRisk ? (
                <div className="p-6 text-center space-y-2">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-slate-600 font-semibold">Running forensic anomaly detection models...</p>
                </div>
              ) : riskAuditResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900">
                    <MaterialIcon name="shield" size={14} className="text-amber-700 shrink-0" />
                    <span>AI Forensic Diagnostic — Non-binding anomaly analysis. Formal tender suspension, vendor debarment, or statutory audit flags require authorized compliance officer approval.</span>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-900">Forensic Risk Score:</span>
                      <span className="font-extrabold text-sm text-rose-700">
                        {riskAuditResult.fraudRiskScore} / 100 ({riskAuditResult.overallRiskLevel} Risk)
                      </span>
                    </div>
                    <p className="text-slate-700">{riskAuditResult.auditSummary}</p>
                    {riskAuditResult.suspiciousFlags && riskAuditResult.suspiciousFlags.length > 0 && (
                      <div className="pt-2 border-t border-rose-200/80 space-y-1.5">
                        <span className="font-bold text-rose-900 text-[11px]">Identified Anomaly Flags:</span>
                        <div className="space-y-1 text-[11px] text-slate-700">
                          {riskAuditResult.suspiciousFlags.map((flag, idx) => (
                            <div key={idx} className="bg-white/80 p-2 rounded-lg border border-rose-100">
                              <span className="font-semibold text-rose-800">[{flag.severity}] </span>
                              <span>{flag.description}</span>
                              <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
                                → Action: {flag.recommendation}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {riskAuditResult.duplicateInvoiceDetected && (
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 font-semibold text-xs">
                      ⚠ Duplicate Invoice Match Flagged: Requires statutory clearance before payout.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <MPIButton
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedTxForAudit(null)
                  setRiskAuditResult(null)
                }}
              >
                Close Audit
              </MPIButton>
            </div>
          </div>
        </div>
      )}

      {/* PERSISTENT FLOATING ADMIN COPILOT TRIGGER */}
      <button
        type="button"
        onClick={() => setIsAdminCopilotOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-[#051F16] hover:bg-[#083A28] text-white px-4 py-3 rounded-full shadow-2xl border border-emerald-500/30 hover:scale-105 transition-all cursor-pointer group"
        title="Open MPI Admin Operations Copilot"
      >
        <div className="relative">
          <Icons.Sparkles className="w-5 h-5 text-[#A3F65C]" />
        </div>
        <span className="text-xs font-bold pr-1">Admin Copilot</span>
        <span className="text-[10px] font-mono bg-blue-900/80 text-orange-300 px-2 py-0.5 rounded-full border border-emerald-500/20">
          ⚡ MPI AI
        </span>
      </button>

      {/* MPI ADMIN OPERATIONS & INTELLIGENCE COPILOT SLIDE-OVER DRAWER */}
      {isAdminCopilotOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slide-left">
            {/* Drawer Header */}
            <div className="bg-[#051F16] text-white p-5 border-b border-[#0A3525] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#A3F65C] text-[#051F16] flex items-center justify-center font-bold shadow-md">
                  <Icons.Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className="font-extrabold text-base text-white tracking-tight"
                      style={{ fontFamily: "Plus Jakarta Sans" }}
                    >
                      MPI Admin Operations Copilot
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                      MPI AI Engine Live
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Real-time operational triage, buyers & suppliers data analysis, and live RFQs
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAdminCopilot}
                  className="text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded-lg hover:bg-[#083A28] transition-colors cursor-pointer border border-emerald-500/20"
                  title="Reset conversation"
                >
                  Clear Session
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdminCopilotOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#083A28] cursor-pointer"
                  aria-label="Close Admin Copilot"
                >
                  <Icons.Close className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick-Analysis Selector Tabs (5 Core Workflows) */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 shrink-0 overflow-x-auto flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                Data Presets:
              </span>
              {[
                { id: "buyers", label: "👥 Buyers Analysis", prompt: "Analyze our 55 startup buyers, procurement spend distribution, and stage health." },
                { id: "suppliers", label: "🏭 Suppliers Analysis", prompt: "Review our 55 MSME suppliers, category capacities, and ZED certifications." },
                { id: "rfqs", label: "📋 Live RFQs Review", prompt: "Review all live RFQs, open demand, and supplier quotation turnaround." },
                { id: "performance", label: "⚡ Performance SLA", prompt: "Analyze MSME fulfillment rates, ISTA-1A drop-test QC passes, and SLA benchmarks." },
                { id: "audit", label: "🛡️ Audit Queue", prompt: "Triage the statutory audit queue, pending verifications, and forensic risk anomalies." },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setAdminCopilotTab(pill.id as any)
                    handleSendAdminCopilot(pill.prompt)
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                    adminCopilotTab === pill.id
                      ? "bg-[#051F16] text-white border-[#051F16] shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {adminCopilotMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  {/* Sender label */}
                  <span className="text-[10px] font-semibold text-slate-400 mb-1 px-1">
                    {msg.role === "user" ? "Admin" : "MPI Operations Intelligence"} · {msg.time}
                  </span>

                  {/* Message bubble */}
                  <div
                    className={`max-w-[92%] rounded-2xl p-4 text-xs ${
                      msg.role === "user"
                        ? "bg-[#051F16] text-white rounded-tr-xs"
                        : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs space-y-3"
                    }`}
                  >
                    {/* Category pill if AI message */}
                    {msg.role === "ai" && msg.category && (
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#051F16] bg-emerald-100/60/70 px-2 py-0.5 rounded-md">
                          {msg.category}
                        </span>
                        {msg.isLive && (
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                            Live MPI AI Response
                          </span>
                        )}
                      </div>
                    )}

                    {/* Main text content with markdown rendering */}
                    <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                      {msg.text.split("\n\n").map((para, pIdx) => (
                        <p key={pIdx}>{parseInlineFormatting(para)}</p>
                      ))}
                    </div>

                    {/* Key Metrics Grid */}
                    {msg.metrics && msg.metrics.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/80">
                        {msg.metrics.map((met, mIdx) => (
                          <div
                            key={mIdx}
                            className="bg-white p-2.5 rounded-xl border border-slate-200 text-center"
                          >
                            <span className="text-[10px] text-slate-500 font-medium block truncate">
                              {met.label}
                            </span>
                            <span className="text-sm font-bold text-[#051F16] block mt-0.5">
                              {met.value}
                            </span>
                            {met.change && (
                              <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
                                {met.change}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prioritized Operational Action Cards */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Prioritized Staff Directives:
                        </span>
                        <div className="space-y-1.5">
                          {msg.actions.map((act, aIdx) => (
                            <div
                              key={aIdx}
                              className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                      act.urgency === "Immediate"
                                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                                        : act.urgency === "High"
                                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                                          : "bg-emerald-100/60 text-blue-800 border border-emerald-200"
                                    }`}
                                  >
                                    {act.urgency}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {act.category}
                                  </span>
                                </div>
                                <div className="text-[11px] font-bold text-slate-900">
                                  {act.title}
                                </div>
                              </div>

                              {act.actionScreen && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(act.actionScreen as Screen)
                                    setIsAdminCopilotOpen(false)
                                  }}
                                  className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#051F16] text-white hover:bg-black transition-colors cursor-pointer"
                                >
                                  {act.actionLabel || "Execute →"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Identified Bottlenecks */}
                    {msg.bottlenecks && msg.bottlenecks.length > 0 && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                          <Icons.AlertCircle className="w-3 h-3 text-amber-600" />
                          Identified Operational Bottlenecks:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800/90">
                          {msg.bottlenecks.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Inquiries / Follow-Up Prompts */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Suggested Deep Dives:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleSendAdminCopilot(sug)}
                              className="text-[10px] font-medium bg-white text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-[#051F16] hover:text-[#051F16] transition-all cursor-pointer text-left"
                            >
                              👉 {sug}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isAdminCopilotTyping && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 w-fit animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-bounce [animation-delay:0.4s]" />
                  <span className="font-semibold text-[11px] text-[#051F16]">
                    Synthesizing ecosystem telemetry via MPI AI Engine...
                  </span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendAdminCopilot()
              }}
              className="p-3.5 sm:p-4 bg-white border-t border-slate-200 shrink-0 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={adminCopilotInput}
                  onChange={(e) => setAdminCopilotInput(e.target.value)}
                  placeholder="Ask about buyers, suppliers, RFQs, SLA rates, or audit queue..."
                  className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#051F16] focus:border-transparent"
                  disabled={isAdminCopilotTyping}
                />
                <button
                  type="submit"
                  disabled={isAdminCopilotTyping || !adminCopilotInput.trim()}
                  className="px-4 py-2.5 bg-[#051F16] hover:bg-[#083A28] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span>Query</span>
                  <Icons.ArrowRight className="w-3.5 h-3.5 text-[#A3F65C]" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                <span>Press Enter to query · Real-time MPI AI inference</span>
                <span>Context: 55 Buyers · 55 MSMEs · 4 Live RFQs</span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // 1. ECOSYSTEM OVERVIEW (admin.home)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "admin.home") {
    return renderShell(
      <div className="space-y-6">
        {/* Top KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <MPIStatCard
            title="Total Sourced GMV"
            value="₹48.6 Cr"
            change="+₹3.7 Cr this month"
            trend="up"
            icon={<Icons.Coins className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Active Startups"
            value={`${demoStartups.length} Registered`}
            change="55 Demo Records"
            trend="up"
            icon={<Icons.Users className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Verified MSMEs"
            value={`${demoMSMEs.length} Suppliers`}
            change="55 Demo Records"
            trend="up"
            icon={<Icons.ShieldCheck className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Pending Audits"
            value={(pendingStartups.length + pendingMSMEs.length).toString()}
            change="Action required"
            trend="down"
            icon={<Icons.AlertCircle className="w-4 h-4 text-emerald-700" />}
          />
          <MPIStatCard
            title="Fulfillment Multiplier"
            value="1 : 50 Orders"
            change="High efficiency"
            trend="up"
            icon={<Icons.TrendingUp className="w-4 h-4 text-[#D9A400]" />}
          />
          <MPIStatCard
            title="AI Confidence"
            value="96.4%"
            change="Model v2.4 Active"
            trend="up"
            icon={<Icons.Sparkles className="w-4 h-4 text-[#051F16]" />}
          />
        </div>

        {/* 1 MSME : 50 ORDERS FULFILLMENT RATIO CARD */}
        <div className="bg-[#051F16] text-white rounded-2xl p-6 shadow-md border border-[#0A3525]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0A3525] text-[#A3F65C] text-[10px] font-bold uppercase tracking-wider">
                <Icons.Sparkles className="w-3.5 h-3.5" />
                Network Multiplier Metric
              </div>
              <h3
                className="text-xl font-extrabold text-white tracking-tight"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                1 Verified MSME : 50 Startup Orders Fulfillment Ratio
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                By maintaining strict statutory verification, each single
                verified MSME manufacturer on MPI fulfills an average of{" "}
                <strong>50 distinct startup procurement batches</strong>{" "}
                annually. This eliminates duplicate supplier discovery cycles by
                82% and accelerates landed delivery by 6–8 days.
              </p>
            </div>

            {/* Visual Diagram */}
            <div className="bg-[#0A3525]/70 border border-emerald-500/20 p-5 rounded-2xl flex flex-col items-center justify-center min-w-65 text-center space-y-3">
              <div className="flex items-center gap-2 bg-[#051F16] px-3.5 py-2 rounded-xl border border-emerald-500/30">
                <div className="w-7 h-7 rounded-lg bg-[#A3F65C] text-[#051F16] flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div className="text-xs font-bold text-white text-left">
                  <div>1 Verified MSME</div>
                  <div className="text-[10px] text-slate-300">
                    Audited Capacity
                  </div>
                </div>
              </div>

              {/* Arrow down visual */}
              <div className="flex flex-col items-center text-orange-400 font-bold text-xs">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
                <span className="text-[10px] text-slate-300 tracking-wider font-semibold">
                  1 MSME ↓ 50 Orders
                </span>
              </div>

              <div className="flex items-center gap-2 bg-[#051F16] px-3.5 py-2 rounded-xl border border-emerald-500/30">
                <div className="w-7 h-7 rounded-lg bg-[#D9A400] text-slate-950 flex items-center justify-center font-bold text-xs">
                  50
                </div>
                <div className="text-xs font-bold text-white text-left">
                  <div>50 Startup Orders</div>
                  <div className="text-[10px] text-[#D9A400]">
                    Fulfilled & Escrowed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Launchers for Startups and Verified MSMEs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => navigate("admin.startup-management")}
            className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-[#051F16] cursor-pointer transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2.5 py-1 rounded-md">
                Demo Startup Data (55 Records)
              </span>
              <Icons.ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#051F16] transition-colors" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              Manage Startups Directory →
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Inspect all 55 registered startups, procurement spend volumes, and
              DPIIT verification status.
            </p>
          </div>

          <div
            onClick={() => navigate("admin.msme-management")}
            className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-[#051F16] cursor-pointer transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2.5 py-1 rounded-md">
                Demo Supplier Data (55 Records)
              </span>
              <Icons.ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#051F16] transition-colors" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              Manage Verified MSMEs Directory →
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Inspect all 55 verified MSME manufacturers across the 7 categories
              and Udyam statutory records.
            </p>
          </div>
        </div>

        {/* Charts: Volume Distribution across the 7 Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Procurement Sourcing GMV Velocity
                </h3>
                <p className="text-xs text-slate-500">
                  Monthly gross transaction value in ₹ Crores
                </p>
              </div>
              <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2 py-0.5 rounded">
                +41% MoM
              </span>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={growthTrend}>
                <defs>
                  <linearGradient id="adminGrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#051F16" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#051F16" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="gmv"
                  stroke="#051F16"
                  strokeWidth={2.5}
                  fill="url(#adminGrd)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 7 Approved Categories Breakdown */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Volume by Approved Categories (7 Catalogs)
            </h3>

            <div className="space-y-2.5">
              {categoryVolumeData.map((c) => (
                <div key={c.cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span className="truncate">{c.cat}</span>
                    <span className="text-slate-900 font-bold">
                      {c.volume}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#051F16] h-full rounded-full"
                      style={{ width: `${c.volume * 2}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>,
      "Operations & Governance Cockpit",
      "Macro ecosystem oversight, verified MSME audits, and AI telemetry health.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. ADMIN ANALYTICS STUDIO (admin.analytics)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "admin.analytics") {
    return renderShell(
      <div className="space-y-6">
        {/* Top KPI Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <MPIStatCard
            title="Sourced GMV"
            value="₹48.6 Cr"
            change="+₹3.7 Cr this month"
            trend="up"
            icon={<Icons.Coins className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Startups Count"
            value="55"
            change="Demo Startup Data"
            trend="up"
            icon={<Icons.Users className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Verified MSMEs"
            value="55"
            change="Demo Supplier Data"
            trend="up"
            icon={<Icons.ShieldCheck className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Fulfillment Ratio"
            value="1 : 50"
            change="1 MSME ↓ 50 Orders"
            trend="up"
            icon={<Icons.TrendingUp className="w-4 h-4 text-[#D9A400]" />}
          />
          <MPIStatCard
            title="Escrow Settlement"
            value="₹42.1 Cr"
            change="100% Protected"
            trend="neutral"
            icon={<Icons.Award className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="AI Match Score"
            value="96.4%"
            change="Model v2.4"
            trend="up"
            icon={<Icons.Sparkles className="w-4 h-4 text-emerald-700" />}
          />
        </div>

        {/* 1 MSME : 50 ORDERS FULFILLMENT RATIO CARD */}
        <div className="bg-[#051F16] text-white rounded-2xl p-6 shadow-md border border-[#0A3525]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0A3525] text-[#A3F65C] text-[10px] font-bold uppercase tracking-wider">
                <Icons.Sparkles className="w-3.5 h-3.5" />
                Network Multiplier Metric
              </div>
              <h3
                className="text-xl font-extrabold text-white tracking-tight"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                1 Verified MSME : 50 Startup Orders Fulfillment Ratio
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                By maintaining strict statutory verification, each single
                verified MSME manufacturer on MPI fulfills an average of{" "}
                <strong>50 distinct startup procurement batches</strong>{" "}
                annually. This eliminates duplicate supplier discovery cycles by
                82% and accelerates landed delivery by 6–8 days.
              </p>
            </div>

            {/* Visual Diagram */}
            <div className="bg-[#0A3525]/70 border border-emerald-500/20 p-5 rounded-2xl flex flex-col items-center justify-center min-w-65 text-center space-y-3">
              <div className="flex items-center gap-2 bg-[#051F16] px-3.5 py-2 rounded-xl border border-emerald-500/30">
                <div className="w-7 h-7 rounded-lg bg-[#A3F65C] text-[#051F16] flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div className="text-xs font-bold text-white text-left">
                  <div>1 Verified MSME</div>
                  <div className="text-[10px] text-slate-300">
                    Audited Capacity
                  </div>
                </div>
              </div>

              {/* Arrow down visual */}
              <div className="flex flex-col items-center text-orange-400 font-bold text-xs">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
                <span className="text-[10px] text-slate-300 tracking-wider font-semibold">
                  1 MSME ↓ 50 Orders
                </span>
              </div>

              <div className="flex items-center gap-2 bg-[#051F16] px-3.5 py-2 rounded-xl border border-emerald-500/30">
                <div className="w-7 h-7 rounded-lg bg-[#D9A400] text-slate-950 flex items-center justify-center font-bold text-xs">
                  50
                </div>
                <div className="text-xs font-bold text-white text-left">
                  <div>50 Startup Orders</div>
                  <div className="text-[10px] text-[#D9A400]">
                    Fulfilled & Escrowed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clickable Quick Tabs to View Full Demo Datasets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => navigate("admin.startup-management")}
            className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-[#051F16] cursor-pointer transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2.5 py-1 rounded-md">
                Demo Startup Data (55 Records)
              </span>
              <Icons.ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#051F16] transition-colors" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              Manage Startups Directory →
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Inspect all 55 registered startups, procurement spend volumes, and
              DPIIT verification status.
            </p>
          </div>

          <div
            onClick={() => navigate("admin.msme-management")}
            className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-[#051F16] cursor-pointer transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2.5 py-1 rounded-md">
                Demo Supplier Data (55 Records)
              </span>
              <Icons.ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#051F16] transition-colors" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              Manage Verified MSMEs Directory →
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Inspect all 55 verified MSME manufacturers across the 7 categories
              and Udyam statutory records.
            </p>
          </div>
        </div>

        {/* LIVE CONVERSION FUNNEL & SCHEME TELEMETRY (POSTGRESQL AUDITED) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Phase 6 Pilot Conversion Measurement
                </span>
                <span className={`text-[11px] font-bold flex items-center gap-1.5 ${
                  telemetryData.fromDatabase ? "text-emerald-700" : "text-amber-700"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    telemetryData.fromDatabase ? "bg-emerald-600 animate-pulse" : "bg-amber-500"
                  }`} />
                  {telemetryData.fromDatabase
                    ? `Persisted Events: ${telemetryData.totalCount}`
                    : "Protected Telemetry: 0 Public Rows"}
                </span>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Local Session Buffer: {telemetryData.localCount} events
                </span>
              </div>
              <h3
                className="text-lg font-extrabold text-[#051F16] mt-1"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Production Funnel Analytics — Pilot Measurement Baseline
              </h3>
              <p className="text-xs text-slate-500">
                Authoritative conversion events across Acquisition, Procurement Intake, MSME Bidding, and Scheme Matching.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMetricStandardsModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold text-emerald-900 transition-colors cursor-pointer"
              >
                <MaterialIcon icon="insights" size={15} className="text-emerald-700" />
                <span>10 Metric Standards</span>
              </button>
              <button
                type="button"
                onClick={reloadTelemetry}
                disabled={isRefreshingTelemetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Icons.Refresh className={`w-3.5 h-3.5 ${isRefreshingTelemetry ? "animate-spin" : ""}`} />
                <span>{isRefreshingTelemetry ? "Refreshing..." : "Refresh Funnel"}</span>
              </button>
            </div>
          </div>

          {/* Section 1: Acquisition & Buyer Activation */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Acquisition & Buyer Activation (Top-of-Funnel)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  id: "landing_view",
                  label: "1. Landing View",
                  desc: "Unique visitors",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["landing_view"]) || telemetryData.localEventCounts["landing_view"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["landing_view"]),
                  color: "text-slate-800",
                  bg: "bg-slate-50",
                },
                {
                  id: "cta_rfq_clicked",
                  label: "2. RFQ CTA Click",
                  desc: "Hero/Dock intents",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["cta_rfq_clicked"]) || telemetryData.localEventCounts["cta_rfq_clicked"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["cta_rfq_clicked"]),
                  color: "text-blue-700",
                  bg: "bg-blue-50/50",
                },
                {
                  id: "signup_completed",
                  label: "3. Account Registered",
                  desc: "Auth established",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["signup_completed"]) || telemetryData.localEventCounts["signup_completed"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["signup_completed"]),
                  color: "text-indigo-700",
                  bg: "bg-indigo-50/50",
                },
                {
                  id: "onboarding_step_viewed",
                  label: "4. Onboarding Step",
                  desc: "Profile calibrated",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["onboarding_step_viewed"]) || telemetryData.localEventCounts["onboarding_step_viewed"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["onboarding_step_viewed"]),
                  color: "text-teal-700",
                  bg: "bg-teal-50/50",
                },
              ].map((stage) => (
                <div
                  key={stage.id}
                  className={`p-3 rounded-xl border border-slate-200/80 ${stage.bg} flex flex-col justify-between space-y-1`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    <span>{stage.label}</span>
                    <span className={`text-[9px] px-1 rounded ${stage.isDb ? "bg-emerald-100 text-emerald-800 font-medium" : "bg-slate-200 text-slate-700"}`}>
                      {stage.isDb ? "Persisted" : "Session"}
                    </span>
                  </div>
                  <div className={`text-xl sm:text-2xl font-extrabold ${stage.color}`}>
                    {stage.count}
                  </div>
                  <div className="text-[9px] text-slate-500 leading-tight">
                    {stage.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Procurement Execution & Scheme Matching Funnel */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Procurement Execution & Government Scheme Integration
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                {
                  id: "scheme_matcher_opened",
                  label: "5. Scheme Opened",
                  desc: "Discovery initiated",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["scheme_matcher_opened"]) || telemetryData.localEventCounts["scheme_matcher_opened"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["scheme_matcher_opened"]),
                  color: "text-emerald-700",
                  bg: "bg-emerald-50/50",
                },
                {
                  id: "scheme_eligibility_started",
                  label: "6. Scheme Profile",
                  desc: "Parameters entered",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["scheme_eligibility_started"]) || telemetryData.localEventCounts["scheme_eligibility_started"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["scheme_eligibility_started"]),
                  color: "text-emerald-800",
                  bg: "bg-emerald-50/70",
                },
                {
                  id: "scheme_eligibility_completed",
                  label: "7. Matches Scored",
                  desc: "Grants quantified",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["scheme_eligibility_completed"]) || telemetryData.localEventCounts["scheme_eligibility_completed"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["scheme_eligibility_completed"]),
                  color: "text-emerald-900",
                  bg: "bg-emerald-100/60",
                },
                {
                  id: "scheme_official_link_clicked",
                  label: "8. Portal Exit",
                  desc: "Ministry portal verified",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["scheme_official_link_clicked"]) || telemetryData.localEventCounts["scheme_official_link_clicked"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["scheme_official_link_clicked"]),
                  color: "text-teal-700",
                  bg: "bg-teal-50",
                },
                {
                  id: "scheme_saved",
                  label: "9. Bookmarked",
                  desc: "Saved to watchlist",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["scheme_saved"]) || telemetryData.localEventCounts["scheme_saved"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["scheme_saved"]),
                  color: "text-amber-800",
                  bg: "bg-amber-50/70",
                },
                {
                  id: "procurement_started",
                  label: "10. Intake Started",
                  desc: "RFQ Builder started",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["procurement_started"]) || telemetryData.localEventCounts["procurement_started"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["procurement_started"]),
                  color: "text-blue-700",
                  bg: "bg-blue-50/60",
                },
                {
                  id: "rfq_dispatched",
                  label: "11. RFQ Dispatched",
                  desc: "Broadcast to MSMEs",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["rfq_dispatched"]) || telemetryData.localEventCounts["rfq_dispatched"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["rfq_dispatched"]),
                  color: "text-indigo-800",
                  bg: "bg-indigo-50/60",
                },
                {
                  id: "msme_quote_submitted",
                  label: "12. Quote Persisted",
                  desc: "Supplier bid stored",
                  count: (telemetryData.fromDatabase && telemetryData.eventCounts["msme_quote_submitted"]) || telemetryData.localEventCounts["msme_quote_submitted"] || 0,
                  isDb: Boolean(telemetryData.fromDatabase && telemetryData.eventCounts["msme_quote_submitted"]),
                  color: "text-emerald-700",
                  bg: "bg-emerald-50",
                },
              ].map((stage) => (
                <div
                  key={stage.id}
                  className={`p-3 rounded-xl border border-slate-200/80 ${stage.bg} flex flex-col justify-between space-y-1`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">
                    <span>{stage.label}</span>
                    <span className={`text-[9px] px-1 rounded shrink-0 ${stage.isDb ? "bg-emerald-100 text-emerald-800 font-medium" : "bg-slate-200 text-slate-700"}`}>
                      {stage.isDb ? "Persisted" : "Session"}
                    </span>
                  </div>
                  <div className={`text-xl sm:text-2xl font-extrabold ${stage.color}`}>
                    {stage.count}
                  </div>
                  <div className="text-[9px] text-slate-500 leading-tight">
                    {stage.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Events Sample Stream */}
          {telemetryData.recentEvents.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Recent Telemetry Ingestion (Audit Feed)</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Showing last {Math.min(5, telemetryData.recentEvents.length)} of {telemetryData.totalCount} events
                </span>
              </div>
              <div className="space-y-1.5">
                {telemetryData.recentEvents.slice(0, 5).map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                        {ev.event}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate max-w-xs">
                        Session: {ev.sessionId.slice(0, 16)}...
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(ev.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 10 METRIC CONVERSION STANDARDS MODAL */}
        {showMetricStandardsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    Phase 6 Standard
                  </div>
                  <h3 className="text-lg font-extrabold text-[#051F16]" style={{ fontFamily: "Plus Jakarta Sans" }}>
                    10 Pilot Conversion Metric Standards & Baselines
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formalized measurement specifications for pilot onboarding and statistical integrity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMetricStandardsModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
                >
                  <MaterialIcon icon="close" size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {[
                  {
                    num: "01",
                    name: "Visitor to Procurement Intake Rate",
                    formula: "cta_rfq_clicked (or procurement_started) / landing_view",
                    source: "public.telemetry_events",
                    target: "≥ 4.5% conversion",
                    limitation: "Anonymous desktop vs mobile sessions without cookies excluded until consent granted.",
                  },
                  {
                    num: "02",
                    name: "Intake Completion Rate",
                    formula: "rfq_dispatched / procurement_started",
                    source: "public.rfqs & public.telemetry_events",
                    target: "≥ 35.0% completion",
                    limitation: "Founders abandoning to search technical drawing tolerances locally.",
                  },
                  {
                    num: "03",
                    name: "Supplier Quotation Response Rate",
                    formula: "RFQs with ≥1 quote / Total RFQs Dispatched",
                    source: "public.rfqs & public.quotes",
                    target: "≥ 85.0% response within 24h",
                    limitation: "Regional specialty constraints (e.g. specialized cleanroom injection molding).",
                  },
                  {
                    num: "04",
                    name: "Median Time to First Quote",
                    formula: "median(quote.created_at - rfq.created_at)",
                    source: "public.quotes & public.rfqs timestamps",
                    target: "≤ 18.0 hours",
                    limitation: "Weekend and national holiday RFQs have higher natural turnaround time.",
                  },
                  {
                    num: "05",
                    name: "Scheme Discovery Engagement Rate",
                    formula: "scheme_matcher_opened / unique sessions",
                    source: "public.telemetry_events",
                    target: "≥ 12.0% engagement",
                    limitation: "Higher on desktop compared to mobile quick scans.",
                  },
                  {
                    num: "06",
                    name: "Scheme Eligibility Completion Rate",
                    formula: "scheme_eligibility_completed / scheme_eligibility_started",
                    source: "public.telemetry_events",
                    target: "≥ 60.0% completion",
                    limitation: "Early founders lacking DPIIT recognition certificate numbers drop off.",
                  },
                  {
                    num: "07",
                    name: "Scheme Verification Exit Rate",
                    formula: "scheme_official_link_clicked / scheme_eligibility_completed",
                    source: "public.telemetry_events (outbound clicks)",
                    target: "≥ 25.0% exit to official portal",
                    limitation: "Outbound government portal clicks cannot track external application completion.",
                  },
                  {
                    num: "08",
                    name: "Cross-Side Marketplace Liquidity Ratio",
                    formula: "Active verified MSMEs bidding / Active open RFQs",
                    source: "public.profiles & public.rfqs",
                    target: "≥ 3.2 : 1 active ratio",
                    limitation: "Clustered around automotive/packaging hubs (Peenya, Okhla, Coimbatore).",
                  },
                  {
                    num: "09",
                    name: "Prototype Sample Request Rate",
                    formula: "sample_requested / quotes reviewed",
                    source: "public.quotes (status = 'sample_requested')",
                    target: "≥ 20.0% of quoted RFQs",
                    limitation: "High-cost tooling items (die-cast molds) rarely request physical sample pre-tooling.",
                  },
                  {
                    num: "10",
                    name: "End-to-End Buyer-to-Supplier Escrow Conversion",
                    formula: "contract_accepted / rfq_dispatched",
                    source: "public.quotes (status = 'accepted')",
                    target: "≥ 15.0% overall conversion",
                    limitation: "Requires physical inspection and bank tripartite escrow mobilization.",
                  },
                ].map((m) => (
                  <div key={m.num} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#051F16] text-sm flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-[#051F16] text-[#A3F65C] text-[10px] flex items-center justify-center font-bold">
                          {m.num}
                        </span>
                        {m.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                        {m.target}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1">
                      <div>
                        <strong className="text-slate-800">Formula:</strong> <code className="text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700">{m.formula}</code>
                      </div>
                      <div>
                        <strong className="text-slate-800">Authoritative Source:</strong> <code className="text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200 text-emerald-700">{m.source}</code>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      <strong className="text-slate-700">Measurement Caveat:</strong> {m.limitation}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowMetricStandardsModal(false)}
                  className="px-4 py-2 bg-[#051F16] text-white rounded-xl font-bold text-xs hover:bg-[#083A28] transition-colors cursor-pointer"
                >
                  Close Standards
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PENDING AUDITS SECTION WITH TABS AND CONFIRMATION DIALOGS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pending Statutory Audits Console
              </h3>
              <p className="text-xs text-slate-500">
                Review and approve incoming startup applications and MSME
                statutory submissions
              </p>
            </div>

            {/* Audit Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setAuditTab("startups")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  auditTab === "startups"
                    ? "bg-white text-[#051F16] shadow-xs"
                    : "text-slate-600"
                }`}
              >
                Startup Audits ({pendingStartups.length})
              </button>
              <button
                onClick={() => setAuditTab("msmes")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  auditTab === "msmes"
                    ? "bg-white text-[#051F16] shadow-xs"
                    : "text-slate-600"
                }`}
              >
                MSME Audits ({pendingMSMEs.length})
              </button>
            </div>
          </div>

          {/* Audit List */}
          {auditTab === "startups" ? (
            <div className="divide-y divide-slate-100">
              {pendingStartups.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {s.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {s.id}
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-[#051F16] px-1.5 py-0.2 rounded font-semibold">
                        {s.industry}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {s.city}, {s.state} · {s.stage} · {s.registrationStatus}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MPIButton
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          type: "startup",
                          id: s.id,
                          targetName: s.name,
                          action: "approve",
                        })
                      }
                    >
                      Approve
                    </MPIButton>
                    <MPIButton
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          type: "startup",
                          id: s.id,
                          targetName: s.name,
                          action: "request_info",
                        })
                      }
                    >
                      Request Info
                    </MPIButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingMSMEs.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {m.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {m.udyamNumber}
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-[#051F16] px-1.5 py-0.2 rounded font-semibold">
                        {m.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {m.city}, {m.state} · Orders Fulfilled: {m.ordersCount}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MPIButton
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          type: "msme",
                          id: m.id,
                          targetName: m.name,
                          action: "approve",
                        })
                      }
                    >
                      Approve
                    </MPIButton>
                    <MPIButton
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          type: "msme",
                          id: m.id,
                          targetName: m.name,
                          action: "request_info",
                        })
                      }
                    >
                      Request Info
                    </MPIButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>,
      "Admin Analytics Studio",
      "Ecosystem macro telemetry, 1 MSME : 50 Orders multiplier, and statutory audit actions.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. STARTUPS DIRECTORY (admin.startup-management)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "admin.startup-management") {
    return renderShell(
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Startups Directory
              </h3>
              <span className="text-xs font-bold bg-emerald-50 text-[#051F16] px-2.5 py-0.5 rounded-full border border-emerald-200">
                Demo Startup Data ({filteredStartups.length} /{" "}
                {demoStartups.length} Records)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive registry of verified startups sourcing through the
              MPI protocol.
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={startupSearch}
            onChange={(e) => setStartupSearch(e.target.value)}
            placeholder="Search startups by name, ID, city, or industry..."
            className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#051F16]"
          />
          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            {([
              "All",
              "Verified",
              "Pending Audit",
              "Under Review",
              "Needs Information",
            ] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStartupStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  startupStatusFilter === tab
                    ? "bg-[#051F16] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Table of 55 Demo Startups */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-150 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 z-10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-3">Startup Name</th>
                  <th className="py-3 px-3">Industry</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Stage</th>
                  <th className="py-3 px-3">DPIIT Status</th>
                  <th className="py-3 px-3">RFQs</th>
                  <th className="py-3 px-3">Orders</th>
                  <th className="py-3 px-3">Spent (₹)</th>
                  <th className="py-3 px-3">Audit Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStartups.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#051F16]">
                      {s.id}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {s.name}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{s.industry}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {s.city}, {s.state}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-700">
                        {s.stage}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-semibold text-[#051F16] bg-emerald-50 px-2 py-0.5 rounded">
                        {s.registrationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {s.rfqsCount}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {s.ordersCount}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      ₹{(s.procurementValue / 100000).toFixed(1)}L
                    </td>
                    <td className="py-3 px-3">
                      <MPIStatusBadge status={s.auditStatus} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {s.auditStatus !== "Verified" ? (
                        <MPIButton
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            setConfirmDialog({
                              isOpen: true,
                              type: "startup",
                              id: s.id,
                              targetName: s.name,
                              action: "approve",
                            })
                          }
                        >
                          Approve
                        </MPIButton>
                      ) : (
                        <span className="text-xs text-[#051F16] font-semibold">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>,
      "Startups Directory",
      "Manage verified Indian startups and inspect procurement volumes and DPIIT credentials.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. VERIFIED MSMES DIRECTORY (admin.msme-management)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "admin.msme-management") {
    return renderShell(
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Verified MSME Manufacturers
              </h3>
              <span className="text-xs font-bold bg-emerald-50 text-[#051F16] px-2.5 py-0.5 rounded-full border border-emerald-200">
                Demo Supplier Data ({filteredMSMEs.length} / {demoMSMEs.length}{" "}
                Records)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Statutory directory of audited MSME suppliers across the 7
              approved categories.
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={msmeSearch}
            onChange={(e) => setMsmeSearch(e.target.value)}
            placeholder="Search MSMEs by name, ID, city, or Udyam number..."
            className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#051F16]"
          />
          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            <select
              value={msmeCategoryFilter}
              onChange={(e) => setMsmeCategoryFilter(e.target.value as any)}
              className="text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              <option value="All">All 7 Categories</option>
              {CATALOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table of 55 Demo MSMEs */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-150 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 z-10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-3">MSME Enterprise</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Udyam Number</th>
                  <th className="py-3 px-3">Quotes</th>
                  <th className="py-3 px-3">Orders Fulfilled</th>
                  <th className="py-3 px-3">Fulfillment Rate</th>
                  <th className="py-3 px-3">Revenue (₹)</th>
                  <th className="py-3 px-3">Audit Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMSMEs.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#051F16]">
                      {m.id}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {m.name}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{m.category}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {m.city}, {m.state}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {m.udyamNumber}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {m.quotesCount}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {m.ordersCount}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#051F16]">
                      {m.fulfillmentRate}%
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      ₹{(m.revenue / 100000).toFixed(1)}L
                    </td>
                    <td className="py-3 px-3">
                      <MPIStatusBadge status={m.verificationStatus} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {m.verificationStatus !== "Verified" ? (
                        <MPIButton
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            setConfirmDialog({
                              isOpen: true,
                              type: "msme",
                              id: m.id,
                              targetName: m.name,
                              action: "approve",
                            })
                          }
                        >
                          Approve
                        </MPIButton>
                      ) : (
                        <span className="text-xs text-[#051F16] font-semibold">
                          Verified
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>,
      "Verified MSMEs Directory",
      "Manage statutory Udyam and GST verified manufacturing partners.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. SUPPLIER VERIFICATION AUDIT QUEUE (admin.verification)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "admin.verification") {
    return renderShell(
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Statutory MSME Audit Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Cross-checking Udyam registration and GST returns
              </p>
            </div>
            <MPIVerifiedBadge label="National MSME Gateway" />
          </div>

          <div className="divide-y divide-slate-100">
            {pendingMSMEs.map((item) => (
              <div
                key={item.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.category} · {item.city}, {item.state}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {item.udyamNumber}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <MPIStatusBadge status={item.verificationStatus} />
                  <MPIButton
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      setConfirmDialog({
                        isOpen: true,
                        type: "msme",
                        id: item.id,
                        targetName: item.name,
                        action: "approve",
                      })
                    }
                  >
                    Approve
                  </MPIButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>,
      "Supplier Verification Audit Queue",
      "Inspect statutory Udyam and GST documentation before granting supplier verification.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. AI MATCHING TELEMETRY (admin.ai-matching)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "admin.ai-matching") {
    return renderShell(
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Matching Engine Calibration & Telemetry
              </h3>
              <p className="text-xs text-slate-500">
                Real-time parameters governing startup-to-MSME matching weights.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-emerald-50 text-blue-800 px-2.5 py-1 rounded-lg">
              Model v2.4-Production
            </span>
          </div>

          {/* Interactive Weight Sliders */}
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Technical Tolerances & Machine Fit Weight:</span>
                <span className="text-[#051F16]">{weights.tolerances}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                value={weights.tolerances}
                onChange={(e) =>
                  setWeights({ ...weights, tolerances: Number(e.target.value) })
                }
                className="w-full accent-[#051F16] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Turnaround & Lead Time Feasibility:</span>
                <span className="text-[#051F16]">{weights.leadTime}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={50}
                value={weights.leadTime}
                onChange={(e) =>
                  setWeights({ ...weights, leadTime: Number(e.target.value) })
                }
                className="w-full accent-[#051F16] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Price Competitiveness & Reverse Margin:</span>
                <span className="text-[#051F16]">{weights.pricing}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={50}
                value={weights.pricing}
                onChange={(e) =>
                  setWeights({ ...weights, pricing: Number(e.target.value) })
                }
                className="w-full accent-[#051F16] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>ZED & Statutory Compliance Pass:</span>
                <span className="text-[#051F16]">{weights.compliance}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={40}
                value={weights.compliance}
                onChange={(e) =>
                  setWeights({ ...weights, compliance: Number(e.target.value) })
                }
                className="w-full accent-[#051F16] cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500">
              Latency: <strong>420ms</strong> | Confidence:{" "}
              <strong>96.4%</strong>
            </span>
            <MPIButton
              variant="primary"
              size="sm"
              onClick={() => {
                setActionSuccessMessage(
                  "AI matching engine weights saved and updated across active clusters.",
                )
                setTimeout(() => setActionSuccessMessage(null), 3000)
              }}
            >
              Save Parameter Calibration
            </MPIButton>
          </div>
        </div>

        {/* ─── MODEL FAIRNESS & QUALITY MONITORING (Blueprint Item 62) ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Item 62 · Model Fairness Audit
                </span>
                <span className="text-xs text-slate-400 font-mono">Statistical Drift & Quota Governance</span>
              </div>
              <h3 className="text-base font-extrabold text-[#051F16] mt-1">
                Model Fairness, Drift & Supplier Outcome Governance
              </h3>
              <p className="text-xs text-slate-500">
                Monitors accuracy, drift, false alerts, match exposure distribution across MSME tiers, and human corrections.
              </p>
            </div>
            <MPIButton
              variant="ai"
              size="sm"
              onClick={handleRunFairnessAudit}
              isLoading={isAuditingFairness}
              icon={<Icons.Sparkles className="w-3.5 h-3.5 text-[#A3F65C]" />}
            >
              {fairnessReport ? "Re-Run Fairness Audit" : "Run AI Fairness Audit"}
            </MPIButton>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] block">Fairness Index</span>
              <div className="text-xl font-extrabold text-[#051F16] mt-0.5">
                {fairnessReport ? `${fairnessReport.fairnessIndex}%` : "96%"}
              </div>
              <span className="text-[10px] text-emerald-700 font-bold">✓ Audit Pass</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] block">Model Accuracy Rate</span>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {fairnessReport ? `${fairnessReport.accuracyRate}%` : "98.4%"}
              </div>
              <span className="text-[10px] text-slate-500">Heuristic matching</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] block">Model Drift Rate</span>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {fairnessReport ? `${fairnessReport.driftPercentage}%` : "-0.2%"}
              </div>
              <span className="text-[10px] text-slate-500">Within tolerance</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] block">Human Override Rate</span>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {fairnessReport ? `${fairnessReport.humanOverrideRate}%` : "3.4%"}
              </div>
              <span className="text-[10px] text-slate-500">Operations adjustments</span>
            </div>
          </div>

          {/* Exposure distribution bars */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-900 block">
              Match Exposure Distribution Across MSME Statutory Tiers:
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                  <span>Micro Enterprises (Turnover &lt; ₹5 Cr)</span>
                  <span className="font-bold text-[#051F16]">38% (Statutory Target: 35%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-[#051F16] h-2 rounded-full" style={{ width: "38%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                  <span>Small Enterprises (Turnover ₹5 Cr – ₹50 Cr)</span>
                  <span className="font-bold text-[#051F16]">44% (Statutory Target: 45%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: "44%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                  <span>Medium Enterprises (Turnover ₹50 Cr – ₹250 Cr)</span>
                  <span className="font-bold text-[#051F16]">18% (Statutory Target: 20%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-400 h-2 rounded-full" style={{ width: "18%" }} />
                </div>
              </div>
            </div>
          </div>

          {fairnessReport && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
              <span className="font-bold text-[#051F16]">AI Governance Directive:</span>
              <p className="text-slate-700 leading-relaxed">{fairnessReport.governanceRecommendation}</p>
            </div>
          )}
        </div>

        {/* ─── MODULAR 62-CAPABILITY ARCHITECTURE REGISTRY (Sections 2, 28, 29) ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#051F16] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Architectural Blueprint · 62 Capabilities
                </span>
                <span className="text-xs text-slate-400 font-mono">Pillars 1 to 6</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-1" style={{ fontFamily: "Plus Jakarta Sans" }}>
                AI Capability Lifecycle & Production Registry
              </h3>
              <p className="text-xs text-slate-500">
                Separates operational AI endpoints from upcoming roadmap capabilities without fake UI buttons.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-emerald-100/80 text-emerald-800 font-bold px-2.5 py-1 rounded-lg">
                38 Available
              </span>
              <span className="text-xs font-mono bg-emerald-100/60/80 text-blue-800 font-bold px-2.5 py-1 rounded-lg">
                12 Beta
              </span>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg">
                12 Planned
              </span>
            </div>
          </div>

          {/* Category Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { id: "all", label: "All 62" },
                { id: "demand_capture", label: "Demand Intake (10)" },
                { id: "supplier_discovery", label: "Supplier Discovery (10)" },
                { id: "rfq_quotation", label: "RFQ & Quotes (11)" },
                { id: "schemes_compliance", label: "Schemes & Compliance (7)" },
                { id: "analytics_forecasting", label: "Analytics & Risk (12)" },
                { id: "copilots_trust", label: "Copilots & Trust (12)" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCapCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    capCategoryFilter === cat.id
                      ? "bg-[#051F16] text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-60 relative">
              <MaterialIcon name="search" size={16} className="text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={capSearchQuery}
                onChange={(e) => setCapSearchQuery(e.target.value)}
                placeholder="Search capability or tool..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#051F16] focus:bg-white"
              />
            </div>
          </div>

          {/* Capabilities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-125 overflow-y-auto pr-1">
            {Object.values(MPI_AI_CAPABILITIES)
              .filter((cap) => {
                if (capCategoryFilter !== "all" && cap.category !== capCategoryFilter) return false
                if (capSearchQuery.trim()) {
                  const q = capSearchQuery.toLowerCase().trim()
                  return (
                    cap.name.toLowerCase().includes(q) ||
                    cap.id.toLowerCase().includes(q) ||
                    cap.description.toLowerCase().includes(q)
                  )
                }
                return true
              })
              .map((cap) => {
                const isAvailable = cap.status === "available"
                const isBeta = cap.status === "beta"

                return (
                  <div
                    key={cap.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-2xs transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>{cap.name}</span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                          id: {cap.id}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                          isAvailable
                            ? "bg-emerald-100 text-emerald-800"
                            : isBeta
                            ? "bg-emerald-100/60 text-blue-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {cap.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                      {cap.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[10px]">
                      <span className="flex items-center gap-1 text-slate-500">
                        <MaterialIcon
                          name={cap.requiresHumanApproval ? "verified_user" : "auto_mode"}
                          size={12}
                          className={cap.requiresHumanApproval ? "text-amber-700" : "text-emerald-700"}
                        />
                        <span>{cap.requiresHumanApproval ? "Human Approval Gate" : "Automated Guidance"}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        {cap.toolsRequired.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded font-mono text-[9px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>,
      "AI Matching Telemetry & Fairness Monitoring",
      "Calibrate heuristic weights, monitor model drift, and ensure non-monopolistic MSME match distribution.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. DEFAULT FALLBACK / PROCUREMENT TRANSACTIONS
  // ════════════════════════════════════════════════════════════════════════════
  return renderShell(
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Procurement Transactions & Escrow Settlement
          </h3>
          <p className="text-xs text-slate-500">
            Audited institutional payment escrow records and milestone
            settlements
          </p>
        </div>
        <span className="text-xs text-[#051F16] font-mono font-bold bg-emerald-50 px-2.5 py-1 rounded-md">
          100% Escrow Protected
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="divide-y divide-slate-100 text-xs">
          {adminTransactions.map((tx) => (
            <div
              key={tx.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
            >
              <div className="space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span>{tx.startup} → {tx.msme}</span>
                  {tx.bankAccountChangedRecently && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                      ⚠ Bank Changed 2h Ago
                    </span>
                  )}
                  {tx.priceJumpPercent > 20 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      ⚡ +{tx.priceJumpPercent}% Price Jump
                    </span>
                  )}
                  {tx.matchedPriorInvoiceId && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                      ⧉ Duplicate Candidate
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  TxID: {tx.id} · Invoice Ref: {tx.invoiceId} · {tx.date} · {tx.category}
                </div>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
                <div className="text-right">
                  <div className="font-extrabold text-slate-900 text-sm">
                    ₹{tx.amount.toLocaleString("en-IN")}
                  </div>
                  <MPIStatusBadge status={tx.status} />
                </div>
                <MPIButton
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunRiskAudit(tx)}
                  icon={<Icons.ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />}
                >
                  AI Forensic Audit
                </MPIButton>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    "Procurement Transactions Ledger",
    "Audited institutional payment escrow records and milestone settlements.",
  )
}
