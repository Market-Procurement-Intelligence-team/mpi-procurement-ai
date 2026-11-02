import { ReactNode } from "react"
import { Card, DemoTag } from "./shared"

const icon = (type: "spark" | "clock" | "shield" | "rfq" | "arrow") => {
  if (type === "clock") return <span aria-hidden>◷</span>
  if (type === "shield") return <span aria-hidden>◈</span>
  if (type === "rfq") return <span aria-hidden>↗</span>
  if (type === "arrow") return <span aria-hidden>→</span>
  return <span aria-hidden>✦</span>
}

function Metric({
  label,
  value,
  note,
  accent = "#0F2744",
}: {
  label: string
  value: string
  note: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
      <div
        className="text-2xl font-bold text-slate-900 tracking-tight"
        style={{ fontFamily: "Plus Jakarta Sans" }}
      >
        {value}
      </div>
      <div className="text-xs font-semibold text-slate-700 mt-1">{label}</div>
      <div
        className="text-[11px] font-medium mt-1 text-slate-500"
        style={{ color: accent }}
      >
        {note}
      </div>
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
  badge,
}: {
  eyebrow: string
  title: string
  subtitle: string
  badge?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 mb-1">
          {eyebrow}
        </div>
        <div
          className="text-lg font-bold text-slate-900 tracking-tight"
          style={{ fontFamily: "Plus Jakarta Sans" }}
        >
          {title}
        </div>
        <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
      </div>
      {badge}
    </div>
  )
}

