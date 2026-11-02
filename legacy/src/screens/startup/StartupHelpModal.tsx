import React from "react"
import { Icons, MPIButton } from "../../components/design-system/MPIDesignSystem"
import { StartupBusinessProfile } from "../../context/ProcurementContext"

interface StartupHelpModalProps {
  isOpen: boolean
  onClose: () => void
  startupProfile?: StartupBusinessProfile
}

export default function StartupHelpModal({
  isOpen,
  onClose,
  startupProfile,
}: StartupHelpModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold shadow-xs">
              <Icons.HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3
                className="text-base sm:text-lg font-extrabold text-[#051F16]"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Procurement Concierge & Support
              </h3>
              <p className="text-xs text-slate-500">
                Direct statutory and technical assistance for startup buyers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs text-slate-600">
          <div className="p-3.5 bg-[#F4FBF7] rounded-xl border border-emerald-200/80 flex items-center justify-between">
            <div>
              <div className="font-bold text-[#051F16]">
                Priority Founder SLA Hotline
              </div>
              <div className="text-[11px] text-slate-500">
                Direct phone & WhatsApp technical advisory
              </div>
            </div>
            <a
              href="tel:+918006743221"
              className="px-3 py-1.5 bg-[#051F16] text-[#A3F65C] font-bold rounded-lg hover:bg-[#0A3525] transition-colors"
            >
              1800-MSME-PROC
            </a>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">
                Technical Specification Review Desk
              </div>
              <div className="text-[11px] text-slate-500">
                CAD tolerance validation & tooling feasibility
              </div>
            </div>
            <a
              href="mailto:support@mpi-procure.in"
              className="text-xs font-bold text-[#051F16] hover:underline"
            >
              support@mpi-procure.in
            </a>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Icons.ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Tripartite Escrow & Dispute Mediation Policy</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All commercial funds deposited into MPI milestone escrow remain
              100% protected until physical delivery passes your specified QC
              criteria. If a supplier fails dimensional checks, funds are held
              under MPI mediation protocol.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Account: {startupProfile?.startupName || "TechNova Innovations"}
          </span>
          <MPIButton variant="primary" size="sm" onClick={onClose}>
            Got it, Close
          </MPIButton>
        </div>
      </div>
    </div>
  )
}
