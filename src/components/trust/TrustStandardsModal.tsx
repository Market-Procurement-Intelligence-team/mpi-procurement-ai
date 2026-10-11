import React, { useState, useEffect } from "react"
import MaterialIcon from "../ui/MaterialIcon"

export interface TrustStandardsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: "verification" | "standards" | "milestones" | "savings"
  onPrimaryAction?: () => void
}

export default function TrustStandardsModal({
  isOpen,
  onClose,
  initialTab = "verification",
  onPrimaryAction,
}: TrustStandardsModalProps) {
  const [activeTab, setActiveTab] = useState<"verification" | "standards" | "milestones" | "savings">(initialTab)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Close on Escape key press
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trust-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold text-sm shadow-xs border border-[#0A3525]">
              <MaterialIcon name="verified_user" size={18} className="text-[#A3F65C]" />
            </div>
            <div>
              <h3 id="trust-modal-title" className="text-base font-extrabold text-[#051F16] tracking-tight">
                MPI Trust, Verification & Governance Framework
              </h3>
              <p className="text-[11px] text-slate-500">
                Institutional standards protecting Indian startup buyers and MSME manufacturers
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

        {/* Tab Strip */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 gap-1 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("verification")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "verification"
                ? "border-[#051F16] text-[#051F16]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            1. Supplier Verification
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("standards")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "standards"
                ? "border-[#051F16] text-[#051F16]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            2. Statutory Schemes & Standards
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("milestones")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "milestones"
                ? "border-[#051F16] text-[#051F16]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            3. Milestone Governance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("savings")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "savings"
                ? "border-[#051F16] text-[#051F16]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            4. Reverse-Margin Methodology
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
          {/* TAB 1: SUPPLIER VERIFICATION PROCESS */}
          {activeTab === "verification" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <span className="font-bold text-emerald-950 block text-xs mb-1">
                  Transparent Two-Tier Verification Policy
                </span>
                <p className="text-[11px] text-emerald-900 leading-normal">
                  MPI does not label a manufacturer "Verified" simply because they completed a registration form.
                  We maintain a strict boundary between initial self-declarations and administrator-audited credentials.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span>Tier 1: Self-Declared</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Entered directly by the supplier during onboarding (stated machinery types, floor capacity, Udyam registration number, and self-reported tolerances).
                  </p>
                  <div className="text-[10px] font-mono text-slate-400 bg-slate-50 p-2 rounded">
                    Displayed with a neutral "Self-Declared" badge until audited.
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[#051F16] text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span>Tier 2: Administrator Audited</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Documented verification by MPI platform operations. Includes active GSTIN filing verification, Udyam ministry certificate match, and uploaded statutory audit certificates.
                  </p>
                  <div className="text-[10px] font-mono text-emerald-800 bg-emerald-100/60 p-2 rounded">
                    Displays official "MPI Verified" green badge in marketplace.
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 text-xs block">Audit Verification Steps:</span>
                <ul className="space-y-1 text-[11px] text-slate-600 list-disc pl-4">
                  <li><strong>Active GSTIN Validation:</strong> Confirmation that taxpayer status is active with regular GSTR-3B filings.</li>
                  <li><strong>Udyam Registration Audit:</strong> Cross-check against MSME Ministry enterprise classification (Micro, Small, Medium).</li>
                  <li><strong>Machinery Ownership Verification:</strong> Validation of operational capital equipment, CNC axes, press capacity, or cleanroom standards.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: STATUTORY SCHEMES & STANDARDS */}
          {activeTab === "standards" && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-600">
                MPI is an independent private B2B procurement intelligence platform that aligns Indian startup procurement requirements with official government assistance frameworks.
              </p>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">MSME ZED Certification Scheme</span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">Zero Defect • Zero Effect</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Financial assistance up to 80% on audit and quality certification expenses. Suppliers holding ZED Bronze, Silver, or Gold have demonstrated audited quality controls, reducing product defect rates.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Startup India Seed Fund Scheme (SISFS)</span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">DPIIT Framework</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Enables eligible DPIIT-recognized startups to allocate grant capital toward proof-of-concept, prototyping, and initial batch tooling with statutory compliance audit trails.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">ISO 9001:2015 & NABL Standards</span>
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">Quality Testing</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Quality management standards and third-party laboratory tests (drop tests, burst strength, tensile testing, and CMM dimensional inspections).
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 text-[11px] text-slate-500">
                <strong>Statutory Notice:</strong> Government subsidies and grants are subject to ministry guidelines and post-fulfillment invoice audit. MPI provides pre-configured documentation and eligibility matching but is not a government agency.
              </div>
            </div>
          )}

          {/* TAB 3: MILESTONE GOVERNANCE & PAYMENT PROTECTION */}
          {activeTab === "milestones" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 block text-xs mb-1">
                  How Milestone-Governed Payments Work
                </span>
                <p className="text-[11px] text-slate-600">
                  Instead of forcing startups to transfer 100% upfront advances to unfamiliar factories, MPI structures every commercial agreement around inspection-backed milestone release gates.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="w-6 h-6 rounded-full bg-[#051F16] text-[#A3F65C] font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">Milestone 1: 30% Mobilization Deposit</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Committed to initiate raw material procurement and machine setup upon counter-signed purchase specifications.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="w-6 h-6 rounded-full bg-[#051F16] text-[#A3F65C] font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">Milestone 2: Pre-Dispatch Quality Inspection (QA Gate)</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Batch samples undergo documented drop tests, dimensional inspection, or photo/video sign-off before dispatch from the supplier facility.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="w-6 h-6 rounded-full bg-[#051F16] text-[#A3F65C] font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">Milestone 3: 70% Landed Balance Settlement</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Released following delivery tracking confirmation and final physical receipt inspection at the startup destination.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 italic">
                *Payment terms are contractually defined between buyer and supplier using MPI's standardized procurement contracts and dispute triage mechanisms.
              </p>
            </div>
          )}

          {/* TAB 4: REVERSE-MARGIN METHODOLOGY */}
          {activeTab === "savings" && (
            <div className="space-y-4">
              <span className="font-bold text-slate-800 block text-xs">
                Deconstructing Sourcing Savings (upto 18-32% Benchmark)
              </span>
              <p className="text-[11px] text-slate-600">
                Traditional industrial procurement involves multi-tier brokers, regional agents, and undisclosed trade markups that inflate final unit costs. MPI replaces opaque quotes with transparent reverse-margin breakdowns.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 text-xs block">Every Quotation Decomposes Into:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Cost Item 1</span>
                    <span className="font-semibold text-slate-800">Base Tooling & Dies</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Cost Item 2</span>
                    <span className="font-semibold text-slate-800">Raw Material & Substrate</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Cost Item 3</span>
                    <span className="font-semibold text-slate-800">Machine Run-Time</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Cost Item 4</span>
                    <span className="font-semibold text-slate-800">QA Lab Testing</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Cost Item 5</span>
                    <span className="font-semibold text-slate-800">Logistics & Packaging</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Tax Compliance</span>
                    <span className="font-semibold text-slate-800">Statutory GST (18%)</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                <strong>Methodology Citation:</strong> Savings percentages are derived by benchmarking direct itemized factory bids against prevailing regional broker quotations for comparable custom batch volumes across Peenya, Chakan, and Okhla corridors.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            MPI Trust & Quality Assurance Framework
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
            {onPrimaryAction && (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#051F16] text-[#A3F65C] hover:bg-[#083A28] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span>Start Procurement</span>
                <MaterialIcon name="arrow_forward" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
