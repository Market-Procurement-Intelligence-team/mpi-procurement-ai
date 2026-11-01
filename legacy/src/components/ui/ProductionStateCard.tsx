import React from "react"
import MaterialIcon from "./MaterialIcon"

export type ProductionStateMode = "loading" | "empty" | "error" | "partial"

export interface ProductionStateProps {
  mode: ProductionStateMode
  title?: string
  description?: string
  // Loading specific
  currentStep?: string
  steps?: string[]
  // Empty specific
  emptyReason?: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  // Error specific
  statusCode?: number
  errorMessage?: string
  onRetry?: () => void
  // Partial / Degraded specific (Section 7)
  availableFields?: Array<{ label: string; value: string }>
  missingFields?: string[]
  onRequestInfo?: () => void
  onProceedAnyway?: () => void
  className?: string
}

export const ProductionStateCard: React.FC<ProductionStateProps> = ({
  mode,
  title,
  description,
  currentStep,
  steps,
  emptyReason,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  statusCode,
  errorMessage,
  onRetry,
  availableFields = [],
  missingFields = [],
  onRequestInfo,
  onProceedAnyway,
  className = "",
}) => {
  // ─── 1. LOADING STATE ──────────────────────────────────────────────────────
  if (mode === "loading") {
    return (
      <div className={`p-8 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-center space-y-5 ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#051F16] flex items-center justify-center mx-auto border border-emerald-100/80 animate-pulse">
          <MaterialIcon name="sync" size={24} className="animate-spin text-emerald-800" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: "Plus Jakarta Sans" }}>
            {title || "Processing Procurement Data..."}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {description || "Communicating with national MSME registries and verified ledger nodes."}
          </p>
        </div>

        {currentStep && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C] ring-2 ring-emerald-600/40 animate-pulse" />
            <span>{currentStep}</span>
          </div>
        )}

        {steps && steps.length > 0 && (
          <div className="max-w-md mx-auto pt-2 space-y-2">
            {steps.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-600 text-left">
                <MaterialIcon name="check_circle" size={14} className="text-emerald-700 shrink-0" />
                <span className="truncate">{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── 2. EMPTY STATE (Section 18) ───────────────────────────────────────────
  if (mode === "empty") {
    return (
      <div className={`p-8 sm:p-12 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-center space-y-4 ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
          <MaterialIcon name="inbox" size={24} />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: "Plus Jakarta Sans" }}>
            {title || "No Records Found"}
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            {description || "There are currently no items matching your criteria in this section."}
          </p>
          {emptyReason && (
            <p className="text-[11px] text-slate-400 italic pt-0.5">
              Why: {emptyReason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white cursor-pointer shadow-xs transition-colors"
            >
              <span>{actionLabel}</span>
              <MaterialIcon name="arrow_forward" size={14} className="text-[#A3F65C]" />
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── 3. ERROR STATE ────────────────────────────────────────────────────────
  if (mode === "error") {
    return (
      <div className={`p-8 rounded-2xl bg-white border border-rose-200 shadow-2xs text-center space-y-4 ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <MaterialIcon name="error_outline" size={24} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: "Plus Jakarta Sans" }}>
              {title || "Unable to Load Procurement Data"}
            </h3>
            {statusCode && (
              <span className="text-[10px] font-mono bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                HTTP {statusCode}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            {errorMessage || description || "A transient network error interrupted your request. Please try again."}
          </p>
        </div>

        {onRetry && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white cursor-pointer shadow-xs transition-colors"
            >
              <MaterialIcon name="refresh" size={14} className="text-[#A3F65C]" />
              <span>Retry Request</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─── 4. PARTIAL / DEGRADED STATE (Section 7) ──────────────────────────────
  if (mode === "partial") {
    return (
      <div className={`p-6 sm:p-7 rounded-2xl bg-white border border-amber-200/90 shadow-2xs space-y-4 ${className}`}>
        <div className="flex items-start justify-between gap-3 border-b border-amber-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60">
              <MaterialIcon name="warning_amber" size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: "Plus Jakarta Sans" }}>
                {title || "Partial Match Found — Additional Details Needed"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {description || "Some factory parameters are ready, while secondary specifications require direct supplier confirmation."}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
            PARTIAL DATA
          </span>
        </div>

        {/* Known Verified Fields */}
        {availableFields.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Verified / Available Parameters
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {availableFields.map((f, idx) => (
                <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                  <div className="text-[10px] text-slate-500">{f.label}</div>
                  <div className="font-semibold text-slate-800 truncate">{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing / Unverified Fields */}
        {missingFields.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Missing or Unverified Parameters
            </span>
            <div className="space-y-1 text-xs">
              {missingFields.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-700 bg-amber-50/60 px-2.5 py-1.5 rounded-lg border border-amber-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Choice Gates */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          {onRequestInfo && (
            <button
              type="button"
              onClick={onRequestInfo}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer transition-colors"
            >
              <MaterialIcon name="contact_support" size={14} className="text-slate-600" />
              <span>Request Information from Supplier</span>
            </button>
          )}
          {onProceedAnyway && (
            <button
              type="button"
              onClick={onProceedAnyway}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#051F16] hover:bg-[#083A28] text-white cursor-pointer shadow-2xs transition-colors"
            >
              <span>Continue with Available Data</span>
              <MaterialIcon name="arrow_forward" size={13} className="text-[#A3F65C]" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}

export default ProductionStateCard
