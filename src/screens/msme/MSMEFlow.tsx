import { useState, useMemo } from "react"
import { NavProps, Screen } from "../../App"
import { useProcurement, SupplierQuote } from "../../context/ProcurementContext"
import { CatalogCategory } from "../../lib/mpiCatalog"
import {
  Icons,
  MPIButton,
  MPIStatCard,
  MPIVerifiedBadge,
} from "../../components/design-system/MPIDesignSystem"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  draftMSMEQuoteResponseWithAI,
  MSMEResponseDraft,
  calculateMSMEInventoryReorderWithAI,
  MSMEInventoryReorderResult,
} from "../../services/aiService"
import MaterialIcon from "../../components/ui/MaterialIcon"
import { getActiveUser } from "../../lib/mockAuth"
import { trackTelemetryEvent } from "../../services/telemetryService"

export default function MSMEFlow({
  navigate,
  goBack,
  currentScreen,
}: NavProps) {
  const {
    submitMSMEQuote,
    msmeProfile,
    msmeRFQs,
    backendSyncState,
    refreshBackendSync,
    quotePersistenceStatus,
    quotePersistenceError,
  } = useProcurement()
  const activeUser = getActiveUser()

  const supplierEnterpriseName =
    msmeProfile.enterpriseName ||
    activeUser?.orgName ||
    "Apex Precision Packaging Ltd."

  const supplierId =
    msmeProfile.udyamNumber ||
    (activeUser?.email ? `MSME-${activeUser.email.split("@")[0].toUpperCase()}` : "SUP-001")

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Active RFQ Opportunities for MSME (Connected to msmeRFQs with buyer privacy guaranteed)
  const [opportunities, setOpportunities] = useState<Array<{
    id: string
    title: string
    buyer: string
    cat: CatalogCategory
    matchScore: number
    qty: string
    budget: string
    leadTime: string
    posted: string
    status: string
    specs: string
    buyerRequirements?: {
      material: string
      tolerance: string
      testingCertificates: string[]
      packagingRequirement: string
    }
  }>>(() => {
    if (msmeRFQs && msmeRFQs.length > 0) {
      return msmeRFQs.map((rfq, idx) => ({
        id: rfq.id,
        title: rfq.title,
        buyer: `${rfq.buyerDisplayName} (${idx === 0 ? "Bengaluru, KA" : idx === 1 ? "Pune, MH" : "Mumbai, MH"})`,
        cat: (rfq.category as CatalogCategory) || "Packaging & Printing",
        matchScore: rfq.matchScore || (97 - idx * 4),
        qty: `${rfq.quantity.toLocaleString("en-IN")} units`,
        budget: `₹${rfq.targetBudget.toLocaleString("en-IN")}`,
        leadTime: idx === 0 ? "12 days" : idx === 1 ? "10 days" : "5 days",
        posted: rfq.postedTime || "Recently posted",
        status: (rfq.status as any) || "Open for Bidding",
        specs: rfq.specs || "Standard industrial engineering tolerances",
        buyerRequirements: {
          material: idx === 0 ? "1200 GSM Kappa Board with Matte Lamination" : "5-ply Corrugated Craft Board (14 kg/cm² burst test)",
          tolerance: "±0.5mm dimensional precision",
          testingCertificates: ["ZED Gold Quality Audit", "NABL Lab Drop Test Report"],
          packagingRequirement: "Shrink-wrapped master carton batch packing with humidity barrier",
        },
      }))
    }
    return [
      {
        id: "OPP-8910",
        title: "500x Custom Rigid Skincare Packaging Boxes",
        buyer: "MPI Verified Buyer #042 (Bengaluru, KA)",
        cat: "Packaging & Printing" as CatalogCategory,
        matchScore: 97,
        qty: "500 units",
        budget: "₹75,000",
        leadTime: "12 days",
        posted: "2 hours ago",
        status: "Open for Bidding",
        specs:
          "1200 GSM kappa board, matte lamination, spot UV logo, EVA foam inserts",
        buyerRequirements: {
          material: "1200 GSM kappa board with matte lamination",
          tolerance: "±0.5mm dimensional precision",
          testingCertificates: ["ZED Gold Quality Audit", "NABL Lab Drop Test Report"],
          packagingRequirement: "Shrink-wrapped master carton batch packing with humidity barrier",
        },
      },
      {
        id: "OPP-8914",
        title: "2,000x Corrugated Outer Shipping Cartons",
        buyer: "MPI Verified Buyer #089 (Pune, MH)",
        cat: "Packaging & Printing" as CatalogCategory,
        matchScore: 93,
        qty: "2,000 boxes",
        budget: "₹55,000",
        leadTime: "10 days",
        posted: "1 day ago",
        status: "Open for Bidding",
        specs:
          "5-ply corrugated board, flexo print 2-color, burst test 14 kg/cm²",
        buyerRequirements: {
          material: "5-ply corrugated craft board",
          tolerance: "Burst test 14 kg/cm²",
          testingCertificates: ["Edge Crush Test (ECT)", "Bursting Strength Report"],
          packagingRequirement: "Bundled in lots of 25 with strapping",
        },
      },
      {
        id: "OPP-8922",
        title: "100x Rapid Prototype Samples with Hot Foil Stamping",
        buyer: "MPI Verified Buyer #104 (Mumbai, MH)",
        cat: "Packaging & Printing" as CatalogCategory,
        matchScore: 89,
        qty: "100 units",
        budget: "₹22,000",
        leadTime: "5 days",
        posted: "2 days ago",
        status: "Quoted",
        specs: "Sample run with micro-embossing and gold foil",
        buyerRequirements: {
          material: "350 GSM Art Board with metallic foil",
          tolerance: "Visual inspection standard AQL 1.0",
          testingCertificates: ["Sample approval sheet"],
          packagingRequirement: "Individual bubble sleeve wrap",
        },
      },
    ]
  })

  // Selected opportunity for quote building
  const [selectedOppId, setSelectedOppId] = useState<string>(() => {
    return msmeRFQs && msmeRFQs.length > 0 ? msmeRFQs[0].id : "OPP-8910"
  })

  // Quotation Builder Form State
  const [quoteForm, setQuoteForm] = useState({
    baseTooling: 6000,
    unitPrice: 110,
    qty: 500,
    qaTesting: 2500,
    logistics: 3500,
    gstRate: 0.18,
    leadDays: 12,
    applyZedSubsidy: true,
    paymentTerms:
      "30% Advance Escrow, 70% against delivery dispatch inspection.",
  })

  // MSME-Controlled Repeat Customer Discounting State
  const [selectedDiscountMode, setSelectedDiscountMode] =
    useState<"none" | "1" | "2" | "3" | "5" | "custom">("2")
  const [repeatDiscountPercent, setRepeatDiscountPercent] = useState<number>(2)
  const [customDiscountPercent, setCustomDiscountPercent] =
    useState<string>("2.5")

  const [quoteSubmittedModal, setQuoteSubmittedModal] = useState(false)
  const [isTransmittingQuote, setIsTransmittingQuote] = useState(false)

  // Machinery & Capacity Ledger State
  const [machineryList, setMachineryList] = useState([
    {
      id: "MCH-01",
      name: "Heidelberg 6-Color Offset Press (CD 102)",
      category: "Packaging & Printing",
      capacity: "85,000 sheets/mo",
      utilization: 68,
      status: "Available",
    },
    {
      id: "MCH-02",
      name: "Kolbus Automatic Rigid Box Former",
      category: "Packaging & Printing",
      capacity: "40,000 boxes/mo",
      utilization: 52,
      status: "Available",
    },
    {
      id: "MCH-03",
      name: "Bobst BMA High-Precision Foil Stamper",
      category: "Packaging & Printing",
      capacity: "60,000 impressions/mo",
      utilization: 84,
      status: "Busy",
    },
    {
      id: "MCH-04",
      name: "Zund G3 Digital Sample Plotter & Cutter",
      category: "Specialized Startup Support",
      capacity: "300 mockups/mo",
      utilization: 35,
      status: "Available",
    },
  ])

  // AI RFQ Response Copilot State (Blueprint Item 24)
  const [isDraftingAIResponse, setIsDraftingAIResponse] = useState(false)
  const [aiDraftResult, setAiDraftResult] = useState<MSMEResponseDraft | null>(null)

  // AI MSME Smart Inventory, Reorder & Lead-Time Assistant State (Blueprint Items 51, 52, 53)
  const [capabilitiesTab, setCapabilitiesTab] = useState<"machinery" | "inventory">("machinery")
  const [inventoryLedger] = useState([
    {
      id: "INV-01",
      materialName: "Virgin Kraft Paper Board (350 GSM)",
      stockUnits: 1200,
      unit: "kg",
      dailyConsumption: 140,
      supplierTurnaroundDays: 10,
      safetyBufferDays: 4,
      reorderPointUnits: 1960,
      status: "Reorder Recommended",
    },
    {
      id: "INV-02",
      materialName: "High-Density EVA Foam Liner (2mm)",
      stockUnits: 850,
      unit: "sqm",
      dailyConsumption: 45,
      supplierTurnaroundDays: 7,
      safetyBufferDays: 5,
      reorderPointUnits: 540,
      status: "Healthy",
    },
    {
      id: "INV-03",
      materialName: "Biodegradable Soy Printing Inks (CMYK)",
      stockUnits: 32,
      unit: "sets",
      dailyConsumption: 4,
      supplierTurnaroundDays: 5,
      safetyBufferDays: 3,
      reorderPointUnits: 32,
      status: "Reorder Recommended",
    },
    {
      id: "INV-04",
      materialName: "Die-Plate Tooling Steel Blocks (P20)",
      stockUnits: 14,
      unit: "blocks",
      dailyConsumption: 1,
      supplierTurnaroundDays: 14,
      safetyBufferDays: 7,
      reorderPointUnits: 21,
      status: "Critical Stockout Risk",
    },
  ])
  const [selectedInventoryMaterial, setSelectedInventoryMaterial] = useState("Virgin Kraft Paper Board (350 GSM)")
  const [isCalculatingReorder, setIsCalculatingReorder] = useState(false)
  const [reorderResult, setReorderResult] = useState<MSMEInventoryReorderResult | null>(null)

  const handleCalculateReorder = async (matName?: string) => {
    const item = inventoryLedger.find((m) => m.materialName === (matName || selectedInventoryMaterial)) || inventoryLedger[0]
    setIsCalculatingReorder(true)
    try {
      const res = await calculateMSMEInventoryReorderWithAI({
        materialName: item.materialName,
        currentStockUnits: item.stockUnits,
        dailyConsumptionRate: item.dailyConsumption,
        supplierTurnaroundDays: item.supplierTurnaroundDays,
      })
      setReorderResult(res)
    } finally {
      setIsCalculatingReorder(false)
    }
  }

  const selectedOpp =
    opportunities.find((o) => o.id === selectedOppId) || opportunities[0]

  const handleAIDraftResponse = async () => {
    setIsDraftingAIResponse(true)
    try {
      const res = await draftMSMEQuoteResponseWithAI(
        {
          title: selectedOpp.title,
          category: selectedOpp.cat,
          quantity: selectedOpp.qty,
          budget: selectedOpp.budget,
          specs: selectedOpp.specs,
        },
        {
          businessName: supplierEnterpriseName,
          machinery: machineryList.map((m) => m.name),
          certifications: [
            "ISO 9001:2015",
            "ZED Gold Certified",
            "Udyam Statutory MSME Registration",
          ],
          city: msmeProfile.city || "Bengaluru",
        },
      )
      setAiDraftResult(res)
    } catch (err) {
      console.warn("AI MSME quote draft error:", err)
    } finally {
      setIsDraftingAIResponse(false)
    }
  }

  // Dynamic calculated totals with repeat customer concession
  const manufacturingSubtotal = quoteForm.unitPrice * quoteForm.qty
  const rawSubtotalBeforeDiscount =
    quoteForm.baseTooling +
    manufacturingSubtotal +
    quoteForm.qaTesting +
    quoteForm.logistics
  const repeatDiscountAmount = Math.round(
    manufacturingSubtotal * (repeatDiscountPercent / 100),
  )
  const subtotalAfterRepeatDiscount =
    rawSubtotalBeforeDiscount - repeatDiscountAmount
  const gstAmount = Math.round(subtotalAfterRepeatDiscount * quoteForm.gstRate)
  const totalWithGst = subtotalAfterRepeatDiscount + gstAmount
  const subsidyDiscount = quoteForm.applyZedSubsidy
    ? Math.round(totalWithGst * 0.1)
    : 0
  const netLandedCostToBuyer = totalWithGst - subsidyDiscount

  const handleTransmitQuotation = () => {
    if (isTransmittingQuote) return
    if (selectedOpp.status === "Quote Transmitted") {
      setQuoteSubmittedModal(true)
      return
    }

    setIsTransmittingQuote(true)
    try {
      const newQuote: SupplierQuote = {
        id: `QTE-${Date.now().toString().slice(-4)}`,
        supplierId: supplierId,
        supplierName: supplierEnterpriseName,
        totalAmount: totalWithGst,
        breakdown: {
          baseToolingOrSetup: quoteForm.baseTooling,
          unitManufacturing: manufacturingSubtotal,
          qualityTesting: quoteForm.qaTesting,
          logisticsAndPackaging: quoteForm.logistics,
          gstAmount: gstAmount,
        },
        deliveryDays: quoteForm.leadDays,
        terms: quoteForm.paymentTerms,
        schemeSubsidyApplied: subsidyDiscount,
        finalLandedCost: totalWithGst,
        scoreBreakdown: {
          priceCompetitiveness: 96,
          qualityAssurance: 98,
          leadTimeFeasibility: 96,
          complianceScore: 100,
        },
        recommendationReason: `Submitted by ${supplierEnterpriseName} (Udyam: ${supplierId}) via MSME Portal with ${repeatDiscountPercent}% repeat client concession and separate post-procurement ZED Gold scheme assessment.`,
      }

      submitMSMEQuote(newQuote, selectedOpp.id)
      // Update opportunity status to "Quote Transmitted"
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === selectedOpp.id ? { ...o, status: "Quote Transmitted" } : o
        )
      )
      setQuoteSubmittedModal(true)
    } finally {
      setIsTransmittingQuote(false)
    }
  }

  const navItems = [
    {
      screen: "msme.home" as Screen,
      label: "Overview",
      icon: <Icons.Building className="w-4 h-4" />,
    },
    {
      screen: "msme.opportunities" as Screen,
      label: "Live RFQ Inquiries",
      icon: <Icons.Search className="w-4 h-4" />,
    },
    {
      screen: "msme.proposal" as Screen,
      label: "Quotation Builder",
      icon: <Icons.Coins className="w-4 h-4" />,
    },
    {
      screen: "msme.capabilities" as Screen,
      label: "Machinery & Capacity",
      icon: <Icons.Package className="w-4 h-4" />,
    },
    {
      screen: "msme.verification" as Screen,
      label: "Statutory Credentials",
      icon: <Icons.ShieldCheck className="w-4 h-4" />,
    },
    {
      screen: "msme.schemes" as Screen,
      label: "Government Schemes",
      icon: <Icons.Award className="w-4 h-4" />,
    },
    {
      screen: "msme.analytics" as Screen,
      label: "Business Performance",
      icon: <Icons.BarChart3 className="w-4 h-4" />,
    },
  ]

  const renderShell = (
    content: React.ReactNode,
    title: string,
    subtitle?: string,
  ) => (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1220] flex font-sans selection:bg-[#051F16] selection:text-white">
      {/* ─── SIDEBAR (Deep Forest #051F16 with Lime Accent) ────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#051F16] text-white flex flex-col justify-between transition-transform duration-300 border-r border-[#0A3525] lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Logo & Workspace header */}
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
                  <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 3l3 4 3-4" />
                </svg>
              </div>
              <div>
                <div
                  className="font-extrabold text-base tracking-tight text-white"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  MSME Hub
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  Supplier Portal · Apex Packaging
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

          {/* Supplier Trust Badge Card */}
          <div className="p-4 mx-3 my-3 bg-[#0A3525]/70 rounded-xl border border-emerald-900/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Apex Precision Ltd.
              </span>
              <span className="text-[10px] bg-emerald-950 text-[#A3F65C] font-bold px-1.5 py-0.5 rounded border border-emerald-800/60">
                ZED Gold Pass
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono">
              Udyam: UDYAM-MH-12-0048192
            </div>
            <div className="text-[11px] text-[#A3F65C] font-semibold">
              Tier 1 Verified Manufacturer
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

        {/* Bottom Help & Cross-Hub Links */}
        <div className="p-3.5 border-t border-[#0A3525] space-y-1.5">
          <button
            onClick={() => navigate("home")}
            className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded-lg hover:bg-[#0A3525] cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <MaterialIcon name="home" size={14} className="text-slate-400" />
              <span>Home Marketplace</span>
            </span>
            <span className="text-[10px] bg-[#0A3525] px-1.5 py-0.5 rounded text-slate-300 border border-emerald-900/50">
              Public
            </span>
          </button>
          <button
            onClick={() => navigate("government-schemes.match")}
            className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded-lg hover:bg-[#0A3525] cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <MaterialIcon name="policy" size={14} className="text-slate-400" />
              <span>Government Schemes</span>
            </span>
            <span className="text-[10px] bg-emerald-950 text-[#A3F65C] border border-emerald-800/50 px-1.5 py-0.5 rounded">
              Grants
            </span>
          </button>
          <div className="text-[10px] text-slate-400 text-center pt-1">
            MSME Bharat Sourcing Desk · Verified
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
                  onClick={() => navigate("msme.home")}
                  className={`hover:text-slate-900 hover:underline cursor-pointer shrink-0 ${
                    currentScreen === "msme.home" ? "font-bold text-[#051F16]" : ""
                  }`}
                >
                  MSME Portal
                </button>
                {currentScreen !== "msme.home" && (
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
              onClick={() => navigate("msme.analytics")}
              className="flex items-center gap-2 bg-[#FFF7D6] hover:bg-[#ffefb3] text-[#8C6B00] border border-yellow-300 px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              <Icons.TrendingUp className="w-3.5 h-3.5 text-[#D9A400]" />
              <span className="hidden sm:inline">Performance Analytics</span>
              <span className="sm:hidden">Analytics</span>
            </button>

            <MPIButton
              variant="ai"
              size="sm"
              onClick={() => navigate("msme.proposal")}
              icon={<Icons.Coins className="w-3.5 h-3.5" />}
            >
              <span className="hidden sm:inline">Build Proposal</span>
              <span className="sm:hidden">Quote</span>
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
                Cloud synchronization is initializing. Quotations are safely preserved in your local session.
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

        {/* Content Viewport */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {content}
        </main>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // 1. OVERVIEW DASHBOARD (msme.home)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "msme.home") {
    return renderShell(
      <div className="space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <MPIStatCard
            title="Live RFQs"
            value="3"
            change="+2 new matches"
            trend="up"
            icon={<Icons.Search className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Proposals Sent"
            value="14"
            change="64% win rate"
            trend="up"
            icon={<Icons.FileText className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Won PO Sourcing"
            value="₹14.8 Lakh"
            change="Past 90 days"
            trend="up"
            icon={<Icons.Coins className="w-4 h-4 text-[#D9A400]" />}
          />
          <MPIStatCard
            title="Capacity Utilization"
            value="68%"
            change="32% capacity open"
            trend="neutral"
            icon={<Icons.Package className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Avg Response Speed"
            value="14 Hours"
            change="Top 5% in Pune cluster"
            trend="up"
            icon={<Icons.Clock className="w-4 h-4 text-emerald-700" />}
          />
        </div>

        {/* Live Opportunities Feed (Strict Buyer Privacy) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                High-Intent Startup RFQ Opportunities
              </h3>
              <p className="text-xs text-slate-500">
                Inquiries matched to your verified packaging machinery and ISO
                9001 certifications.
              </p>
            </div>
            <MPIButton
              variant="outline"
              size="sm"
              onClick={() => navigate("msme.opportunities")}
            >
              View All ({opportunities.length}) →
            </MPIButton>
          </div>

          <div className="divide-y divide-slate-100">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="p-4 rounded-xl hover:bg-slate-50/80 border border-transparent hover:border-slate-200/80 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {opp.title}
                    </span>
                    <span className="text-[10px] font-bold text-[#051F16] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {opp.matchScore}% Match
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      opp.status === "Quote Transmitted"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : opp.status === "Under Evaluation"
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : opp.status === "Accepted"
                        ? "bg-purple-50 text-purple-800 border-purple-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      ● {opp.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Buyer:{" "}
                    <strong className="text-[#051F16]">{opp.buyer}</strong> ·
                    Target Budget: <strong>{opp.budget}</strong> · Lead:{" "}
                    <strong>{opp.leadTime}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1 max-w-2xl">
                    <strong>Specs:</strong> {opp.specs}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <MPIButton
                    variant="ai"
                    size="sm"
                    onClick={() => {
                      setSelectedOppId(opp.id)
                      navigate("msme.proposal")
                    }}
                    icon={<Icons.Coins className="w-3.5 h-3.5" />}
                  >
                    {opp.status === "Quote Transmitted"
                      ? "View / Revise Quote →"
                      : "Submit Itemized Quote →"}
                  </MPIButton>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Machinery Status Quick Strip */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Active Machinery Capacity Slots
              </h3>
              <p className="text-xs text-slate-400">
                Available production lines across the 7 categories
              </p>
            </div>
            <MPIButton
              variant="outline"
              size="sm"
              onClick={() => navigate("msme.capabilities")}
            >
              Manage Machines →
            </MPIButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {machineryList.map((mch) => (
              <div
                key={mch.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-slate-300 transition-all duration-300 hover:-translate-y-0.5 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded">
                    {mch.category}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      mch.status === "Available"
                        ? "bg-emerald-100/60 text-[#051F16]"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {mch.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 leading-snug">
                  {mch.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  Capacity: {mch.capacity}
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#051F16] h-full"
                    style={{ width: `${mch.utilization}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400">
                  {mch.utilization}% monthly utilized
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>,
      "Supplier Business Command Center",
      "Grow your manufacturing business by bidding on high-intent startup procurement RFQs.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  // 2. ITEMISED QUOTATION SUBMISSION BUILDER (msme.proposal)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "msme.proposal") {
    return renderShell(
      <div className="max-w-4xl mx-auto space-y-6">
        {/* RFQ Context Header with Dynamic Selected Opportunity & Submitting Identity */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                RFQ #{selectedOpp.id}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                selectedOpp.status === "Quote Transmitted"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : selectedOpp.status === "Under Evaluation"
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : selectedOpp.status === "Accepted"
                  ? "bg-purple-50 text-purple-800 border-purple-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                ● Status: {selectedOpp.status}
              </span>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                Submitting as: {supplierEnterpriseName}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#051F16]">
              {selectedOpp.title}
            </h3>
            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span>Buyer: <strong className="text-[#051F16]">{selectedOpp.buyer}</strong></span>
              <span>•</span>
              <span>Target Budget: <strong className="text-slate-800">{selectedOpp.budget}</strong></span>
              <span>•</span>
              <span>Target Volume: <strong className="text-slate-800">{selectedOpp.qty}</strong></span>
              <span>•</span>
              <span>Turnaround: <strong className="text-slate-800">{selectedOpp.leadTime}</strong></span>
            </div>
          </div>
          <MPIVerifiedBadge label="Reverse-Margin Protocol" />
        </div>

        {/* ─── RFQ SPECIFICATIONS & BID SUBMISSION PROTOCOL GUIDANCE ─────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold text-xs">
                <Icons.FileText className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-[#051F16]">
                Quotation Submission Protocol & Buyer Specifications
              </h4>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
              Guidance & Compliance
            </span>
          </div>

          {/* 4-Stage Post-Submission Lifecycle Roadmap */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Quotation Lifecycle Roadmap
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { stage: "1. Draft", desc: "Formulating itemized pricing", active: selectedOpp.status === "Open for Bidding" || selectedOpp.status === "Draft" },
                { stage: "2. Transmitted", desc: "Live in buyer's matrix", active: selectedOpp.status === "Quote Transmitted" },
                { stage: "3. Under Evaluation", desc: "Sample & tolerance check", active: selectedOpp.status === "Under Evaluation" },
                { stage: "4. Accepted", desc: "PO issued & escrow locked", active: selectedOpp.status === "Accepted" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    item.active
                      ? "bg-[#F4FBF7] border-emerald-300 ring-1 ring-emerald-300"
                      : "bg-slate-50/70 border-slate-200 opacity-80"
                  }`}
                >
                  <div className={`text-xs font-bold ${item.active ? "text-emerald-900" : "text-slate-700"}`}>
                    {item.stage}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Specifications Needing Supplier Response */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Buyer Technical Specifications
              </span>
              <p className="text-slate-700 font-semibold leading-relaxed">
                {selectedOpp.specs}
              </p>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                Material: <strong>{selectedOpp.buyerRequirements?.material || "Standard Grade"}</strong> • Tolerance: <strong>{selectedOpp.buyerRequirements?.tolerance || "±0.5mm"}</strong>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Supplier Response Requirements
              </span>
              <ul className="space-y-1 text-[11px] text-slate-600">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>Itemize setup tooling separately from unit production</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>Confirm NABL/ZED testing certificates availability</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>30% advance escrow with 70% released upon QC sign-off</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ─── REPEAT BUYER PROFILE BANNER ─────────────────────────────────── */}
        <div className="bg-linear-to-r from-[#FFFDF5] to-amber-50/70 rounded-2xl border-2 border-[#D9A400]/40 p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D9A400] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <Icons.Award className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                    Repeat Client Verified
                  </span>
                  <span className="text-[10px] font-extrabold bg-[#FFF7D6] text-[#8C6B00] px-2 py-0.5 rounded-full border border-amber-300">
                    Gold Tier Account
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-[#051F16]">
                  MPI Verified Buyer #042 · Bangalore Cluster
                </h4>
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-600 flex items-center gap-4 bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
              <div>
                <div className="text-[10px] text-slate-400">Order History</div>
                <div className="font-bold text-slate-900">
                  8 Completed Orders
                </div>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] text-slate-400">Cumulative GMV</div>
                <div className="font-bold text-[#051F16]">₹7,80,000</div>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] text-slate-400">
                  Settlement Track Record
                </div>
                <div className="font-bold text-emerald-700">100% On-Time</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-950/80 leading-relaxed">
            Buyer #042 is a repeat buyer with a zero-dispute track record across
            8 past production cycles. Offering a loyalty concession strengthens
            long-term procurement exclusivity.
          </p>
        </div>

        {/* ─── MSME-CONTROLLED LOYALTY DISCOUNT SELECTOR ───────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <label className="text-sm font-bold text-slate-900 block">
                Repeat Customer Loyalty Concession (MSME Discretion)
              </label>
              <span className="text-xs text-slate-500">
                You retain complete commercial agency. Concessions are 100%
                voluntary and never platform-enforced.
              </span>
            </div>
            <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
              {repeatDiscountPercent > 0
                ? `${repeatDiscountPercent}% Loyalty Concession`
                : "Standard Pricing (0%)"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            {[
              { id: "none", label: "0% (Standard)", val: 0 },
              { id: "1", label: "1% Courtesy", val: 1 },
              { id: "2", label: "2% Loyalty", val: 2 },
              { id: "3", label: "3% Preferred", val: 3 },
              { id: "5", label: "5% Volume", val: 5 },
              { id: "custom", label: "Custom %", val: -1 },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedDiscountMode(opt.id as any)
                  if (opt.val >= 0) setRepeatDiscountPercent(opt.val)
                  else
                    setRepeatDiscountPercent(
                      parseFloat(customDiscountPercent) || 0,
                    )
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                  selectedDiscountMode === opt.id
                    ? "bg-[#051F16] text-white border-[#051F16] shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {selectedDiscountMode === "custom" && (
            <div className="pt-2 flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="text-xs font-semibold text-slate-700 shrink-0">
                Custom Loyalty Discount:
              </label>
              <input
                type="number"
                min="0"
                max="25"
                step="0.5"
                value={customDiscountPercent}
                onChange={(e) => {
                  setCustomDiscountPercent(e.target.value)
                  const p = parseFloat(e.target.value) || 0
                  setRepeatDiscountPercent(p)
                }}
                className="w-24 text-xs p-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-[#051F16] font-bold text-slate-900"
                placeholder="2.5"
              />
              <span className="text-xs text-slate-500">
                % applied directly on unit manufacturing volume
              </span>
            </div>
          )}
        </div>

        {/* ─── AI MSME RFQ RESPONSE COPILOT (Blueprint Item 24) ──────────── */}
        <div className="bg-linear-to-r from-[#051F16] to-[#0A3525] text-white rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold shrink-0">
                <Icons.Sparkles className="w-5 h-5 text-[#A3F65C]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>AI MSME RFQ Response & Bid Copilot</span>
                  <span className="text-[10px] font-mono uppercase bg-white/10 text-blue-200 px-2 py-0.5 rounded">
                    Blueprint Item 24
                  </span>
                </h4>
                <p className="text-xs text-blue-200">
                  Formulates margin-optimized pricing, setup fees & drafts an authoritative proposal letter citing your verified machines.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAIDraftResponse}
              disabled={isDraftingAIResponse}
              className="px-3.5 py-2 bg-[#A3F65C] hover:bg-[#92E64B] text-[#051F16] rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
            >
              <Icons.Sparkles className="w-4 h-4 text-white" />
              <span>
                {isDraftingAIResponse
                  ? "Drafting with MPI AI..."
                  : aiDraftResult
                    ? "Regenerate Bid"
                    : "Draft Bid with MPI AI"}
              </span>
            </button>
          </div>

          {isDraftingAIResponse ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-2">
              <div className="w-6 h-6 border-2 border-[#A3F65C] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-blue-200">
                Analyzing RFQ tolerances and matching verified Heidelberg & Bobst machine capacities...
              </span>
            </div>
          ) : aiDraftResult ? (
            <div className="bg-white/10 rounded-xl p-4 space-y-3.5 backdrop-blur-xs text-xs border border-white/10 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-black/20 p-3 rounded-lg">
                  <span className="text-blue-200 text-[10px] block font-medium">AI Suggested Unit Price</span>
                  <div className="text-lg font-extrabold text-white mt-0.5">
                    ₹{aiDraftResult.suggestedUnitPrice}/unit
                  </div>
                  <span className="text-[10px] text-emerald-300 font-semibold">Competitive reverse margin</span>
                </div>
                <div className="bg-black/20 p-3 rounded-lg">
                  <span className="text-blue-200 text-[10px] block font-medium">Suggested Tooling / Setup Fee</span>
                  <div className="text-lg font-extrabold text-white mt-0.5">
                    ₹{aiDraftResult.suggestedToolingFee.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-blue-200">One-time die/plate</span>
                </div>
                <div className="bg-black/20 p-3 rounded-lg">
                  <span className="text-blue-200 text-[10px] block font-medium">Recommended Turnaround</span>
                  <div className="text-lg font-extrabold text-white mt-0.5">
                    {aiDraftResult.recommendedLeadDays} Days
                  </div>
                  <span className="text-[10px] text-blue-200">Capacity verified</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-white block">Competitive Edge Rationale:</span>
                <p className="text-emerald-100 text-xs italic bg-black/20 p-2.5 rounded-lg border border-white/5">
                  "{aiDraftResult.competitiveEdge}"
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Generated Bid Proposal Letter:</span>
                  <span className="text-[10px] text-[#A3F65C] font-mono">
                    {aiDraftResult.isLive ? "✓ Live MPI AI Generation" : "Calibrated Industry Proposal"}
                  </span>
                </div>
                <pre className="p-3 bg-black/40 text-emerald-50 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed border border-white/5">
                  {aiDraftResult.coverNote}
                </pre>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/10">
                <span className="text-[11px] text-emerald-300 font-semibold">
                  ✓ Verified machinery & ZED Gold quality clauses ready
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuoteForm((prev) => ({
                      ...prev,
                      unitPrice: aiDraftResult.suggestedUnitPrice,
                      baseTooling: aiDraftResult.suggestedToolingFee,
                      leadDays: aiDraftResult.recommendedLeadDays,
                      paymentTerms: `${aiDraftResult.coverNote.split("\n")[0]} — 30% Advance Escrow, 70% against delivery inspection.`,
                    }))
                  }}
                  className="px-3.5 py-1.5 bg-[#A3F65C] hover:bg-[#92E64B] text-[#051F16] rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  1-Click Apply AI Pricing & Terms to Quote
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ─── ITEMISED PRICING FORM ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Itemized Cost Breakdown Ledger
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Base Tooling / Die-Cutting / Plate Setup Fee (₹)
              </label>
              <input
                type="number"
                value={quoteForm.baseTooling}
                onChange={(e) =>
                  setQuoteForm({
                    ...quoteForm,
                    baseTooling: Number(e.target.value),
                  })
                }
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#051F16]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                One-time custom kappa cutting die
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Unit Fabrication Price (₹ per unit)
              </label>
              <input
                type="number"
                value={quoteForm.unitPrice}
                onChange={(e) =>
                  setQuoteForm({
                    ...quoteForm,
                    unitPrice: Number(e.target.value),
                  })
                }
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#051F16]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                500 units × ₹{quoteForm.unitPrice} = ₹
                {(quoteForm.unitPrice * 500).toLocaleString("en-IN")}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Quality Inspection & Drop Testing (₹)
              </label>
              <input
                type="number"
                value={quoteForm.qaTesting}
                onChange={(e) =>
                  setQuoteForm({
                    ...quoteForm,
                    qaTesting: Number(e.target.value),
                  })
                }
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#051F16]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                ISTA-1A certified drop testing
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Logistics & Protective Packaging (₹)
              </label>
              <input
                type="number"
                value={quoteForm.logistics}
                onChange={(e) =>
                  setQuoteForm({
                    ...quoteForm,
                    logistics: Number(e.target.value),
                  })
                }
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#051F16]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Pune to Bengaluru door dispatch
              </span>
            </div>
          </div>

          {/* Lead time & payment terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Production Lead Time (Business Days)
              </label>
              <input
                type="number"
                value={quoteForm.leadDays}
                onChange={(e) =>
                  setQuoteForm({
                    ...quoteForm,
                    leadDays: Number(e.target.value),
                  })
                }
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#051F16]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Commercial Payment Terms
              </label>
              <input
                type="text"
                value={quoteForm.paymentTerms}
                onChange={(e) =>
                  setQuoteForm({ ...quoteForm, paymentTerms: e.target.value })
                }
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#051F16]"
              />
            </div>
          </div>

          {/* ZED Scheme subsidy checkbox */}
          <div
            onClick={() =>
              setQuoteForm({
                ...quoteForm,
                applyZedSubsidy: !quoteForm.applyZedSubsidy,
              })
            }
            className="p-4 rounded-xl border border-yellow-200 bg-[#FFF7D6]/50 flex items-start gap-3 cursor-pointer"
          >
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center text-xs mt-0.5 shrink-0 ${
                quoteForm.applyZedSubsidy
                  ? "bg-[#D9A400] text-white"
                  : "border border-slate-300"
              }`}
            >
              {quoteForm.applyZedSubsidy && (
                <Icons.Check className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-yellow-950">
                Apply ZED Gold MSME Subsidy Pass-Through (10% Landed Cost
                Reduction)
              </div>
              <div className="text-[11px] text-yellow-800">
                Our Udyam & ZED Gold registration grants ₹
                {Math.round(totalWithGst * 0.1).toLocaleString("en-IN")} in
                direct govt grant savings for the buyer.
              </div>
            </div>
          </div>

          {/* ─── LIVE LANDED COST CALCULATION LEDGER ───────────────────────── */}
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>
                Gross Base Subtotal (Tooling + Unit Fab + QA + Freight):
              </span>
              <span className="font-semibold text-slate-900">
                ₹{rawSubtotalBeforeDiscount.toLocaleString("en-IN")}
              </span>
            </div>

            {repeatDiscountPercent > 0 && (
              <div className="flex justify-between text-amber-900 bg-[#FFF7D6] px-2 py-1.5 rounded font-bold border border-amber-200/80">
                <span className="flex items-center gap-1.5">
                  <Icons.Award className="w-3.5 h-3.5 text-[#8C6B00]" />
                  <span>
                    Repeat Buyer Loyalty Concession ({repeatDiscountPercent}% on
                    unit fabrication):
                  </span>
                </span>
                <span>- ₹{repeatDiscountAmount.toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Taxable Subtotal (After Loyalty Concession):</span>
              <span className="font-bold text-slate-900">
                ₹{subtotalAfterRepeatDiscount.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>GST (18% Statutory Output Tax):</span>
              <span className="font-semibold text-slate-900">
                ₹{gstAmount.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-[#051F16]">
              <span>Contracted Payable Invoice to Factory (Escrow Locked):</span>
              <span className="text-base text-[#051F16]">
                ₹{totalWithGst.toLocaleString("en-IN")}
              </span>
            </div>

            {quoteForm.applyZedSubsidy && (
              <div className="p-2.5 rounded-xl bg-[#FFF7D6]/60 border border-[#FFE799] text-xs space-y-1">
                <div className="flex justify-between font-bold text-[#8C6B00]">
                  <span>Eligible Buyer Scheme Subsidy (Separate Track):</span>
                  <span>Est. ₹{subsidyDiscount.toLocaleString("en-IN")}</span>
                </div>
                <p className="text-[10px] text-[#A37D00] leading-tight">
                  Estimated ZED Gold quality audit reimbursement claimable post-procurement from Ministry of MSME. Payable invoice to your factory remains ₹{totalWithGst.toLocaleString("en-IN")} in full.
                </p>
              </div>
            )}
          </div>

          {/* ─── MSME AI QUOTATION ASSISTANT CARD ──────────────────────────── */}
          <div className="bg-linear-to-r from-blue-50/70 to-slate-50 border border-emerald-200/80 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#051F16] text-white flex items-center justify-center shrink-0">
                <Icons.Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-[#051F16] uppercase tracking-wide">
                MPI AI Repeat Buyer Strategy Advisor
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Buyer #042 re-orders every 45 days with 100% prompt settlement.
              Our pricing telemetry indicates that offering a{" "}
              <strong>
                {repeatDiscountPercent > 0 ? `${repeatDiscountPercent}%` : "2%"}{" "}
                loyalty concession (saving them ₹
                {(repeatDiscountPercent > 0
                  ? repeatDiscountAmount
                  : Math.round(manufacturingSubtotal * 0.02)
                ).toLocaleString("en-IN")}
                )
              </strong>{" "}
              elevates your quote acceptance probability to <strong>94%</strong>{" "}
              while keeping your operational contribution margin at a solid{" "}
              <strong>32.4%</strong>.
            </p>
          </div>

          <MPIButton
            variant="ai"
            fullWidth
            size="lg"
            onClick={handleTransmitQuotation}
            disabled={isTransmittingQuote || selectedOpp.status === "Quote Transmitted"}
            isLoading={isTransmittingQuote}
            icon={<Icons.ArrowRight className="w-4 h-4" />}
          >
            {selectedOpp.status === "Quote Transmitted"
              ? "Quotation Already Transmitted"
              : `Transmit Binding Quotation to ${selectedOpp.buyer.split("(")[0]} →`}
          </MPIButton>
        </div>

        {/* Confirmation Modal */}
        {quoteSubmittedModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100/60 text-[#051F16] flex items-center justify-center mx-auto">
                <Icons.Check className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-[#051F16]">
                {quotePersistenceStatus === "saved_to_supabase"
                  ? "Quotation Submitted to Buyer"
                  : quotePersistenceStatus === "saving"
                  ? "Submitting Quotation..."
                  : "Quotation Saved Locally"}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {quotePersistenceStatus === "saved_to_supabase" ? (
                  <>
                    Your binding itemized quotation of{" "}
                    <strong>₹{totalWithGst.toLocaleString("en-IN")}</strong> payable invoice value{" "}
                    (including {repeatDiscountPercent}% repeat client concession
                    {subsidyDiscount > 0 ? ` and ₹${subsidyDiscount.toLocaleString("en-IN")} eligible ZED subsidy assessment` : ""})
                    has been saved to your MPI account and transmitted directly into {selectedOpp.buyer}'s comparison
                    matrix on behalf of <strong>{supplierEnterpriseName}</strong>.
                  </>
                ) : quotePersistenceStatus === "saving" ? (
                  <>
                    Transmitting your binding itemized quotation of{" "}
                    <strong>₹{totalWithGst.toLocaleString("en-IN")}</strong> payable invoice value to the MPI
                    cloud network on behalf of <strong>{supplierEnterpriseName}</strong>...
                  </>
                ) : (
                  <>
                    Your binding itemized quotation of{" "}
                    <strong>₹{totalWithGst.toLocaleString("en-IN")}</strong> payable invoice value{" "}
                    has been saved in this browser session. Synchronization is pending; remote saving and transmission
                    have not been confirmed.
                  </>
                )}
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <Icons.ShieldCheck className="w-3.5 h-3.5 text-[#051F16]" />
                  <span>
                    Quotation Lifecycle Status:{" "}
                    {quotePersistenceStatus === "saved_to_supabase"
                      ? "Quote Transmitted"
                      : quotePersistenceStatus === "saving"
                      ? "Transmitting"
                      : "Local Session Stored"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {quotePersistenceStatus === "saved_to_supabase" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Submitted & Confirmed</span>
                    </span>
                  ) : quotePersistenceStatus === "saving" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-spin" />
                      <span>Syncing with MPI Network...</span>
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                      title={quotePersistenceError || "Stored locally in browser session"}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Saved in Local Session Buffer</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug pt-1">
                  {quotePersistenceStatus === "saved_to_supabase"
                    ? "The buyer has been notified. You can track evaluation progress, sample requests, and milestone releases directly from your supplier dashboard."
                    : quotePersistenceStatus === "saving"
                    ? "Please wait while your proposal is encrypted and dispatched to the procurement registry."
                    : "Your quote draft is retained in this browser session. To ensure transmission to the buyer once online, reconnect to synchronize with the MPI network."}
                </div>
              </div>
              <MPIButton
                variant="primary"
                fullWidth
                onClick={() => {
                  setQuoteSubmittedModal(false)
                  navigate("msme.opportunities")
                }}
              >
                Back to Opportunities Feed
              </MPIButton>
            </div>
          </div>
        )}
      </div>,
      "Itemized Quotation Submission",
      "Build transparent institutional quotes with setup, tooling, GST, and repeat-order discounts.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. MACHINERY & CAPACITY MANAGER (msme.capabilities)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "msme.capabilities") {
    return renderShell(
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl">
            <button
              type="button"
              onClick={() => setCapabilitiesTab("machinery")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                capabilitiesTab === "machinery"
                  ? "bg-white text-[#051F16] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Production Lines & Machinery ({machineryList.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setCapabilitiesTab("inventory")
                if (!reorderResult) handleCalculateReorder()
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                capabilitiesTab === "inventory"
                  ? "bg-[#051F16] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icons.Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>AI Inventory Reorder & Lead-Time Assistant (Items 51–53)</span>
            </button>
          </div>

          {capabilitiesTab === "machinery" && (
            <MPIButton
              variant="outline"
              size="sm"
              onClick={() => {
                const newMachine = {
                  id: `MCH-0${machineryList.length + 1}`,
                  name: "High-Speed Automated Folding Carton Gluer",
                  category: "Packaging & Printing",
                  capacity: "120,000 cartons/mo",
                  utilization: 40,
                  status: "Available",
                }
                setMachineryList([...machineryList, newMachine])
              }}
            >
              + Add Equipment Line
            </MPIButton>
          )}
        </div>

        {capabilitiesTab === "machinery" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Machine Capacities & Tooling Assets
                </h3>
                <p className="text-xs text-slate-500">
                  Live operational equipment listed across the 7 approved
                  categories.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {machineryList.map((mch, idx) => (
                <div
                  key={mch.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                        {mch.category}
                      </span>
                      <button
                        onClick={() => {
                          const next =
                            mch.status === "Available"
                              ? "Busy"
                              : mch.status === "Busy"
                                ? "Maintenance"
                                : "Available"
                          const updated = [...machineryList]
                          updated[idx].status = next
                          setMachineryList(updated)
                        }}
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold cursor-pointer transition-colors ${
                          mch.status === "Available"
                            ? "bg-emerald-100/60 text-[#051F16]"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {mch.status} (Toggle)
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mb-1">
                      {mch.name}
                    </h4>
                    <div className="text-xs text-slate-500 mb-4">
                      Total Production Rating: {mch.capacity}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-slate-600">
                        <span>Monthly Load:</span>
                        <span>{mch.utilization}% Allocated</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#051F16] h-full"
                          style={{ width: `${mch.utilization}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>Verified by MSME Toolroom Audit</span>
                    <span className="text-[#051F16] font-semibold">
                      Active in RFQ Matching
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* AI Smart Inventory, Reorder & Lead-Time Assistant (Blueprint Items 51, 52, 53) */
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-linear-to-r from-[#051F16] to-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#051F16] text-white px-2.5 py-0.5 rounded-full">
                    Blueprint Items 51, 52, 53
                  </span>
                  <span className="text-xs text-blue-200">
                    Smart Operations & Supplier Telemetry
                  </span>
                </div>
                <h3
                  className="text-lg sm:text-xl font-bold text-white"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  MSME Inventory & Reorder Point Optimizer
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Calculates optimal reorder triggers using shop-floor daily consumption, stock on hand, and supplier delivery lead-time intervals. Prevents line halts and rush freight premiums.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <MPIButton
                  variant="ai"
                  size="md"
                  disabled={isCalculatingReorder}
                  onClick={() => handleCalculateReorder()}
                  icon={<Icons.Sparkles className="w-4 h-4" />}
                >
                  {isCalculatingReorder ? "Calculating with MPI AI..." : "Recalculate Reorder Point"}
                </MPIButton>
              </div>
            </div>

            {/* Material Selector Chips */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Select Raw Material Input:
              </span>
              <div className="flex flex-wrap gap-2">
                {inventoryLedger.map((mat) => {
                  const isSelected = selectedInventoryMaterial === mat.materialName
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => {
                        setSelectedInventoryMaterial(mat.materialName)
                        handleCalculateReorder(mat.materialName)
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${
                        isSelected
                          ? "bg-[#051F16] text-white border-[#051F16] shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        mat.status === "Healthy"
                          ? "bg-emerald-400"
                          : mat.status === "Critical Stockout Risk"
                          ? "bg-red-400"
                          : "bg-amber-400"
                      }`} />
                      <span>{mat.materialName}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* AI Calculation Results Grid */}
            {isCalculatingReorder ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-3 border-[#051F16] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-600">
                  MPI AI modeling consumption curves and supplier turnaround distribution...
                </p>
              </div>
            ) : reorderResult ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                {/* Left Card: Reorder Point & Suggested Action (Item 51) */}
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Reorder Point Calculation (Item 51)
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-0.5">
                          {selectedInventoryMaterial}
                        </h4>
                      </div>
                      <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                        reorderResult.reorderStatus === "Healthy"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : reorderResult.reorderStatus === "Critical Stockout Risk"
                          ? "bg-red-50 text-red-800 border-red-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
                      }`}>
                        {reorderResult.reorderStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Action Trigger</span>
                        <strong className="text-slate-900 text-sm mt-0.5 block">
                          {reorderResult.suggestedReorderDate}
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Suggested Batch Qty</span>
                        <strong className="text-[#051F16] text-sm mt-0.5 block">
                          {reorderResult.reorderQuantity.toLocaleString("en-IN")} units
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Safety Stock Buffer</span>
                        <strong className="text-emerald-700 text-sm mt-0.5 block">
                          {reorderResult.safetyStockBuffer.toLocaleString("en-IN")} units
                        </strong>
                      </div>
                    </div>

                    <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-blue-950 leading-relaxed">
                      <strong>Shop-Floor Guidance:</strong> {reorderResult.guidanceNotes}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Algorithm: Dynamic Burn Rate + Safety Margin</span>
                    <button
                      type="button"
                      onClick={() => alert(`Purchase requisition triggered for ${reorderResult.reorderQuantity} units of ${selectedInventoryMaterial}`)}
                      className="px-3 py-1.5 bg-[#051F16] text-white font-bold rounded-lg hover:bg-black transition-colors cursor-pointer text-xs"
                    >
                      Trigger Material PO →
                    </button>
                  </div>
                </div>

                {/* Right Card: Lead-Time Intervals (Item 52) & Scorecard (Item 53) */}
                <div className="lg:col-span-6 space-y-6">
                  {/* Lead-Time Prediction (Item 52) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Icons.Clock className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-900">
                          Supplier Lead-Time Prediction Intervals (Item 52)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Regression Bands
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-extrabold text-[#051F16]">
                          {reorderResult.predictedLeadTimeDays} Business Days
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Estimated Delivery Window: <strong>{reorderResult.leadTimeInterval[0]} to {reorderResult.leadTimeInterval[1]} Days</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          95% Confidence Interval
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Performance Scorecard (Item 53) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Icons.ShieldCheck className="w-4 h-4 text-[#051F16]" />
                        <span className="text-xs font-bold text-slate-900">
                          Supplier Performance Scorecard (Item 53)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ZED Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">On-Time Delivery</span>
                        <strong className="text-slate-900 text-sm">{reorderResult.scorecard.onTimeDeliveryRate}%</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">QC Drop Test Pass</span>
                        <strong className="text-emerald-700 text-sm">{reorderResult.scorecard.qcDropTestPassRate}%</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">Response Speed</span>
                        <strong className="text-emerald-800 text-sm">{reorderResult.scorecard.responseSpeedHours} Hours</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">Cancellations</span>
                        <strong className="text-slate-900 text-sm">{reorderResult.scorecard.cancellationRate}%</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-2">
                        <span className="text-slate-400 block text-[10px]">Repeat Business Retention</span>
                        <strong className="text-[#8C6B00] text-sm">{reorderResult.scorecard.repeatBusinessRate}% Contract Retention</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Inventory Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900">
                  Full Raw Material Inventory Ledger
                </h4>
                <span className="text-xs text-slate-400">
                  Synchronized with ERP & Shop-Floor Weigh Scales
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="pb-3">SKU ID</th>
                      <th className="pb-3">Material Name</th>
                      <th className="pb-3">Stock on Hand</th>
                      <th className="pb-3">Daily Burn</th>
                      <th className="pb-3">Lead Time</th>
                      <th className="pb-3">Reorder Point</th>
                      <th className="pb-3">Inventory Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryLedger.map((mat) => (
                      <tr key={mat.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 font-mono font-medium text-slate-900">{mat.id}</td>
                        <td className="py-3 font-semibold text-slate-900">{mat.materialName}</td>
                        <td className="py-3 text-slate-800 font-bold">{mat.stockUnits.toLocaleString("en-IN")} {mat.unit}</td>
                        <td className="py-3 text-slate-600">{mat.dailyConsumption} {mat.unit}/day</td>
                        <td className="py-3 text-slate-600">{mat.supplierTurnaroundDays} days</td>
                        <td className="py-3 font-bold text-[#051F16]">{mat.reorderPointUnits.toLocaleString("en-IN")} {mat.unit}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            mat.status === "Healthy"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : mat.status === "Critical Stockout Risk"
                              ? "bg-red-50 text-red-800 border-red-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}>
                            {mat.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInventoryMaterial(mat.materialName)
                              handleCalculateReorder(mat.materialName)
                            }}
                            className="text-xs text-[#051F16] hover:text-[#A3F65C] font-bold cursor-pointer transition-colors"
                          >
                            Analyze →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>,
      "Machinery & Capacity Manager",
      "Manage production asset availability to receive calibrated procurement inquiries.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. STATUTORY VERIFICATION LEDGER (msme.verification)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "msme.verification") {
    return renderShell(
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#051F16] text-white flex items-center justify-center font-bold">
              <Icons.ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">
                MPI Statutory Compliance Audit Status
              </div>
              <div className="text-xs text-[#051F16] font-semibold">
                100% Verified · Gold Tier Sourcing Authorization
              </div>
            </div>
          </div>
          <MPIVerifiedBadge label="DPIIT Verified" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h4 className="text-sm font-bold text-slate-900">
            Verified Compliance Credentials
          </h4>

          <div className="divide-y divide-slate-100">
            {[
              {
                doc: "Udyam Registration Certificate",
                ref: "UDYAM-MH-12-0048192",
                status: "Permanent Valid",
                expiry: "Never Expires",
              },
              {
                doc: "GSTIN Return Filing Compliance",
                ref: "27AAACA9921B1ZM",
                status: "Active (3B/GSTR-1 Current)",
                expiry: "Annual Audit 2026",
              },
              {
                doc: "ISO 9001:2015 Quality Management",
                ref: "CERT-IN-8891-QMS",
                status: "Audited & Valid",
                expiry: "Dec 2026",
              },
              {
                doc: "ZED Gold Level Manufacturing Certificate",
                ref: "ZED-MH-2025-091",
                status: "Gold Level Subsidy Pass",
                expiry: "Nov 2027",
              },
            ].map((c) => (
              <div
                key={c.doc}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {c.doc}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {c.ref}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#051F16] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {c.status}
                  </span>
                  <span className="text-[11px] text-slate-400">{c.expiry}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>,
      "Statutory Verification Ledger",
      "Statutory Udyam, GST, and ISO quality credentials audited by MPI.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. GOVERNMENT SCHEMES & SUBSIDIES (msme.schemes)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "msme.schemes") {
    const msmeSchemes = [
      {
        id: "SCH-MSME-01",
        name: "ZED Certification Reimbursement Scheme",
        ministry: "O/o DC-MSME · Quality Division",
        matchScore: 99,
        maxBenefit: "Up to ₹5,00,000 subsidy",
        summary:
          "Reimbursement of 80% on ZED certification fees, handholding consultancy, and NABL-accredited laboratory test expenses.",
        status: "Active Pass-Through (Gold Tier)",
        portalUrl: "https://zed.msme.gov.in",
        tags: ["Packaging & Printing", "Quality Assurance", "ZED Gold"],
      },
      {
        id: "SCH-MSME-02",
        name: "Credit Linked Capital Subsidy Scheme (CLCSS)",
        ministry: "Ministry of MSME · Technology Division",
        matchScore: 96,
        maxBenefit: "15% upfront capital subsidy (Max ₹15 Lakhs)",
        summary:
          "Direct institutional capital grant for modernizing printing presses, packaging formers, and high-efficiency die cutters through designated nodal banks (SIDBI/NABARD).",
        status: "Eligible for FY 2026-27",
        portalUrl: "https://clcss.msme.gov.in",
        tags: ["Capital Machinery", "Technology Modernization"],
      },
      {
        id: "SCH-MSME-03",
        name: "CGTMSE Collateral-Free Credit Guarantee Scheme",
        ministry: "SIDBI & Ministry of MSME",
        matchScore: 94,
        maxBenefit: "Credit Guarantee up to ₹5 Crore",
        summary:
          "Enables MSMEs to secure working capital and term loans from scheduled commercial banks without pledging third-party collateral or personal real estate.",
        status: "Available via Partner Banks",
        portalUrl: "https://www.cgtmse.in",
        tags: ["Working Capital", "Collateral-Free"],
      },
      {
        id: "SCH-MSME-04",
        name: "Lean Manufacturing Competitiveness Scheme (LMCS)",
        ministry: "O/o DC-MSME · Productivity Wing",
        matchScore: 91,
        maxBenefit: "80% central grant for lean consultants",
        summary:
          "Subsidizes expert consultancy to implement 5S, Kaizen, Kanban, Poka-Yoke, and SMED setups in packaging plants, lowering rejection rates below 0.5%.",
        status: "Cluster Applications Open",
        portalUrl:
          "https://my.msme.gov.in/MyMsme/Reg/COM_LeanManufacturing.aspx",
        tags: ["Productivity", "Zero-Defect", "Cost Reduction"],
      },
      {
        id: "SCH-MSME-05",
        name: "Design Clinic Sourcing Assistance Scheme",
        ministry: "DC-MSME & National Institute of Design",
        matchScore: 89,
        maxBenefit: "Up to ₹9,00,000 for product & tool design",
        summary:
          "Financial support of 60% up to ₹9 Lakhs for expert design intervention in carton structure, ergonomic unboxing design, and tooling development.",
        status: "Open for Sourcing Grants",
        portalUrl: "https://designclinicsmsme.org",
        tags: ["Structural Packaging", "Prototyping"],
      },
      {
        id: "SCH-MSME-06",
        name: "SFURTI Cluster Regeneration Grant",
        ministry: "Ministry of MSME · Cluster Development",
        matchScore: 85,
        maxBenefit: "Up to ₹5 Crore for Common Facility Centers",
        summary:
          "Grants for setting up shared testing labs, raw material bulk procurement depots, and high-capacity offset packaging clusters.",
        status: "Cluster Sponsoring Active",
        portalUrl: "https://sfurti.msme.gov.in",
        tags: ["Cluster Sourcing", "Raw Material Depot"],
      },
    ]

    const activeUserObj = getActiveUser()
    const displayEnterpriseName = activeUserObj?.orgName || msmeProfile.enterpriseName || "Apex Precision Packaging"
    const displayUdyam = msmeProfile.udyamNumber || "UDYAM-MH-12-0048192"
    const displayType = msmeProfile.enterpriseType || "Micro"

    return renderShell(
      <div className="space-y-6">
        {/* Header Strip */}
        <div className="bg-linear-to-r from-[#051F16] to-[#0A3525] rounded-2xl p-6 text-white shadow-lg border border-blue-400/20 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#051F16] text-white px-2.5 py-0.5 rounded-full">
                MSME Central Scheme Registry
              </span>
              <span className="text-xs text-[#FFF7D6] font-semibold">
                Udyam: {displayUdyam} ({displayType} Enterprise)
              </span>
            </div>
            <h3
              className="text-lg sm:text-xl font-extrabold text-white"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              Statutory Subsidies & Modernization Grants for {displayEnterpriseName}
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              MPI monitors 30 central government schemes across MSME, DC-MSME,
              NSIC, SIDBI, and DPIIT. These grants offset machine procurement,
              testing, and certification costs for your facility.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <MPIButton
              variant="ai"
              size="md"
              onClick={() => {
                trackTelemetryEvent("scheme_matcher_opened", {
                  source: "msme_dashboard",
                  role: "msme",
                  enterpriseType: displayType,
                })
                navigate("government-schemes.match")
              }}
              icon={<Icons.Sparkles className="w-4 h-4" />}
            >
              Run Scheme Matcher →
            </MPIButton>
            <MPIButton
              variant="outline"
              size="md"
              onClick={() => navigate("government-schemes.browse")}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              Browse All 30 Schemes
            </MPIButton>
          </div>
        </div>

        {/* Schemes KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Identified Grant Potential
            </div>
            <div className="text-2xl font-extrabold text-[#051F16]">
              ₹34.5 Lakhs
            </div>
            <div className="text-[11px] text-[#168A5B] font-semibold">
              Across 6 matched central programs
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Statutory Program Status
            </div>
            <div className="text-2xl font-extrabold text-[#8C6B00]">
              ZED Gold Active
            </div>
            <div className="text-[11px] text-slate-500">
              Reimbursement filed with Ministry · Subsidies do not deduct from quote amount
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Statutory Pre-Verification
            </div>
            <div className="text-2xl font-extrabold text-emerald-700">
              100% Verified
            </div>
            <div className="text-[11px] text-slate-500">
              Udyam + GSTIN + ISO 9001 on file
            </div>
          </div>
        </div>

        {/* Matched Schemes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {msmeSchemes.map((sch) => (
            <div
              key={sch.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {sch.ministry}
                  </span>
                  <span className="text-xs font-extrabold text-[#051F16] bg-slate-100 px-2.5 py-1 rounded-xl">
                    {sch.matchScore}% Match
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-[#051F16]">
                    {sch.name}
                  </h4>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {sch.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {sch.summary}
                </p>
                <div className="p-3 bg-[#FFFDF5] border border-[#FFE799] rounded-xl text-xs flex justify-between items-center">
                  <span className="font-semibold text-amber-900">
                    Ceiling Benefit:
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {sch.maxBenefit}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-semibold">
                  {sch.status}
                </span>
                <a
                  href={sch.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackTelemetryEvent("scheme_official_link_clicked", {
                      schemeId: sch.id,
                      schemeName: sch.name,
                      url: sch.portalUrl,
                    })
                  }}
                  className="font-bold text-emerald-800 hover:underline flex items-center gap-1"
                >
                  <span>Official Portal</span>
                  <Icons.ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>,
      "Government Schemes & Subsidies",
      "Central manufacturing grants, capital subsidies, and quality testing reimbursements for MSMEs.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. MSME BUSINESS PERFORMANCE ANALYTICS STUDIO (msme.analytics)
  // ════════════════════════════════════════════════════════════════════════════
  if (currentScreen === "msme.analytics") {
    const monthlyRevenueData = [
      { month: "Apr", revenue: 4.2, orders: 8 },
      { month: "May", revenue: 6.8, orders: 12 },
      { month: "Jun", revenue: 8.5, orders: 15 },
      { month: "Jul", revenue: 11.2, orders: 19 },
      { month: "Aug", revenue: 14.8, orders: 24 },
      { month: "Sep", revenue: 18.4, orders: 29 },
    ]

    const funnelStages = [
      { stage: "Dispatched RFQs", count: 48, pct: 100 },
      { stage: "Reviewed Specifications", count: 42, pct: 87.5 },
      { stage: "Itemized Quotes Sent", count: 32, pct: 66.6 },
      { stage: "Shortlisted by Buyer", count: 24, pct: 50.0 },
      { stage: "Commercial PO Awarded", count: 18, pct: 37.5 },
    ]

    const buyerSegments = [
      { segment: "D2C Skincare & Beauty Startups", orders: 12, share: "42%" },
      { segment: "CleanTech & Hardware Prototyping", orders: 6, share: "21%" },
      { segment: "AgriTech & Organic Food Packaging", orders: 5, share: "18%" },
      { segment: "HealthTech & Diagnostic Kits", orders: 4, share: "14%" },
      { segment: "Early Stage Specialized Support", orders: 2, share: "5%" },
    ]

    return renderShell(
      <div className="space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <MPIStatCard
            title="Proposals Sent"
            value="32"
            change="+6 this cycle"
            trend="up"
            icon={<Icons.FileText className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Quote Win Rate"
            value="56.2%"
            change="+4.8% vs benchmark"
            trend="up"
            icon={<Icons.TrendingUp className="w-4 h-4 text-[#D9A400]" />}
          />
          <MPIStatCard
            title="Total Revenue Won"
            value="₹38.4 Lakh"
            change="+28% MoM"
            trend="up"
            icon={<Icons.Coins className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="Avg Order Value"
            value="₹1.28 Lakh"
            change="Institutional contracts"
            trend="up"
            icon={<Icons.Package className="w-4 h-4 text-emerald-700" />}
          />
          <MPIStatCard
            title="On-Time Delivery"
            value="98.5%"
            change="Zero SLA breaches"
            trend="up"
            icon={<Icons.Clock className="w-4 h-4 text-[#051F16]" />}
          />
          <MPIStatCard
            title="MPI Trust Rating"
            value="4.9 / 5.0"
            change="ZED Gold Audited"
            trend="up"
            icon={<Icons.ShieldCheck className="w-4 h-4 text-[#D9A400]" />}
          />
        </div>

        {/* Revenue Growth Chart & Win Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Realized Procurement Revenue Velocity
                </h3>
                <p className="text-xs text-slate-500">
                  Gross landed revenue in ₹ Lakhs sourced via MPI
                </p>
              </div>
              <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                +34% Growth
              </span>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyRevenueData}>
                <defs>
                  <linearGradient id="msmeRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#051F16" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#051F16" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(val: any) => `₹${Number(val)} Lakh`} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#051F16"
                  strokeWidth={2.5}
                  fill="url(#msmeRevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Conversion Funnel */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              RFQ Conversion & Bidding Funnel
            </h3>

            <div className="space-y-3">
              {funnelStages.map((f) => (
                <div key={f.stage} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{f.stage}</span>
                    <span className="text-[#051F16] font-bold">
                      {f.count} ({f.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#051F16] h-full rounded-full"
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Buyer Analytics & Growth Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Procurement Demand by Startup Industry Segment
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {buyerSegments.map((b) => (
                <div
                  key={b.segment}
                  className="py-2.5 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-800">
                    {b.segment}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{b.orders} POs</span>
                    <span className="font-bold text-[#051F16] bg-emerald-50 px-2 py-0.5 rounded">
                      {b.share}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#051F16] text-white rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0A3525] text-[#A3F65C] border border-emerald-900/50 text-[10px] font-bold uppercase tracking-wider mb-2">
                <Icons.Sparkles className="w-3.5 h-3.5" />
                Capacity & Sourcing Intelligence
              </div>
              <h3
                className="text-base font-bold text-white mb-2"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Increase Win Rate with Zero-Defect Tooling
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Startups in our Bengaluru and NCR clusters are reporting a 40%
                increase in demand for FSC-certified biodegradable packaging.
                Upgrading your gluer line with soy-ink certification will
                qualify you for an estimated{" "}
                <strong>₹12 Lakhs in additional monthly RFQs</strong>.
              </p>
            </div>

            <div className="pt-3 border-t border-[#0A3525] flex justify-between items-center">
              <span className="text-xs text-slate-400">
                MPI Supplier Telemetry
              </span>
              <MPIButton
                variant="ai"
                size="sm"
                onClick={() => navigate("msme.opportunities")}
              >
                Explore High-Value Inquiries →
              </MPIButton>
            </div>
          </div>
        </div>
      </div>,
      "MSME Analytics Studio",
      "Track proposal conversion funnels, realized sourcing revenues, and buyer segment demand.",
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. DEFAULT FALLBACK / OPPORTUNITIES FEED
  // ════════════════════════════════════════════════════════════════════════════
  return renderShell(
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            All RFQ Opportunities ({opportunities.length})
          </h3>
          <p className="text-xs text-slate-500">
            Live procurement inquiries with strict buyer anonymity guaranteed
          </p>
        </div>
        <MPIButton
          variant="primary"
          size="sm"
          onClick={() => navigate("msme.proposal")}
        >
          Submit New Proposal →
        </MPIButton>
      </div>

      <div className="space-y-4">
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900">
                  {opp.title}
                </span>
                <span className="text-xs font-bold text-[#051F16] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {opp.matchScore}% Match
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  opp.status === "Quote Transmitted"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : opp.status === "Under Evaluation"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : opp.status === "Accepted"
                    ? "bg-purple-50 text-purple-800 border-purple-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}>
                  ● {opp.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span>Buyer: <strong className="text-[#051F16]">{opp.buyer}</strong></span>
                <span>•</span>
                <span>Budget: <strong>{opp.budget}</strong></span>
                <span>•</span>
                <span>Volume: <strong>{opp.qty}</strong></span>
                <span>•</span>
                <span>Lead: <strong>{opp.leadTime}</strong></span>
              </div>
              <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-200">
                {opp.specs}
              </div>
            </div>

            <MPIButton
              variant="ai"
              size="sm"
              onClick={() => {
                setSelectedOppId(opp.id)
                navigate("msme.proposal")
              }}
              icon={<Icons.Coins className="w-3.5 h-3.5" />}
            >
              {opp.status === "Quote Transmitted"
                ? "View / Revise Quote →"
                : "Submit Itemized Quote →"}
            </MPIButton>
          </div>
        ))}
      </div>
    </div>,
    "Live RFQ Opportunities",
    "Open procurement inquiries from verified Indian startups ready for quotation.",
  )
}
