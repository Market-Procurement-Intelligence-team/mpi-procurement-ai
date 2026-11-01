import { useState } from "react"
import { NavProps } from "../../App"
import GenerativeMeshVisualizer from "../../components/GenerativeMeshVisualizer"
import * as RechartsModule from "recharts"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const Cell = (RechartsModule as unknown as { Cell: React.ComponentType<{ key?: string; fill?: string; stroke?: string; strokeWidth?: number }> }).Cell
import {
  runAIAnalyticsSynthesis,
  forecastDemandAndPriceWithAI,
  MacroForecastResult,
} from "../../services/aiService"

interface DetailPageProps extends NavProps {
  onBackToAnalytics?: () => void
}

// -------------------------------------------------------------
// Shared Sub-header & Breadcrumb for Detail Pages
// -------------------------------------------------------------
function DetailHeader({
  folder = "Sales",
  subfolder = "Tech Products",
  title,
  subtitle,
  onBack,
  actionButton,
}: {
  folder?: string
  subfolder?: string
  title: string
  subtitle?: string
  onBack: () => void
  actionButton?: React.ReactNode
}) {
  return (
    <div className="mb-4 sm:mb-6">
      {/* Folder Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-stone-500 mb-1.5 overflow-x-auto no-scrollbar">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-stone-400 shrink-0"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="shrink-0">{folder}</span>
        <span className="text-stone-300">→</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-stone-400 shrink-0"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-stone-700 font-medium truncate">{subfolder}</span>
      </div>

      {/* Main Title Row with circular back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-700 shadow-xs transition-all cursor-pointer shrink-0"
            title="Go back to dashboard"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-stone-900 font-sans truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] sm:text-xs md:text-sm text-stone-500 mt-0.5 line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actionButton && (
          <div className="shrink-0 self-start sm:self-auto">{actionButton}</div>
        )}
      </div>
    </div>
  )
}

// =============================================================
// 1. AI Assistant Copilot & Growth Insights Detail Page
// =============================================================
export function AIInsightsDetailPage({ goBack }: DetailPageProps) {
  const [prompt, setPrompt] = useState(
    "Analyze product sales over last year. Compare revenue, quality, sales and brand by age and gender",
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [keyFinding, setKeyFinding] = useState("+5% YoY Growth Confirmed")
  const [confidenceMetric, setConfidenceMetric] = useState(96.4)
  const [synthesisHtml, setSynthesisHtml] = useState(
    `<p>Product sales grew <strong class="text-stone-900 font-bold">5% year-over-year</strong>. Quality scores and brand perception index increased across all monitored manufacturing clusters. Revenue growth was primarily driven by the <strong class="text-stone-900 font-bold">30–45 age demographic</strong> (34,200 Sales, +3% growth) alongside rapid expansion in the <strong class="text-stone-900 font-bold">18–30 segment</strong> (28,322 Sales, +8% growth).</p><p>Key procurement optimizations identified include consolidating micro-lot RFQs into quarterly batch orders, which unlocked <strong class="text-stone-900 font-bold">₹4.2M in bulk volume rebates</strong> across ISO-certified precision machining partners.</p>`,
  )

  const [selectedMacroCategory, setSelectedMacroCategory] = useState("Corrugated Packaging & Paper")
  const [isForecasting, setIsForecasting] = useState(false)
  const [macroForecast, setMacroForecast] = useState<MacroForecastResult>({
    category: "Corrugated Packaging & Paper",
    demandForecast: [
      { quarter: "Q1 2027", projectedVolume: 14500, growthRatePercent: 14, confidenceBand: [13200, 15800] },
      { quarter: "Q2 2027", projectedVolume: 18200, growthRatePercent: 25, confidenceBand: [16500, 19900] },
      { quarter: "Q3 2027", projectedVolume: 22400, growthRatePercent: 23, confidenceBand: [20100, 24700] },
    ],
    priceForecast: [
      { rawMaterial: "Kraft Paper Board (350 GSM)", currentBenchmark: 44, projectedRange: [42, 47], unit: "₹/kg", trendDirection: "Stable" },
      { rawMaterial: "EVA Foam Liner (2mm)", currentBenchmark: 88, projectedRange: [82, 94], unit: "₹/sqm", trendDirection: "Softening" },
      { rawMaterial: "Die-Plate Tooling Steel", currentBenchmark: 240, projectedRange: [230, 255], unit: "₹/kg", trendDirection: "Increasing" },
    ],
    supplierConcentration: {
      hhiScore: 0.16,
      riskStatus: "Moderate Risk",
      primarySupplierSharePercent: 36,
      recommendedAlternativeClusters: ["Peenya Cluster (Bangalore)", "Okhla Cluster (Delhi)", "Sivakasi Cluster (TN)"],
    },
    savingsMeasurement: {
      verifiedDeterministicSavings: 42850,
      avoidedNegotiationCosts: 18400,
      statutorySubsidiesClaimed: 12500,
      totalEconomicImpact: 73750,
    },
    isLive: false,
  })

  const handleRunMacroForecast = async (cat?: string) => {
    const targetCat = cat || selectedMacroCategory
    setIsForecasting(true)
    try {
      const res = await forecastDemandAndPriceWithAI(targetCat, 500000)
      setMacroForecast(res)
    } finally {
      setIsForecasting(false)
    }
  }

  const handleRunAnalysis = async (customPrompt?: string) => {
    const textToRun = customPrompt || prompt
    if (!textToRun.trim()) return
    setIsGenerating(true)

    try {
      const res = await runAIAnalyticsSynthesis(textToRun, {
        totalSales: 90744,
        clusters: 1420,
        yoyGrowth: 5.4,
        demographics: { "18-30": "28,322", "30-45": "34,200", "45-60": "19,800" },
      })
      setKeyFinding(res.keyFinding)
      setSynthesisHtml(res.synthesisHtml)
      if (res.confidenceMetric) setConfidenceMetric(res.confidenceMetric)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-6xl mx-auto">
        <DetailHeader
          folder="AI Intelligence"
          subfolder="Copilot Deep-Dive"
          title="AI Assistant Analysis & Growth Modeling"
          subtitle="Real-time generative intelligence synthesizing revenue, supplier quality, and demographic penetration"
          onBack={goBack}
          actionButton={
            <div className="flex items-center gap-2">
              <div className="bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-2xs flex items-center gap-1.5">
                <span>MPI AI Active</span>
              </div>
              <button
                onClick={() =>
                  alert("Report downloaded successfully in PDF format.")
                }
                className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-medium px-4 py-2 rounded-full shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export AI Briefing
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 3D Visualizer & Prompt Studio */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Visualizer Card */}
            <div className="neo-card-sage p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#051F16] animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Generative AI Engine Active
                  </span>
                </div>
                <span className="text-[11px] font-medium bg-white/70 px-2 py-0.5 rounded-full text-stone-600">
                  v3.8 Multi-Factor
                </span>
              </div>

              <GenerativeMeshVisualizer
                isGenerating={isGenerating}
                className="my-2"
              />

              {/* Prompt Bar */}
              <div className="neo-citron-pill p-1.5 pl-4 flex items-center justify-between gap-3 shadow-xs">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="bg-transparent text-xs text-stone-900 outline-none w-full font-medium placeholder-stone-600"
                  placeholder="Ask AI anything about your procurement..."
                />
                <button
                  onClick={() => handleRunAnalysis()}
                  disabled={isGenerating}
                  className="w-8 h-8 rounded-full bg-black hover:bg-stone-800 text-white flex items-center justify-center shrink-0 shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  title="Run Prompt Analysis"
                >
                  {isGenerating ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Quick Prompts */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  "Compare supplier quality by tier",
                  "Predict Q4 raw material variance",
                  "Find idle CNC capacity",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setPrompt(q)
                      handleRunAnalysis(q)
                    }}
                    className="text-[10px] bg-white/60 hover:bg-white text-stone-700 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                  >
                    + {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Performance Stats in Sage Tint */}
            <div className="neo-card p-6">
              <h3 className="text-sm font-semibold text-stone-800 mb-4">
                Core AI Confidence Metrics
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span className="text-stone-600">
                      Model Precision & Match Accuracy
                    </span>
                    <span className="text-stone-900 font-bold">{confidenceMetric}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-stone-900 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(confidenceMetric, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span className="text-stone-600">
                      Supplier Capability Verification
                    </span>
                    <span className="text-stone-900 font-bold">98.1%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#051F16] rounded-full"
                      style={{ width: "98.1%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span className="text-stone-600">
                      Cost Savings Prediction Confidence
                    </span>
                    <span className="text-stone-900 font-bold">92.8%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: "92.8%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: In-Depth Synthesis & Actions */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Executive Analysis Card */}
            <div className="neo-card p-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-800">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900">
                      Synthesis Findings
                    </h3>
                    <p className="text-xs text-stone-500">
                      Synthesized from 90,744 transactions & 1,420 MSME audits
                    </p>
                  </div>
                </div>
                <span className="bg-[#FFF7D6] text-[#8C6B00] border border-yellow-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
                  {keyFinding}
                </span>
              </div>

              {isGenerating ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-stone-500 font-medium animate-pulse">
                    MPI AI synthesizing multi-factor procurement data...
                  </p>
                </div>
              ) : (
                <div
                  className="mt-4 space-y-4 text-xs md:text-sm text-stone-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: synthesisHtml }}
                />
              )}

              {/* Age & Segment Breakdown Bar in Details */}
              <div className="mt-6 pt-5 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/60">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-stone-700">
                      30–45 Demographic
                    </span>
                    <span className="text-[11px] font-bold text-stone-900 bg-[#E8F596] px-2 py-0.5 rounded-full">
                      3% Growth
                    </span>
                  </div>
                  <div className="text-lg font-bold text-stone-900">
                    34,200 Sales
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Represents 37.7% of total procurement order volume
                  </p>
                </div>

                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/60">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-stone-700">
                      18–30 Demographic
                    </span>
                    <span className="text-[11px] font-bold text-stone-900 bg-[#E8F596] px-2 py-0.5 rounded-full">
                      8% Growth
                    </span>
                  </div>
                  <div className="text-lg font-bold text-stone-900">
                    28,322 Sales
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Fastest accelerating customer tier over the last 4 quarters
                  </p>
                </div>
              </div>
            </div>

            {/* Strategic Action Items */}
            <div className="neo-card p-6">
              <h3 className="text-sm font-bold text-stone-900 mb-3">
                AI Recommended Strategic Actions
              </h3>
              <div className="space-y-3">
                {[
                  {
                    title:
                      "Expand Tier-1 MSME Allocations in Precision Machining",
                    desc: "Shift 15% of spot purchase orders to pre-negotiated annual contracts to lock in 4.8% price hedge.",
                    tag: "High Impact",
                    color: "text-[#8C6B00] bg-[#FFF7D6] border-yellow-300",
                  },
                  {
                    title: "Implement Automated RFQ Clustering for Packaging",
                    desc: "Group carton and label orders into bi-weekly batches to reduce freight and tooling setup charges.",
                    tag: "Quick Win",
                    color: "text-emerald-800 bg-emerald-50 border-emerald-200",
                  },
                  {
                    title:
                      "Audit Idle Machine Capacity in Southern Industrial Corridor",
                    desc: "Engage 18 verified CNC suppliers in Coimbatore & Peenya reporting >30% open machine hours.",
                    tag: "Capacity",
                    color: "text-amber-700 bg-amber-50 border-amber-200",
                  },
                ].map((act, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-3.5 rounded-2xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200/50 transition-all"
                  >
                    <div className="pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">
                          {act.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.color}`}
                        >
                          {act.tag}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">{act.desc}</p>
                    </div>
                    <button
                      onClick={() => alert(`Applied action: ${act.title}`)}
                      className="bg-white hover:bg-black hover:text-white border border-stone-200 text-stone-800 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all shrink-0 cursor-pointer shadow-xs"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BLUEPRINT: DEMAND & PRICE FORECASTING, RESILIENCE & SAVINGS (Items 49, 50, 56, 57) */}
        {/* ================================================================= */}
        <div className="mt-8 space-y-6 pt-8 border-t border-stone-200">
          {/* Section Header with Category Picker & AI Runner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#051F16] text-white px-2.5 py-0.5 rounded-full">
                  Blueprint Items 49, 50, 56, 57
                </span>
                <span className="text-xs font-bold text-stone-500">
                  Econometric Forecasting & Supply Chain Resilience
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 mt-1">
                Category Demand, Material Price Ranges & HHI Concentration
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Multi-quarter ML projections with uncertainty bands and deterministic savings vs cost avoidance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedMacroCategory}
                onChange={(e) => {
                  setSelectedMacroCategory(e.target.value)
                  handleRunMacroForecast(e.target.value)
                }}
                className="text-xs bg-stone-50 border border-stone-200 rounded-full px-3.5 py-2 font-semibold text-stone-800 outline-none focus:border-stone-900 cursor-pointer"
              >
                <option value="Corrugated Packaging & Paper">Corrugated Packaging & Paper</option>
                <option value="Precision CNC Machining">Precision CNC Machining</option>
                <option value="Injection Molded Polymers">Injection Molded Polymers</option>
                <option value="Electronics & PCBA Assembly">Electronics & PCBA Assembly</option>
                <option value="Sheet Metal Fabrication">Sheet Metal Fabrication</option>
              </select>

              <button
                type="button"
                onClick={() => handleRunMacroForecast()}
                disabled={isForecasting}
                className="bg-black hover:bg-stone-800 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isForecasting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Forecasting with MPI AI...</span>
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <span>Run AI Econometric Forecast</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4 Cards Grid for Items 49, 50, 56, 57 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Item 49: Demand Forecasting */}
            <div className="neo-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    <h3 className="text-sm font-bold text-stone-900">
                      Demand Forecasting (Item 49)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Quarterly ML Bands
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Category-level quarterly demand projection with historical seasonality adjustments and confidence intervals.
                </p>

                <div className="mt-4 space-y-3">
                  {macroForecast.demandForecast.map((df, i) => (
                    <div key={i} className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-900">{df.quarter}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#E8F596] text-stone-900 rounded-md">
                            +{df.growthRatePercent}% YoY
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          Confidence Band: <strong>{df.confidenceBand[0].toLocaleString("en-IN")} – {df.confidenceBand[1].toLocaleString("en-IN")}</strong> units
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold text-stone-900">
                          {df.projectedVolume.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-stone-400 font-medium">Projected Units</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
                <span>Model Calibration: ISO cluster telemetry</span>
                <span className="font-semibold text-stone-700">±6.8% Permissible Variance</span>
              </div>
            </div>

            {/* Item 50: Price Forecasting with Uncertainty Intervals */}
            <div className="neo-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-600" />
                    <h3 className="text-sm font-bold text-stone-900">
                      Raw Material Price Forecasting (Item 50)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-[#8C6B00] bg-[#FFF7D6] px-2 py-0.5 rounded-full border border-yellow-300">
                    Quality Gated
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Market raw material input prices with uncertainty bands. Orders flagged if quote exceeds high threshold.
                </p>

                <div className="mt-4 space-y-3">
                  {macroForecast.priceForecast.map((pf, i) => (
                    <div key={i} className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60 flex items-center justify-between">
                      <div className="max-w-[65%]">
                        <div className="text-xs font-bold text-stone-900 truncate">{pf.rawMaterial}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          Benchmark: <strong>₹{pf.currentBenchmark} {pf.unit}</strong> · Range: <strong>₹{pf.projectedRange[0]} – ₹{pf.projectedRange[1]}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            pf.trendDirection === "Softening"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : pf.trendDirection === "Stable"
                              ? "bg-emerald-50 text-blue-800 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {pf.trendDirection}
                        </span>
                        <div className="text-[10px] text-stone-400 mt-1">NCDEX / Sourcing Index</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
                <span>Data Quality Gate: Passed</span>
                <span className="font-semibold text-emerald-700">✓ Anomaly filters active</span>
              </div>
            </div>

            {/* Item 56: Supplier Concentration & Resilience (HHI) */}
            <div className="neo-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-600" />
                    <h3 className="text-sm font-bold text-stone-900">
                      Supplier Concentration & Resilience (Item 56)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    HHI Index: {macroForecast.supplierConcentration.hhiScore}
                  </span>
                </div>

                <div className="mt-4 p-4 rounded-2xl bg-stone-50 border border-stone-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-600 font-medium">Primary Supplier Spend Share:</span>
                    <span className="text-sm font-extrabold text-stone-900">
                      {macroForecast.supplierConcentration.primarySupplierSharePercent}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        macroForecast.supplierConcentration.primarySupplierSharePercent > 40
                          ? "bg-red-500"
                          : macroForecast.supplierConcentration.primarySupplierSharePercent > 25
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${macroForecast.supplierConcentration.primarySupplierSharePercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-500">Risk Assessment:</span>
                    <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {macroForecast.supplierConcentration.riskStatus}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-xs font-bold text-stone-800 block mb-2">
                    Recommended Diversification Clusters:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {macroForecast.supplierConcentration.recommendedAlternativeClusters.map((cluster, i) => (
                      <span
                        key={i}
                        className="text-xs bg-white border border-stone-200 px-3 py-1 rounded-full text-stone-700 font-medium shadow-2xs"
                      >
                        📍 {cluster}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500">
                Single-source alerts prevent disruption if one cluster experiences factory downtime.
              </div>
            </div>

            {/* Item 57: Savings & Impact Measurement (Deterministic vs Avoided) */}
            <div className="neo-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-stone-900">
                      Savings & Impact Measurement (Item 57)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Audit Certified
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Strict separation of verified realized savings, avoided cost inflation, and statutory grants claimed.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60">
                    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                      Verified Realized Savings
                    </span>
                    <div className="text-base font-extrabold text-emerald-700 mt-1">
                      ₹{macroForecast.savingsMeasurement.verifiedDeterministicSavings.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      Deterministic contract cuts
                    </span>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60">
                    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                      Avoided Costs
                    </span>
                    <div className="text-base font-extrabold text-emerald-800 mt-1">
                      ₹{macroForecast.savingsMeasurement.avoidedNegotiationCosts.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      Prevented quote inflation
                    </span>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60">
                    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                      Gov Subsidies Claimed
                    </span>
                    <div className="text-base font-extrabold text-[#8C6B00] mt-1">
                      ₹{macroForecast.savingsMeasurement.statutorySubsidiesClaimed.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      ZED & Design clinic grants
                    </span>
                  </div>

                  <div className="p-3 bg-stone-900 text-white rounded-2xl">
                    <span className="text-[10px] font-semibold text-stone-300 uppercase tracking-wider block">
                      Total Economic Value
                    </span>
                    <div className="text-base font-extrabold text-[#E8F596] mt-1">
                      ₹{macroForecast.savingsMeasurement.totalEconomicImpact.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      Combined platform ROI
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
                <span>Formula: Realized + Avoided + Statutory</span>
                <span className="font-semibold text-stone-700">Clean Boardroom Reporting</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 2. Total Sales & 90,744 Orders Deep-Dive Detail Page
// =============================================================
export function TotalSalesDetailPage({ goBack }: DetailPageProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const monthlyData = [
    { month: "Feb", sales: 9800, volume: 11200 },
    { month: "Mar", sales: 11400, volume: 12800 },
    { month: "Apr", sales: 12900, volume: 14100 },
    { month: "May", sales: 13800, volume: 15300 },
    { month: "Jun", sales: 16520, volume: 18400, highlight: true },
    { month: "Jul", sales: 14200, volume: 15900 },
    { month: "Aug", sales: 12124, volume: 13044 },
  ]

  const transactions = [
    {
      id: "ORD-98421",
      item: "Precision CNC Aluminum Brackets (Aircraft Grade)",
      client: "AeroDynamics Lab",
      amount: "₹14,80,000",
      qty: "2,400 pcs",
      status: "Delivered",
      date: "22 Aug 2024",
    },
    {
      id: "ORD-98418",
      item: "High-Density Corrugated Shipping Boxes (3-Ply)",
      client: "OmniPack Global",
      amount: "₹3,20,000",
      qty: "15,000 pcs",
      status: "In Transit",
      date: "21 Aug 2024",
    },
    {
      id: "ORD-98412",
      item: "Multilayer Printed Circuit Board Assemblies (PCBA)",
      client: "Nova IoT Systems",
      amount: "₹28,50,000",
      qty: "1,200 pcs",
      status: "Delivered",
      date: "19 Aug 2024",
    },
    {
      id: "ORD-98405",
      item: "Injection Molded Polymer Enclosures (IP67)",
      client: "ElectroCraft Tech",
      amount: "₹9,40,000",
      qty: "5,000 pcs",
      status: "Processing",
      date: "18 Aug 2024",
    },
    {
      id: "ORD-98399",
      item: "Industrial SS316 Flange & Fastener Sets",
      client: "HydroFlow Systems",
      amount: "₹6,15,000",
      qty: "800 sets",
      status: "Delivered",
      date: "16 Aug 2024",
    },
    {
      id: "ORD-98382",
      item: "Custom ZED Certified Solar Inverter Chassis",
      client: "SunPower CleanTech",
      amount: "₹22,10,000",
      qty: "650 units",
      status: "Delivered",
      date: "14 Aug 2024",
    },
  ]

  const filtered = transactions.filter(
    (t) =>
      t.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-6xl mx-auto">
        <DetailHeader
          folder="Sales & Orders"
          subfolder="Total Sales Breakdown"
          title="Total Sales & Procurement Order Ledger"
          subtitle="Itemized breakdown of 90,744 total units and ₹142.8 Cr in cumulative order fulfillment"
          onBack={goBack}
          actionButton={
            <div className="flex items-center gap-2">
              <button
                onClick={() => alert("Orders exported as CSV successfully.")}
                className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-medium px-4 py-2 rounded-full shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export CSV (90,744)
              </button>
            </div>
          }
        />

        {/* Top 4 KPI Metrics in White Neo Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="neo-card p-5">
            <span className="text-xs text-stone-500 font-medium">
              All-Time Units
            </span>
            <div className="text-2xl md:text-3xl font-extrabold text-stone-900 mt-1">
              90,744
            </div>
            <span className="text-[11px] font-semibold text-[#051F16] flex items-center gap-1 mt-1">
              ↑ +14.2% YoY
            </span>
          </div>

          <div className="neo-card p-5">
            <span className="text-xs text-stone-500 font-medium">
              Peak Month (June)
            </span>
            <div className="text-2xl md:text-3xl font-extrabold text-stone-900 mt-1">
              16,520
            </div>
            <span className="text-[11px] font-semibold text-stone-500 mt-1">
              Record fulfillment
            </span>
          </div>

          <div className="neo-card p-5">
            <span className="text-xs text-stone-500 font-medium">
              Average Order Value
            </span>
            <div className="text-2xl md:text-3xl font-extrabold text-stone-900 mt-1">
              ₹1.57 Lakh
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 mt-1">
              Stable margin
            </span>
          </div>

          <div className="neo-card p-5">
            <span className="text-xs text-stone-500 font-medium">
              Fulfillment SLA
            </span>
            <div className="text-2xl md:text-3xl font-extrabold text-stone-900 mt-1">
              98.6%
            </div>
            <span className="text-[11px] font-semibold text-[#051F16] mt-1">
              On-time delivery
            </span>
          </div>
        </div>

        {/* Full Interactive Chart */}
        <div className="neo-card p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Monthly Order Distribution
              </h3>
              <p className="text-xs text-stone-500">
                Visualizing units procured per calendar month across verified
                suppliers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-3 py-1 rounded-full">
                Highlight: June (16,520)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barSize={36}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748B" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748B" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(237, 241, 237, 0.6)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-stone-900 text-white p-2.5 rounded-xl shadow-lg text-xs">
                          <p className="font-bold">
                            {payload[0].payload.month}
                          </p>
                          <p className="text-[#A3F65C] font-bold">
                            {payload[0].value} units
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="sales" radius={[18, 18, 18, 18]} fill="#CBD5E1">
                  {monthlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.highlight ? "#1E293B" : "#CBD5E1"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Search & Transaction Table */}
        <div className="neo-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-stone-100">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Recent Purchase Orders
              </h3>
              <p className="text-xs text-stone-500">
                Real-time settlement status from the MPI escrow system
              </p>
            </div>

            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="Search orders, suppliers, items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 rounded-full text-xs border border-stone-200 focus:outline-none focus:border-stone-900 transition-colors"
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-3 top-2.5 text-stone-400"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-xs min-w-[620px]">
              <thead>
                <tr className="border-b border-stone-200/80 text-stone-500">
                  <th className="pb-3 font-semibold">Order ID</th>
                  <th className="pb-3 font-semibold">Procured Item</th>
                  <th className="pb-3 font-semibold">Buyer / Client</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Volume</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-stone-50/70 transition-colors"
                  >
                    <td className="py-3 font-mono font-medium text-stone-900">
                      {row.id}
                    </td>
                    <td className="py-3 font-medium text-stone-800 max-w-xs truncate">
                      {row.item}
                    </td>
                    <td className="py-3 text-stone-600">{row.client}</td>
                    <td className="py-3 font-bold text-stone-900">
                      {row.amount}
                    </td>
                    <td className="py-3 text-stone-600">{row.qty}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          row.status === "Delivered"
                            ? "bg-[#FFF7D6] text-[#8C6B00] border border-yellow-300"
                            : row.status === "In Transit"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 text-stone-500">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 3. Comparison of Revenue Detail Page (35,40M)
// =============================================================
export function RevenueComparisonDetailPage({ goBack }: DetailPageProps) {
  const comparisonData = [
    { month: "Jan", y2022: 24, y2023: 26, savings: 2.0 },
    { month: "Feb", y2022: 25, y2023: 28, savings: 3.0 },
    { month: "Mar", y2022: 27, y2023: 31, savings: 4.0 },
    { month: "Apr", y2022: 29, y2023: 33, savings: 4.0 },
    { month: "May", y2022: 30, y2023: 34, savings: 4.0 },
    { month: "Jun", y2022: 31, y2023: 35.4, savings: 4.4 },
    { month: "Jul", y2022: 32, y2023: 35.1, savings: 3.1 },
    { month: "Aug", y2022: 33, y2023: 35.4, savings: 2.4 },
  ]

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-6xl mx-auto">
        <DetailHeader
          folder="Finance"
          subfolder="Revenue & Budget Variance"
          title="Comparison of Revenue & Cost Efficiency"
          subtitle="In-depth comparative analysis between FY 2022 and FY 2023 across 35.40M cumulative volume"
          onBack={goBack}
        />

        {/* Highlight Card in Soft Ice Blue */}
        <div className="neo-card-ice p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
                All-Time Cumulative Revenue
              </span>
              <div className="text-3xl md:text-5xl font-extrabold text-stone-900 mt-1">
                35,40M
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-[#E8F596] text-stone-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  +5% YoY Variance
                </span>
                <span className="text-xs text-stone-600">
                  Generated ₹4.2M in bulk MSME procurement savings
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/70 p-2 rounded-2xl border border-stone-200/50">
              <div className="text-right px-3 border-r border-stone-200">
                <div className="text-[11px] text-stone-500">2022 Benchmark</div>
                <div className="text-sm font-bold text-stone-800">31.20M</div>
              </div>
              <div className="text-left px-3">
                <div className="text-[11px] text-stone-500">2023 Current</div>
                <div className="text-sm font-bold text-stone-900">35.40M</div>
              </div>
            </div>
          </div>
        </div>

        {/* Dual Band Area Curve */}
        <div className="neo-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Comparative Revenue Trajectory
              </h3>
              <p className="text-xs text-stone-500">
                2022 vs 2023 monthly revenue bands with shaded margin difference
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-stone-700">
                <span className="w-3 h-3 rounded-full bg-emerald-600" /> 2023
                Actual
              </span>
              <span className="flex items-center gap-1.5 font-medium text-stone-500">
                <span className="w-3 h-3 rounded-full bg-stone-300" /> 2022
                Baseline
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={comparisonData}>
                <defs>
                  <linearGradient id="color2023" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748B" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748B" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-stone-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                          <p className="font-bold">
                            {payload[0].payload.month}
                          </p>
                          <p className="text-blue-400">
                            2023: {payload[1]?.value}M
                          </p>
                          <p className="text-stone-400">
                            2022: {payload[0]?.value}M
                          </p>
                          <p className="text-[#E8F596]">
                            Savings: +{payload[0].payload.savings}M
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="y2022"
                  stroke="#94A3B8"
                  strokeWidth={2}
                  fill="#F1F5F9"
                />
                <Area
                  type="monotone"
                  dataKey="y2023"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#color2023)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Decomposition */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="neo-card p-5">
            <h4 className="text-xs font-semibold text-stone-500 uppercase">
              Hardware & Robotics
            </h4>
            <div className="text-xl font-bold text-stone-900 mt-1">₹18.4M</div>
            <p className="text-xs text-stone-500 mt-1">
              52% of total spend. 8.4% cost reduction via tier-1 suppliers.
            </p>
          </div>

          <div className="neo-card p-5">
            <h4 className="text-xs font-semibold text-stone-500 uppercase">
              Specialized Tooling
            </h4>
            <div className="text-xl font-bold text-stone-900 mt-1">₹11.2M</div>
            <p className="text-xs text-stone-500 mt-1">
              31% of total spend. Fast turnaround on custom jigs & fixtures.
            </p>
          </div>

          <div className="neo-card p-5">
            <h4 className="text-xs font-semibold text-stone-500 uppercase">
              Packaging & Logistics
            </h4>
            <div className="text-xl font-bold text-stone-900 mt-1">₹5.8M</div>
            <p className="text-xs text-stone-500 mt-1">
              17% of total spend. Sustainable carton & box procurement.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 4. Sales Trend & 21 Pivot Points Detail Page
// =============================================================
export function SalesTrendDetailPage({ goBack }: DetailPageProps) {
  const trendData = [
    { point: 1, val: 0.12, date: "1 Feb" },
    { point: 2, val: 0.22, date: "5 Feb" },
    { point: 3, val: 0.15, date: "10 Feb" },
    { point: 4, val: 0.38, date: "15 Feb" },
    { point: 5, val: 0.28, date: "20 Feb" },
    { point: 6, val: 0.45, date: "1 Mar" },
    { point: 7, val: 0.32, date: "10 Mar" },
    { point: 8, val: 0.58, date: "20 Mar" },
    { point: 9, val: 0.42, date: "1 Apr" },
    { point: 10, val: 0.65, date: "15 Apr" },
    { point: 11, val: 0.48, date: "1 May" },
    { point: 12, val: 0.62, date: "15 May" },
    { point: 13, val: 0.52, date: "1 Jun" },
    { point: 14, val: 0.7, date: "15 Jun", highlight: true }, // Peak 10,230
    { point: 15, val: 0.58, date: "20 Jun" },
    { point: 16, val: 0.45, date: "1 Jul" },
    { point: 17, val: 0.52, date: "15 Jul" },
    { point: 18, val: 0.38, date: "1 Aug" },
    { point: 19, val: 0.48, date: "10 Aug" },
    { point: 20, val: 0.35, date: "18 Aug" },
    { point: 21, val: 0.42, date: "25 Aug" },
  ]

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-6xl mx-auto">
        <DetailHeader
          folder="Analytics"
          subfolder="Statistical Volatility"
          title="Sales Trend & Volatility Modeling"
          subtitle="Algorithmic spline analysis tracking 21 pivot points and market demand sensitivity"
          onBack={goBack}
        />

        {/* 5 Stats Strip matching the card */}
        <div className="neo-card p-5 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center divide-y sm:divide-y-0 sm:divide-x divide-stone-200/60">
            <div>
              <span className="text-xs text-stone-500">Pivot Points</span>
              <div className="text-xl font-bold text-stone-900 mt-1">21</div>
            </div>
            <div>
              <span className="text-xs text-stone-500">Minimum</span>
              <div className="text-xl font-bold text-stone-900 mt-1">0.0</div>
            </div>
            <div>
              <span className="text-xs text-stone-500">Maximum</span>
              <div className="text-xl font-bold text-stone-900 mt-1">0.7</div>
            </div>
            <div>
              <span className="text-xs text-stone-500">Median</span>
              <div className="text-xl font-bold text-stone-900 mt-1">0.1</div>
            </div>
            <div>
              <span className="text-xs text-stone-500">Average</span>
              <div className="text-xl font-bold text-stone-900 mt-1">0.1</div>
            </div>
          </div>
        </div>

        {/* Wave Spline Chart */}
        <div className="neo-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Summary Statistics & Wave Spline
              </h3>
              <p className="text-xs text-stone-500">
                Peak observed on 15 Jun with 10,230 index value
              </p>
            </div>
            <span className="bg-[#E8F596] text-stone-900 text-xs font-bold px-3 py-1 rounded-full">
              Peak: 10,230 (15 Jun)
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-stone-900 text-white p-2.5 rounded-xl shadow-lg text-xs">
                          <p className="font-bold">{payload[0].payload.date}</p>
                          <p className="text-[#FFF7D6] font-bold">
                            Index: {payload[0].value}
                          </p>
                          {payload[0].payload.highlight && (
                            <p className="text-[#A3F65C] font-bold">
                              10,230 Max Peak
                            </p>
                          )}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line
                  type="natural"
                  dataKey="val"
                  stroke="#0F172A"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#0F172A" }}
                  activeDot={{
                    r: 6,
                    fill: "#A3F65C",
                    stroke: "#0F172A",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Scrubber Gradient Line */}
          <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <span>Low Volatility Zone</span>
            <div className="w-1/2 h-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-600 to-[#051F16]" />
            <span>Optimal Procurement Band</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 5. Age Range / Sector Breakdown Detail Page (40% Highlight)
// =============================================================
export function AgeRangeDetailPage({ goBack }: DetailPageProps) {
  const ageData = [
    { name: "0–18", value: 5, color: "#FDA4AF" },
    { name: "18–30", value: 25, color: "#CBD5E1" },
    { name: "30–45", value: 40, color: "#E8F596", highlight: true }, // 40% dominant
    { name: "45–60", value: 20, color: "#7DD3FC" },
    { name: "60–75", value: 10, color: "#86EFAC" },
  ]

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-6xl mx-auto">
        <DetailHeader
          folder="Demographics"
          subfolder="Audience Segmentation"
          title="Age Range & Demographic Breakdown"
          subtitle="Segment analysis revealing the 40% majority market share in the 30–45 age cohort"
          onBack={goBack}
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Donut Chart Card */}
          <div className="md:col-span-6 neo-card p-6 flex flex-col items-center justify-center">
            <h3 className="text-base font-bold text-stone-900 mb-2 self-start">
              Distribution by Age Segment
            </h3>
            <div className="w-full h-64 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {ageData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-stone-900 text-white p-2 rounded-lg text-xs">
                            <span className="font-bold">
                              {payload[0].name}:{" "}
                            </span>
                            <span>{payload[0].value}%</span>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Highlight Tag in center or floating */}
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-stone-900">
                  40%
                </span>
                <span className="text-[10px] uppercase font-bold text-stone-500">
                  Dominant
                </span>
              </div>
            </div>

            {/* Legend Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {ageData.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center gap-1.5 text-xs bg-stone-50 px-3 py-1 rounded-full border border-stone-200/60"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-stone-700 font-medium">{d.name}</span>
                  <span className="text-stone-900 font-bold">({d.value}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown Insights */}
          <div className="md:col-span-6 neo-card p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 mb-3">
                Key Demographics Takeaways
              </h3>
              <div className="space-y-3 text-xs md:text-sm text-stone-600">
                <p>
                  The{" "}
                  <strong className="text-stone-900 font-bold">
                    30–45 age bracket
                  </strong>{" "}
                  represents{" "}
                  <strong className="text-stone-900 font-bold">
                    40% of all buying decisions
                  </strong>{" "}
                  on the platform. This group prioritizes ISO certification,
                  verified delivery SLAs, and verified machinery capacity over
                  raw price discounting.
                </p>
                <p>
                  The fastest-growing segment is the{" "}
                  <strong className="text-stone-900 font-bold">
                    18–30 age cohort
                  </strong>{" "}
                  at 25% share, surging 8% year-over-year, driven by startup
                  founders and hardware engineering leads.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-800 uppercase">
                Recommended Positioning
              </span>
              <p className="text-xs text-stone-500 mt-1">
                Align RFQ templates to highlight engineering precision
                tolerances for the 30–45 group, while offering instant AI
                matching for early-stage prototype founders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 6. + Add Widget Studio Page
// =============================================================
export function AddWidgetStudioPage({ goBack }: DetailPageProps) {
  const [widgets, setWidgets] = useState([
    {
      id: "cash-flow",
      title: "Cash Flow Velocity",
      desc: "Real-time liquidity and milestone payout cycle time across escrow accounts.",
      active: true,
      tag: "Finance",
    },
    {
      id: "lead-time",
      title: "Supplier Lead Time Index",
      desc: "Average turnaround from PO generation to factory gate dispatch.",
      active: true,
      tag: "Operations",
    },
    {
      id: "cluster-map",
      title: "Geographic Density Heatmap",
      desc: "Interactive map displaying verified MSME machine shops across India.",
      active: false,
      tag: "Supply Chain",
    },
    {
      id: "esg-score",
      title: "ESG & ZED Green Compliance",
      desc: "Zero Defect Zero Effect (ZED) certification rating distribution.",
      active: true,
      tag: "Sustainability",
    },
    {
      id: "dispute-rate",
      title: "Dispute & Arbitration Rate",
      desc: "Ratio of disputed procurement orders settled via smart mediation.",
      active: false,
      tag: "Governance",
    },
    {
      id: "machine-uptime",
      title: "Real-Time Machine Uptime",
      desc: "Live IoT telemetry indicating open CNC, VMC, and lathe machine hours.",
      active: false,
      tag: "Manufacturing",
    },
  ])

  const toggleWidget = (id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w)),
    )
  }

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-5xl mx-auto">
        <DetailHeader
          folder="Dashboard"
          subfolder="Customization"
          title="Add & Configure Dashboard Widgets"
          subtitle="Customize your executive workspace with modular real-time procurement intelligence components"
          onBack={goBack}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {widgets.map((w) => (
            <div
              key={w.id}
              className="neo-card p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full">
                    {w.tag}
                  </span>
                  <button
                    onClick={() => toggleWidget(w.id)}
                    className={`text-xs font-semibold px-3 py-1 rounded-full cursor-pointer transition-all ${
                      w.active
                        ? "bg-black text-white"
                        : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {w.active ? "✓ Added to Dashboard" : "+ Add Widget"}
                  </button>
                </div>
                <h3 className="text-base font-bold text-stone-900 mt-2">
                  {w.title}
                </h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  {w.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                <span>Update Frequency: Real-Time</span>
                <span>Type: Metric & Chart</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 7. Create a Report Page
// =============================================================
export function CreateReportPage({ goBack }: DetailPageProps) {
  const [reportType, setReportType] = useState("Executive Procurement Audit")
  const [format, setFormat] = useState("PDF")
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownload = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      alert(
        `Report "${reportType}" successfully generated and downloaded as ${format}!`,
      )
    }, 1200)
  }

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-4xl mx-auto">
        <DetailHeader
          folder="Reporting"
          subfolder="Export Studio"
          title="Create & Export Platform Report"
          subtitle="Generate audit-ready procurement dossiers, financial variance reports, and compliance certificates"
          onBack={goBack}
        />

        <div className="neo-card p-6 md:p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                1. Select Report Template
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  "Executive Procurement Audit",
                  "Cost Savings & Rebate Analysis",
                  "Supplier Due Diligence & KYC Dossier",
                  "Carbon Footprint & ESG Scorecard",
                ].map((t) => (
                  <button
                    key={t}
                    onClick={() => setReportType(t)}
                    className={`p-3.5 rounded-2xl text-left border text-xs font-semibold transition-all cursor-pointer ${
                      reportType === t
                        ? "bg-black text-white border-black shadow-sm"
                        : "bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200/80"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                2. Export Format
              </label>
              <div className="flex gap-3">
                {[
                  "PDF (Audit Ready)",
                  "Excel (XLSX)",
                  "CSV (Raw Data)",
                  "JSON (API)",
                ].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f.split(" ")[0])}
                    className={`px-4 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      format === f.split(" ")[0]
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Preview Box */}
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200/80">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <span className="text-xs font-bold text-stone-700">
                  Preview: {reportType}
                </span>
                <span className="text-[11px] font-mono text-stone-400">
                  MPI-REPORT-2024-Q3
                </span>
              </div>
              <div className="mt-3 text-xs text-stone-600 space-y-2">
                <p>• Period Covered: 24.04.2023 to 24.04.2024</p>
                <p>• Cumulative Volume Audited: 90,744 units (₹142.8 Cr)</p>
                <p>
                  • Verified MSMEs Evaluated: 1,420 suppliers across 7
                  manufacturing categories
                </p>
                <p>
                  • Digital Hash Signature:{" "}
                  <code className="bg-stone-200 px-1 py-0.5 rounded text-[10px]">
                    sha256:4a8b...f91c
                  </code>
                </p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="w-full bg-black hover:bg-stone-800 text-white font-bold py-3.5 px-6 rounded-full text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Dossier...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Generate & Download {format} Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 8. Pulse Live Market Feed Page
// =============================================================
export function PulseLiveFeedPage({ goBack }: DetailPageProps) {
  const tickerItems = [
    {
      title: "Aluminum 6061-T6 Spot Price",
      change: "+1.2%",
      trend: "up",
      price: "₹224 / kg",
      time: "2m ago",
    },
    {
      title: "Stainless Steel SS316 Rolled Sheet",
      change: "-0.4%",
      trend: "down",
      price: "₹312 / kg",
      time: "5m ago",
    },
    {
      title: "Copper Cathode High Purity",
      change: "+2.8%",
      trend: "up",
      price: "₹748 / kg",
      time: "8m ago",
    },
    {
      title: "Polypropylene Copolymer Resin",
      change: "-1.1%",
      trend: "down",
      price: "₹118 / kg",
      time: "14m ago",
    },
  ]

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-6xl mx-auto">
        <DetailHeader
          folder="Live Intelligence"
          subfolder="Market Ticker"
          title="Market Pulse & Real-Time Commodities Feed"
          subtitle="Streaming price movements, supplier capacity heartbeats, and raw material volatility signals"
          onBack={goBack}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {tickerItems.map((t) => (
            <div key={t.title} className="neo-card p-5">
              <span className="text-[11px] text-stone-500 font-medium">
                {t.title}
              </span>
              <div className="text-xl font-extrabold text-stone-900 mt-1">
                {t.price}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span
                  className={`font-bold ${
                    t.trend === "up" ? "text-[#051F16]" : "text-rose-600"
                  }`}
                >
                  {t.change}
                </span>
                <span className="text-stone-400 text-[10px]">{t.time}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="neo-card p-6">
          <h3 className="text-base font-bold text-stone-900 mb-4">
            Live Procurement Tender Activity Stream
          </h3>
          <div className="space-y-3">
            {[
              {
                rfq: "RFQ-8924: 5,000 units CNC Turned Shafts",
                budget: "₹18.5 Lakh",
                bids: "7 Verified Bids",
                status: "Bidding Active",
              },
              {
                rfq: "RFQ-8921: 12,000 sets Eco-friendly Packaging Cartons",
                budget: "₹4.2 Lakh",
                bids: "11 Verified Bids",
                status: "Reviewing Quotes",
              },
              {
                rfq: "RFQ-8919: 1,500 units IoT Gateway Metal Enclosures",
                budget: "₹14.8 Lakh",
                bids: "4 Verified Bids",
                status: "PO Dispatched",
              },
            ].map((item) => (
              <div
                key={item.rfq}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-stone-900">
                    {item.rfq}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-stone-500 mt-1">
                    <span>
                      Budget:{" "}
                      <strong className="text-stone-800">{item.budget}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">
                      {item.bids}
                    </span>
                  </div>
                </div>
                <span className="bg-[#FFF7D6] text-[#8C6B00] border border-yellow-300 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 9. Data Catalog & MSME Directory Page
// =============================================================
export function DataCatalogPage({ goBack }: DetailPageProps) {
  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-6xl mx-auto">
        <DetailHeader
          folder="Data Vault"
          subfolder="Supplier Registry"
          title="MPI Data Explorer & Supplier Registry"
          subtitle="Directory of 1,420+ verified MSMEs, machinery capabilities, and certified industrial capacity"
          onBack={goBack}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="neo-card p-5">
            <span className="text-xs text-stone-500 font-medium">
              Registered MSMEs
            </span>
            <div className="text-3xl font-extrabold text-stone-900 mt-1">
              1,420
            </div>
            <span className="text-xs text-[#051F16] font-bold">
              100% ZED / ISO Audited
            </span>
          </div>

          <div className="neo-card p-5">
            <span className="text-xs text-stone-500 font-medium">
              Precision Machines Cataloged
            </span>
            <div className="text-3xl font-extrabold text-stone-900 mt-1">
              4,890
            </div>
            <span className="text-xs text-stone-500">
              CNC, VMC, EDM, Extrusion
            </span>
          </div>

          <div className="neo-card p-5">
            <span className="text-xs text-stone-500 font-medium">
              Export Compliance Ready
            </span>
            <div className="text-3xl font-extrabold text-stone-900 mt-1">
              94.8%
            </div>
            <span className="text-xs text-emerald-700 font-semibold">
              Ready for Global Sourcing
            </span>
          </div>
        </div>

        <div className="neo-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-stone-900">
              Featured Certified Machine Suppliers
            </h3>
            <button
              onClick={() => alert("Dataset export initiated (JSON/CSV).")}
              className="bg-black text-white text-xs font-semibold px-4 py-2 rounded-full cursor-pointer shadow-xs"
            >
              Export Complete Dataset
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                name: "PrecisionCraft CNC Solutions",
                loc: "Peenya, Bengaluru",
                spec: "5-Axis VMC, Wire EDM, ±5 micron tolerance",
                cert: "ISO 9001:2015, AS9100",
              },
              {
                name: "Apex Polymer Molders & Tooling",
                loc: "Hosur Industrial Complex",
                spec: "Plastic Injection Molding, 50T - 650T presses",
                cert: "ZED Gold, ISO 14001",
              },
              {
                name: "Bharat Die-Cast & Extrusion Ltd",
                loc: "Coimbatore Foundry Cluster",
                spec: "High-pressure aluminum die-casting",
                cert: "IATF 16949, ISO 9001",
              },
            ].map((s) => (
              <div
                key={s.name}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-stone-900">{s.name}</h4>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {s.loc} •{" "}
                    <span className="text-stone-800 font-medium">{s.spec}</span>
                  </p>
                </div>
                <span className="bg-white border border-stone-200 text-stone-800 text-[11px] font-semibold px-3 py-1 rounded-full">
                  {s.cert}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 10. Shared & Team Collaboration Page
// =============================================================
export function SharedTeamPage({ goBack }: DetailPageProps) {
  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-4xl mx-auto">
        <DetailHeader
          folder="Workspace"
          subfolder="Collaboration"
          title="Team Members & Shared Access"
          subtitle="Manage workspace permissions, invite team analysts, and configure shared procurement dashboards"
          onBack={goBack}
        />

        <div className="neo-card p-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Active Workspace Members (6)
              </h3>
              <p className="text-xs text-stone-500">
                Collaborating on Product Sales Performance & Sourcing
              </p>
            </div>
            <button
              onClick={() =>
                alert(
                  "Invite link copied to clipboard: https://mpi.procure/workspace/invite?token=49af1",
                )
              }
              className="bg-black text-white text-xs font-semibold px-4 py-2 rounded-full cursor-pointer shadow-xs"
            >
              + Invite Colleague
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                name: "Sarah Chen",
                role: "Head of Procurement",
                email: "sarah@aerodynamics.io",
                badge: "Owner",
              },
              {
                name: "Michael Davies",
                role: "Lead Hardware Engineer",
                email: "michael@aerodynamics.io",
                badge: "Admin",
              },
              {
                name: "Elena Rostova",
                role: "Financial Sourcing Analyst",
                email: "elena@aerodynamics.io",
                badge: "Editor",
              },
              {
                name: "Rajesh Nair",
                role: "Supply Chain Compliance Officer",
                email: "rajesh@aerodynamics.io",
                badge: "Viewer",
              },
            ].map((m) => (
              <div
                key={m.email}
                className="p-3.5 rounded-2xl bg-stone-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-stone-200 font-bold text-xs flex items-center justify-center text-stone-700">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">
                      {m.name}
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      {m.role} • {m.email}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold bg-white border border-stone-200 text-stone-800 px-3 py-1 rounded-full">
                  {m.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 11. Notifications Page
// =============================================================
export function NotificationsPage({ goBack }: DetailPageProps) {
  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-4xl mx-auto">
        <DetailHeader
          folder="System"
          subfolder="Activity"
          title="Notifications & Alerts"
          subtitle="Real-time order milestone updates, supplier bids, and verification audit notifications"
          onBack={goBack}
        />

        <div className="neo-card p-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
            <h3 className="text-base font-bold text-stone-900">
              Recent Notifications
            </h3>
            <button
              onClick={() => alert("All notifications marked as read.")}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Mark all as read
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                title: "New Quotation Received",
                desc: "Apex Polymer submitted a quote for RFQ-98405 (₹9.40 Lakh).",
                time: "10m ago",
                unread: true,
              },
              {
                title: "Milestone Escrow Released",
                desc: "₹14.80 Lakh released to PrecisionCraft CNC following QA acceptance.",
                time: "1h ago",
                unread: false,
              },
              {
                title: "Supplier Audit Approved",
                desc: "Bharat Die-Cast ZED Gold certification verified by auditor.",
                time: "3h ago",
                unread: false,
              },
            ].map((n, i) => (
              <div
                key={i}
                className={`p-4 rounded-2xl border transition-all ${
                  n.unread
                    ? "bg-[#E8F596]/30 border-[#E8F596]"
                    : "bg-stone-50 border-stone-200/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-900">
                    {n.title}
                  </h4>
                  <span className="text-[11px] text-stone-400">{n.time}</span>
                </div>
                <p className="text-xs text-stone-600 mt-1">{n.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 12. Messages / Negotiations Page
// =============================================================
export function MessagesPage({ goBack }: DetailPageProps) {
  const [messages, setMessages] = useState([
    {
      sender: "PrecisionCraft CNC",
      text: "We have updated the tooling estimate with a 5% volume discount for 2,400 brackets.",
      time: "11:20 AM",
      isMe: false,
    },
    {
      sender: "You",
      text: "Thank you. Can you confirm if delivery can be accelerated to 18 days?",
      time: "11:25 AM",
      isMe: true,
    },
    {
      sender: "PrecisionCraft CNC",
      text: "Yes, if the raw material batch is approved today, we can expedite dispatch by Friday.",
      time: "11:28 AM",
      isMe: false,
    },
  ])
  const [inputText, setInputText] = useState("")

  const sendMessage = () => {
    if (!inputText.trim()) return
    setMessages((prev) => [
      ...prev,
      { sender: "You", text: inputText, time: "Just now", isMe: true },
    ])
    setInputText("")
  }

  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-4xl mx-auto">
        <DetailHeader
          folder="Communication"
          subfolder="Supplier Chat"
          title="Direct Supplier Negotiations"
          subtitle="Secure real-time negotiation channel with verified MSME manufacturers"
          onBack={goBack}
        />

        <div className="neo-card p-6 flex flex-col h-[520px]">
          {/* Chat Header */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#051F16] text-white font-bold flex items-center justify-center text-xs">
                PC
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  PrecisionCraft CNC Solutions
                </h3>
                <span className="text-[10px] text-[#051F16] font-semibold">
                  ● Online • Verified MSME
                </span>
              </div>
            </div>
            <button
              onClick={() => alert("Creating formal quotation amendment...")}
              className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer"
            >
              Amend Quotation
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  m.isMe ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                    m.isMe
                      ? "bg-black text-white rounded-br-xs"
                      : "bg-stone-100 text-stone-900 rounded-bl-xs"
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-stone-400 mt-1 px-1">
                  {m.time}
                </span>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="pt-3 border-t border-stone-100 flex items-center gap-2">
            <input
              type="text"
              placeholder="Type quotation message or request terms..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-full px-4 py-2.5 text-xs outline-none focus:border-stone-900"
            />
            <button
              onClick={sendMessage}
              className="bg-black hover:bg-stone-800 text-white text-xs font-semibold px-5 py-2.5 rounded-full cursor-pointer shadow-xs"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 13. Documents / Compliance Vault Page
// =============================================================
export function DocumentsPage({ goBack }: DetailPageProps) {
  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-4xl mx-auto">
        <DetailHeader
          folder="Compliance"
          subfolder="Audit Archive"
          title="Compliance & Audit Document Vault"
          subtitle="Encrypted repository of verified ISO certificates, GST filings, and QA audit dossiers"
          onBack={goBack}
        />

        <div className="neo-card p-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
            <h3 className="text-base font-bold text-stone-900">
              Verified Compliance Records
            </h3>
            <button
              onClick={() =>
                alert("Upload dialog opened. Please select PDF or TIFF.")
              }
              className="bg-black text-white text-xs font-semibold px-4 py-2 rounded-full cursor-pointer shadow-xs"
            >
              + Upload Compliance Doc
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                title: "ISO 9001:2015 Quality Management Certificate",
                issuer: "TÜV SÜD South Asia",
                expiry: "Expires Oct 2026",
                verified: true,
              },
              {
                title: "ZED Gold Sustainable Manufacturing Certification",
                issuer: "Ministry of MSME, Govt of India",
                expiry: "Active",
                verified: true,
              },
              {
                title: "Standard Mutual Non-Disclosure Agreement (NDA)",
                issuer: "MPI Legal Framework",
                expiry: "Indefinite",
                verified: true,
              },
              {
                title: "Material Test Reports (MTR) SS316 Batch #849",
                issuer: "National Testing House (NTH)",
                expiry: "Batch Verified",
                verified: true,
              },
            ].map((d, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-stone-900">
                    {d.title}
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {d.issuer} • {d.expiry}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#FFF7D6] text-[#8C6B00] border border-yellow-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Verified
                  </span>
                  <button
                    onClick={() =>
                      alert(`Downloading verified copy of ${d.title}`)
                    }
                    className="w-7 h-7 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-100 cursor-pointer shadow-2xs"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 14. 24/7 Concierge Support Page
// =============================================================
export function SupportPage({ goBack }: DetailPageProps) {
  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-4xl mx-auto">
        <DetailHeader
          folder="Support"
          subfolder="Helpdesk"
          title="24/7 Procurement Concierge & Support"
          subtitle="Direct escalation channel with senior procurement specialists and technical tooling engineers"
          onBack={goBack}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="neo-card p-6">
            <h3 className="text-base font-bold text-stone-900 mb-2">
              Live Concierge Helpdesk
            </h3>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              Connect directly with an MPI sourcing advisor to resolve
              manufacturing tolerance questions or expedited delivery terms.
            </p>
            <div className="space-y-2 text-xs text-stone-700 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#051F16]" />
                <span>
                  Average Response Time: <strong>&lt; 3 minutes</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  Dedicated Technical Escalation: <strong>Available</strong>
                </span>
              </div>
            </div>
            <button
              onClick={() =>
                alert("Initiating live call with Sourcing Concierge...")
              }
              className="w-full bg-black text-white font-bold py-3 rounded-full text-xs shadow-xs hover:bg-stone-800 cursor-pointer"
            >
              Start Live Concierge Call
            </button>
          </div>

          <div className="neo-card p-6">
            <h3 className="text-base font-bold text-stone-900 mb-2">
              Frequently Asked Inquiries
            </h3>
            <div className="space-y-3 text-xs">
              <details className="p-3 rounded-xl bg-stone-50 border border-stone-200/60 cursor-pointer">
                <summary className="font-semibold text-stone-800">
                  How does MPI guarantee supplier delivery SLAs?
                </summary>
                <p className="text-stone-600 mt-2">
                  All payments are held in escrow and released in phases upon
                  physical quality inspection verification.
                </p>
              </details>
              <details className="p-3 rounded-xl bg-stone-50 border border-stone-200/60 cursor-pointer">
                <summary className="font-semibold text-stone-800">
                  What if parts fail tolerance inspection?
                </summary>
                <p className="text-stone-600 mt-2">
                  Suppliers are bound by contract to replace non-conforming lots
                  within 5 business days or release a full refund.
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// 15. User & Organization Profile Page
// =============================================================
export function AccountProfilePage({ goBack }: DetailPageProps) {
  return (
    <div className="neo-bento-shell p-3 sm:p-5 md:p-8 safe-top safe-bottom pb-16">
      <div className="max-w-3xl mx-auto">
        <DetailHeader
          folder="Account"
          subfolder="Organization"
          title="Organization & Procurement Profile"
          subtitle="Manage buyer credentials, tax registrations, and verified spending authorizations"
          onBack={goBack}
        />

        <div className="neo-card p-6">
          <div className="flex items-center gap-4 pb-6 border-b border-stone-100">
            <div className="w-16 h-16 rounded-full bg-stone-900 text-white font-bold text-xl flex items-center justify-center shadow-sm">
              AD
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                AeroDynamics Technologies Ltd
              </h3>
              <p className="text-xs text-stone-500">
                Tier-1 Enterprise Buyer • Verified Account
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-xs">
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/60">
              <span className="text-stone-500">Corporate GSTIN</span>
              <div className="font-mono font-bold text-stone-900 mt-0.5">
                29AAAAA0000A1Z5
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/60">
              <span className="text-stone-500">
                Procurement Budget Allocation
              </span>
              <div className="font-bold text-stone-900 mt-0.5">
                ₹25.0 Crore (FY2024-25)
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/60">
              <span className="text-stone-500">Registered Office</span>
              <div className="font-medium text-stone-800 mt-0.5">
                Indiranagar 100ft Rd, Bengaluru, KA
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/60">
              <span className="text-stone-500">Escrow Security Status</span>
              <div className="font-bold text-[#051F16] mt-0.5">
                Active & Insured (ICICI Bank)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
