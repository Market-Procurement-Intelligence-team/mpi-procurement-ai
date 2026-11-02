import React, { useState, useEffect, useRef } from "react"
import MaterialIcon from "../ui/MaterialIcon"
import { CookieCategories, CookieConsentRecord } from "../../services/cookieConsentService"

export interface CookiePreferencesModalProps {
  isOpen: boolean
  currentConsent: CookieConsentRecord | null
  onClose: () => void
  onSavePreferences: (categories: CookieCategories) => void
  onAcceptAll: () => void
  onRejectOptional: () => void
}

interface CategoryConfig {
  id: keyof CookieCategories
  name: string
  badge?: string
  badgeVariant?: "success" | "neutral"
  description: string
  examples: string
  locked?: boolean
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: "necessary",
    name: "Strictly Necessary Cookies",
    badge: "Always Active",
    badgeVariant: "success",
    locked: true,
    description:
      "Essential for core security, session continuity, CSRF tokens, and authentication state. The MPI procurement engine and buyer/supplier portals cannot function safely without these.",
    examples: "mpi_auth_session, csrf_token, procurement_cart_cache",
  },
  {
    id: "preferences",
    name: "Functional & Preference Cookies",
    badge: "Optional",
    badgeVariant: "neutral",
    locked: false,
    description:
      "Enables MPI to remember your personalized settings such as active vertical category filters, regional language translation, dashboard view density, and notification sound alerts.",
    examples: "mpi_lang, mpi_category_pref, workspace_density",
  },
  {
    id: "analytics",
    name: "Performance & Analytics Cookies",
    badge: "Optional",
    badgeVariant: "neutral",
    locked: false,
    description:
      "Collects aggregated, privacy-preserving telemetry on RFQ generation completion times, catalogue search queries, and page responsiveness to help us optimize platform reliability.",
    examples: "mpi_telemetry_id, rfq_funnel_metrics, latency_tracker",
  },
  {
    id: "marketing",
    name: "MSME Announcements & Updates",
    badge: "Optional",
    badgeVariant: "neutral",
    locked: false,
    description:
      "Allows MPI to notify your organization about relevant newly accredited MSME manufacturing clusters, Ministry of MSME subsidy windows, and verified OEM supply batches.",
    examples: "partner_campaign_ref, subsidy_alert_flag",
  },
]

export const CookiePreferencesModal: React.FC<CookiePreferencesModalProps> = ({
  isOpen,
  currentConsent,
  onClose,
  onSavePreferences,
  onAcceptAll,
  onRejectOptional,
}) => {
  const [preferences, setPreferences] = useState<CookieCategories>({
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false,
  })

  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Sync state whenever modal opens or currentConsent changes
  useEffect(() => {
    if (isOpen) {
      if (currentConsent) {
        setPreferences({
          necessary: true,
          preferences: Boolean(currentConsent.categories.preferences),
          analytics: Boolean(currentConsent.categories.analytics),
          marketing: Boolean(currentConsent.categories.marketing),
        })
      } else {
        setPreferences({
          necessary: true,
          preferences: false,
          analytics: false,
          marketing: false,
        })
      }
    }
  }, [isOpen, currentConsent])

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleToggle = (id: keyof CookieCategories) => {
    if (id === "necessary") return // Locked
    setPreferences((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleKeyDownToggle = (
    e: React.KeyboardEvent,
    id: keyof CookieCategories
  ) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      handleToggle(id)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        aria-describedby="cookie-preferences-description"
        className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[92vh] animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 pt-6 pb-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#051F16] text-[#A3F65C] flex items-center justify-center font-bold text-sm shadow-xs border border-[#0A3525]">
              <MaterialIcon name="tune" size={20} className="text-[#A3F65C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="cookie-preferences-title"
                  className="text-lg sm:text-xl font-extrabold text-[#051F16] tracking-tight"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Cookie & Privacy Preferences
                </h2>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-300">
                  GDPR & DPDP Compliant
                </span>
              </div>
              <p
                id="cookie-preferences-description"
                className="text-xs text-slate-500 mt-0.5 leading-snug"
              >
                Control which cookies and data telemetry MPI uses during your procurement sessions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <MaterialIcon name="close" size={20} />
          </button>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-4 flex-1">
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-2.5">
            <MaterialIcon
              name="verified_user"
              size={18}
              className="text-emerald-700 shrink-0 mt-0.5"
            />
            <p className="leading-relaxed">
              MPI strictly respects your privacy. We never sell your corporate procurement data
              or share institutional RFQs with third-party advertising networks. Essential security
              cookies are strictly limited to verified platform operations.
            </p>
          </div>

          {/* Categories List */}
          <div className="space-y-3 pt-1">
            {CATEGORY_CONFIGS.map((cat) => {
              const isChecked = preferences[cat.id]
              const isLocked = Boolean(cat.locked)

              return (
                <div
                  key={cat.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isChecked
                      ? "bg-slate-50/60 border-slate-300/80 shadow-2xs"
                      : "bg-white border-slate-200/70 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 pr-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-sm font-bold text-slate-900"
                          style={{ fontFamily: "Plus Jakarta Sans" }}
                        >
                          {cat.name}
                        </span>

                        {cat.badge && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              cat.badgeVariant === "success"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {cat.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {cat.description}
                      </p>

                      {showTechnicalDetails && (
                        <div className="pt-2">
                          <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Identifier: {cat.examples}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Accessible Toggle Switch */}
                    <div className="shrink-0 pt-0.5">
                      {isLocked ? (
                        <div
                          className="w-12 h-6 rounded-full bg-[#051F16] flex items-center justify-end px-1 opacity-70 cursor-not-allowed border border-[#0A3525]"
                          title="Necessary cookies cannot be disabled"
                          aria-label={`${cat.name} is always enabled`}
                        >
                          <div className="w-4 h-4 rounded-full bg-[#A3F65C] shadow-xs flex items-center justify-center">
                            <MaterialIcon name="lock" size={10} className="text-[#051F16]" />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isChecked}
                          aria-label={`Enable or disable ${cat.name}`}
                          onClick={() => handleToggle(cat.id)}
                          onKeyDown={(e) => handleKeyDownToggle(e, cat.id)}
                          className={`w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#051F16] flex items-center px-1 ${
                            isChecked
                              ? "bg-[#051F16] justify-end border border-[#0A3525]"
                              : "bg-slate-300 justify-start border border-slate-300"
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full shadow-xs transition-transform duration-200 block ${
                              isChecked
                                ? "bg-[#A3F65C]"
                                : "bg-white"
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Technical Details Toggle */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails((prev) => !prev)}
              className="text-xs font-semibold text-slate-500 hover:text-[#051F16] transition-colors inline-flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-100"
            >
              <MaterialIcon
                name={showTechnicalDetails ? "expand_less" : "expand_more"}
                size={16}
              />
              <span>
                {showTechnicalDetails
                  ? "Hide Technical Cookie Names"
                  : "View Technical Cookie Names & Identifiers"}
              </span>
            </button>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-200/90 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRejectOptional}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] flex items-center justify-center active:scale-[0.98]"
          >
            Reject Optional
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onAcceptAll}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] flex items-center justify-center active:scale-[0.98]"
            >
              Accept All
            </button>

            <button
              type="button"
              onClick={() => onSavePreferences(preferences)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 border border-[#0A3525] active:scale-[0.98]"
            >
              <MaterialIcon name="check" size={16} className="text-[#A3F65C]" />
              <span>Save Preferences</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CookiePreferencesModal
