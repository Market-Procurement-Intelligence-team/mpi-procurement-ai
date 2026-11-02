import React from "react"
import MaterialIcon from "../ui/MaterialIcon"

export interface CookieConsentBannerProps {
  isOpen: boolean
  onAcceptAll: () => void
  onRejectOptional: () => void
  onOpenPreferences: () => void
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  isOpen,
  onAcceptAll,
  onRejectOptional,
  onOpenPreferences,
}) => {
  if (!isOpen) return null

  return (
    <aside
      role="region"
      aria-label="Cookie and Privacy Consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-fade-in-up"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.16)] p-5 sm:p-6 space-y-4 overflow-hidden relative">
        {/* Subtle decorative accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#051F16] via-emerald-600 to-[#A3F65C]" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs border border-[#0A3525]">
              <MaterialIcon name="shield" size={18} className="text-[#A3F65C]" />
            </div>
            <div>
              <h3
                className="text-base font-extrabold text-[#051F16] tracking-tight leading-snug"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                We use cookies
              </h3>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-bold">
                MPI Privacy & Security
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onRejectOptional}
            aria-label="Dismiss cookie notice with essential cookies only"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <MaterialIcon name="close" size={16} />
          </button>
        </div>

        {/* Body Text */}
        <p className="text-xs text-slate-600 leading-relaxed font-normal">
          We use essential cookies to keep MPI working and optional cookies to understand
          usage and improve your experience.
        </p>

        {/* Action Buttons */}
        <div className="pt-1 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRejectOptional}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all duration-150 cursor-pointer min-h-[44px] flex items-center justify-center active:scale-[0.98]"
            >
              Reject Optional
            </button>

            <button
              type="button"
              onClick={onAcceptAll}
              className="w-full py-2.5 px-3 rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 border border-[#0A3525] active:scale-[0.98]"
            >
              <MaterialIcon name="check" size={14} className="text-[#A3F65C]" />
              <span>Accept All</span>
            </button>
          </div>

          {/* Preferences Link */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 px-1">
            <button
              type="button"
              onClick={onOpenPreferences}
              className="font-semibold text-slate-600 hover:text-[#051F16] transition-colors cursor-pointer underline-offset-2 hover:underline flex items-center gap-1 py-1"
            >
              <MaterialIcon name="tune" size={13} className="text-slate-500" />
              <span>Cookie Preferences</span>
            </button>

            <span className="text-[10px] text-slate-400 font-mono">
              DPDP • ISO 27001
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default CookieConsentBanner