export function StartupMPIIntelligence({
  onNewRequest,
}: {
  onNewRequest: () => void
}) {
  const recommendations = [
    {
      name: "Website Development",
      match: 96,
      reason: "Matches your online presence requirement.",
      metric: "AI estimate · 4–7 days",
    },
    {
      name: "Brand Identity Design",
      match: 91,
      reason: "Useful for a consistent startup identity.",
      metric: "AI estimate · 3–6 days",
    },
    {
      name: "GST Filing & Compliance",
      match: 88,
      reason: "Relevant to your stated compliance need.",
      metric: "AI estimate · 1–3 days",
    },
  ]

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-slate-200">
        <div className="rounded-xl p-5 bg-linear-to-r from-slate-50 to-blue-50/40 border border-slate-200/60">
          <SectionTitle
            eyebrow="MPI AI ENGINE"
            title="Procurement Copilot Overview"
            subtitle="Turns your requirements into structured recommendations, RFQs, and vetted decisions."
            badge={<DemoTag label="AI Engine Active" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Metric
              label="Estimated savings"
              value="₹18,400"
              note="Illustrative · AI estimate"
              accent="#059669"
            />
            <Metric
              label="Time saved"
              value="11.5 hrs"
              note="Workflow automation"
              accent="#2563EB"
            />
            <Metric
              label="Active RFQs"
              value="3"
              note="2 awaiting responses"
              accent="#D97706"
            />
            <Metric
              label="Potential matches"
              value="14"
              note="Across active requests"
              accent="#0F2744"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionTitle
            eyebrow="RECOMMENDATIONS"
            title="AI Recommended Sourcing Opportunities"
            subtitle="Generated based on your business stage, profile parameters, and catalog readiness."
          />
          <div className="space-y-3">
            {recommendations.map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:bg-slate-50/50 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                    {icon("spark")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-bold text-slate-900">
                        {item.name}
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/80">
                        {item.match}% fit
                      </span>
                      <DemoTag label="Sourcing Match" />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {item.reason}
                    </div>
                    <div className="text-[11px] font-medium text-slate-400 mt-2">
                      {item.metric}
                    </div>
                  </div>
                  <span className="text-slate-400">{icon("arrow")}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={onNewRequest}
            className="btn-primary w-full mt-4 py-2.5 rounded-lg text-sm font-semibold"
          >
            Create AI-Assisted RFQ →
          </button>
        </Card>

        <Card>
          <SectionTitle
            eyebrow="PROCUREMENT PIPELINE"
            title="RFQ Progress Tracker"
            subtitle="Lifecycle of active procurement."
          />
          <div className="space-y-3 mt-4">
            {[
              ["Draft Specification", true],
              ["AI Parameter Parsing", true],
              ["RFQ Dispatched", true],
              ["Supplier Responses", false],
              ["Matrix Comparison", false],
              ["Order Awarded", false],
              ["Delivery & Completion", false],
            ].map(([label, done], i) => (
              <div key={String(label)} className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    done
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <div
                  className={`text-xs font-semibold ${
                    done ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {String(label)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle
          eyebrow="PRIVACY & GOVERNANCE"
          title="Supplier Identity Protection"
          subtitle="Buyer views use standardized MPI supplier ratings without exposing private supplier documents."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            [
              "Verified Supplier Designation",
              "Use platform-level trust labels in buyer-facing recommendations.",
            ],
            [
              "Private Documents Protected",
              "Sensitive tax records, bank files, and trade secrets remain restricted.",
            ],
            [
              "Human Review & Auditability",
              "AI matching suggestions can be manually overridden with full audit trails.",
            ],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-xl bg-slate-50 border border-slate-200/80 p-4"
            >
              <div className="text-sm font-semibold text-slate-900">
                {title}
              </div>
              <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {body}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function MSMEAIWorkspace({
  onOpportunities,
}: {
  onOpportunities: () => void
}) {
  const priorities = [
    {
      level: "HIGH",
      title: "Respond to RFQ-2048",
      detail: "Quote response window closes in 18 hours.",
      color: "#DC2626",
    },
    {
      level: "HIGH",
      title: "Confirm Pending Order",
      detail: "Order #MPI-118 needs acknowledgement.",
      color: "#DC2626",
    },
    {
      level: "MEDIUM",
      title: "Complete Portfolio Showcase",
      detail: "Add two case studies to improve discoverability score.",
      color: "#D97706",
    },
    {
      level: "LOW",
      title: "Refresh Capability Tags",
      detail: "Keep your matching keywords synchronized with recent jobs.",
      color: "#059669",
    },
  ]

  const metrics = [
    ["Since 2008", "Establishment"],
    ["96%", "Order fulfillment"],
    ["93%", "On-time delivery"],
    ["91%", "Commitment adherence"],
    ["88%", "RFQ response rate"],
    ["4.7 / 5.0", "MPI verified rating"],
  ]

  return (
    <div className="space-y-5">
      <Card>
        <div className="rounded-xl p-5 bg-linear-to-r from-slate-50 to-orange-50/40 border border-slate-200/60">
          <SectionTitle
            eyebrow="SUPPLIER INTELLIGENCE"
            title="Recommended Business Actions"
            subtitle="Prioritized steps to improve response scores, buyer conversion, and match visibility."
            badge={<DemoTag label="Supplier Console" />}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {metrics.map(([value, label]) => (
              <Metric
                key={label}
                label={label}
                value={value}
                note="Verified performance indicator"
                accent="#051F16"
              />
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionTitle
            eyebrow="TASK PRIORITIES"
            title="Action Items"
            subtitle="Complete these to maintain an elite MPI response rating."
          />
          <div className="space-y-3">
            {priorities.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
                  style={{ background: item.color }}
                >
                  {item.level}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {item.detail}
                  </div>
                </div>
                <span className="text-slate-400">{icon("arrow")}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle
            eyebrow="OPPORTUNITY PIPELINE"
            title="Matched Procurement Inquiries"
            subtitle="Filtered against your verified machinery and capabilities."
          />
          <div className="space-y-3">
            {[
              [
                "Custom packaging — 5,000 units",
                "94% fit",
                "Response due tomorrow",
              ],
              [
                "Website redesign — B2B startup",
                "89% fit",
                "Response due in 2 days",
              ],
              ["Compliance support package", "83% fit", "New inquiry today"],
            ].map(([title, fit, timing]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex justify-between items-center gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {title}
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                    {fit}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1.5">{timing}</div>
              </div>
            ))}
          </div>
          <button
            onClick={onOpportunities}
            className="btn-primary w-full mt-4 py-2.5 rounded-lg text-sm font-semibold"
          >
            View All Open Inquiries →
          </button>
        </Card>
      </div>

      <Card>
        <SectionTitle
          eyebrow="TRUST REPUTATION"
          title="Supplier Trust Architecture"
          subtitle="Transparent evaluation of identity, capability, and historical execution reliability."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            [
              "01",
              "Business Identity",
              "Udyam, registration and statutory records.",
            ],
            [
              "02",
              "Verification Review",
              "Submitted capability, machinery, and facility proof.",
            ],
            [
              "03",
              "Catalog & Offerings",
              "Services, MOQ tiers, and turnaround commitments.",
            ],
            [
              "04",
              "Performance Signals",
              "Fulfillment percentage and buyer feedback ratings.",
            ],
          ].map(([n, title, body]) => (
            <div
              key={n}
              className="rounded-xl bg-slate-50 border border-slate-200 p-4"
            >
              <div className="text-xs font-bold text-emerald-700">{n}</div>
              <div className="text-sm font-semibold text-slate-900 mt-2">
                {title}
              </div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                {body}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function AdminMPIControlCenter() {
  const activity = [
    [
      "09:42",
      "Startup requirement parsed",
      "3 matching suppliers suggested",
      "#051F16",
    ],
    [
      "09:37",
      "MSME opportunity prioritized",
      "High priority alert · RFQ-2048",
      "#059669",
    ],
    [
      "09:21",
      "Supplier verification approved",
      "ISO 9001:2015 audit validated",
      "#059669",
    ],
    [
      "09:04",
      "Procurement milestone tracked",
      "Batch delivery confirmed for order #108",
      "#051F16",
    ],
  ]

  return (
    <div className="space-y-5">
      <Card>
        <div className="rounded-xl p-5 bg-gradient-to-r from-slate-50 to-slate-100/60 border border-slate-200">
          <SectionTitle
            eyebrow="ADMIN CONTROL CENTER"
            title="Platform Oversight & Engine Health"
            subtitle="Holistic visibility over startups, verified suppliers, and AI algorithm performance."
            badge={<DemoTag label="Operations Center" />}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Metric
              label="AI recommendations"
              value="183"
              note="Generated this week"
            />
            <Metric
              label="MSME match accuracy"
              value="91%"
              note="Verified match rate"
              accent="#059669"
            />
            <Metric
              label="Open RFQs"
              value="347"
              note="Across 7 sectors"
              accent="#051F16"
            />
            <Metric
              label="Action items"
              value="16"
              note="Awaiting review"
              accent="#059669"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionTitle
            eyebrow="AUDIT TRAIL"
            title="Real-Time Event Activity"
            subtitle="Transparent log of AI decisions and status changes."
          />
          <div className="space-y-2">
            {activity.map(([time, title, detail, color]) => (
              <div
                key={`${time}-${title}`}
                className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="text-[11px] font-mono text-slate-400 pt-0.5 w-12">
                  {time}
                </div>
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {title}
                  </div>
                  <div className="text-xs text-slate-500">{detail}</div>
                </div>
                <span className="text-slate-400">{icon("arrow")}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle
            eyebrow="HEALTH CHECK"
            title="Queue Status"
            subtitle="Pending operational workflows."
          />
          <div className="space-y-2.5 mt-2">
            {[
              ["12", "RFQs awaiting response", "amber"],
              ["4", "Orders pending confirmation", "blue"],
              ["2", "Verification audits pending", "emerald"],
              ["7", "Supplier profile updates", "slate"],
            ].map(([count, label, tone]) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200/80 p-3"
              >
                <div className="text-lg font-bold text-slate-900">{count}</div>
                <div className="flex-1 text-xs font-medium text-slate-600">
                  {label}
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${
                    tone === "amber"
                      ? "bg-amber-500"
                      : tone === "emerald"
                        ? "bg-emerald-500"
                        : tone === "blue"
                          ? "bg-emerald-600"
                          : "bg-slate-400"
                  }`}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
