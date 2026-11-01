import React, { useState, useEffect } from "react"
import MaterialIcon from "../ui/MaterialIcon"

export interface StickyPrimaryCTAProps {
  onStartProcurement: () => void
  onRegisterMSME?: () => void
  onViewStandards?: () => void
  isModalOpen?: boolean
}

export default function StickyPrimaryCTA({
  onStartProcurement,
  onRegisterMSME,
  onViewStandards,
  isModalOpen = false,
}: StickyPrimaryCTAProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("mpi_dismiss_sticky_cta") === "true"
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isDismissed) return

    const handleScroll = () => {
      const scrollY = window.scrollY
      const docHeight = document.documentElement.scrollHeight
      const windowHeight = window.innerHeight

      // Show after scrolling past hero (~550px) and hide near footer (~400px from bottom)
      const nearBottom = scrollY + windowHeight >= docHeight - 450
      if (scrollY > 550 && !nearBottom) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isDismissed])

  const handleDismiss = () => {
    setIsDismissed(true)
    try {
      sessionStorage.setItem("mpi_dismiss_sticky_cta", "true")
    } catch {}
  }

  if (isDismissed || !isVisible || isModalOpen) return null

  return (
    <aside
      aria-label="Quick Procurement Action Bar"
      className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:max-w-3xl z-40 transition-all duration-300 motion-reduce:transition-none"
    >
      <div className="bg-[#051F16]/95 backdrop-blur-md text-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-[#0A3525] shadow-[0_12px_40px_rgba(5,31,22,0.45)] flex items-center justify-between gap-3 sm:gap-4 ring-1 ring-emerald-500/20">
        {/* Left Label (Desktop Only) */}
        <div className="hidden lg:flex items-center gap-2 pr-1">
          <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
            Ready to source custom parts or packaging?
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onStartProcurement}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl bg-[#A3F65C] hover:bg-[#92E64B] active:scale-[0.98] text-[#051F16] transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#051F16]"
            aria-label="Start a Procurement Request"
          >
            <MaterialIcon name="auto_awesome" size={14} className="text-[#051F16]" />
            <span className="whitespace-nowrap">Start a Procurement Request</span>
          </button>

          {onViewStandards && (
            <button
              type="button"
              onClick={onViewStandards}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white border border-white/20 transition-all cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-label="View Trust and Verification Standards"
            >
              <MaterialIcon name="verified" size={14} className="text-[#A3F65C]" />
              <span>Standards</span>
            </button>
          )}

          {onRegisterMSME && (
            <button
              type="button"
              onClick={onRegisterMSME}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white border border-white/20 transition-all cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-label="Register as MSME Supplier"
            >
              <span>Join as MSME</span>
            </button>
          )}

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Dismiss quick procurement action bar"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
