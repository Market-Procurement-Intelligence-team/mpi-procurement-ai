import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  MULTILINGUAL_AI_PARSER_DEMO_DATA,
  MultilingualDemoItem,
} from "../../data/multilingualAiParserData"

interface MultilingualAiParserDemoProps {
  className?: string
  intervalMs?: number
}

/**
 * MultilingualAiParserDemo
 * 
 * Synchronously cycles through all 8 supported Indian languages:
 * EN -> HI -> TA -> TE -> MR -> BN -> GU -> KN -> loop.
 * 
 * Features:
 * - 100% synchronized input prompt and structured request draft.
 * - Restrained, premium fade + subtle slide transition.
 * - Automatic pause on mouse hover or keyboard focus.
 * - Page Visibility & IntersectionObserver awareness (pauses off-screen / background).
 * - Respects `prefers-reduced-motion`.
 * - Fixed minimum layout bounds to prevent layout shifts.
 * - Preserves canonical `data-cinematic` attributes for existing GSAP ScrollTrigger.
 */
export default function MultilingualAiParserDemo({
  className = "",
  intervalMs = 4000,
}: MultilingualAiParserDemoProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false)
  const [isInView, setIsInView] = useState<boolean>(true)

  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. Accessibility: Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  // 2. Viewport optimization: Pause when scrolled off-screen
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return
    const el = cardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        setIsInView(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 3. Tab visibility optimization: Pause when backgrounded
  useEffect(() => {
    if (typeof document === "undefined") return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true)
      } else {
        setIsPaused(false)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // 4. Smooth language transition step
  const advanceLanguage = useCallback(() => {
    if (prefersReducedMotion) {
      // Instant switch without motion
      setCurrentIndex((prev) => (prev + 1) % MULTILINGUAL_AI_PARSER_DEMO_DATA.length)
      return
    }

    // Phase A: Subtle fade-out
    setIsTransitioning(true)

    setTimeout(() => {
      // Phase B: Switch content in lockstep
      setCurrentIndex((prev) => (prev + 1) % MULTILINGUAL_AI_PARSER_DEMO_DATA.length)

      // Phase C: Fade back in
      setTimeout(() => {
        setIsTransitioning(false)
      }, 50)
    }, 220)
  }, [prefersReducedMotion])

  // 5. Timer loop lifecycle
  useEffect(() => {
    if (isPaused || !isInView) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setTimeout(() => {
      advanceLanguage()
    }, intervalMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentIndex, isPaused, isInView, intervalMs, advanceLanguage])

  const currentItem: MultilingualDemoItem =
    MULTILINGUAL_AI_PARSER_DEMO_DATA[currentIndex] || MULTILINGUAL_AI_PARSER_DEMO_DATA[0]

  return (
    <div
      ref={cardRef}
      data-cinematic="discovery-visual"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      className={`bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4 select-text ${className}`}
      aria-label="Multilingual AI parser procurement intake demonstration"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-500 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <span
            className={`transition-opacity duration-200 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {currentItem.inputBadge}
          </span>
          {/* Active Language Pill */}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100/70 text-emerald-800 font-sans tracking-normal border border-emerald-200/60 uppercase">
            {currentItem.code} • {currentItem.nativeName}
          </span>
        </div>

        <span className="text-emerald-700 font-bold shrink-0">
          {currentItem.parserStatus}
        </span>
      </div>

      {/* Input Prompt Box (Height stabilized to prevent layout shifts) */}
      <div
        data-cinematic="discovery-input"
        className="p-4 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium min-h-[88px] sm:min-h-[80px] flex items-center"
      >
        <p
          className={`w-full transition-all duration-200 ${
            isTransitioning && !prefersReducedMotion
              ? "opacity-0 translate-y-1.5"
              : "opacity-100 translate-y-0"
          }`}
        >
          {currentItem.inputPrompt}
        </p>
      </div>

      {/* Structured Output Box (Height stabilized to prevent layout shifts) */}
      <div
        data-cinematic="discovery-output"
        className="p-4 bg-[#051F16] text-white rounded-xl text-xs space-y-2.5 font-mono border border-[#0A3525] min-h-[292px] sm:min-h-[268px] flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span
              className={`text-[#A3F65C] font-bold tracking-wider transition-opacity duration-200 ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              {currentItem.outputBadge}
            </span>
            <span
              className={`text-[10px] text-slate-400 font-sans transition-opacity duration-200 ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              {currentItem.outputStatus}
            </span>
          </div>

          {/* 5 Structured Fields */}
          <div
            className={`text-slate-200 text-[11px] space-y-1.5 pt-2 transition-all duration-200 ${
              isTransitioning && !prefersReducedMotion
                ? "opacity-0 translate-y-1.5"
                : "opacity-100 translate-y-0"
            }`}
          >
            {currentItem.fields.map((field, idx) => (
              <div
                key={idx}
                data-cinematic="discovery-item"
                className="flex items-start gap-2"
              >
                <span className="text-[#A3F65C] shrink-0">•</span>
                <span className="leading-snug">
                  <strong className="text-white font-semibold mr-1.5">
                    {field.label}
                  </strong>
                  <span>{field.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 8-Language Cycle Indicator Dots */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-sans select-none">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Auto-Translating (8 Languages)</span>
          </span>

          <div className="flex items-center gap-1">
            {MULTILINGUAL_AI_PARSER_DEMO_DATA.map((lang, idx) => {
              const isActive = idx === currentIndex
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx)
                    setIsPaused(true)
                  }}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#A3F65C] w-4"
                      : "bg-white/20 hover:bg-white/50"
                  }`}
                  title={`${lang.languageName} (${lang.nativeName})`}
                  aria-label={`Switch demo to ${lang.languageName}`}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

